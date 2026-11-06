"""Verify the trained FP32 weights shipped in Git; no network access is used."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'weights/mpnet-v3'


def validate_layout(root, manifest):
    if manifest.get('format') != 2 or manifest.get('id') != 'mpnet' or manifest.get('precision') != 'float32':
        raise ValueError('Unexpected model bundle format, identity or precision.')
    for side in ['ai', 'buyer']:
        for name in ['model.safetensors.index.json', 'head.json', 'config.json', 'tokenizer.json']:
            relative = side + '/' + name
            if relative not in manifest['files'] or not (root / relative).is_file():
                raise ValueError('Tracked model file is missing: ' + relative)
        index = json.loads((root / side / 'model.safetensors.index.json').read_text())
        weight_map = index.get('weight_map')
        if not isinstance(weight_map, dict) or not weight_map:
            raise ValueError('Empty model shard index: ' + side)
        shards = set(weight_map.values())
        for name in shards:
            if not isinstance(name, str) or Path(name).name != name or not name.endswith('.safetensors'):
                raise ValueError('Invalid model shard path.')
            relative = side + '/' + name
            if relative not in manifest['files'] or not (root / relative).is_file():
                raise ValueError('Tracked model shard is missing: ' + relative)
        recorded = {Path(name).name for name in manifest['files']
                    if name.startswith(side + '/') and name.endswith('.safetensors')}
        if recorded != shards:
            raise ValueError('Model shard index and manifest disagree: ' + side)


def verify(root=ROOT):
    root = Path(root)
    manifest = json.loads((root / 'manifest.json').read_text())
    validate_layout(root, manifest)
    for name, expected in manifest['files'].items():
        f = root / name
        if not f.resolve().is_relative_to(root.resolve()):
            raise ValueError('Unsafe model path.')
        digest = hashlib.sha256()
        with f.open('rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(chunk)
        if f.stat().st_size != expected['size'] or digest.hexdigest() != expected['sha256']:
            raise ValueError('Model integrity check failed: ' + name)
    return manifest


if __name__ == '__main__':
    manifest = verify()
    print(f"Verified {len(manifest['files'])} tracked MPNet files; no model download required.")
