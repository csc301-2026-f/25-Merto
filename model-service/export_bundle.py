"""Package the trusted fine-tuned MPNet pair, without changing its precision."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tarfile


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
    files = ['model.safetensors', 'model_head.pkl', 'config.json', 'tokenizer.json',
             'tokenizer_config.json', 'special_tokens_map.json', 'vocab.txt',
             'modules.json', 'config_setfit.json', 'sentence_bert_config.json',
             'config_sentence_transformers.json', '1_Pooling/config.json']
    manifest = {'format': 1, 'id': 'mpnet', 'version': 'v3-natural-s42-20261102',
                'precision': 'float32', 'max_length': 128, 'seed': 42, 'files': {}, 'roles': {}}
    for side in ['ai', 'buyer']:
        source = args.run_dir / 'models/mpnet' / side
        target = bundle / side
        target.mkdir(parents=True)
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
    archive = out / 'mpnet-v3-fp32.tar.gz'
    with tarfile.open(archive, 'w:gz', compresslevel=1) as tar:
        tar.add(bundle, arcname='mpnet-v3')
    metadata = {'url': 'https://github.com/csc301-2026-f/25-Merto/releases/download/mpnet-v3-natural-s42/mpnet-v3-fp32.tar.gz',
                'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size,
                'version': manifest['version'], 'precision': 'float32'}
    (out / 'weights-release.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata, indent=2))


if __name__ == '__main__':
    main()
