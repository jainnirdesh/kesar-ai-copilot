#!/usr/bin/env python3
"""Offline evidence reconciliation. Reads raw files, writes derived submission reports only."""
import csv,json,statistics
from pathlib import Path
S=Path(__file__).resolve().parents[1]
BASE=['E01','E02','E03','E04','E07','E08','E10','E12','E19','E20','E21','E24']
EXT=['E05','E06','E09','E11','E13','E14','E15','E16','E17','E18','E22','E23','E25']
EXPECTED={x['id']:x for x in json.loads((S/'data/expected-outcomes.json').read_text())['cases']}
def load(p):return json.loads((S/p).read_text())
def results(p):
 x=load(p);return x[0]['results']if isinstance(x,list)and 'results'in x[0]else x
paths={'v1':'evidence/v1/v1-baseline-results.json','v2':'evidence/v2/v2-baseline-results.json','currency':'evidence/v2_1_currency/v2.1-currency-baseline-results.json','extended':'evidence/v2_1_currency_extended/v2.1-currency-extended-results.json'}
RS={k:results(v)for k,v in paths.items()}
FINAL=RS['currency']+[r for r in RS['extended']if r['email_id']in EXT]
assert len(FINAL)==25 and {r['email_id']for r in FINAL}==set(EXPECTED)
def notes(r):return json.loads(r['audit']['notes'])
def norm(k,v):
 if k in ['needs_human','order_found']:return str(v).lower()
 if k=='confidence':return float(v)
 if k=='notes':
  try:return json.loads(v)
  except:return v
 return str(v)
reconciliation={}
for key in RS:
 folder=Path(paths[key]).parent;prefix={'v1':'v1-baseline','v2':'v2-baseline','currency':'v2.1-currency-baseline','extended':'v2.1-currency-extended'}[key]
 with (S/folder/(prefix+'-audit.csv')).open(newline='')as f:audits=list(csv.DictReader(f))
 with (S/folder/(prefix+'-tickets.csv')).open(newline='')as f:tickets=list(csv.DictReader(f))
 wanted=EXT if key=='extended'else BASE;by={a['email_id']:a for a in audits};diff=[]
 for r in RS[key]:
  if r['email_id']not in wanted:continue
  for k,v in by[r['email_id']].items():
   if norm(k,v)!=norm(k,r['audit'].get(k,'')):diff.append([r['email_id'],k])
 latest={}
 if key=='v2':
  for r in results('evidence/v2/v2-smoke-results.json'):
   if r.get('ticket'):latest[r['ticket']['ticket_id']]=r['ticket']
 for r in RS[key]:
  if r.get('ticket'):latest[r['ticket']['ticket_id']]=r['ticket']
 td=[];scored_tickets=[];excluded_tickets=[]
 for t in tickets:
  links=set(t['email_ids'].split(','))
  if not links.intersection(wanted):excluded_tickets.append(t['ticket_id']);continue
  scored_tickets.append(t)
  if t['ticket_id']not in latest:td.append([t['ticket_id'],'missing JSON snapshot']);continue
  for k,v in t.items():
   if norm(k,v)!=norm(k,latest[t['ticket_id']].get(k,'')):td.append([t['ticket_id'],k])
 reconciliation[key]={'raw_audit_rows':len(audits),'raw_ticket_rows':len(tickets),'scored_email_count':len(wanted),'excluded_audit_ids':[a['email_id']for a in audits if a['email_id']not in wanted],'excluded_ticket_ids':excluded_tickets,'audit_differences':diff,'ticket_differences':td,'scored_tickets':scored_tickets}
HUMAN={'E03','E04','E07','E08','E11','E12','E13','E14','E16','E17','E18','E19','E20','E21','E22','E23'}
def metrics(rs):
 n=len(rs);lat=[r['processing_latency_ms']/1000 for r in rs if r.get('processing_latency_ms')is not None];ns=[notes(r)for r in rs];drafts=[r for r in rs if r['audit']['reply_draft']]
 return {'n':n,'primary_correct':sum(r['audit']['intent']==EXPECTED[r['email_id']]['intent']for r in rs),'secondary_exact':sum((r['audit']['secondary_intent']or None)==EXPECTED[r['email_id']].get('secondary_intent')for r in rs),'persisted':sum(r['status']=='persisted'for r in rs),'replays':[r['email_id']for r in rs if r['status']=='already_processed'],'reported_first_try_valid':sum(n.get('first_try_valid')is True for n in ns),'reported_errors':sum(bool(r['audit'].get('error'))for r in rs),'tool_name_compliant':sum(all(t in n.get('tools',[])for t in ([]if EXPECTED[r['email_id']]['intent']=='other'else ['search_faq']if EXPECTED[r['email_id']]['intent']=='product_query'else ['get_order','search_faq']))for r,n in zip(rs,ns)),'generic_fallbacks':sum(n.get('v2',{}).get('generic_fallback','Your request needs a team member' in r['audit']['reply_draft'])for r,n in zip(rs,ns)),'fallback_kinds':{kind:sum(n.get('v2',{}).get('fallback_kind')==kind for n in ns)for kind in sorted({n.get('v2',{}).get('fallback_kind','unavailable')for n in ns})},'drafted':len(drafts),'human_flags':sum(str(r['audit']['needs_human']).lower()=='true'for r in rs),'escalation_correct':sum((str(r['audit']['needs_human']).lower()=='true')==(r['email_id']in HUMAN)for r in rs),'latency_sample':len(lat),'mean_seconds':statistics.mean(lat)if lat else None,'median_seconds':statistics.median(lat)if lat else None,'max_seconds':max(lat)if lat else None,'repair_cases':sum(n.get('v2',{}).get('attempt_count',1)>1 for n in ns)}
