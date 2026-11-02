"""Independently recompute saved v3 metrics with scikit-learn, without retraining."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import torch
from setfit import SetFitModel
from sklearn.metrics import accuracy_score,precision_recall_fscore_support,f1_score
from safetensors import safe_open

HERE=Path(__file__).resolve().parent
DATA=HERE.parent/'test/fixtures/signals-v3-natural'

def main():
 ap=argparse.ArgumentParser();ap.add_argument('run_dir',type=Path);args=ap.parse_args();run=args.run_dir
 status=json.loads((run/'status.json').read_text());assert status['phase']=='complete',status
 comparison=json.loads((run/'comparison.json').read_text());plan=json.loads((run/'plan.json').read_text())
 torch.set_num_threads(4)
 test=json.loads((DATA/'test.json').read_text());dev=json.loads((DATA/'dev.json').read_text())
 checks=[];weight_checks=[];parity_checks=[]
 for split in ['train','dev','test']:
  actual=hashlib.sha256((DATA/(split+'.json')).read_bytes()).hexdigest()
  assert actual==comparison['dataset_hashes'][split]==plan['data_manifest']['files'][split]['sha256']
 for name in ['minilm','bge','mpnet']:
  result=json.loads((run/'results'/f'{name}.json').read_text());summary={}
  for side in ['ai','buyer']:
   rows=test[side+'_messages'];saved=result['by_side'][side];keys=saved['signals'];t=np.array(saved['thresholds'])
   calibration=json.loads((run/'calibration'/f'{name}-{side}.json').read_text())
   if name=='mpnet' and (run/'repair-plan.json').exists():
    assert calibration.get('repair'),'A failed original MPNet calibration must not be accepted'
    device='mps' if calibration['trained_device'].startswith('mps') else 'cpu'
    accepted_log=(run/f'repair-mpnet-{side}-{device}.log').read_text(errors='replace')
    assert 'Insufficient Memory' not in accepted_log and 'command buffer exited with error' not in accepted_log
    assert 'WORKER_COMPLETE' in accepted_log
   assert saved['thresholds']==calibration['thresholds']
   assert len(saved['predictions'])==len(rows)
   assert [r['id'] for r in rows]==[r['id'] for r in saved['predictions']]
   y=np.array([[r['signals'][k] for k in keys] for r in rows],dtype=bool)
   p=np.array([r['scores'] for r in saved['predictions']]);assert p.shape==y.shape
   assert np.isfinite(p).all() and ((p>=0)&(p<=1)).all()
   pred=p>=t
   for original,stored,yp in zip(rows,saved['predictions'],pred):
    assert original['signals']==stored['gold']
    assert stored['predicted']==dict(zip(keys,map(bool,yp)))
   for group in ['all','none','single','multi']:
    mask=np.array([group=='all' or r['bucket']==group for r in rows]);g=saved['groups'][group]
    gy=y[mask];gp=pred[mask];pr,rc,f1,_=precision_recall_fscore_support(gy,gp,average=None,zero_division=0)
    assert abs(accuracy_score(gy,gp)-g['whole_message_accuracy'])<1e-12
    assert abs(accuracy_score(gy.ravel(),gp.ravel())-g['per_signal_accuracy'])<1e-12
    assert int((gy==gp).all(axis=1).sum())==g['whole_message_correct']
    assert np.allclose(pr,g['precision']) and np.allclose(rc,g['recall']) and np.allclose(f1,g['f1'])
    assert abs(f1_score(gy,gp,average='micro',zero_division=0)-g['micro_f1'])<1e-12
    summary.setdefault(group,[]).append(g)
    checks.append(name+'/'+side+'/'+group)
   assert (run/'models'/name/side/'model_head.pkl').exists()
   assert (run/'models'/name/side/'model.safetensors').exists()
   dv=dev[side+'_messages'];indices=np.linspace(0,len(dv)-1,24,dtype=int)
   selected=[dv[i] for i in indices]
   expected={r['id']:r['scores'] for r in calibration['dev_predictions']}
   reloaded=SetFitModel.from_pretrained(str(run/'models'/name/side),local_files_only=True,device='cpu')
   actual=np.asarray(reloaded.predict_proba([r['text'] for r in selected],as_numpy=True))
   gap=float(np.abs(actual-np.asarray([expected[r['id']] for r in selected])).max())
   assert gap<.001,(name,side,gap)
   parity_checks.append({'model':name,'side':side,'messages':24,'max_score_gap':gap})
   del reloaded
   base=Path(plan['bases'][name]['path'])/'model.safetensors'
   trained=run/'models'/name/side/'model.safetensors'
   if base.exists():
    with safe_open(str(base),framework='pt',device='cpu') as original, safe_open(str(trained),framework='pt',device='cpu') as fitted:
     common=set(original.keys())&set(fitted.keys())
     candidates=sorted(k for k in common if k.endswith(('query.weight','.q.weight','q_proj.weight')))
     assert candidates, 'No shared attention query tensor for weight-change check'
     key=candidates[0];a=original.get_tensor(key);b=fitted.get_tensor(key)
     change=float((a-b).abs().max());assert change>1e-9
     weight_checks.append({'model':name,'side':side,'tensor':key,'maximum_absolute_change':change})
  for group,gg in summary.items():
   c=result['combined'][group]
   assert c['messages']==sum(g['messages'] for g in gg)
   assert c['whole_message_correct']==sum(g['whole_message_correct'] for g in gg)
   assert c['label_decisions_correct']==sum(g['label_decisions_correct'] for g in gg)
   assert c==comparison['models'][name]['combined'][group]
 report={'passed':True,'independent_library':'scikit-learn','groups_verified':checks,
         'split_hashes_preserved':True,'saved_role_models_checked':6,'fine_tuned_tensor_checks':weight_checks,
         'saved_reload_parity_checks':parity_checks,
         'note':'This verifies calculations and files, not semantic correctness of the synthetic labels.'}
 (run/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))

if __name__=='__main__':main()
