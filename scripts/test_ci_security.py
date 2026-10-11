import unittest
from datetime import date
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('ci_security', Path(__file__).with_name('ci-security.py'))
ci_security = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci_security)
evaluate = ci_security.evaluate

def report(v):return {'metadata':{'vulnerabilities':{}},'vulnerabilities':v}
class PolicyTests(unittest.TestCase):
 def setUp(self):
  self.identifier='GHSA-example'
  self.policy={'developmentOnly':{self.identifier:{'reviewBy':'2026-11-06'}}}
  self.dev=report({'leaf':{'severity':'high','via':[{'url':'https://github.com/advisories/'+self.identifier}]},'parent':{'severity':'high','via':['leaf']}})
 def test_only_reviewed_development_chain_passes(self):self.assertEqual(evaluate(report({}),self.dev,self.policy,date(2026,10,7)),[self.identifier])
 def test_new_finding_fails(self):
  with self.assertRaises(ValueError):evaluate(report({}),self.dev,{},date(2026,10,7))
 def test_expired_fails(self):
  with self.assertRaises(ValueError):evaluate(report({}),self.dev,self.policy,date(2026,11,7))
 def test_runtime_fails_even_if_exception_exists(self):
  with self.assertRaises(ValueError):evaluate(self.dev,self.dev,self.policy,date(2026,10,7))
 def test_service_failure_fails_closed(self):
  with self.assertRaises(ValueError):evaluate({'error':'network'},self.dev,self.policy,date(2026,10,7))
if __name__=='__main__':unittest.main()
