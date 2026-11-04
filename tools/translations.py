#!/usr/bin/env python3
"""Compile and check gettext catalogs (requires GNU gettext)."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
for catalog in sorted((ROOT / 'po').glob('*.po')):
    target = ROOT / 'locale' / catalog.stem / 'LC_MESSAGES' / 'nextile.mo'
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['msgfmt', '--check', '--check-format', '-o', str(target), str(catalog)], check=True)
