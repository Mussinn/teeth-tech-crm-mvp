"""Integrity checks reject corruption, incomplete archives and unsafe paths."""
import hashlib,json,tempfile,unittest
from pathlib import Path
from saas_backups import verify

class BackupIntegrityTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  (self.root/'database.sql').write_bytes(b'example backup')
  self.manifest={'format':1,'files':{'database.sql':hashlib.sha256(b'example backup').hexdigest()}}
  self.save();(self.root/'COMPLETE').write_text('complete')
 def tearDown(self):self.temp.cleanup()
 def save(self):(self.root/'manifest.json').write_text(json.dumps(self.manifest))
 def test_valid(self):verify(self.root)
 def test_corruption(self):
  (self.root/'database.sql').write_bytes(b'corrupt')
  with self.assertRaises(ValueError):verify(self.root)
 def test_incomplete(self):
  (self.root/'COMPLETE').unlink()
  with self.assertRaises(ValueError):verify(self.root)
 def test_untracked_secret(self):
  (self.root/'unexpected.env').write_text('secret')
  with self.assertRaises(ValueError):verify(self.root)
 def test_traversal(self):
  self.manifest['files']={'../database.sql':'invalid'};self.save()
  with self.assertRaises(ValueError):verify(self.root)
 def test_symlink(self):
  (self.root/'link').symlink_to(self.root/'database.sql')
  with self.assertRaises(ValueError):verify(self.root)

if __name__=='__main__':unittest.main()
