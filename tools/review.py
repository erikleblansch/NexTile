#!/usr/bin/env python3
"""Keep the full Shexli report and reject findings outside the reviewed baseline.

A successful exit means the findings match the documented triage, NOT that
Shexli reports zero issues or that GNOME has approved the extension.
"""
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = Path('dist/nextile@erikleblansch.github.io.shell-extension.zip')
REPORT = ROOT / 'dist/shexli-report.json'
EXPECTED = ROOT / 'tests/review-expectations.json'

for requirement in (ROOT / 'tools/review-requirements.txt').read_text().splitlines():
    if requirement and not requirement.startswith('#'):
        name, version = requirement.split('==')
        assert importlib.metadata.version(name) == version, f'Use the pinned reviewer requirements: {name}'

result = subprocess.run(['shexli', str(ARCHIVE), '--format', 'json'], cwd=ROOT,
                        check=True, capture_output=True, text=True)
report = json.loads(result.stdout.replace(str(ROOT) + '/', ''))
REPORT.write_text(json.dumps(report, indent=2) + '\n')

def signature(finding):
    return {
        'rule_id': finding['rule_id'],
        'severity': finding['severity'],
        'evidence': [{'path': item['path'].split('.zip:', 1)[-1], 'snippet': item['snippet']}
                     for item in finding['evidence']],
    }

actual = sorted((signature(f) for f in report['findings']), key=lambda f: f['rule_id'])
expected = json.loads(EXPECTED.read_text())
print(f'Shexli {importlib.metadata.version("shexli")}: {report["summary"]["status"]}')
for finding in report['findings']:
    print(f'  {finding["severity"]}: {finding["rule_id"]} — {finding["message"]}')
print(f'Report: {REPORT.relative_to(ROOT)}')
print(f'Archive SHA-256: {hashlib.sha256((ROOT / ARCHIVE).read_bytes()).hexdigest()}')
assert report['spec_version'] == '2026-04-02', 'Reassess the triage when the checker rules change'
assert actual == expected, 'Findings changed: investigate and update the documented triage before release'
print('PASS: report matches the four documented findings; no warnings remain. This is not GNOME approval.')
