"""Resume four valid role models, replace failed MPNet jobs, then score all three."""
import argparse,json,os,selectors,subprocess,sys,time
from pathlib import Path
from train_v3 import DATA,SIGNALS,MODELS,CONFIG,SetFitModel,load,gold,probabilities,metrics,write,verify_data
import numpy as np


def worker(run,side,device,model='mpnet'):
 command=[sys.executable,'-u',str(Path(__file__).with_name('train_v3_worker.py')),
          '--run-dir',str(run),'--model',model,'--side',side,'--device',device]
 log=run/f'repair-{model}-{side}-{device}.log'
 env=os.environ.copy();env['PYTORCH_MPS_HIGH_WATERMARK_RATIO']='1.0'
 env['PYTORCH_MPS_LOW_WATERMARK_RATIO']='0.8'
 env['ACCELERATE_USE_CPU']='true' if device=='cpu' else 'false'
 progress=run/f'progress-{model}-{side}.json'
 if progress.exists():progress.unlink()
 process=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,bufsize=0,env=env)
 write(run/'status.json',{'phase':'training','model':model,'side':side,'device':device,'pid':process.pid})
 failed_metal=False;last_progress=time.monotonic();last_step=0;tail=''
 selector=selectors.DefaultSelector();selector.register(process.stdout,selectors.EVENT_READ)
 with log.open('w') as output:
  while process.poll() is None:
   for key,event in selector.select(timeout=1):
    chunk=os.read(key.fileobj.fileno(),8192).decode('utf-8',errors='replace')
    output.write(chunk);output.flush();tail=(tail+chunk)[-12000:]
    if 'Insufficient Memory' in tail or 'command buffer exited with error' in tail:
     failed_metal=True;process.kill();break
   if progress.exists():
    try:state=json.loads(progress.read_text())
    except (json.JSONDecodeError,FileNotFoundError):state={}
    if state.get('step',0)>last_step:
     last_step=state['step'];last_progress=time.monotonic();print('PROGRESS',side,device,state,flush=True)
   if time.monotonic()-last_progress>150:
    output.write('\nWatchdog: no training progress for 150 seconds; terminating worker.\n');output.flush()
    process.kill();break
  rest=process.stdout.read().decode('utf-8',errors='replace');output.write(rest)
 selector.close()
 rc=process.wait();return rc==0 and not failed_metal


def main():
 ap=argparse.ArgumentParser();ap.add_argument('run_dir',type=Path);args=ap.parse_args();run=args.run_dir.resolve()
 plan=json.loads((run/'plan.json').read_text());verify_data(plan['data_manifest'])
 assert not (run/'comparison.json').exists(),'Frozen test has already been scored'
 repair={'reason':'Original MPNet MPS jobs emitted silent Metal OOM errors; both excluded.',
   'preserved':['minilm/ai','minilm/buyer','bge/ai','bge/buyer'],
   'same_numerical_stack':True,'config':CONFIG,'mpnet_mps_padding':'fixed masked length 128',
   'isolated_role_processes':True,'mps_driver_guard_gib':8,'evaluation_device':'cpu','cpu_fallback_if_mps_fails':True}
 write(run/'repair-plan.json',repair)
 for side in SIGNALS:
  if not worker(run,side,'mps'):
   print(f'MPS worker failed for {side}; retrying fresh base on CPU.',flush=True)
   if not worker(run,side,'cpu'):raise RuntimeError('Both MPS and CPU worker failed')
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
    'runtime_repair':repair,'limits':['One fixed seed; synthetic assistant-reviewed data.','MPNet uses fixed masked padding to avoid MPS memory growth; see repair-plan.json.','No hard subset assigned.']})
 write(run/'status.json',{'phase':'complete','models':list(MODELS),'repair_completed':True})
 print('ALL TRAINING AND EVALUATION COMPLETE',flush=True)

if __name__=='__main__':main()
