import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('preflight', Path(__file__).with_name('production-preflight.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PreflightTests(unittest.TestCase):
    def test_demo_cannot_pass_production_gate(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            env = root/'config'; env.write_text(''); env.chmod(0o600)
            findings = module.evaluate({'SAAS_PUBLIC_URL':'http://localhost:8099','SAAS_BASE_DOMAIN':'localhost',
                'SAAS_HTTP_ADDR':'127.0.0.1:8099','SAAS_OWNER_PASSWORD':'DemoOwner2026!'},env,root)
            statuses = {f['id']: f['status'] for f in findings}
            self.assertEqual(statuses['public-https'], 'block')
            self.assertEqual(statuses['owner-password'], 'block')
            self.assertEqual(statuses['recent-offsite-backup'], 'block')
            self.assertEqual(statuses['portal-loopback'], 'pass')

    def test_secret_values_never_appear_in_findings(self):
        with tempfile.TemporaryDirectory() as name:
            root=Path(name); env=root/'config'; env.write_text(''); env.chmod(0o600)
            secret='secret-value-not-for-output'*2
            findings=module.evaluate({'SAAS_WORKER_SECRET':secret},env,root)
            self.assertNotIn(secret,str(findings))

if __name__ == '__main__': unittest.main()
