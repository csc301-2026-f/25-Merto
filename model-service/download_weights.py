"""Download the pinned GitHub Release bundle and verify all files before use."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import tarfile
import tempfile
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent


def verify(root):
    manifest = json.loads((root / 'manifest.json').read_text())
    if manifest.get('id') != 'mpnet' or manifest.get('precision') != 'float32':
        raise ValueError('Unexpected model bundle identity or precision.')
    for name, expected in manifest['files'].items():
        f = root / name
        if not f.resolve().is_relative_to(root.resolve()):
            raise ValueError('Unsafe bundle path.')
        digest = hashlib.sha256()
        with f.open('rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(chunk)
        if f.stat().st_size != expected['size'] or digest.hexdigest() != expected['sha256']:
            raise ValueError('Model bundle integrity check failed: ' + name)
    return manifest


def main():
    parent = HERE / 'weights'
    parent.mkdir(exist_ok=True)
    target = parent / 'mpnet-v3'
    if target.exists():
        verify(target)
        print('MPNet bundle already present and verified.')
        return
    meta = json.loads((HERE / 'weights-release.json').read_text())
    with tempfile.TemporaryDirectory(dir=parent) as temporary:
        stage = Path(temporary)
        archive = stage / 'bundle.tar.gz'
        digest = hashlib.sha256()
        count = 0
        with urlopen(meta['url'], timeout=120) as source, archive.open('wb') as output:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                count += len(chunk)
                if count > meta['bytes']:
                    raise ValueError('Model download exceeds its pinned size.')
                digest.update(chunk)
                output.write(chunk)
        if count != meta['bytes'] or digest.hexdigest() != meta['sha256']:
            raise ValueError('Model download checksum mismatch.')
        with tarfile.open(archive) as tar:
            # The exporter produces ordinary files/directories only; reject links.
            for member in tar.getmembers():
                if not (member.isfile() or member.isdir()) or not (stage / member.name).resolve().is_relative_to(stage):
                    raise ValueError('Unsafe model archive member.')
            tar.extractall(stage, filter='data')
        verify(stage / 'mpnet-v3')
        os.replace(stage / 'mpnet-v3', target)
    print('Downloaded and verified the trained MPNet AI/Buyer FP32 pair.')


if __name__ == '__main__':
    main()

