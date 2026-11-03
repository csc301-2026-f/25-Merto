"""One-shot postprocessing for a specific authorised v3 training run."""
import argparse,json,subprocess,sys,time
from pathlib import Path
from train_v3 import write

def main():
 ap=argparse.ArgumentParser();ap.add_argument('run_dir',type=Path)
 ap.add_argument('--wait',action='store_true');ap.add_argument('--plot-python',type=Path)
 args=ap.parse_args();run=args.run_dir.resolve();started=time.monotonic();here=Path(__file__).resolve().parent
 while True:
  status=json.loads((run/'status.json').read_text())
  if status['phase']=='complete':break
  if not args.wait or status['phase']=='failed':raise RuntimeError(status)
  if time.monotonic()-started>5400:raise TimeoutError('Training did not complete within postprocessing wait budget')
  time.sleep(5)
 subprocess.run([sys.executable,str(here/'verify_v3_results.py'),str(run)],check=True)
 if args.plot_python:
  subprocess.run([str(args.plot_python),str(here/'plot_v3_results.py'),str(run)],check=True)
 status['verification']='passed'
 if (run/'comparison.png').exists():status['chart']='comparison.png'
 write(run/'status.json',status)
 print('VERIFIED RESULTS READY',run,flush=True)

if __name__=='__main__':main()