report={'provenance':'Saved execution evidence, no new external runs; expected labels are human-authored from official sources, not an official answer key.','metrics':{k:metrics(v)for k,v in RS.items()},'final25':metrics(FINAL),'reconciliation':reconciliation,'batch_disclosure':'Final25 combines currency baseline12 and extended13 with unchanged prompts/model3.5; separate tab persistence, not a single clean25 run. Extended CSV E03 and its smoke ticket excluded only from derived scoring.','manual_findings':{'E04':'Extra return_refund secondary versus frozen expected checklist; judgment call.','E11':'Correct kit/QC policy, but unnecessary non-refundable shipping INR0 wording.','E15':'Correct COD fee49 but omits useful full COD total1897.','E18':'Safe clarification; active-order qualifier is stronger than source lookup.','E23':'Correct packing-weight/499 remedy, but should explicitly acknowledge refund rather than resend preference.'}}
D=S/'evidence/derived';D.mkdir(exist_ok=True);(D/'evaluation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
headers=list(FINAL[0]['audit']);headers=[h for h in headers if h!='row']
with (D/'final25-audit.csv').open('w',newline='')as f:
 w=csv.DictWriter(f,fieldnames=headers,extrasaction='ignore');w.writeheader();w.writerows(r['audit']for r in sorted(FINAL,key=lambda r:r['email_id']))
all_tickets=reconciliation['currency']['scored_tickets']+reconciliation['extended']['scored_tickets'];orderids=[t['order_id']for t in all_tickets];report['final_ticket_reconciliation']={'ticket_rows':len(all_tickets),'unique_orders':len(set(orderids)),'duplicate_orders':[o for o in set(orderids)if orderids.count(o)>1]}
(D/'evaluation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
with (D/'final25-tickets.csv').open('w',newline='')as f:
 w=csv.DictWriter(f,fieldnames=list(all_tickets[0]));w.writeheader();w.writerows(all_tickets)
lines=['# Test Report — Kesar & Co. Support Copilot','', '**Candidate:** pending candidate confirmation. **Platform:** n8n Cloud. **Final model:** models/gemini-3.5-flash-lite.','', '## 1. Correctness standard','', 'Expected labels come from the frozen human-authored checklist grounded in official emails/orders/FAQ. No official answer key is provided. Raw fields and actions are compared automatically; content, policy and usefulness require manual review. E04 secondary intent is a judgment call.','', '## 2. Email-by-email comparison','', '| Email | Expected intent/action | V1 intent/action | Original V2 intent/action | Final intent/action | Final notes |','|---|---|---|---|---|---|']
lookup={k:{r['email_id']:r for r in v}for k,v in RS.items()};final={r['email_id']:r for r in FINAL}
for id in sorted(EXPECTED):
 x=EXPECTED[id]
 def cell(r):
  if not r:return '— not run'
  a=r['audit'];fallback=notes(r).get('v2',{}).get('fallback_kind');fallback=fallback or ('generic'if 'Your request needs a team member'in a['reply_draft']else 'draft')
  return a['intent']+' / '+a['action_taken']+' / '+fallback
 lines.append('| '+id+' | '+x['intent']+' / '+x['action']+' | '+cell(lookup['v1'].get(id))+' | '+cell(lookup['v2'].get(id))+' | '+cell(final[id])+' | '+report['manual_findings'].get(id,x['check'])+' |')
lines+=['','## 3. Summary','', '| Metric | V1 matched12 | Original V2 matched12 | Final currency matched12 | Final25 split batches |','|---|---|---|---|---|']
for label,key in [('Primary correct','primary_correct'),('Secondary exact','secondary_exact'),('Reported first-attempt validity','reported_first_try_valid'),('Tool-name compliance','tool_name_compliant'),('Generic fallback','generic_fallbacks'),('Escalation correct (declared risk reference)','escalation_correct')]:lines.append('| '+label+' | '+' | '.join(str(m[key])+'/'+str(m['n'])for m in [report['metrics']['v1'],report['metrics']['v2'],report['metrics']['currency'],report['final25']])+' |')
lines+=['','## 4. Iteration and limitations','', 'V1 → original V2 improved tool invocation and useful replies. V2.1 added attribution/attachment/date guards and observability. Currency revision retained all core validators and added explicit INR instructions and runner-owned model profile. Model changed3.1→3.5: this is NOT a controlled same-model causal comparison.','', 'Final25 uses two executions (baseline runner44 and extended runner57), not one clean end-to-end25 run. Extended raw audit14/tickets5 contain an earlier E03 smoke record; derived scoring excludes E03 and its ticket, leaving13/4. Raw evidence is untouched. Wrong-tab persistence is disclosed, not fixed.','', '## 5. Failures and unresolved issues','', 'Historical full regression:88 run,86 pass,2 Finder metadata preservation failures,0 skips. Focused extended tests:5 pass. Frozen assertions/manifests unchanged. Provider503 attempts and safe fallback evidence retained. Additional manual findings appear above. Separate ticket tabs deduplicate only within a batch; derived reconciliation finds nine unique ticket orders but does not prove automatic cross-batch deduplication.','', 'See EVALUATION_REPORT.md for trace checks, persistence reconciliation, latency definitions and manual review. Missing mandatory screenshots/recording/links are in MANUAL_ACTIONS.md.']
(S/'TEST_REPORT.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'metrics':report['metrics'],'final25':report['final25'],'tickets':report['final_ticket_reconciliation'],'reconciliation':{k:{a:b for a,b in v.items()if a!='scored_tickets'}for k,v in reconciliation.items()}},indent=2))
