#!/usr/bin/env python3
"""Require complete catalogs, matching placeholders and an English fallback."""
import gettext
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    pot = Path(tmp) / 'nextile.pot'
    subprocess.run(['xgettext', '--language=JavaScript', '--from-code=UTF-8',
                    '--keyword=_', '--no-location', '-o', str(pot),
                    *map(str, sorted(ROOT.glob('*.js')))], check=True)
    # Load the template through GNU gettext instead of a homegrown PO parser.
    filled = subprocess.check_output(['msgen', str(pot)])
    mo = Path(tmp) / 'source.mo'
    subprocess.run(['msgfmt', '-o', str(mo), '-'], input=filled, check=True)
    with mo.open('rb') as source:
        keys = set(gettext.GNUTranslations(source)._catalog) - {''}
    for lang in ('nl', 'de', 'fr', 'es', 'pt', 'it', 'pl', 'ja', 'zh', 'uk'):
        t = gettext.translation('nextile', ROOT / 'locale', languages=[lang])
        assert set(t._catalog) - {''} == keys, f'{lang}: missing {keys-set(t._catalog)}, stale {set(t._catalog)-keys-{""}}'
        for key in keys:
            value = t.gettext(key)
            assert value, (lang, key)
            assert re.findall(r'%[ds]', key) == re.findall(r'%[ds]', value), (lang, key)
        # Regional locales must use the shipped base language.
        regional = gettext.translation('nextile', ROOT / 'locale', languages=[lang + '_XX'])
        assert regional.gettext('Search') == t.gettext('Search')
    for lang in ('en', 'ko', 'C'):
        t = gettext.translation('nextile', ROOT / 'locale', languages=[lang], fallback=True)
        assert all(t.gettext(key) == key for key in keys), lang
    print(f'PASS: {len(keys)} strings, ten complete catalogs, regional and English fallbacks')
