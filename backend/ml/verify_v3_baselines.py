"""Independent sklearn arithmetic checks for previous-model and rules baselines."""
import json,hashlib
from pathlib import Path
import numpy as np
from sklearn.metrics import accuracy_score,precision_recall_fscore_support
from train_v3 import SIGNALS

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'predictions/v3-natural-s42'

def main():
 d=json.loads((OUT/'upgrade-comparison.json').read_text());p=ROOT.parent/'test/fixtures/signals-v3-natural/test.json'
 assert hashlib.sha256(p.read_bytes()).hexdigest()==d['test_sha256'];test=json.loads(p.read_text());checks=[]
 methods={f'previous/{m}':v for m,v in d['previous'].items()};methods['deterministic']=d['deterministic']
 for method,data in methods.items():
  totals={b:[0,0] for b in ['all','none','single','multi']}
  for side,keys in SIGNALS.items():
   rows=test[side+'_messages'];r=data['by_side'][side]
   assert [x['id'] for x in rows]==[x['id'] for x in r['predictions']]
   y=np.array([[x['signals'][k] for k in keys] for x in rows],dtype=bool)
   pred=np.array([[x['predicted'][k] for k in keys] for x in r['predictions']],dtype=bool)
   if method!='deterministic':
    raw=np.array([x['scores'] for x in r['predictions']]);assert np.isfinite(raw).all()
    assert np.array_equal(raw>=np.array(r['thresholds']),pred)
   for bucket in totals:
    mask=np.array([bucket=='all' or x['bucket']==bucket for x in rows]);yy=y[mask];pp=pred[mask];g=r['groups'][bucket]
    assert abs(accuracy_score(yy,pp)-g['whole_message_accuracy'])<1e-12
    assert abs(accuracy_score(yy.ravel(),pp.ravel())-g['per_signal_accuracy'])<1e-12
    pr,rc,f1,_=precision_recall_fscore_support(yy,pp,average=None,zero_division=0)
    assert np.allclose(pr,g['precision']) and np.allclose(rc,g['recall']) and np.allclose(f1,g['f1'])
    totals[bucket][0]+=int((yy==pp).all(axis=1).sum());totals[bucket][1]+=len(yy)
    checks.append(method+'/'+side+'/'+bucket)
  for bucket,(correct,n) in totals.items():
   assert correct==data['combined'][bucket]['whole_message_correct'];assert n==data['combined'][bucket]['messages']
 for m in d['current']:
  for bucket in ['all','none','single','multi']:
   new=d['current'][m]['combined'][bucket];old=d['previous'][m]['combined'][bucket];rules=d['deterministic']['combined'][bucket]
   assert abs(d['deltas'][m][bucket]['new_minus_old_percentage_points']-100*(new['whole_message_correct']-old['whole_message_correct'])/new['messages'])<1e-10
   assert abs(d['deltas'][m][bucket]['new_minus_rules_percentage_points']-100*(new['whole_message_correct']-rules['whole_message_correct'])/new['messages'])<1e-10
 report={'passed':True,'independent_library':'scikit-learn','groups_verified':checks,'test_sha256_preserved':True,
         'previous_model_reference_parity_messages':sum(x['reference_messages'] for x in d['legacy_inference_parity']),
         'maximum_previous_model_parity_gap':max(x['max_score_gap'] for x in d['legacy_inference_parity']),
         'delta_units':'percentage points','scope':'message wording signals only; not history-dependent deployment flags'}
 (OUT/'baseline-verification.json').write_text(json.dumps(report,indent=2)+'\n')
 print('Verified',len(checks),'baseline author/bucket groups, original-model parity and all percentage-point deltas.')

if __name__=='__main__':main()
