"""Validate the complete natural-message corpus without querying classifiers."""
import argparse
from collections import Counter,defaultdict
import hashlib
import json
from pathlib import Path
import re
from build_natural_corpus import QUOTAS,expected_patterns,digest
from build_natural_test import KEYS,OUT,normalized
import natural_train_source,natural_dev_source,natural_test_source

FEATURES={
 'colour':r'\b(red|blue|white|black|silver|grey|gray|beige|cream|green|brown|navy|copper|charcoal|orange|yellow|bronze|teal|maroon|purple|burgundy|ivory)\b',
 'listed_model':r'\b(accord|tucson|cx-5|pilot|elantra|camry|focus|impreza|soul|pathfinder|jetta|cr-v|sorento|passat|sentra|kona|odyssey|terrain|rogue|s60|rio|forte|venza|matrix|compass|legacy|edge|accent|a3|malibu|journey|rdx|beetle|trax|qashqai|cx-3|a4|tsx|equinox|grand cherokee|prius|acadia|micra|avalon|impala|im|ilx|sonata|juke|traverse|c-max|lancer|mazda2|rav4|civic|crosstrek|sienna|golf|forester|yaris|hr-v|sportage|corolla|outback|fit|niro|q3|v60|mirage|clarity|note)\b',
 'digit':r'\d',
}
MODELS={'minilm':'sentence-transformers--all-MiniLM-L6-v2',
        'bge':'BAAI--bge-base-en-v1.5','mpnet':'sentence-transformers--all-mpnet-base-v2'}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--tokenizers',action='store_true');ap.add_argument('--require-review',action='store_true');args=ap.parse_args()
 manifest=json.loads((OUT/'manifest.json').read_text());allrows=[];stats={};errors=[]
 for split,module in [('train',natural_train_source),('dev',natural_dev_source),('test',natural_test_source)]:
  path=OUT/(split+'.json');data=json.loads(path.read_text());assert digest(path)==manifest['files'][split]['sha256']
  assert digest(Path(module.__file__))==manifest['source_hashes'][Path(module.__file__).name]
  source={a:[(s,t) for aa,s,t in module.ROWS if aa==a] for a in KEYS}
  for author,keys in KEYS.items():
   rr=data[author+'_messages'];assert len(rr)==3*QUOTAS[split]
   patterns=Counter(frozenset(k for k,v in r['signals'].items() if v) for r in rr)
   assert patterns==expected_patterns(author,QUOTAS[split])
   assert len({r['id'] for r in rr})==len(rr)
   for r,(s,t) in zip(rr,source[author]):
    assert r['text']==t and set(r['signals'])==set(keys)
    assert all(type(v) is bool for v in r['signals'].values())
    assert {k for k,v in r['signals'].items() if v}==set(s)
    assert r['signal_count']==len(s) and r['difficulty'] is None and r['channel'] is None
    assert not re.search(r'\{(?:car|amount|day|time|rep)\}|\[Simulated',t)
    allrows.append(dict(r,split=split,author=author))
   probes={k:{f:{name:{'matches':sum(bool(re.search(p,r['text'],re.I)) for r in selected),'messages':len(selected)}
                      for name,selected in [('positive',[r for r in rr if r['signals'][k]]),('negative',[r for r in rr if not r['signals'][k]])]}
                  for f,p in FEATURES.items()} for k in keys}
   stats[split+'/'+author]={'messages':len(rr),'bucket_counts':dict(Counter(r['bucket'] for r in rr)),
       'positive_counts':{k:sum(r['signals'][k] for r in rr) for k in keys},'format_counts':dict(Counter(r['format'] for r in rr)),
       'lexical_probes':probes}
 # Entity words should not act as a strong one-sided label cue. This is a
 # declared review threshold for these probes, not a certificate of diversity.
 for name,group in stats.items():
  if name.endswith('/ai'):
   for label,probes in group['lexical_probes'].items():
    for feature in ['colour','listed_model']:
     pos=probes[feature]['positive'];neg=probes[feature]['negative']
     gap=abs(pos['matches']/pos['messages']-neg['matches']/neg['messages'])
     if gap > .15:
      errors.append({'lexical_probe_gap_over_15_points':name+'/'+label+'/'+feature,'gap':gap})
 exact=defaultdict(list)
 for r in allrows:exact[normalized(r['text'])].append(r['id'])
 duplicates=[ids for ids in exact.values() if len(ids)>1]
 tokens=[set(re.findall('[a-z0-9]+',r['text'].casefold())) for r in allrows]
 near=[];within=Counter()
 for i,(r,ta) in enumerate(zip(allrows,tokens)):
  for j in range(i):
   other=allrows[j];tb=tokens[j]
   if r['author']!=other['author'] or min(len(ta),len(tb))<.8*max(len(ta),len(tb)):continue
   score=len(ta&tb)/len(ta|tb)
   if score>=.8:
    if r['split']==other['split']:within[r['split']+'/'+r['author']]+=1
    else:near.append({'first':other['id'],'second':r['id'],'jaccard':score})
 sentences=Counter(s.strip().casefold() for r in allrows for s in re.split(r'(?<=[.!?])\s+|\n+',r['text']) if len(s.split())>=4)
 overused=[(s,n) for s,n in sentences.items() if n>5]
 if duplicates:errors.append({'exact_duplicate_groups':duplicates})
 if near:errors.append({'cross_split_near_pairs':near})
 if within:errors.append({'within_split_near_pairs':dict(within)})
 if overused:errors.append({'sentences_repeated_over_five':overused})
 lengths={}
 if args.tokenizers:
  from tokenizers import Tokenizer
  hub=Path.home()/'.cache/huggingface/hub'
  for name,repo in MODELS.items():
   base=hub/('models--'+repo);revision=(base/'refs/main').read_text().strip()
   t=Tokenizer.from_file(str(base/'snapshots'/revision/'tokenizer.json'));t.no_padding();t.no_truncation()
   ll=[len(t.encode(r['text']).ids) for r in allrows]
   lengths[name]={'base_revision':revision,'maximum':max(ll),'over_128':[r['id'] for r,n in zip(allrows,ll) if n>128]}
   if lengths[name]['over_128']:errors.append({'token_overflow':name,'ids':lengths[name]['over_128']})
 # Stratified, deterministic selection for an inspectable packaged review.
 groups=defaultdict(list)
 for r in allrows:groups[(r['split'],r['author'],tuple(k for k,v in r['signals'].items() if v))].append(r)
 selected={}
 for rr in groups.values():
  for i in (0,len(rr)//2,len(rr)-1):selected[rr[i]['id']]=rr[i]
 for r in sorted(allrows,key=lambda r:len(r['text']),reverse=True):
  if len(selected)==200:break
  selected[r['id']]=r
 sample=list(selected.values())
 (OUT/'review-sample.json').write_text(json.dumps(sample,ensure_ascii=False,indent=2)+'\n')
 review_path=OUT/'corpus-review.json';review=None
 if review_path.exists():
  review=json.loads(review_path.read_text())
  if review.get('file_hashes')!={s:v['sha256'] for s,v in manifest['files'].items()}:review=None
 if args.require_review:
  assert review is not None,'Full-corpus semantic review is missing or stale'
  assert set(review['packaged_review_ids'])==set(selected),'Packaged sample changed after review'
  assert review['source_messages_read']==3840
 quality={'passed':not errors,'messages':len(allrows),'groups':stats,'errors':errors,
          'normalized_duplicate_groups':duplicates,'cross_split_token_jaccard_ge_0_8':near,
          'within_split_token_jaccard_ge_0_8':dict(within),'maximum_repeated_sentence':max(sentences.values()),
          'near_duplicate_comparison_scope':'same author; AI and buyer train separate encoders',
          'token_length_checks':lengths,'lexical_probe_regexes':FEATURES,
          'lexical_probe_scope':'Literal keyword occurrences, including ambiguous words such as fit/note; not named-entity recognition.',
          'semantic_review_current':review is not None,'packaged_sample_messages':len(sample),
          'test_preserved':digest(OUT/'test.json')==manifest['frozen_test_sha256'],
          'file_hashes':{s:v['sha256'] for s,v in manifest['files'].items()},
          'limits':['Synthetic, assistant-authored and assistant-reviewed; no independent human annotation.',
                    'Lexical checks do not establish semantic independence or prove label correctness.',
                    'Difficulty is unassigned; no hard-subset metric may be inferred from quotas.',
                    'Colour/model/digit regexes are limited probes, not exhaustive entity detection.']}
 capitalised={}
 for split in QUOTAS:
  rr=[r for r in allrows if r['split']==split and r['author']=='ai']
  capitalised[split]={}
  for label in KEYS['ai']:
   cells={}
   for name,value in [('positive',True),('negative',False)]:
    selected_rows=[r for r in rr if r['signals'][label]==value]
    matches=sum(any(any(c.isupper() for c in m.group()) for m in re.finditer(FEATURES['listed_model'],r['text'],re.I)) for r in selected_rows)
    cells[name]={'matches':matches,'messages':len(selected_rows)}
   capitalised[split][label]=cells
 quality['capitalised_model_word_diagnostic']=capitalised
 quality['limits'].append('A capitalisation-sensitive model-word diagnostic leaves a 16.5 percentage-point availability-label gap in train; nuisance vocabulary is not perfectly balanced. Dev/test gaps are smaller. The frozen data were not edited after training to hide this diagnostic.')
 (OUT/'corpus-quality.json').write_text(json.dumps(quality,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:quality[k] for k in ['passed','messages','errors','maximum_repeated_sentence','token_length_checks','semantic_review_current','test_preserved']},indent=2))
 if errors:raise SystemExit(1)

if __name__=='__main__':main()
