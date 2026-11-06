"""Export trusted training checkpoints as Git-trackable, lossless FP32 shards."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil


def write_shards(source, target):
    from huggingface_hub import split_torch_state_dict_into_shards
    from safetensors import safe_open
    from safetensors.torch import load_file, save_file
    state = load_file(str(source), device='cpu')
    split = split_torch_state_dict_into_shards(state, max_shard_size='50MB')
    for name, keys in split.filename_to_tensors.items():
        save_file({key: state[key] for key in keys}, str(target / name), metadata={'format': 'pt'})
        if (target / name).stat().st_size >= 100 * 1024 ** 2:
            raise ValueError('A tensor shard exceeds GitHub\'s 100 MiB limit.')
        # Verify the serialization changed no tensor values, shapes or dtypes.
        with safe_open(str(target / name), framework='pt', device='cpu') as saved:
            assert set(saved.keys()) == set(keys)
            for key in keys:
                actual = saved.get_tensor(key)
                assert actual.dtype == state[key].dtype and actual.shape == state[key].shape
                assert actual.equal(state[key]), key
    index = {'metadata': split.metadata, 'weight_map': split.tensor_to_filename}
    (target / 'model.safetensors.index.json').write_text(json.dumps(index, indent=2, sort_keys=True) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    # Only the owner's trusted training files are unpickled by this export tool.
    # The deployed service reads plain JSON coefficients, never pickle files.
    import joblib
    import numpy as np
    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=False)
    bundle = out / 'mpnet-v3'
    files = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'vocab.txt']
    manifest = {'format': 2, 'id': 'mpnet', 'version': 'v3-natural-s42-20261102',
                'precision': 'float32', 'max_length': 128, 'seed': 42,
                'storage': 'git-tracked-safetensors-shards', 'source_weights': {}, 'files': {}, 'roles': {}}
    for side in ['ai', 'buyer']:
        source = args.run_dir / 'models/mpnet' / side
        target = bundle / side
        target.mkdir(parents=True)
        manifest['source_weights'][side] = hashlib.sha256((source / 'model.safetensors').read_bytes()).hexdigest()
        write_shards(source / 'model.safetensors', target)
        for name in files:
            f = target / name
            f.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source / name, f)
        head = joblib.load(source / 'model_head.pkl')
        coefficients = np.concatenate([e.coef_ for e in head.estimators_], axis=0)
        intercepts = np.concatenate([e.intercept_ for e in head.estimators_])
        assert coefficients.shape[1] == 768 and all(list(e.classes_) == [0, 1] for e in head.estimators_)
        (target / 'head.json').write_text(json.dumps({'coefficients': coefficients.tolist(),
                                                    'intercepts': intercepts.tolist()}) + '\n')
        calibration = json.loads((args.run_dir / 'calibration' / f'mpnet-{side}.json').read_text())
        manifest['roles'][side] = {'signals': calibration['signals'], 'thresholds': calibration['thresholds']}
        for f in sorted(target.rglob('*')):
            if f.is_file():
                manifest['files'][str(f.relative_to(bundle))] = {
                    'size': f.stat().st_size, 'sha256': hashlib.sha256(f.read_bytes()).hexdigest()}
    (bundle / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'path': str(bundle), 'files': len(manifest['files']),
                      'bytes': sum(f['size'] for f in manifest['files'].values()),
                      'precision': manifest['precision'], 'all_tensors_unchanged': True}, indent=2))


if __name__ == '__main__':
    main()
