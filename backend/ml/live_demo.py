"""Local live MPNet FP32 signal inference. No database or external API."""
from pathlib import Path
import os,json,re,time,argparse
HERE=Path(__file__).resolve().parent
os.environ['HF_HUB_OFFLINE']='1'
os.environ['TOKENIZERS_PARALLELISM']='false'
# Text-only inference needs none of these optional integrations.
import transformers.utils.import_utils as iu
for key in ['_sklearn_available','_torchvision_available','_librosa_available','_scipy_available']:
    setattr(iu,key,False)
from transformers import AutoModel,AutoTokenizer
import torch,numpy as np
from joblib.numpy_pickle import NumpyUnpickler
from http.server import HTTPServer,BaseHTTPRequestHandler
import webbrowser
MODEL_DIR=Path(os.environ.get('MERTO_MODEL_DIR', str(HERE/'models/mpnet-s1'))).expanduser()
REFERENCE=HERE/'predictions/mpnet-save-s1.json'
META=json.loads(REFERENCE.read_text())['meta']
torch.set_num_threads(1)
class SavedState: pass
class HeadReader(NumpyUnpickler):
    # Read local sklearn state without importing its optional SciPy runtime.
    # Inference below uses the stored logistic-regression coefficients directly.
    def find_class(self,module,name):
        if module.startswith('sklearn'): return SavedState
        return super().find_class(module,name)
class Classifier:
    def __init__(self,side):
        path=MODEL_DIR/side
        self.tokenizer=AutoTokenizer.from_pretrained(path,local_files_only=True)
        self.model=AutoModel.from_pretrained(path,local_files_only=True).eval()
        file=path/'model_head.pkl'
        with file.open('rb') as f:
            state=HeadReader(str(file),f,ensure_native_byte_order=True).load()
        self.weights=np.concatenate([e.coef_ for e in state.estimators_],axis=0)
        self.bias=np.concatenate([e.intercept_ for e in state.estimators_])
        self.signals=META[side+'_signals'];self.thresholds=META['thresholds'][side]
    def predict(self,text):
        text=re.sub(r'^\[Simulated[^\]]*\]\s*','',text)
        x=self.tokenizer(text,truncation=True,max_length=128,return_tensors='pt')
        with torch.inference_mode():
            hidden=self.model(**x).last_hidden_state
            mask=x['attention_mask'].unsqueeze(-1)
            vec=(hidden*mask).sum(1)/mask.sum(1).clamp(min=1)
            vec=torch.nn.functional.normalize(vec,p=2,dim=1).numpy()[0]
        logits=self.weights@vec+self.bias
        return 1/(1+np.exp(-np.clip(logits,-80,80)))
