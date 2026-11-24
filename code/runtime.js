'use strict';
// Runner-owned execution profile. Processor has no independently selected model.
const PROFILE_REVISION='v2.1-currency-1';
const REFERENCE_MODEL='models/gemini-3.1-flash-lite';
const ALLOWED_MODELS=['models/gemini-3.1-flash-lite','models/gemini-3.5-flash-lite'];
function runtimeProfile(input,mode) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('Missing runner runtime profile; do not use a legacy runner.');
  if(input.profile_revision!==PROFILE_REVISION)throw new Error('Runner/processor profile revision mismatch.');
  if(!['smoke','replay','baseline'].includes(mode))throw new Error('Full evaluation is disabled.');
  if(!ALLOWED_MODELS.includes(input.model))throw new Error('Model is not in the reviewed allowlist.');
  if(!ALLOWED_MODELS.includes(input.baseline_model))throw new Error('Missing or unreviewed pinned baseline model.');
  if(mode==='baseline' && input.model!==input.baseline_model)throw new Error('Selected model differs from the pinned baseline model.');
  if(input.v1_model_confirmed!==(input.model===REFERENCE_MODEL))throw new Error('v1_model_confirmed conflicts with actual model; comparison disclosure required.');
  if(input.confidence_threshold!==0.85 || input.delay_seconds!==15)throw new Error('Retain threshold 0.85 and 15-second pacing for this revision.');
  if(typeof input.sheet_id!=='string'||!/^[A-Za-z0-9_-]+$/.test(input.sheet_id)||input.sheet_id.startsWith('REPLACE'))throw new Error('Set the private Sheet ID in Runner configuration only.');
  const tabs={audit_tab:'V2.1 Currency Baseline Audit Log',tickets_tab:'V2.1 Currency Baseline Tickets',smoke_audit_tab:'V2.1 Currency Smoke Audit Log',smoke_tickets_tab:'V2.1 Currency Smoke Tickets'};
  for(const [key,value]of Object.entries(tabs))if(input[key]!==value)throw new Error('Only version-isolated Currency revision tab names are allowed.');
  // Copy a whitelist, never arbitrary input fields or credentials.
  return {profile_revision:PROFILE_REVISION,model:input.model,baseline_model:input.baseline_model,v1_model_confirmed:input.v1_model_confirmed,reference_model:REFERENCE_MODEL,controlled_same_model_comparison:input.model===REFERENCE_MODEL,comparison_note:input.model===REFERENCE_MODEL?'Same model ID as V1/V2; other controls still require review.':'Different model from V1/V2; not a controlled same-model comparison.',confidence_threshold:0.85,delay_seconds:15,sheet_id:input.sheet_id,...tabs,run_mode:mode,run_id:mode==='baseline'?'v2.1-currency-baseline':'v2.1-currency-smoke',prompt_version:PROFILE_REVISION,n8n_version:typeof input.n8n_version==='string'?input.n8n_version:'unknown',smoke_ids:Array.isArray(input.smoke_ids)?input.smoke_ids:[]};
}
function requireProfileHandshake(profile,runner) {
  if(!runner || runner.profile_revision!==profile.profile_revision || runner.model!==profile.model || runner.baseline_model!==profile.baseline_model || runner.v1_model_confirmed!==profile.v1_model_confirmed || runner.target_sheet_id!==profile.sheet_id)throw new Error('Runner/processor runtime profile mismatch; stop before model or Sheets calls.');
}
function monetaryContext(ctx) {
  const order=ctx.policy?.tool_order?.result==='found'?ctx.policy.tool_order.order:null;
  if(!order)return {currency:'INR',source:'no_authorized_order',amounts:{}};
  const amounts={};
  for(const field of ['shipping_fee','cod_fee','subtotal','total'])if(typeof order[field]==='number')amounts[field]={value:order[field],text:'INR '+order[field]};
  return {currency:'INR',source:'authorized_provided_order',amounts,rule:'Write every monetary amount as INR <verified value>; bare numbers do not satisfy monetary validation.'};
}
function monetaryRepair(ctx,errors) {
  const context=monetaryContext(ctx);
  if(errors.includes('exact_shipping_fee_missing') && context.amounts.shipping_fee)return {error:'exact_shipping_fee_missing',instruction:'Use this exact source-grounded currency phrase for the shipping fee; a bare number remains invalid.',required_phrase:context.amounts.shipping_fee.text+' shipping fee',value:context.amounts.shipping_fee.value,currency:'INR'};
  return {instruction:context.rule,amounts:context.amounts};
}
if(typeof module!=='undefined')module.exports={PROFILE_REVISION,REFERENCE_MODEL,ALLOWED_MODELS,runtimeProfile,requireProfileHandshake,monetaryContext,monetaryRepair};
