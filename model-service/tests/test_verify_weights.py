"""Ensure a build rejects incomplete/corrupt Git weights before serving requests."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_weights import verify


class TrackedWeightsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.manifest = {'format': 2, 'id': 'mpnet', 'precision': 'float32', 'files': {}}
        for side in ['ai', 'buyer']:
            (self.root / side).mkdir()
            index = {'weight_map': {'encoder.weight': 'model-00001-of-00001.safetensors'}}
            self.record(side + '/model.safetensors.index.json', json.dumps(index).encode())
            self.record(side + '/model-00001-of-00001.safetensors', b'test-weight-bytes')
            for name in ['head.json', 'config.json', 'tokenizer.json']:
                self.record(side + '/' + name, b'{}')
        self.save_manifest()

    def record(self, name, data):
        (self.root / name).write_bytes(data)
        self.manifest['files'][name] = {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

    def save_manifest(self):
        (self.root / 'manifest.json').write_text(json.dumps(self.manifest))

    def test_complete_clone_needs_no_network(self):
        with patch('socket.create_connection', side_effect=AssertionError('Network must not be used')):
            self.assertEqual(verify(self.root), self.manifest)

    def test_missing_shard_fails(self):
        (self.root / 'buyer/model-00001-of-00001.safetensors').unlink()
        with self.assertRaisesRegex(ValueError, 'shard is missing'):
            verify(self.root)

    def test_corrupt_shard_fails_even_when_size_is_unchanged(self):
        (self.root / 'ai/model-00001-of-00001.safetensors').write_bytes(b'Test-weight-bytes')
        with self.assertRaisesRegex(ValueError, 'integrity check failed'):
            verify(self.root)

    def test_index_cannot_reference_an_untracked_shard(self):
        self.record('ai/model.safetensors.index.json', json.dumps({
            'weight_map': {'encoder.weight': 'not-in-git.safetensors'}}).encode())
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, 'shard is missing'):
            verify(self.root)

    def test_shards_cannot_escape_the_role_directory(self):
        self.record('ai/model.safetensors.index.json', json.dumps({
            'weight_map': {'encoder.weight': '../buyer/model-00001-of-00001.safetensors'}}).encode())
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, 'Invalid model shard path'):
            verify(self.root)


if __name__ == '__main__':
    unittest.main()