HTML='''<!doctype html><html lang="en"><meta charset="utf-8"><title>Merto model demo</title>
<style>body{font:18px system-ui;background:#f8faf9;color:#183e3a;max-width:920px;margin:45px auto;padding:0 25px}h1{font-size:36px;margin-bottom:8px}p{line-height:1.5}select,button,textarea{font:inherit;padding:12px;border:1px solid #a8b9b3;border-radius:7px}textarea{box-sizing:border-box;width:100%;height:140px;margin:16px 0}button{cursor:pointer;background:#147d72;color:white}button.example{background:white;color:#183e3a;margin:5px 6px 5px 0;font-size:16px}.row{padding:18px 0;border-bottom:1px solid #dbe4df;display:grid;grid-template-columns:260px 1fr 150px;gap:20px;align-items:center}.track{background:#e2e9e5;height:13px}.bar{height:13px;background:#147d72}.small{font-size:15px;color:#526762}.badge{font-weight:700;color:#147d72}#status{margin:18px 0}label{display:block;font-weight:600}footer{margin:30px 0}</style>
<h1>Merto conversation signal demo</h1><p>Live inference with the saved MPNet FP32 models.</p>
<p class="small">Local demonstration. The deployed CRM currently uses deterministic rules.</p>
<label>Message author <select id="side"><option value="ai">AI assistant</option><option value="buyer">Buyer</option></select></label>
<textarea id="text">Half past three goes in the diary for you. Bring your licence.</textarea>
<div><button class="example" onclick="example('ai',`Half past three goes in the diary for you. Bring your licence.`)">Indirect booking</button><button class="example" onclick="example('buyer',`plz let a humen answer this one`)">Human request with typo</button><button class="example" onclick="example('ai',`Let me check availability with Dana before you drive over.`)">Offer to check</button></div>
<p><button id="run" onclick="predict()">Analyze message</button></p><div id="status" role="status"></div><div id="results"></div>
<footer class="small">A positive signal describes the wording. A final issue flag also needs deal history, such as whether a person confirmed the appointment or took over. Model scores are not guaranteed probabilities of correctness.</footer>
<script>function example(side,text){document.getElementById('side').value=side;document.getElementById('text').value=text;predict()}
async function predict(){let b=document.getElementById('run'),status=document.getElementById('status'),results=document.getElementById('results');b.disabled=true;status.textContent='Running model…';results.replaceChildren();try{let r=await fetch('/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({side:document.getElementById('side').value,text:document.getElementById('text').value})});let d=await r.json();if(!r.ok)throw Error(d.error);status.textContent='Live model inference: '+d.ms+' ms';for(let s of d.signals){let row=document.createElement('div');row.className='row';let name=document.createElement('span');name.textContent=s.label;let track=document.createElement('div');track.className='track';let bar=document.createElement('div');bar.className='bar';bar.style.width=(s.score*100)+'%';track.append(bar);let value=document.createElement('div');value.textContent=(s.positive?'YES':'NO')+' · '+(s.score*100).toFixed(1)+'%';value.className=s.positive?'badge':'';let threshold=document.createElement('div');threshold.className='small';threshold.textContent='Threshold '+(s.threshold*100).toFixed(0)+'%';value.append(threshold);row.append(name,track,value);results.append(row)}}catch(e){status.textContent=e.message}finally{b.disabled=false}}
</script></html>'''
LABELS={'claims_booking':'Claims a booked visit','guarantees_availability':'Guarantees availability','quotes_price':'Quotes a financial amount','off_tone':'Unprofessional tone','asks_for_person':'Requests a human','asks_about_price':'Requests pricing'}
def main():
    global META
    ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');ap.add_argument('--predictions',type=Path,default=REFERENCE);ap.add_argument('--port',type=int,default=3085);ap.add_argument('--open',action='store_true');args=ap.parse_args()
    META=json.loads(args.predictions.read_text())['meta']
    for side in ['ai','buyer']:
        if not (MODEL_DIR/side/'model.safetensors').is_file():
            ap.error('Trained model files are missing. Set MERTO_MODEL_DIR to the directory containing ai/ and buyer/. See backend/ml/README.md.')
    print('Loading saved MPNet FP32 models…',flush=True)
    models={s:Classifier(s) for s in ['ai','buyer']}
    if args.check:
        ref=json.loads(args.predictions.read_text());gap=0;n=0
        for side in models:
            texts=list(ref[side]);chosen=texts[::max(1,len(texts)//12)][:12]
            for text in chosen:
                actual=models[side].predict(text);expected=np.array(ref[side][text]);gap=max(gap,float(np.max(np.abs(actual-expected))));n+=1
        print(json.dumps({'checked_messages':n,'max_absolute_score_difference':gap,'tolerance':0.001,'passed':gap<0.001}),flush=True)
        if gap>=0.001:raise SystemExit('Prediction parity failed')
        return
    class Handler(BaseHTTPRequestHandler):
        def respond(self,code,data,kind='application/json'):
            out=data.encode() if isinstance(data,str) else json.dumps(data).encode()
            self.send_response(code);self.send_header('Content-Type',kind+'; charset=utf-8');self.send_header('Content-Length',str(len(out)));self.end_headers();self.wfile.write(out)
        def do_GET(self):
            if self.path=='/':self.respond(200,HTML,'text/html')
            elif self.path=='/health':self.respond(200,{'ready':True,'model':'MPNet FP32','live_inference':True})
            else:self.respond(404,{'error':'Not found'})
        def do_POST(self):
            if self.path!='/predict':return self.respond(404,{'error':'Not found'})
            try:
                size=int(self.headers.get('Content-Length','0'))
                if size<1 or size>20000:raise ValueError('Please enter a shorter message.')
                data=json.loads(self.rfile.read(size));side=data.get('side');text=data.get('text')
                if side not in models or not isinstance(text,str) or not text.strip():raise ValueError('Choose an author and enter a message.')
                if len(text)>4000:raise ValueError('Maximum 4,000 characters for this demo.')
                started=time.perf_counter();model=models[side];scores=model.predict(text)
                self.respond(200,{'ms':round((time.perf_counter()-started)*1000),'signals':[{'label':LABELS[k],'signal':k,'score':float(p),'threshold':t,'positive':bool(p>=t)} for k,p,t in zip(model.signals,scores,model.thresholds)]})
            except (ValueError,TypeError) as e:self.respond(400,{'error':str(e)})
            except Exception as e:self.respond(500,{'error':str(e)})
    class LocalServer(HTTPServer):
        def server_bind(self):
            self.socket.bind(self.server_address)
            self.server_name='localhost'
            self.server_port=self.socket.getsockname()[1]
    server=LocalServer(('127.0.0.1',args.port),Handler)
    url=f'http://127.0.0.1:{server.server_port}'
    print('Ready: '+url,flush=True)
    if args.open:webbrowser.open(url)
    server.serve_forever()
if __name__=='__main__':main()
