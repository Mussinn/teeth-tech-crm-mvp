"""Read-only production configuration gate. Outputs findings without secret values.

This checks local configuration, not DNS, actual firewall rules or offsite recovery.
Run on the target Linux host after provisioning and successful backup-all.
"""
from datetime import datetime, timezone, timedelta
from pathlib import Path
import argparse, json, os, re, stat, sys
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent

def read_env(path):
    values = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key] = value.strip().strip("'\"")
    return values

def evaluate(cfg, envfile, runtime, now=None):
    now = now or datetime.now(timezone.utc)
    findings = []
    def check(identifier, ok, message):
        findings.append({'id': identifier, 'status': 'pass' if ok else 'block', 'message': message})
    url = urlparse(cfg.get('SAAS_PUBLIC_URL', ''))
    domain = cfg.get('SAAS_BASE_DOMAIN', '')
    public_host = url.hostname or ''
    local = lambda host: host in ('localhost', '127.0.0.1', '::1') or host.endswith(('.localhost', '.test', '.local'))
    check('public-https', url.scheme == 'https' and bool(public_host) and not local(public_host)
          and url.port is None and not url.username and not url.password and url.path in ('', '/'),
          'Use a public HTTPS URL without credentials, path or custom port.')
    check('tenant-domain', bool(re.fullmatch(r'[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', domain)) and not local(domain),
          'Set a public base domain and DNS for lab1, lab2 and lab3.')
    check('portal-loopback', bool(re.fullmatch(r'127\.0\.0\.1:\d{2,5}', cfg.get('SAAS_HTTP_ADDR', ''))),
          'The portal must listen on loopback behind the HTTPS reverse proxy.')
    check('config-private', not (stat.S_IMODE(envfile.stat().st_mode) & 0o077),
          'Private environment file must have permissions 0600 or stricter.')
    for identifier, key in [('worker-secret', 'SAAS_WORKER_SECRET'), ('database-password', 'SAAS_DB_PASSWORD')]:
        check(identifier, len(cfg.get(key, '')) >= 24, 'Configure a separate long random secret.')
    password = cfg.get('SAAS_OWNER_PASSWORD', '')
    hashed = cfg.get('SAAS_OWNER_PASSWORD_HASH', '')
    check('owner-password', bool(re.fullmatch(r'\$2[aby]\$\d{2}\$.{53}', hashed)) or
          (len(password) >= 12 and password not in ('DemoOwner2026!', 'OwnerTestPassword2026')),
          'Use a private owner password/hash; this does not verify the already bootstrapped database password.')
    keyfile = Path(cfg.get('SAAS_BACKUP_KEY_FILE') or '/nonexistent-teethtech-key')
    check('backup-key', keyfile.is_file() and not keyfile.is_symlink() and keyfile.stat().st_size == 32
          and not (stat.S_IMODE(keyfile.stat().st_mode) & 0o077),
          'A private 32-byte backup key must exist outside backup archives; keep a separate recovery copy.')
    check('offsite-config', cfg.get('SAAS_BACKUP_AGE_RECIPIENT', '').startswith('age1') and
          bool(re.fullmatch(r'[A-Za-z0-9_.-]+@[A-Za-z0-9.-]+:/[A-Za-z0-9_./-]+', cfg.get('SAAS_BACKUP_REMOTE', ''))),
          'Configure encrypted external backups. These settings alone do not prove recoverability.')
    latest = runtime / 'backup-reports/latest.json'
    fresh = False
    try:
        report = json.loads(latest.read_text())
        created = datetime.fromisoformat(report['createdAt'])
        expected = {'control', 'images'} | {p.name for p in (runtime / 'labs').glob('lab*') if (p / 'compose.yaml').is_file()}
        fresh = not report.get('errors') and report.get('offsite') == 'uploaded-encrypted' and \
                expected.issubset(report.get('backups', {})) and timedelta(0) <= now-created <= timedelta(hours=26)
    except (OSError, ValueError, KeyError, TypeError):
        pass
    check('recent-offsite-backup', fresh, 'Require a complete successful external backup report within 26 hours.')
    for path in sorted((runtime / 'labs').glob('lab*/compose.yaml')):
        try:
            doc = json.loads(path.read_text())
            services = doc['services']
            private = all(isinstance(port, dict) and port.get('host_ip') == '127.0.0.1'
                          for service in services.values() for port in service.get('ports', []))
            check(path.parent.name+'-private-ports', private, 'Published laboratory ports must be loopback only.')
            https = services['frontend'].get('environment', {}).get('MVP_REQUIRE_HTTPS') == 'true'
            check(path.parent.name+'-https-cookies', https, 'Enable HTTPS session cookies for this laboratory.')
            rotated = all(service.get('logging', {}).get('options', {}).get('max-size') and
                          service.get('logging', {}).get('options', {}).get('max-file') for service in services.values())
            check(path.parent.name+'-log-rotation', rotated, 'Set bounded container log rotation; existing labs need a controlled configuration update.')
        except (OSError, ValueError, KeyError, TypeError):
            check(path.parent.name+'-compose', False, 'Cannot validate generated laboratory configuration.')
    return findings

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=ROOT/'saas/.env')
    parser.add_argument('--runtime', type=Path, default=ROOT/'saas/.saas-runtime')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    findings = evaluate(read_env(args.config), args.config, args.runtime)
    payload = {'format': 1, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'scope': 'configuration-only',
               'ready': all(f['status'] == 'pass' for f in findings), 'findings': findings,
               'remainingManualChecks': ['TLS/DNS/firewall', 'Owner MFA in database', 'External restore drill',
                    'Monitoring and alert delivery', 'Disk capacity and log retention', 'Client data processing terms']}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    for finding in findings:
        print(finding['status'].upper(), finding['id']+':', finding['message'])
    print('Scope: configuration only. Manual server checks remain even if this gate passes.')
    return 0 if payload['ready'] else 1

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError) as exc:
        print('Preflight could not validate configuration:', type(exc).__name__, file=sys.stderr)
        sys.exit(2)
