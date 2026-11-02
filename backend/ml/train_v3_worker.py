"""One isolated role-model job with fixed-size MPS inputs and memory guards."""
import argparse,os,time,resource
from pathlib import Path
import numpy as np
import torch
from torch.nn import functional as F
from datasets import Dataset
from setfit import SetFitModel,Trainer,TrainingArguments
from transformers import TrainerCallback,set_seed
from train_v3 import CONFIG,SIGNALS,load,gold,probabilities,thresholds,metrics,write

class MemoryGuard(TrainerCallback):
 def __init__(self,path,device):self.path=path;self.device=device;self.started=time.monotonic()
 def on_step_end(self,args,state,control,**kwargs):
  if state.global_step%10 and state.global_step!=1:return
  memory={}
  if self.device=='mps':
   torch.mps.synchronize()
   memory={'mps_active':torch.mps.current_allocated_memory(),'mps_driver':torch.mps.driver_allocated_memory()}
   if memory['mps_driver']>8*1024**3:raise RuntimeError(f'MPS memory guard exceeded 8 GiB: {memory}')
  elapsed=time.monotonic()-self.started
  state_record={'step':state.global_step,'total':state.max_steps,'elapsed_seconds':elapsed,
                'device':self.device,'peak_rss':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,**memory}
  write(self.path,state_record)
  print('MEMORY_GUARD',state_record,flush=True)
  if self.device=='mps' and state.global_step%50==0:torch.mps.empty_cache()


def main():
 ap=argparse.ArgumentParser();ap.add_argument('--run-dir',type=Path,required=True)
 ap.add_argument('--model',default='mpnet');ap.add_argument('--side',choices=list(SIGNALS),required=True)
 ap.add_argument('--device',choices=['mps','cpu'],default='mps');args=ap.parse_args()
 import json
 run=args.run_dir.resolve();plan=json.loads((run/'plan.json').read_text());base=plan['bases'][args.model]
 set_seed(42);torch.set_num_threads(4);start=time.monotonic()
 model=SetFitModel.from_pretrained(base['path'],local_files_only=True,multi_target_strategy='one-vs-rest',device=args.device)
 model.model_body.max_seq_length=128
 if args.device=='mps':
  # Keep graph input shapes constant. Padding is masked and does not add content.
  original=model.model_body.preprocess
  def fixed_preprocess(texts,**kwargs):
   features=original(texts,**kwargs)
   for key,value in features.items():
    if isinstance(value,torch.Tensor) and value.ndim==2:
     n=128-value.shape[1];assert n>=0
     fill=model.model_body.tokenizer.pad_token_id if key=='input_ids' else 0
     features[key]=F.pad(value,(0,n),value=fill)
   return features
  model.model_body.preprocess=fixed_preprocess
  def check_shape(module,inputs,kwargs):
   assert kwargs['input_ids'].shape[1]==128,'Fixed padding was not applied'
  model.model_body[0].auto_model.register_forward_pre_hook(check_shape,with_kwargs=True)
 train=load('train')[args.side+'_messages'];dev=load('dev')[args.side+'_messages']
 dataset=Dataset.from_dict({'text':[r['text'] for r in train],'label':gold(train,args.side).astype(int).tolist()})
 trargs=TrainingArguments(output_dir=str(run/'temporary-checkpoints'/args.model/args.side),
     batch_size=16,num_epochs=1,num_iterations=5,seed=42,max_length=128,body_learning_rate=2e-5,
     use_amp=False,report_to='none',save_strategy='no',eval_strategy='no',show_progress_bar=False,logging_steps=100)
 trainer=Trainer(model=model,args=trargs,train_dataset=dataset,
     callbacks=[MemoryGuard(run/f'progress-{args.model}-{args.side}.json',args.device)])
 assert trainer.st_trainer.args.device.type==args.device,trainer.st_trainer.args.device
 trainer.train()
 trained_device=str(model.model_body.device)
 # Calibration and saving use CPU to release the GPU and avoid extra graph shapes.
 model.model_body.to('cpu')
 p=probabilities(model,dev);t=thresholds(gold(dev,args.side),p)
 model.save_pretrained(str(run/'models'/args.model/args.side))
 write(run/'calibration'/f'{args.model}-{args.side}.json',{'signals':SIGNALS[args.side],'thresholds':t,
    'dev_metrics':metrics(gold(dev,args.side),p,t),
    'dev_predictions':[{'id':r['id'],'scores':v.tolist()} for r,v in zip(dev,p)],
    'training_seconds':time.monotonic()-start,'trained_device':trained_device,
    'padding_policy':'fixed_128_masked' if args.device=='mps' else 'dynamic_up_to_128',
    'execution_policy':'fresh base; isolated process and memory watchdog',
    'repair':'previous Metal-OOM checkpoint discarded' if (run/'repair-plan.json').exists() else None})
 print(f'WORKER_COMPLETE {args.model}/{args.side} {time.monotonic()-start:.1f}s thresholds={t}',flush=True)

if __name__=='__main__':main()
