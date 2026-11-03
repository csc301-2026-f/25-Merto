"""Score six completed role models on the frozen test, using CPU inference."""
import json
import numpy as np
import torch
from train_v3 import SIGNALS,MODELS,CONFIG,SetFitModel,load,gold,probabilities,metrics,write,verify_data

def evaluate(run,plan,repair=None):
 torch.set_num_threads(4)
 for name in MODELS:
  for side in SIGNALS:
   assert (run/'calibration'/f'{name}-{side}.json').exists()
   assert (run/'models'/name/side/'model_head.pkl').exists()
 verify_data(plan['data_manifest']);test=load('test');results={}
 # Test predictions use CPU so GPU memory failures cannot contaminate scoring.
 for name in MODELS:
  by_side={};write(run/'status.json',{'phase':'test_evaluation','model':name,'device':'cpu'})
  for side in SIGNALS:
   model=SetFitModel.from_pretrained(str(run/'models'/name/side),local_files_only=True,device='cpu')
   rr=test[side+'_messages'];p=probabilities(model,rr);y=gold(rr,side)
   t=json.loads((run/'calibration'/f'{name}-{side}.json').read_text())['thresholds']
   groups={}
   for bucket in ['all','none','single','multi']:
    mask=np.array([bucket=='all' or r['bucket']==bucket for r in rr]);groups[bucket]=metrics(y[mask],p[mask],t)
   by_side[side]={'signals':SIGNALS[side],'thresholds':t,'groups':groups,
    'predictions':[{'id':r['id'],'scores':pp.tolist(),'gold':r['signals'],
                   'predicted':{k:bool(v) for k,v in zip(SIGNALS[side],pp>=np.asarray(t))}} for r,pp in zip(rr,p)]}
   del model
  combined={}
  for bucket in ['all','none','single','multi']:
   gg=[by_side[s]['groups'][bucket] for s in SIGNALS];n=sum(g['messages'] for g in gg)
   wc=sum(g['whole_message_correct'] for g in gg);dec=sum(g['label_decisions'] for g in gg);correct=sum(g['label_decisions_correct'] for g in gg)
   combined[bucket]={'messages':n,'whole_message_correct':wc,'whole_message_accuracy':wc/n,
                    'label_decisions':dec,'label_decisions_correct':correct,'per_signal_accuracy':correct/dec}
  results[name]={'combined':combined,'by_side':by_side};write(run/'results'/f'{name}.json',results[name])
  print('TEST',name,combined['all'],flush=True)
 write(run/'comparison.json',{'config':CONFIG,'dataset_hashes':{s:v['sha256'] for s,v in plan['data_manifest']['files'].items()},
    'models':{name:{'combined':r['combined'],'by_side':{s:{k:v for k,v in q.items() if k!='predictions'} for s,q in r['by_side'].items()}} for name,r in results.items()},
    'runtime_repair':repair,'limits':['One fixed seed; synthetic assistant-reviewed data.','Padding and training device are recorded per role; see plan.json and any repair-plan.json.','No hard subset assigned.']})
