'use strict';
// Dependency-free functions bundled verbatim into the exported n8n Code nodes.
const INTENTS = ['order_status', 'product_query', 'return_refund', 'complaint', 'other'];
const AUDIT = 'email_id,received_at,from_email,intent,secondary_intent,order_id,language,sentiment,confidence,order_found,action_taken,needs_human,ticket_id,reply_draft,prompt_version,processed_at,error,notes'.split(',');
const TICKETS = 'ticket_id,created_at,updated_at,order_id,customer_email,email_ids,intent,priority,status,summary,notes'.split(',');
function parseJSON(raw) {
  if (typeof raw === 'object' && raw !== null) return raw;
  return JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}
function validateClassification(value, email) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['not an object'];
  if (!INTENTS.includes(value.intent)) errors.push('intent');
  if (!(value.secondary_intent === null || INTENTS.includes(value.secondary_intent))) errors.push('secondary_intent');
  if (!(value.order_id === null || (typeof value.order_id === 'string' && /^KC-[0-9]{4}$/.test(value.order_id)))) errors.push('order_id');
  if (!['positive','neutral','negative','angry'].includes(value.sentiment)) errors.push('sentiment');
  if (!['en','hi','hinglish'].includes(value.language)) errors.push('language');
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) errors.push('confidence');
  if (typeof value.summary !== 'string' || [...value.summary].length > 200) errors.push('summary');
  if (email && value.order_id && !(email.subject + '\n' + email.body).includes(value.order_id)) errors.push('order_id not mentioned');
  return errors;
}
function classification(raw, email, final = false) {
  let value, errors;
  try { value = parseJSON(raw); errors = validateClassification(value, email); }
  catch { errors = ['invalid JSON']; }
  if (!errors.length) return { classification: value, valid: true, errors: [] };
  if (!final) return { classification: null, valid: false, errors };
  return { classification: { intent:'other', secondary_intent:null, order_id:null, sentiment:'neutral', language:'en', confidence:0, summary:'Classification failed; human review required.' }, valid:false, errors };
}
function normalizeEmail(s) { return String(s || '').trim().toLowerCase(); }
function lookup(email, id, orders) {
  const sender = normalizeEmail(email.from.email);
  const matches = id ? orders.filter(o => o.order_id === id) : orders.filter(o => normalizeEmail(o.customer_email) === sender);
  if (!matches.length) return { result:'not_found' };
  if (matches.length !== 1) return { result:'ambiguous' };
  const o = matches[0];
  if (normalizeEmail(o.customer_email) !== sender) return { result:'not_authorized' };
  // Address and customer email never leave this boundary, including on successful lookup.
  const { shipping_address, customer_email, customer_name, ...safe } = o;
  return { result:'found', order:safe };
}
function calendarDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return NaN;
  const ms = Date.parse(s + 'T00:00:00+05:30');
  return Number.isFinite(ms) && new Date(ms + 19800000).toISOString().slice(0,10) === s ? ms / 86400000 : NaN;
}
function basePolicy(email, c, orders, threshold = 0.85) {
  const text = email.subject + '\n' + email.body;
  const reasons = [];
  const intents = new Set([c.intent, c.secondary_intent]);
  // Safety detection cannot grant permissions. A missed pattern never makes a refund executable.
  const injection = /ignore (?:all |any )?(?:previous|prior)|system note|system prompt|do not create (?:any )?ticket|set priority|reply exactly/i.test(text);
  const medical = /eczema|psoriasis|pregnan|allerg|reaction|rash|burning|swelling|cure|treat (?:my|a |the )/i.test(text);
  const reaction = /reaction|rash|burning|swelling/i.test(text);
  const issue = /wrong (?:item|product)|instead\b/i.test(text) ? 'wrong' : /missing|only had/i.test(text) ? 'missing' : /crack|leak|damag|spilled/i.test(text) ? 'damaged' : 'ordinary';
  const used = /\bused\b|been using|using .{0,40}(?:days|weeks)|didn't suit|did not suit|no difference|didn't see results/i.test(text);
  const sealed = /unopened|still sealed|never opened|all seals intact/i.test(text);
  const ticketRequired = intents.has('return_refund') || intents.has('complaint');
  const needsOrder = ticketRequired || intents.has('order_status');
  const toolOrder = needsOrder ? lookup(email, c.order_id, orders) : { result:'not_requested' };
  const o = toolOrder.order;
  if (c.confidence < threshold) reasons.push('low_classification_confidence');
  if (injection) reasons.push('untrusted_instruction_attempt');
  if (medical) reasons.push(reaction ? 'reported_reaction' : 'medical_question');
  if (c.sentiment === 'angry') reasons.push('angry_customer');
  if (needsOrder && toolOrder.result !== 'found') reasons.push('order_' + toolOrder.result);
  let eligibility = { state:'not_applicable' };
  if (ticketRequired) {
    reasons.push('human_must_review_ticket_no_operational_action');
    if (!o) eligibility = { state:'unknown', reason:'No authorized order available.' };
    else {
      const receivedDay = calendarDay(new Date(Date.parse(email.received_at) + 19800000).toISOString().slice(0,10));
      const deliveredDay = calendarDay(o.delivered_date);
      const days = receivedDay - deliveredDay;
      if (!Number.isFinite(deliveredDay) || days < 0) eligibility = {state:'unknown', reason:'Missing or inconsistent delivery date.'};
      else if (issue !== 'ordinary') {
        // Delivery time is absent. Calculate an interval, never pretend midnight is exact delivery time.
        const ageMaxHours = (Date.parse(email.received_at) - deliveredDay * 86400000) / 3600000;
        const ageMinHours = Math.max(0, ageMaxHours - 24);
        eligibility = { state: ageMaxHours <= 48 ? 'within_reporting_window_pending_verification' : ageMinHours > 48 ? 'outside_reporting_window_needs_review' : 'reporting_boundary_unknown', issue, age_min_hours:ageMinHours, age_max_hours:ageMaxHours, photos_listed:email.attachments || [], photos_verified:false, packing_weight_verified:false, remedy:'FAQ section 5; human verification required; no refund or replacement executed.' };
        eligibility.customer_requested_remedy = /replacement/i.test(text) ? 'replacement' : /refund/i.test(text) ? 'refund' : /correct items/i.test(text) ? 'correct_items' : 'unspecified';
        if (issue === 'missing') {
          const claimed = o.items.filter(i=>text.toLowerCase().includes(i.name.replace(/\s+\d+\s*(?:ml|g)\b/i,'').trim().toLowerCase()));
          // Only a uniquely named single-quantity item can have a deterministic proposed value.
          eligibility.missing_item_value = claimed.length === 1 && claimed[0].qty === 1 ? claimed[0].unit_price : null;
          eligibility.missing_item_refund = 'Only missing item value, after packing-weight verification; no full-order approval.';
        }
        reasons.push('item_issue_verification_required');
      } else {
        const state = days > 7 || used ? 'ineligible' : sealed ? 'eligible_pending_pickup_and_qc' : 'condition_confirmation_required';
        eligibility = { state, days_since_delivery:days, used_claim:used, unopened_claim:sealed, complete_set_required:o.items.some(i=>i.sku === 'KC-KIT-BRD'), reason:days > 7 ? 'Outside seven-day window.' : used ? 'Opened/used products excluded.' : 'Customer claims are not quality verification.', payment_method:o.payment_method, merchandise_value:o.subtotal, nonrefundable_fees:o.shipping_fee + o.cod_fee, refund_method:o.payment_method === 'cod' ? 'UPI or bank transfer; details only after pickup.' : 'Original payment method.', refund_timing:'5–7 business days after returned item passes quality check.', pickup_executed:false, refund_approved:false };
      }
    }
  }
  if (c.intent === 'other' && /invoice|gst|collab|partnership|wholesale|press/i.test(text)) reasons.push('manual_business_or_unsupported_request');
  return { tool_order:toolOrder, eligibility, ticket_required:ticketRequired, priority:intents.has('complaint') ? 'High' : 'Normal', needs_order:needsOrder, reasons, injection, medical, reaction, issue };
}
function rows(values, headers) {
  if (!Array.isArray(values) || !values.length || JSON.stringify(values[0]) !== JSON.stringify(headers)) throw new Error('Sheet headers must exactly match supplied CSV; stop before writing.');
  return values.slice(1).map((r,i)=>({row:i+2, ...Object.fromEntries(headers.map((h,j)=>[h,r[j] ?? '']))}));
}
function ticketPlan(ctx, values, now) {
  const existing = rows(values, TICKETS);
  if (!ctx.policy.ticket_required) return { required:false, ticket_id:'' };
  const c = ctx.classification, e = ctx.email;
  // An explicit but unauthorized ID is retained internally; it is never an authorization to disclose it.
  const id = ctx.policy.tool_order.order?.order_id || c.order_id || '';
  const matches = id ? existing.filter(r=>r.order_id === id && r.status !== 'Closed') : existing.filter(r=>!r.order_id && String(r.email_ids).split(',').includes(e.id));
  if (matches.length > 1) throw new Error('Multiple open tickets for one order; resolve manually before retry.');
  const old = matches[0];
  const ticket_id = old?.ticket_id || ('TKT-' + (id || e.id) + '-' + (existing.length + 1));
  const linked = old ? String(old.email_ids).split(',').filter(Boolean) : [];
  const alreadyLinked = linked.includes(e.id);
  if (!alreadyLinked) linked.push(e.id);
  const note = `${now} ${e.id}: ${c.summary} | eligibility=${ctx.policy.eligibility.state}; requested_remedy=${ctx.policy.eligibility.customer_requested_remedy || 'return_refund'}; attachments=${(e.attachments || []).join(',') || 'none'} (unverified)`;
  const obj = {ticket_id, created_at:old?.created_at || now, updated_at:alreadyLinked ? old.updated_at : now, order_id:id, customer_email:old?.customer_email || e.from.email, email_ids:linked.join(','), intent:old?.intent === 'complaint' || c.intent === 'complaint' || c.secondary_intent === 'complaint' ? 'complaint' : 'return_refund', priority:old?.priority === 'High' || ctx.policy.priority === 'High' ? 'High' : 'Normal', status:old?.status || 'Open', summary:alreadyLinked ? old.summary : c.summary, notes:alreadyLinked ? old.notes : [old?.notes,note].filter(Boolean).join('\n')};
  return {required:true, ticket_id, row:old?.row || existing.length+2, values:[TICKETS.map(h=>obj[h])], object:obj};
}
function safeDraft(email, reason, medical = false, reaction = false) {
  const name = String(email.from.name || '').split(/\s+/)[0].replace(/[^\p{L}\p{M}-]/gu,'') || 'there';
  const safety = reaction ? 'Please stop using the product immediately and consult a doctor. ' : medical ? 'Our products are cosmetics, not medicines, and are not intended to diagnose, treat or cure medical conditions. Please consult a dermatologist or doctor before use. ' : '';
  return `Hi ${name},\n\n${safety}${reason || 'Your request needs a team member’s review.'} Thank you for your patience. A team member will follow up within 24 business hours.\n\nWarm regards,\nTeam Kesar`;
}
function auditPlan(ctx, draft, ticket, values, now) {
  const existing = rows(values,AUDIT), c = ctx.classification, e = ctx.email;
  const matches = existing.filter(r=>r.email_id === e.id);
  if (matches.length > 1) throw new Error('Duplicate audit IDs; repair manually.');
  const reasons = [...new Set([...ctx.policy.reasons,...draft.reasons,...(ctx.classification_errors?.length ? ['classification_fallback'] : [])])];
  const obj = { email_id:e.id, received_at:e.received_at, from_email:e.from.email, intent:c.intent, secondary_intent:c.secondary_intent ?? '', order_id:ctx.policy.tool_order.order?.order_id || c.order_id || '', language:c.language, sentiment:c.sentiment, confidence:c.confidence, order_found:ctx.policy.tool_order.result === 'found', action_taken:ticket.required ? 'ticket_and_draft' : draft.reply_draft ? 'draft_reply' : 'log_only', needs_human:reasons.length > 0, ticket_id:ticket.ticket_id || '', reply_draft:draft.reply_draft, prompt_version:'v2.1', processed_at:now, error:(ctx.classification_errors || []).join('; '), notes:JSON.stringify({run_id:ctx.config.run_id,extracted_order_id:c.order_id,reasons,eligibility:ctx.policy.eligibility,tools:draft.tool_names,first_try_valid:ctx.first_try_valid,classification_repaired:ctx.classification_repaired,v2:draft.telemetry || {},latency_ms:Math.max(0,Date.parse(now)-(ctx.started_at_ms || Date.parse(now)))}) };
  return {row:matches[0]?.row || existing.length+2, values:[AUDIT.map(h=>obj[h])], object:obj};
}
// V2 separates agent semantics, bounded tool/semantic repair and presentation.
function needsDraft(ctx) {
  return [ctx.classification.intent,ctx.classification.secondary_intent].some(i=>i && i !== 'other');
}
function toolPlan(ctx) {
  if (!needsDraft(ctx)) return {required:[],faq_sections:[]};
  const p=ctx.policy, text=ctx.email.subject+'\n'+ctx.email.body;
  let sections;
  if (p.medical) sections=[8];
  else if (p.ticket_required) sections=p.issue === 'ordinary'?[4,6]:[5,6];
  else if (p.needs_order) sections=p.tool_order.order?.status === 'cancelled'?[3]:[1,...(p.tool_order.order?.payment_method === 'cod'?[2]:[])];
  else if (/delivery|shipping|COD|डिलीवरी/i.test(text)) sections=[1,2,7];
  else sections=[7,8];
  return {required:p.needs_order?['get_order','search_faq']:['search_faq'],faq_sections:sections,lookup_outcome:p.tool_order.result};
}
function unpackBody(s) {
  let body=String(s || '').normalize('NFC').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/\*\*/g,'').trim();
  let old;
  do {
    old=body;
    body=body.replace(/^(?:Hi|Hello|Dear|नमस्ते|नमस्कार)(?=\s|[,!])[^\n,!]{0,65}[,!]\s*/iu,'').replace(/^(?:Hi|Hello|Dear)\s+[^\n]{1,60}\n+/i,'').trim();
    body=body.replace(/(?:^|\n|\s)(?:Warm regards|Kind regards|Best regards|Regards|धन्यवाद|सादर)[,!:.]?\s*(?:Team Kesar)?\s*$/iu,'').replace(/(?:^|\n)Team Kesar\s*$/i,'').trim();
  } while(body !== old);
  return body.replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function sentences(body) {
  return unpackBody(body).replace(/https?:\/\/\S+/g,'LINK').replace(/\b(?:Rs|ml)\./g,'UNIT').replace(/(\d)\.(\d)/g,'$1$2').split(/[.!?।]+/u).map(s=>s.trim()).filter(Boolean);
}
function formatBrand(email,content,language='en') {
  let body=unpackBody(content).replace(/\p{Extended_Pictographic}(?:\uFE0F)?/gu,'').replace(/!+/g,'.').trim();
  if (!body) return '';
  // A short courtesy adds no policy or operational assertion; never truncate meaningful content.
  const courtesy=language==='hi'?'किसी और सहायता के लिए हमें बताएं।':language==='hinglish'?'Aur madad chahiye toh humein batayein.':'Please let us know if you need any further help.';
  if(sentences(body).length<2) body+=(/[.!?।]$/.test(body)?' ':'. ')+(language==='hi'?'संपर्क करने के लिए धन्यवाद।':language==='hinglish'?'Sampark karne ke liye dhanyavaad.':'Thank you for contacting us.');
  if(sentences(body).length<3) body+=(/[.!?।]$/.test(body)?' ':'. ')+courtesy;
  const name=String(email.from.name).split(/\s+/)[0].replace(/[^\p{L}\p{M}-]/gu,'') || 'there';
  return `Hi ${name},\n\n${body}\n\nWarm regards,\nTeam Kesar`;
}
function brandErrors(email,draft) {
  if (!draft) return ['empty_reply'];
  const errors=[];
  if (formatBrand(email,draft) !== draft) errors.push('brand_format');
  if (sentences(draft).length<3 || sentences(draft).length>6) errors.push('brand_sentence_count');
  const prose=unpackBody(draft).replace(/https?:\/\/\S+/g,'').replace(/\b(?:COD|UPI|INR|FAQ|AM|PM|KC-\d+)\b/g,'');
  if (prose.split(/[.!?।]/).some(s=>(s.match(/[A-Za-z]/g)||[]).length>8 && s === s.toUpperCase())) errors.push('brand_all_caps');
  if (/\p{Extended_Pictographic}/u.test(draft)) errors.push('brand_emoji');
  return errors;
}
function traceEvidence(ctx,steps) {
  const calls=[], successful=new Set(), sections=new Set();
  for (const s of Array.isArray(steps)?steps:[]) {
    const name=s.action?.tool;
    if (!['get_order','search_faq'].includes(name)) continue;
    let data;
    try {data=parseJSON(s.observation);} catch {data=null;}
    let ok=false;
    if (name==='get_order') {
      const expected=ctx.policy.tool_order;
      ok=data?.result === expected.result && (expected.result!=='found' || JSON.stringify(data.order) === JSON.stringify(expected.order));
    } else if (Array.isArray(data?.sections)) {
      // Observation IDs alone are insufficient: require the exact trusted source section text.
      for (const section of data.sections) {
        const trusted=ctx.faq_sections.find(f=>f.id===section.id && f.text===section.text);
        if (trusted) sections.add(section.id);
      }
      ok=ctx.tool_plan.faq_sections.every(id=>sections.has(id));
    }
    if (ok) successful.add(name);
    calls.push({name,ok,outcome:name==='get_order'?data?.result:undefined});
  }
  return {calls,successful:[...successful],sections:[...sections],missing:ctx.tool_plan.required.filter(t=>!successful.has(t))};
}
function baseSafetyErrors(ctx,body) {
  const errors=[],p=ctx.policy,o=p.tool_order.order;
  if (!body) return ['draft_missing'];
  if (p.tool_order.result==='not_authorized' && /KC-\d{4}|https?:\/\/|(?:INR|₹|Rs)\s*\d/i.test(body)) errors.push('privacy_disclosure');
  for (const id of body.match(/KC-\d{4}/g)||[]) if(id!==o?.order_id) errors.push('unauthorized_order_reference');
  for (const url of body.match(/https?:\/\/[^\s<>\])]+/g)||[]) if(url.replace(/[.,;]+$/,'')!==o?.tracking_url) errors.push('unapproved_link');
  const amounts=new Set(o?[o.total,o.subtotal,o.shipping_fee,o.cod_fee,...o.items.flatMap(i=>[i.unit_price,i.unit_price*i.qty])]:[]);
  // Product/policy prices must occur in retrieved relevant FAQ text, not the model's world knowledge.
  const faqText=(ctx.faq_sections||[]).filter(s=>ctx.tool_plan.faq_sections.includes(s.id)).map(s=>s.text).join('\n');
  for(const m of faqText.matchAll(/₹([\d,]+)/g)) amounts.add(Number(m[1].replace(/,/g,'')));
  for(const m of body.matchAll(/(?:₹|INR\s*|Rs\.?\s*)([\d,]+(?:\.\d+)?)/gi)) if(!amounts.has(Number(m[1].replace(/,/g,'')))) errors.push('unsupported_amount');
  for(const date of body.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[]) if(!o || ![o.order_date,o.shipped_date,o.delivered_date,o.estimated_delivery,o.cancelled_date,refundRecordDate(o)].includes(date)) errors.push('unsupported_date');
  for(const sentence of sentences(body)) {
    const sourceInitiated=verifiedRefundInitiation(ctx,sentence);
    const claim=sentence.replace(/\b(?:only )?after (?:the )?pickup is completed\b/gi,'AFTER_PICKUP_CONDITION').replace(/\b(?:no|not|never)\s+(?:a |the |any )?(?:refund|pickup|replacement|cancellation)\s+(?:has been |is |was )?(?:approved|initiated|completed|credited|booked|scheduled|arranged|dispatched)\b/gi,'').replace(/\b(?:refund|pickup|replacement|cancellation)\s+(?:has |have |is |was )?(?:not|never)\s+(?:been )?(?:approved|initiated|completed|credited|booked|scheduled|arranged|dispatched)\b/gi,'');
    const operational=/\b(?:refund|pickup|replacement|cancellation)\b(?:\s+(?:of|for)?\s*(?:INR\s*|₹|Rs\.?\s*)[\d,]+)?\s+(?:(?:has|have)\s+been\s+|was\s+|is(?: now)?\s+|will be\s+)?(?:approved|initiated|completed|credited|booked|scheduled|arranged|dispatched)\b|\b(?:we|I)\s+(?:have\s+|already\s+)?(?:approved|initiated|processed|completed|booked|scheduled|arranged|dispatched)\b|\brefund\b.{0,60}(?:has been|was|is now)\s+processed\b/i.test(claim);
    if (operational && !sourceInitiated) errors.push('unsupported_operational_claim');
    if (/\b(?:send|share|provide|tell us)\b.{0,35}\b(?:OTP|PIN|CVV|password|UPI|account number|IFSC)\b/i.test(sentence) && !/never|do not|not share/i.test(sentence)) errors.push('premature_or_sensitive_payment_request');
  }
  if (/photos?\s+(?:have been|were|are)\s+(?:verified|inspected|reviewed)|(?:we|I)\s+(?:have\s+)?(?:verified|inspected|reviewed)\s+(?:your |the )?(?:photos|attachments)/i.test(body)) errors.push('unverified_attachment_claim');
  if (/\b(?:will cure|cures|treats eczema|heals eczema|guaranteed results)\b/i.test(body)) errors.push('medical_or_efficacy_claim');
  if (/guaranteed.{0,30}(?:delivery|arrival)|definitely.{0,30}(?:deliver|arrive)/i.test(body)) errors.push('delivery_guarantee');
  if (p.issue==='missing' && p.eligibility.missing_item_value!=null) for(const m of body.matchAll(/refund\D{0,35}(?:₹|INR\s*|Rs\.?\s*)([\d,]+)/gi)) if(Number(m[1].replace(/,/g,''))!==p.eligibility.missing_item_value) errors.push('missing_item_refund_scope');
  return [...new Set(errors)];
}
function baseCompletenessErrors(ctx,body,out) {
  const p=ctx.policy,o=p.tool_order.order,errors=[];
  if (p.medical || p.tool_order.result==='not_authorized') return errors; // fixed templates are applied later
  const need=(ok,reason)=>{if(!ok) errors.push(reason);};
  if (p.needs_order && !o) {need(/order (?:ID|number)|email address|ऑर्डर|order no/i.test(body),'missing_order_clarification'); return errors;}
  if (ctx.classification.intent==='order_status' && o) {
    need(body.includes(o.order_id),'order_id_missing');
    if(o.status==='cancelled') {need(/cancelled/i.test(body),'cancellation_missing');need(!o.refund_status || body.includes(o.cancelled_date),'cancellation_refund_evidence_missing');}
    else {need(body.includes(o.status.replace(/_/g,' ')) || (o.status==='shipped' && /shipped/i.test(body)),'order_status_missing');need(!o.courier || body.includes(o.courier),'courier_missing');need(!o.tracking_url || body.includes(o.tracking_url),'tracking_missing');need(!o.estimated_delivery || body.includes(o.estimated_delivery),'estimated_delivery_missing');}
  }
  if(p.ticket_required && o) {
    if(p.issue==='ordinary') {
      need(/7|seven|सात/i.test(body),'return_window_missing');
      need(/unopened|opened|unused|used|seal/i.test(body),'condition_policy_missing');
      if(p.eligibility.state==='ineligible') need(/cannot|not eligible|outside|unable|ineligible/i.test(body),'return_ineligibility_missing');
      else {
        need(/quality|QC/i.test(body),'quality_check_dependency_missing');need(/5[–-]7|five to seven/.test(body),'refund_timing_missing');
        need(/pickup/i.test(body),'pickup_dependency_missing');
        need(o.payment_method==='cod'?/UPI|bank transfer/i.test(body):/original payment/i.test(body),'refund_method_missing');
        if(o.payment_method==='cod') need(/after.{0,30}pickup|pickup.{0,30}(?:completed|complete)/i.test(body),'cod_details_timing_missing');
        if(o.shipping_fee+o.cod_fee) need(/non-refundable|not refundable|excluded/i.test(body),'nonrefundable_fees_missing');
        if(p.eligibility.complete_set_required) need(/complete set|whole kit|entire kit/i.test(body),'kit_scope_missing');
      }
    } else {
      need(/48|forty-eight/.test(body),'reporting_window_missing');need(/photo/i.test(body) && /box/i.test(body),'photo_evidence_missing');need(/verif/i.test(body),'verification_dependency_missing');
      if(p.issue==='missing') need(/packing weight/i.test(body),'packing_weight_missing');
      if(p.eligibility.photos_listed.length) need(/listed|received|attached/i.test(body),'attachment_acknowledgment_missing');
    }
    need(/24 business hours/.test(body),'human_followup_missing');
  }
  if(out.unsupported_question) errors.push('faq_unsupported_question');
  if(sentences(body).length>6) errors.push('brand_sentence_count');
  return errors;
}
function inspectAttempt(ctx,raw,steps,previous=null) {
  let out,errors=[];
  try {out=parseJSON(raw);} catch {errors.push('agent_output_invalid_json');out={};}
  const body=unpackBody(out.body ?? out.reply_draft ?? '');
  if(!body) errors.push('draft_missing');
  if(typeof out.unsupported_question!=='boolean') errors.push('unsupported_flag_missing');
  // Carry ONLY real observations from executed attempts. Retry is not credited for planned calls.
  const attempts=[...(previous?.attempts||[]),{raw,steps:Array.isArray(steps)?steps:[]}];
  const evidence=traceEvidence(ctx,attempts.flatMap(a=>a.steps));
  errors.push(...evidence.missing.map(t=>'required_tool_missing:'+t));
  if(!Array.isArray(out.faq_sections) || !out.faq_sections.length || out.faq_sections.some(id=>!evidence.sections.includes(id))) errors.push('faq_evidence_missing');
  errors.push(...safetyErrors(ctx,body),...completenessErrors(ctx,body,out));
  return {body,out,errors:[...new Set(errors)],evidence,attempts,history:[...(previous?.history||[]),[...new Set(errors)]]};
}
function policyFallback(ctx) {
  const p=ctx.policy,o=p.tool_order.order,e=p.eligibility;
  if(!needsDraft(ctx)) return {body:'',kind:'log_only'};
  if(p.tool_order.result==='not_authorized') return {body:'For privacy, please contact us from the email address used to place the order. We cannot share order information from a different email address. A team member will follow up within 24 business hours.',kind:'privacy'};
  if(p.medical) return {body:p.reaction?'Please stop using the product immediately and consult a doctor. Our products are cosmetics, not medicines. A team member will follow up within 24 business hours.':'Our products are cosmetics, not medicines, and are not intended to diagnose, treat or cure medical conditions. Please consult a dermatologist or doctor before use. A team member will follow up within 24 business hours.',kind:'medical'};
  if(p.needs_order && !o) return {body:'I could not resolve an authorized order from the information provided. Please confirm your order number and contact us from the email address used for the order. A team member will follow up within 24 business hours.',kind:'order_clarification'};
  if(ctx.classification.language==='hinglish' && ctx.classification.intent==='order_status' && o && o.status!=='cancelled') return {body:`Aapka order ${o.order_id} ${o.status.replace(/_/g,' ')} hai${o.courier?' aur courier '+o.courier+' hai':''}. ${o.estimated_delivery?'Estimated delivery date '+o.estimated_delivery+' hai; yeh guarantee nahi hai.':'Estimated delivery date abhi available nahi hai.'} ${o.tracking_url?'Tracking link: '+o.tracking_url:'Tracking link abhi available nahi hai.'}`,kind:'order_status'};
  if(ctx.classification.intent==='order_status' && o) {
    if(o.status==='cancelled') return {body:`Your order ${o.order_id} was cancelled on ${o.cancelled_date}${o.cancellation_reason?' because '+o.cancellation_reason.toLowerCase():''}. ${o.refund_status?`Your refund of INR ${o.total} was initiated on ${o.cancelled_date} to the original payment method.`:'The refund status is not available and needs checking.'} The FAQ gives a 5–7 business day refund window for brand-cancelled prepaid orders; completion is not confirmed here.`,kind:'order_status'};
    return {body:`Your order ${o.order_id} is ${o.status.replace(/_/g,' ')}${o.courier?' with '+o.courier:''}. ${o.estimated_delivery?'The estimated delivery date is '+o.estimated_delivery+', rather than a guarantee.':'An estimated delivery date is not available.'} ${o.tracking_url?'Track it here: '+o.tracking_url: 'A tracking link is not available.'}${o.payment_method==='cod'?` The COD amount is INR ${o.total}; please keep exact change ready.`:''}`,kind:'order_status'};
  }
  if(p.ticket_required && o) {
    if(p.issue!=='ordinary') {
      const issue=p.issue==='wrong'?'incorrect items':p.issue==='missing'?'missing item':'damaged or leaking product';
      const evidence=e.photos_listed.length?'The product and outer-box photo filenames are listed, but the images have not been inspected.':'Please share photos of the product and outer box for verification.';
      const timing=e.state==='within_reporting_window_pending_verification'?'Your report falls within the 48-hour reporting window.':'The 48-hour reporting window needs human checking because the exact delivery time is unavailable or the report appears late.';
      const remedy=p.issue==='missing'?`After packing weight verification, the missing item can be shipped or its value refunded${e.missing_item_value!=null?' (INR '+e.missing_item_value+')':''}.`:p.issue==='wrong'?'After verification, the wrong items can be picked up and the correct items sent at no cost.':`After verification, the policy offers a free replacement or full refund${e.customer_requested_remedy==='replacement'?'; your replacement preference is noted':e.customer_requested_remedy==='refund'?'; your refund preference is noted':''}.`;
      return {body:`I’m sorry about the ${issue} in order ${o.order_id}. ${timing} ${evidence} ${remedy} A team member will follow up within 24 business hours.`,kind:'item_issue'};
    }
    if(e.state==='ineligible') return {body:`I understand you would like to return the products in order ${o.order_id}. Ordinary returns are accepted within 7 days of delivery only for unused, unopened products with seals intact; ${e.used_claim?'you reported using the products':'this request is outside the return window'}, so this request is not eligible under that policy. Your request is recorded for human review, and a team member will follow up within 24 business hours.`,kind:'return_ineligible'};
    const condition=e.state==='eligible_pending_pickup_and_qc'?'Based on your unopened condition report, the request is within the 7-day return window, subject to verification; returned items must be unused, unopened and have intact seals':'The 7-day return window and unused, unopened, intact-seal condition must be confirmed';
    const method=o.payment_method==='cod'?'For COD, refunds use UPI or bank transfer; payment details are requested only after pickup is completed':'For prepaid orders, refunds go to the original payment method';
    const charges=[o.shipping_fee?`INR ${o.shipping_fee} shipping fee`:null,o.cod_fee?`INR ${o.cod_fee} COD fee`:null].filter(Boolean);
    const fee=charges.length?` The ${charges.join(' and ')} ${charges.length>1?'are':'is'} non-refundable for this ordinary return.`:'';
    return {body:`${condition}${e.complete_set_required?'; the entire kit must be returned as a complete set':''}. The return policy provides free reverse pickup within 2–3 business days; a booking requires human follow-up. ${method}, with the refund window of 5–7 business days after the returned item passes quality check.${fee} A team member will follow up within 24 business hours.`,kind:'return_policy'};
  }
  const question=ctx.email.subject+'\n'+ctx.email.body;
  if(ctx.classification.intent==='product_query' && /saffron.*serum|Saffron Glow/i.test(question) && /oily|vegan/i.test(question)) return {body:'The Saffron Glow Face Serum is lightweight, non-greasy and suitable for all skin types, including oily skin. It is vegan. Before first use, the FAQ recommends a 24-hour patch test on the inner forearm.',kind:'faq_product'};
  if(ctx.classification.intent==='product_query' && /Bridal Glow Kit/i.test(question) && /COD|कैश/i.test(question) && /delivery|डिलीवरी/i.test(question)) return {body:ctx.classification.language==='hi'?'डिस्पैच में 1–2 कार्य दिवस लगते हैं और उत्तर-पूर्व के लिए डिस्पैच के बाद डिलीवरी में 6–8 कार्य दिवस लगते हैं। Bridal Glow Kit की कीमत INR 3499 है और भारत में INR 999 से ऊपर शिपिंग निःशुल्क है। INR 5000 तक COD उपलब्ध है और INR 49 का COD शुल्क लगता है।':'Dispatch takes 1–2 business days, with 6–8 business days after dispatch for North-East delivery. Bridal Glow Kit costs INR 3499 and shipping is free for orders of INR 999 or more within India. COD is available up to INR 5000 with an INR 49 handling fee.',kind:'faq_shipping'};
  return {body:'Your question needs checking because I cannot provide a fully supported answer from the available FAQ evidence. I have flagged it for human review. A team member will follow up within 24 business hours.',kind:'generic'};
}
function selectDraft(ctx,assessment) {
  const forced=ctx.policy.medical || ctx.policy.tool_order.result==='not_authorized';
  const fallback=forced || assessment.errors.length ? policyFallback(ctx) : null;
  const body=fallback?fallback.body:assessment.body;
  const reasons=[...assessment.errors];
  if(ctx.policy.medical) reasons.push('medical_safe_template');
  if(ctx.policy.tool_order.result==='not_authorized') reasons.push('privacy_safe_template');
  return {body,reasons:[...new Set(reasons)],tool_names:assessment.evidence.successful,telemetry:{required_tools:ctx.tool_plan.required,tool_compliance:assessment.evidence.missing.length===0,tool_outcomes:assessment.evidence.calls,attempt_count:assessment.attempts.length,validation_history:assessment.history,fallback_kind:fallback?.kind || 'none',generic_fallback:fallback?.kind==='generic',faq_sections:assessment.evidence.sections},evidence:assessment.attempts};
}
function finishDraft(ctx,draft) {
  let formatted=formatBrand(ctx.email,draft.body,ctx.classification.language);
  let errors=needsDraft(ctx)?[...safetyErrors(ctx,unpackBody(formatted)),...brandErrors(ctx.email,formatted)]:[];
  if(errors.length) {
    const fallback=policyFallback(ctx); formatted=formatBrand(ctx.email,fallback.body,ctx.classification.language);
    const fallbackErrors=[...safetyErrors(ctx,unpackBody(formatted)),...brandErrors(ctx.email,formatted)];
    draft.telemetry.final_rejection=errors;
    draft.reasons.push(...errors);
    draft.telemetry.fallback_kind=fallback.kind;
    draft.telemetry.generic_fallback=fallback.kind==='generic';
    if(fallbackErrors.length) {formatted=formatBrand(ctx.email,'Your request needs a team member’s review. I cannot provide a verified answer from the available information. A team member will follow up within 24 business hours.');draft.telemetry.fallback_kind='generic';draft.telemetry.generic_fallback=true;draft.reasons.push('final_fallback_rejected');}
  }
  return {...draft,reply_draft:formatted,telemetry:{...draft.telemetry,brand_compliant:!formatted || brandErrors(ctx.email,formatted).length===0,final_safety_errors:formatted?safetyErrors(ctx,unpackBody(formatted)):[]}};
}
function validateWrite(values,headers) {
  if(!Array.isArray(values) || values.length!==1 || !Array.isArray(values[0]) || values[0].length!==headers.length || values[0].some(v=>!['string','number','boolean'].includes(typeof v) || typeof v==='number'&&!Number.isFinite(v))) throw new Error('Invalid Sheets RAW row payload.');
  if(values[0].some(v=>typeof v==='string' && v.length>45000)) throw new Error('Cell too large; retain execution and review manually.');
  return values;
}
// Targeted V2.1 guards: facts are trusted workflow state, never customer/model assertions.
function refundRecordDate(order) {
  if(!order || !/refund.*initiated/i.test(order.refund_status || ''))return null;
  const dates=[...new Set((order.refund_status || '').match(/\b\d{4}-\d{2}-\d{2}\b/g)||[])];
  return dates.length===1?dates[0]:null;
}
function verifiedRefundInitiation(ctx,sentence) {
  const o=ctx.policy.tool_order.order,date=refundRecordDate(o);
  if(!date || !/initiated/i.test(sentence) || /approved|completed|credited|processed|pickup|replacement/i.test(sentence))return false;
  const amounts=[...sentence.matchAll(/(?:INR\s*|₹|Rs\.?\s*)([\d,]+(?:\.\d+)?)/gi)].map(m=>Number(m[1].replace(/,/g,'')));
  const dates=[...new Set(sentence.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[])];
  return amounts.length===1 && amounts[0]===o.total && dates.length===1 && dates[0]===date;
}
function resolveRefundDates(ctx,body) {
  const parts=sentences(body),errors=[];const o=ctx.policy.tool_order.order,record=refundRecordDate(o);
  for(let i=0;i<parts.length;i++) {
    if(!/\brefund\b.*\binitiated\b/i.test(parts[i]))continue;
    const phrase=/\bon (?:the same|that) day\b/i;
    if(phrase.test(parts[i])) {
      const before=parts[i].slice(0,parts[i].search(phrase));
      const anchor=/cancelled|cancellation/i.test(before)&&/\d{4}-\d{2}-\d{2}/.test(before)?before:(parts[i-1]||'');
      const dates=[...new Set(anchor.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[])];
      if(record && dates.length===1 && dates[0]===record && /cancelled|cancellation/i.test(anchor) && anchor.includes(o.order_id) && dates[0]===o.cancelled_date)parts[i]=parts[i].replace(phrase,'on '+record);
      else errors.push('ambiguous_refund_date_coreference');
    }
    if(!verifiedRefundInitiation(ctx,parts[i]))errors.push('unsupported_refund_initiation_fact');
  }
  // Validation-only normalization; the customer-facing body is preserved.
  return {text:parts.join('. '),errors:[...new Set(errors)]};
}
function conditionFacts(email) {
  const text=email.subject+'\n'+email.body;
  return {unopened:{reported:/unopened|never opened|still sealed/i.test(text),verified:false},seal_intact:{reported:/seals?\s+(?:(?:is|are)\s+)?intact|intact seals?|still sealed/i.test(text),verified:false},unused:{reported:/unused|never used/i.test(text),verified:false}};
}
function sentimentReview(email,current) {
  const text=email.subject+'\n'+email.body;
  const strong=/worst experience|absolutely unacceptable|refund now|posting.{0,40}(?:instagram|reviews)|scam|fraud|furious|disgusting|outrageous/i.test(text);
  const restrained=/following up|follow[- ]?up|haven.t heard back|still waiting|please (?:help|arrange)|damaged|cracked/i.test(text);
  return current==='angry'&&!strong&&restrained?{sentiment:'negative',changed:true,reason:'restrained_followup_without_explicit_anger'}:{sentiment:current,changed:false,reason:'model_sentiment_retained'};
}
function policy(email,c,orders,threshold=0.85) {
  const p=basePolicy(email,c,orders,threshold);
  p.condition_facts=conditionFacts(email);
  return p;
}
function supportedAttachmentAction(ctx,action) {
  // This field is supplied ONLY by workflow initialization/executors, never an email or agent.
  const fact=ctx.execution_facts?.attachments?.[action];
  return fact?.status==='succeeded' && typeof fact.execution_id==='string' && !!fact.execution_id && typeof fact.evidence_ref==='string' && !!fact.evidence_ref;
}
function attachmentErrors(ctx,body) {
  const errors=[];let checked=false;
  const verbs={forwarded:'forwarded',transferred:'transferred',sent:'forwarded',shared:'forwarded',passed:'forwarded',inspected:'inspected',verified:'verified',reviewed:'inspected',examined:'inspected',checked:'inspected',opened:'inspected',received:'contents_received','looked at':'inspected'};
  const noun='(?:attachments?|files?|photos?|images?|pictures?|documents?)';
  const action=Object.keys(verbs).join('|');
  for(const sentence of sentences(body)) {
    // Remove only negative assertions, not an entire sentence containing a negated second action.
    const clean=sentence.replace(new RegExp(noun+'\\s+(?:have|has|were|was|are|is)\\s+(?:not|never)\\s+(?:been\\s+)?(?:'+action+')','gi'),'NO_ACTION');
    const patterns=[new RegExp('\\b(?:we|I|our team|the team)\\s+(?:(?:have|has|already|will have)\\s+)*(?:'+action+')\\b.{0,60}\\b'+noun+'\\b','gi'),new RegExp('\\b'+noun+'\\b.{0,40}?\\b(?:(?:have|has) been|were|was|are|is|will be|already)\\s+(?:(?:already|successfully|securely|carefully|thoroughly)\\s+)*('+action+')\\b','gi'),new RegExp('\\b'+noun+'\\s+(?:(?:already|successfully|securely|carefully|thoroughly)\\s+)*('+action+')\\b','gi')];
    for(const pattern of patterns)for(const match of clean.matchAll(pattern)) {
      checked=true;
      const found=match[0].match(new RegExp('\\b('+action+')\\b','i'));
      if(found&&!supportedAttachmentAction(ctx,verbs[found[1].toLowerCase()]))errors.push('unsupported_attachment_action');
    }
    if(new RegExp('\\b'+noun+'\\b.{0,25}\\b(?:are|is|were|was)\\s+(?:now\\s+)?with\\s+(?:our|the)\\s+team','i').test(clean) && !supportedAttachmentAction(ctx,'forwarded'))errors.push('unsupported_attachment_action');
    if(/\bI['’]ve\s+(?:forwarded|transferred|sent|shared|inspected|verified|reviewed|checked)\b.{0,60}\b(?:attachments?|files?|photos?|images?|pictures?)\b/i.test(clean))errors.push('unsupported_attachment_action');
  }
  return {errors:[...new Set(errors)],checked};
}
function productConditionErrors(ctx,body) {
  const errors=[],facts=ctx.policy.condition_facts || conditionFacts(ctx.email);
  for(const sentence of sentences(body)) {
    const seal=/seals?\s+(?:(?:is|are)\s+)?(?:intact|unbroken)|(?:intact|unbroken) seals?|\bsealed\b/i.test(sentence),unopened=/\bunopened\b/i.test(sentence),unused=/\bunused\b/i.test(sentence);
    if(!seal&&!unopened&&!unused)continue;
    const requirement=/\b(?:must|require|required|please ensure|need to|provided|if|only for)\b/i.test(sentence);
    const assertion=/\b(?:they|items?|products?|bottles?|both|seals?)\b.{0,45}\b(?:are|is|remain|were|have)\b|\b(?:verified|confirmed|checked)\b/i.test(sentence);
    const attributed=/you (?:reported|said|mentioned)|your (?:condition )?(?:report|description)|reportedly|according to your/i.test(sentence);
    if(/\b(?:we|I|our team)\b.{0,20}\b(?:verified|confirmed|checked)\b/i.test(sentence))errors.push('unverified_product_condition');
    if(!requirement && seal && !facts.seal_intact.reported)errors.push('unreported_intact_seals');
    if(!requirement && assertion && !attributed)errors.push('unverified_product_condition');
    if(!requirement && attributed && (unopened&&!facts.unopened.reported || unused&&!facts.unused.reported))errors.push('unreported_product_condition');
  }
  return [...new Set(errors)];
}
function safetyErrors(ctx,body) {
  const dates=resolveRefundDates(ctx,body),attachment=attachmentErrors(ctx,body);
  const base=baseSafetyErrors(ctx,dates.text);
  const filtered=attachment.checked&&!attachment.errors.length?base.filter(e=>e!=='unverified_attachment_claim'):base;
  return [...new Set([...filtered,...dates.errors,...attachment.errors,...productConditionErrors(ctx,body)])];
}
function completenessErrors(ctx,body,out) {
  const errors=baseCompletenessErrors(ctx,body,out),p=ctx.policy,o=p.tool_order.order;
  if(p.ticket_required && o && p.issue==='ordinary' && p.eligibility.state!=='ineligible' && p.eligibility.state!=='unknown') {
    if(!/2\s*[–-]\s*3\s+business days|two to three business days/i.test(body))errors.push('reverse_pickup_window_missing');
    if(o.shipping_fee && !new RegExp('(?:INR\\s*|₹|Rs\\.?\\s*)'+o.shipping_fee+'\\b.{0,30}shipping|shipping.{0,30}(?:INR\\s*|₹|Rs\\.?\\s*)'+o.shipping_fee+'\\b','i').test(body))errors.push('exact_shipping_fee_missing');
    if(!/quality|QC/i.test(body))errors.push('quality_check_dependency_missing');
  }
  return [...new Set(errors)];
}
function redactEvidence(value) {
  if(typeof value==='string')return value.replace(/AIza[0-9A-Za-z_-]{30,}|ya29\.[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._~-]+/g,'[REDACTED]');
  if(Array.isArray(value))return value.map(redactEvidence);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|credential|thought_signature/i.test(key)).map(([k,v])=>[k,redactEvidence(v)]));
  return value;
}
function stageTiming(start,end=Date.now()) {return {started_at_ms:start,finished_at_ms:end,duration_ms:Math.max(0,end-start)};}
function providerError(response) {
  if(!response?.error)return null;
  const e=response.error;
  return redactEvidence({message:typeof e==='string'?e:e.message || 'Provider error; inspect saved execution',code:e.code ?? null,status:e.statusCode ?? e.status ?? null,retry_count:null});
}
function requireFreshTabs(valueRanges,auditHeaders=AUDIT,ticketHeaders=TICKETS) {
  if(!Array.isArray(valueRanges)||valueRanges.length!==2)throw new Error('Preflight requires exactly two V2.1 tab ranges.');
  rows(valueRanges[0].values,auditHeaders);rows(valueRanges[1].values,ticketHeaders);
  if(valueRanges.some(r=>r.values.slice(1).some(row=>row.some(v=>String(v).trim()!==''))))throw new Error('Fresh baseline requires empty V2.1 audit and ticket tabs; keep smoke evidence separate.');
  return true;
}
if(typeof module!=='undefined') module.exports={INTENTS,AUDIT,TICKETS,parseJSON,classification,validateClassification,normalizeEmail,lookup,calendarDay,policy,rows,ticketPlan,auditPlan,safeDraft,needsDraft,toolPlan,unpackBody,sentences,formatBrand,brandErrors,traceEvidence,safetyErrors,completenessErrors,inspectAttempt,policyFallback,selectDraft,finishDraft,validateWrite,refundRecordDate,verifiedRefundInitiation,resolveRefundDates,conditionFacts,sentimentReview,attachmentErrors,productConditionErrors,redactEvidence,stageTiming,providerError,requireFreshTabs};
