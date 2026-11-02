"""Compare fixed old classifiers, retrained classifiers and current text rules.

The same frozen v3 test is used for all methods. Old thresholds are not refitted.
Saved logistic heads are read as coefficient state to avoid sklearn-version drift.
"""
import argparse,gc,hashlib,json,os,re
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
import numpy as np
import torch
from transformers import AutoModel,AutoTokenizer
from joblib.numpy_pickle import NumpyUnpickler
from train_v3 import SIGNALS,CONFIG,gold,metrics,write

HERE=Path(__file__).resolve().parent
DATA=HERE.parent/'test/fixtures/signals-v3-natural'
SAVED=HERE/'predictions/v3-natural-s42'
OLD={'minilm':'minilm-s42','bge':'bge-s1','mpnet':'mpnet-s1'}
class State:pass
class HeadReader(NumpyUnpickler):
 def find_class(self,module,name):
  if module.startswith('sklearn'):return State
  return super().find_class(module,name)

def old_classifier(path):
 tokenizer=AutoTokenizer.from_pretrained(path,local_files_only=True)
 model=AutoModel.from_pretrained(path,local_files_only=True).eval()
 pooling=json.loads((path/'1_Pooling/config.json').read_text())
 mode=pooling.get('pooling_mode')
 if not mode:mode='cls' if pooling.get('pooling_mode_cls_token') else 'mean'
 assert mode in ['cls','mean'],mode
 modules=json.loads((path/'modules.json').read_text());normalise=any(m['type'].endswith('.Normalize') for m in modules)
 p=path/'model_head.pkl'
 with p.open('rb') as f:head=HeadReader(str(p),f,ensure_native_byte_order=True).load()
 assert all(list(e.classes_)==[0,1] for e in head.estimators_)
 weights=np.concatenate([e.coef_ for e in head.estimators_]);bias=np.concatenate([e.intercept_ for e in head.estimators_])
 def predict(texts):
  scores=[]
  for begin in range(0,len(texts),32):
   batch=[re.sub(r'^\[Simulated[^\]]*\]\s*','',t) for t in texts[begin:begin+32]]
   features=tokenizer(batch,padding=True,truncation=True,max_length=128,return_tensors='pt')
   with torch.inference_mode():
    hidden=model(**features).last_hidden_state
    if mode=='cls':v=hidden[:,0]
    else:
     mask=features['attention_mask'].unsqueeze(-1);v=(hidden*mask).sum(1)/mask.sum(1).clamp(min=1)
    if normalise:v=torch.nn.functional.normalize(v,p=2,dim=1)
    logits=v.numpy()@weights.T+bias
    scores.extend(1/(1+np.exp(-np.clip(logits,-80,80))))
  return np.asarray(scores)
 return predict,tokenizer,model,mode

def scored(rows,p,thresholds,side):
 y=gold(rows,side)
 return {bucket:metrics(y[mask],p[mask],thresholds)
  for bucket in ['all','none','single','multi']
  for mask in [np.array([bucket=='all' or r['bucket']==bucket for r in rows])]}

