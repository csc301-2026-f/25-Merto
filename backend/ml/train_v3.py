"""Train three fresh SetFit encoder pairs, calibrate on dev, then score frozen test.

Usage: .venv-v3/bin/python train_v3.py --run-dir /absolute/local/run
All encoders use seed 42, five pair-sampling iterations, one encoder epoch,
batch 16, FP32, maximum length 128 and one-vs-rest logistic-regression heads.
"""
import argparse
import gc
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import random
import time

os.environ.setdefault('TOKENIZERS_PARALLELISM','false')
os.environ.setdefault('HF_HUB_OFFLINE','1')
os.environ.setdefault('HF_DATASETS_OFFLINE','1')
os.environ.setdefault('WANDB_DISABLED','true')
import numpy as np
import torch
from datasets import Dataset
from setfit import SetFitModel,Trainer,TrainingArguments
from transformers import set_seed

HERE=Path(__file__).resolve().parent
DATA=HERE.parent/'test/fixtures/signals-v3-natural'
SIGNALS={'ai':['claims_booking','guarantees_availability','quotes_price','off_tone'],
         'buyer':['asks_for_person','asks_about_price']}
MODELS={'minilm':'sentence-transformers--all-MiniLM-L6-v2','bge':'BAAI--bge-base-en-v1.5',
        'mpnet':'sentence-transformers--all-mpnet-base-v2'}
CONFIG={'seed':42,'iterations':5,'encoder_epochs':1,'batch_size':16,'max_length':128,
        'body_learning_rate':2e-5,'precision':'FP32','head':'one-vs-rest logistic regression',
        'threshold_grid':[round(i/20,2) for i in range(1,20)],'threshold_objective':'per-label dev F1; ties nearest 0.5'}

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
def load(split):return json.loads((DATA/(split+'.json')).read_text())
def gold(rows,side):return np.array([[r['signals'][k] for k in SIGNALS[side]] for r in rows],dtype=bool)
def probabilities(model,rows):
 return np.asarray(model.predict_proba([r['text'] for r in rows],as_numpy=True),dtype=float)
def thresholds(y,p):
 chosen=[]
 for i in range(y.shape[1]):
  scores=[]
  for t in CONFIG['threshold_grid']:
   pred=p[:,i]>=t;tp=int((pred&y[:,i]).sum());denom=int(pred.sum()+y[:,i].sum())
   scores.append((round(2*tp/denom,12) if denom else 0,-abs(t-.5),-t,t))
  chosen.append(max(scores)[-1])
 return chosen

def metrics(y,p,t):
 pred=p>=np.asarray(t);tp=(pred&y).sum(axis=0);fp=(pred&~y).sum(axis=0);fn=(~pred&y).sum(axis=0)
 n=len(y);correct=int((pred==y).sum());whole=int((pred==y).all(axis=1).sum())
 precision=np.divide(tp,tp+fp,out=np.zeros_like(tp,dtype=float),where=(tp+fp)!=0)
 recall=np.divide(tp,tp+fn,out=np.zeros_like(tp,dtype=float),where=(tp+fn)!=0)
 f1=np.divide(2*tp,2*tp+fp+fn,out=np.zeros_like(tp,dtype=float),where=(2*tp+fp+fn)!=0)
 return {'messages':n,'whole_message_correct':whole,'whole_message_accuracy':whole/n if n else None,
         'label_decisions':int(y.size),'label_decisions_correct':correct,'per_signal_accuracy':correct/y.size if y.size else None,
         'tp':tp.tolist(),'fp':fp.tolist(),'fn':fn.tolist(),'positives':y.sum(axis=0).tolist(),
         'precision':precision.tolist(),'recall':recall.tolist(),'f1':f1.tolist(),'macro_f1':float(f1.mean()),
         'micro_f1':float(2*tp.sum()/(2*tp.sum()+fp.sum()+fn.sum())) if (2*tp.sum()+fp.sum()+fn.sum()) else 0.0}

def verify_data(manifest):
 quality=json.loads((DATA/'corpus-quality.json').read_text())
 assert quality['passed'] and quality['semantic_review_current'] and quality['test_preserved']
 for split in ['train','dev','test']:
  h=sha(DATA/(split+'.json'));assert h==manifest['files'][split]['sha256']==quality['file_hashes'][split]
 return quality

def main():
 # Keep the historical command as an alias for guarded, isolated execution.
 from run_v3 import main as run
 run()

if __name__=='__main__':main()
