"""Safe v3 orchestration: one process per role, guarded MPS, CPU scoring."""
import argparse,importlib.metadata,json,subprocess,sys
from pathlib import Path
from train_v3 import DATA,MODELS,SIGNALS,CONFIG,sha,write,verify_data
from repair_v3 import worker
from evaluate_v3 import evaluate

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--run-dir',type=Path,required=True)
 ap.add_argument('--device',choices=['mps','cpu'],default='mps');args=ap.parse_args()
 run=args.run_dir.resolve();run.mkdir(parents=True,exist_ok=True)
 assert not (run/'plan.json').exists(),'Use a new run directory'
 manifest=json.loads((DATA/'manifest.json').read_text());verify_data(manifest)
 hub=Path.home()/'.cache/huggingface/hub';bases={}
 for name,repo in MODELS.items():
  root=hub/('models--'+repo);revision=(root/'refs/main').read_text().strip();path=root/'snapshots'/revision
  weight=path/('model.safetensors' if (path/'model.safetensors').exists() else 'pytorch_model.bin')
  bases[name]={'path':str(path),'revision':revision,'repo':repo.replace('--','/'),'weight_sha256':sha(weight)}
 plan={'config':CONFIG,'device':args.device,'versions':{k:importlib.metadata.version(k) for k in ['torch','setfit','sentence-transformers','transformers','numpy','scipy','scikit-learn','datasets']},
       'bases':bases,'data_manifest':manifest,'padding':'fixed masked 128 on MPS; dynamic on CPU',
       'isolated_role_processes':True,'mps_driver_guard_gib':8,'progress_timeout_seconds':150,
       'test_policy':'score only after all six training jobs and dev calibrations complete; CPU inference',
       'comparison':'one common seed; not a multi-seed significance claim'}
 write(run/'plan.json',plan)
 try:
  for name in MODELS:
   for side in SIGNALS:
    if not worker(run,side,args.device,name):
     if args.device=='cpu' or not worker(run,side,'cpu',name):raise RuntimeError(f'Training failed: {name}/{side}')
  evaluate(run,plan)
  write(run/'status.json',{'phase':'complete','models':list(MODELS)})
  subprocess.run([sys.executable,str(Path(__file__).with_name('verify_v3_results.py')),str(run)],check=True)
 except BaseException as e:
  write(run/'status.json',{'phase':'failed','error':repr(e)});raise

if __name__=='__main__':main()
