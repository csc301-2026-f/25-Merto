"""Recompute saved natural-v3 counts with Python alone; no weights required."""
import hashlib,json
from pathlib import Path

HERE=Path(__file__).resolve().parent
OUT=HERE/'predictions/v3-natural-s42'
DATA=HERE.parent/'test/fixtures/signals-v3-natural'

def main():
 summary=json.loads((OUT/'comparison.json').read_text())
 for split,h in summary['dataset_hashes'].items():
  assert hashlib.sha256((DATA/(split+'.json')).read_bytes()).hexdigest()==h
 test=json.loads((DATA/'test.json').read_text())
 print('Whole-message accuracy: every author-specific signal must match.')
 print('Model          All              No signal        One signal       Multi signal')
 for name in ['minilm','bge','mpnet']:
  result=json.loads((OUT/(name+'.json')).read_text());totals={g:[0,0] for g in ['all','none','single','multi']}
  for side in ['ai','buyer']:
   saved=result['by_side'][side];keys=saved['signals'];thresholds=saved['thresholds'];rows=test[side+'_messages']
   assert [r['id'] for r in rows]==[r['id'] for r in saved['predictions']]
   for group in totals:
    selected=[(r,p) for r,p in zip(rows,saved['predictions']) if group=='all' or r['bucket']==group]
    correct=0;label_correct=0;tp=[0]*len(keys);fp=[0]*len(keys);fn=[0]*len(keys)
    for row,p in selected:
     predicted=[v>=t for v,t in zip(p['scores'],thresholds)];gold=[row['signals'][k] for k in keys]
     correct+=int(predicted==gold);label_correct+=sum(a==b for a,b in zip(predicted,gold))
     for i,(a,b) in enumerate(zip(predicted,gold)):
      tp[i]+=int(a and b);fp[i]+=int(a and not b);fn[i]+=int(not a and b)
    recorded=saved['groups'][group]
    assert correct==recorded['whole_message_correct'] and label_correct==recorded['label_decisions_correct']
    assert tp==recorded['tp'] and fp==recorded['fp'] and fn==recorded['fn']
    totals[group][0]+=correct;totals[group][1]+=len(selected)
  fields=[]
  for group,(correct,n) in totals.items():
   assert correct==summary['models'][name]['combined'][group]['whole_message_correct']
   fields.append(f'{correct}/{n} {correct/n:6.2%}')
  print(f'{name:<14} '+ '   '.join(fields))
 print('Verified split hashes, message counts, label counts and per-signal TP/FP/FN.')

if __name__=='__main__':main()