def combine(by_side):
 combined={}
 for bucket in ['all','none','single','multi']:
  gg=[by_side[s]['groups'][bucket] for s in SIGNALS];n=sum(g['messages'] for g in gg)
  correct=sum(g['whole_message_correct'] for g in gg);dec=sum(g['label_decisions'] for g in gg);lc=sum(g['label_decisions_correct'] for g in gg)
  combined[bucket]={'messages':n,'whole_message_correct':correct,'whole_message_accuracy':correct/n,
    'label_decisions':dec,'label_decisions_correct':lc,'per_signal_accuracy':lc/dec}
 return combined

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--legacy-model-dir',type=Path,required=True)
 ap.add_argument('--rules',type=Path,required=True);ap.add_argument('--out',type=Path,default=SAVED/'upgrade-comparison.json');args=ap.parse_args()
 torch.set_num_threads(4)
 test_path=DATA/'test.json';test=json.loads(test_path.read_text());test_hash=hashlib.sha256(test_path.read_bytes()).hexdigest()
 current=json.loads((SAVED/'comparison.json').read_text());assert current['dataset_hashes']['test']==test_hash
 rules=json.loads(args.rules.read_text());assert rules['meta']['test_sha256']==test_hash
 results={};parity=[]
 for name,folder in OLD.items():
  ref=json.loads((HERE/'predictions'/f'{folder.replace("-s42","-save-s42").replace("-s1","-save-s1")}.json').read_text())
  by_side={}
  for side in SIGNALS:
   path=args.legacy_model_dir/folder/side;predict,tokenizer,model,mode=old_classifier(path)
   assert ref['meta'][side+'_signals']==SIGNALS[side]
   # Only non-truncated references are relevant: every new test message <=81 tokens.
   eligible=[t for t in ref[side] if len(tokenizer.encode(re.sub(r'^\[Simulated[^\]]*\]\s*','',t)))<=128]
   chosen=[eligible[i] for i in np.linspace(0,len(eligible)-1,min(12,len(eligible)),dtype=int)]
   actual=predict(chosen);expected=np.array([ref[side][t] for t in chosen]);gap=float(np.abs(actual-expected).max())
   assert gap<.001,(name,side,gap)
   parity.append({'model':name,'side':side,'reference_messages':len(chosen),'max_score_gap':gap,'pooling':mode})
   rr=test[side+'_messages'];p=predict([r['text'] for r in rr]);t=ref['meta']['thresholds'][side]
   by_side[side]={'signals':SIGNALS[side],'thresholds':t,'groups':scored(rr,p,t,side),
      'predictions':[{'id':r['id'],'scores':v.tolist(),'predicted':dict(zip(SIGNALS[side],map(bool,v>=np.array(t))))} for r,v in zip(rr,p)]}
   del predict,tokenizer,model;gc.collect()
   print('Scored fixed previous model',name,side,'parity gap',gap,flush=True)
  results[name]={'legacy_seed':ref['meta']['seed'],'legacy_train_sizes':ref['meta']['train_sizes'],'by_side':by_side,'combined':combine(by_side)}
 by_side={}
 for side in SIGNALS:
  rr=test[side+'_messages'];saved=rules['by_side'][side]['predictions'];assert [r['id'] for r in rr]==[r['id'] for r in saved]
  p=np.array([[r['predicted'][k] for k in SIGNALS[side]] for r in saved],dtype=float)
  by_side[side]={'signals':SIGNALS[side],'groups':scored(rr,p,[.5]*len(SIGNALS[side]),side),'predictions':saved}
 deterministic={'scope':rules['meta']['scope'],'source_hash':rules['meta']['rules_sha256'],'by_side':by_side,'combined':combine(by_side)}
 deltas={}
 for name in OLD:
  deltas[name]={}
  for bucket in ['all','none','single','multi']:
   new=current['models'][name]['combined'][bucket];old=results[name]['combined'][bucket];rule=deterministic['combined'][bucket]
   old_errors=old['messages']-old['whole_message_correct'];new_errors=new['messages']-new['whole_message_correct']
   deltas[name][bucket]={'new_minus_old_percentage_points':100*(new['whole_message_accuracy']-old['whole_message_accuracy']),
     'new_minus_rules_percentage_points':100*(new['whole_message_accuracy']-rule['whole_message_accuracy']),
     'fewer_errors_than_old':old_errors-new_errors,'relative_error_reduction_vs_old':(old_errors-new_errors)/old_errors if old_errors else None}
 output={'test_sha256':test_hash,'test_messages':960,'current':current['models'],'previous':results,'deterministic':deterministic,
  'deltas':deltas,'legacy_inference_parity':parity,
  'limits':['Same frozen test and message-only labels for all methods. No thresholds were selected on test.',
   'Previous models keep original thresholds; current models use their v3-dev thresholds.',
   'This is an end-to-end recipe comparison: training data, calibration and BGE/MPNet seeds changed; it does not isolate the data effect.',
   'Deterministic means repository wording checks, not history-dependent final deployment flags.',
   'Synthetic assistant-reviewed test; single trained instance per method.']}
 write(args.out,output)
 print('DETERMINISTIC',deterministic['combined'],flush=True)
 for name in OLD:print(name,'previous',results[name]['combined'],'delta',deltas[name],flush=True)

if __name__=='__main__':main()
