"""Package complete authored train/dev messages beside the frozen test.

No sentence composition, substitutions, augmentation or classifier queries occur.
"""
from collections import Counter
from itertools import combinations
import hashlib
import json
from pathlib import Path
import natural_train_source
import natural_dev_source
from build_natural_test import KEYS, OUT, normalized

QUOTAS = {'train': 400, 'dev': 80, 'test': 160}

def expected_patterns(author, bucket):
    keys = KEYS[author]
    if author == 'buyer':
        return {frozenset():bucket, frozenset([keys[0]]):bucket//2,
                frozenset([keys[1]]):bucket//2, frozenset(keys):bucket}
    patterns = {frozenset():bucket}
    patterns.update({frozenset([k]):bucket//4 for k in keys})
    patterns.update({frozenset(c):bucket//10 for c in combinations(keys,2)})
    patterns.update({frozenset(c):3*bucket//40 for c in combinations(keys,3)})
    patterns[frozenset(keys)] = bucket//10
    return patterns

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    frozen = json.loads((OUT/'freeze.json').read_text())
    assert digest(OUT/'test.json') == frozen['test_sha256'], 'Frozen test changed'
    for split,module in [('train',natural_train_source),('dev',natural_dev_source)]:
        result = {'schema_version':'3-natural-message-1','split':split,
                  'provenance':'AI-assistant-authored complete messages; no template expansion or classifier-guided selection',
                  'review_status':'assistant review; no independent human annotation',
                  'difficulty_policy':'No inferred easy/hard quota; difficulty is unassigned.',
                  'ai_messages':[],'buyer_messages':[]}
        ids = Counter()
        for author,active,text in module.ROWS:
            assert author in KEYS and set(active)<=set(KEYS[author])
            assert text.strip()
            ids[author]+=1
            result[author+'_messages'].append({'id':f'v3n-{split}-{author}-{ids[author]:04d}',
                'text':text,'signals':{k:k in active for k in KEYS[author]},
                'signal_count':len(active),'bucket':'none' if not active else 'single' if len(active)==1 else 'multi',
                'format':'email' if '\n' in text else 'short_message','channel':None,
                'source':'individually_authored_complete_message','difficulty':None})
        for author in KEYS:
            rr=result[author+'_messages']
            assert Counter(frozenset(k for k,v in r['signals'].items() if v) for r in rr)==expected_patterns(author,QUOTAS[split])
        (OUT/(split+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        print(split,dict(ids))
    manifest={'schema_version':'3-natural-corpus-1','synthetic':True,'independent_human_annotation':False,
              'model_predictions_used_for_construction':False,
              'balance':'equal authors; equal none/single/multi within author; equal positive counts within author',
              'files':{s:{'sha256':digest(OUT/(s+'.json')),'messages':QUOTAS[s]*6} for s in QUOTAS},
              'source_hashes':{p.name:digest(p) for p in [Path(natural_train_source.__file__),Path(natural_dev_source.__file__),Path(__file__).with_name('natural_test_source.py')]},
              'frozen_test_sha256':frozen['test_sha256']}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

if __name__=='__main__': main()
