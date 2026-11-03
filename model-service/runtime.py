"""Small CPU-only runtime for the original trained MPNet + logistic heads."""
from collections import OrderedDict
import json
import os
from pathlib import Path
import re
import resource
import sys
import threading
import time

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['USE_TF'] = '0'
os.environ['USE_FLAX'] = '0'

ROOT = Path(__file__).resolve().parent / 'weights/mpnet-v3'
SIGNALS = {'ai': ['claims_booking', 'guarantees_availability', 'quotes_price', 'off_tone'],
           'buyer': ['asks_for_person', 'asks_about_price']}
_lock = threading.Lock()
_predictor = None


def metadata(root=ROOT):
    value = json.loads((root / 'manifest.json').read_text())
    if value.get('id') != 'mpnet' or value.get('precision') != 'float32':
        raise ValueError('Unexpected model identity.')
    for side, signals in SIGNALS.items():
        role = value['roles'][side]
        if role['signals'] != signals or len(role['thresholds']) != len(signals) or not all(
                isinstance(t, (int, float)) and 0 <= t <= 1 for t in role['thresholds']):
            raise ValueError('Invalid saved thresholds.')
        for name in ['model.safetensors', 'head.json', 'config.json', 'tokenizer.json']:
            if not (root / side / name).is_file():
                raise ValueError('Model files are missing. Run download_weights.py at build time.')
    return value


def health(root=ROOT):
    saved = metadata(root)
    return {'ready': True, 'engine': {'id': 'mpnet', 'mode': 'model', 'name': 'MPNet v3',
            'version': saved['version'], 'ready': True}, 'signals': SIGNALS,
            'thresholds': {s: saved['roles'][s]['thresholds'] for s in SIGNALS},
            'precision': 'float32', 'loaded': _predictor is not None,
            'peak_rss_bytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024)}


class Predictor:
    def __init__(self, root=ROOT):
        import numpy as np
        import torch
        # These optional training/media packages are not used by text inference.
        import transformers.utils.import_utils as imports
        for name in ['_sklearn_available', '_torchvision_available', '_librosa_available', '_scipy_available']:
            setattr(imports, name, False)
        from transformers import AutoModel, AutoTokenizer
        torch.set_num_threads(1)
        self.np, self.torch, self.root = np, torch, root
        self.saved = metadata(root)
        self.models, self.heads, self.tokenizers = {}, {}, {}
        self.cache = {side: OrderedDict() for side in SIGNALS}
        for side in SIGNALS:
            source = root / side
            self.tokenizers[side] = AutoTokenizer.from_pretrained(source, local_files_only=True)
            self.models[side] = AutoModel.from_pretrained(source, local_files_only=True).eval()
            head = json.loads((source / 'head.json').read_text())
            weights = np.asarray(head['coefficients'], dtype=np.float64)
            bias = np.asarray(head['intercepts'], dtype=np.float64)
            if weights.shape != (len(SIGNALS[side]), 768) or bias.shape != (len(SIGNALS[side]),):
                raise ValueError('Invalid logistic head shape.')
            self.heads[side] = weights, bias

    def predict(self, messages):
        np, torch = self.np, self.torch
        started = time.perf_counter()
        for side in SIGNALS:
            texts = list(dict.fromkeys(row['text'] for row in messages if row['side'] == side))
            missing = [text for text in texts if text not in self.cache[side]]
            # Bound temporary activations even for the maximum 64-message request.
            for offset in range(0, len(missing), 4):
                batch = missing[offset:offset + 4]
                clean = [re.sub(r'^\[Simulated[^\]]*\]\s*', '', text) for text in batch]
                inputs = self.tokenizers[side](clean, padding=True, truncation=True, max_length=128, return_tensors='pt')
                with torch.inference_mode():
                    hidden = self.models[side](**inputs).last_hidden_state
                    mask = inputs['attention_mask'].unsqueeze(-1)
                    vectors = torch.nn.functional.normalize((hidden * mask).sum(1) / mask.sum(1).clamp(min=1), p=2, dim=1).numpy()
                weights, bias = self.heads[side]
                logits = vectors @ weights.T + bias
                probabilities = 1 / (1 + np.exp(-np.clip(logits, -80, 80)))
                for text, scores in zip(batch, probabilities):
                    self.cache[side][text] = dict(zip(SIGNALS[side], scores.tolist()))
            for text in texts:
                self.cache[side].move_to_end(text)
            while len(self.cache[side]) > 2048:
                self.cache[side].popitem(last=False)
        return {**health(self.root), 'ms': round((time.perf_counter() - started) * 1000),
                'predictions': [{'id': row['id'], 'side': row['side'], 'signals': self.cache[row['side']][row['text']]}
                                for row in messages]}


def predict(data):
    global _predictor
    rows = data.get('messages') if isinstance(data, dict) else None
    if not isinstance(rows, list) or not 1 <= len(rows) <= 64:
        raise ValueError('Expected 1 to 64 messages.')
    ids = set()
    for row in rows:
        if not isinstance(row, dict) or row.get('side') not in SIGNALS or not isinstance(row.get('id'), str) or not row['id'] \
                or row['id'] in ids or not isinstance(row.get('text'), str) or len(row['text']) > 16_000:
            raise ValueError('Invalid message id, side or text.')
        ids.add(row['id'])
    # Fluid compute can dispatch concurrent requests to one process. Serialize
    # initialization and inference to avoid duplicate encoders/activation peaks.
    with _lock:
        if _predictor is None:
            _predictor = Predictor()
        return _predictor.predict(rows)
