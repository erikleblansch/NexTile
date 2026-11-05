#!/usr/bin/env python3
"""Check the actual upload archive, including schemas and compiled catalogs."""
import gettext
import io
import json
from pathlib import Path, PurePosixPath
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parents[1]
with zipfile.ZipFile(root / 'dist/nextile@erikleblansch.github.io.shell-extension.zip') as package:
    names = package.namelist()
    assert len(names) == len(set(names)), 'Duplicate ZIP entries'
    for name in names:
        path = PurePosixPath(name)
        assert not path.is_absolute() and '..' not in path.parts, name
        assert path.parts[0] not in {'tests', 'tools', 'docs', 'po', 'node_modules', '.git'}, name
        assert path.suffix in {'.js', '.json', '.css', '.xml', '.compiled', '.mo'} or name == 'LICENSE', name
        assert package.read(name), f'Empty file: {name}'
    metadata = json.loads(package.read('metadata.json'))
    assert metadata['uuid'] == 'nextile@erikleblansch.github.io'
    assert metadata['shell-version'] == ['46', '47', '48', '49', '50', '51']
    assert 'version' not in metadata, 'EGO assigns its own version number'
    assert 'session-modes' not in metadata, 'Default user session only'
    assert 'clipboard' in metadata['description'], 'Declare result-triggered clipboard writes'
    assert 'GNU GENERAL PUBLIC LICENSE' in package.read('LICENSE').decode()
    schema_id = metadata['settings-schema']
    schema = ET.fromstring(package.read(f'schemas/{schema_id}.gschema.xml')).find('schema')
    assert schema.get('id') == schema_id
    assert schema.get('path') == '/org/gnome/shell/extensions/nextile/'
    assert 'schemas/gschemas.compiled' in names
    for lang in ('nl', 'de', 'fr', 'es', 'pt', 'it', 'pl', 'ja', 'zh', 'uk'):
        name = f'locale/{lang}/LC_MESSAGES/{metadata["gettext-domain"]}.mo'
        catalog = gettext.GNUTranslations(io.BytesIO(package.read(name)))
        assert len(catalog._catalog) == 26, lang
    assert {'extension.js', 'stylesheet.css', 'nativeSearch.js', 'terminalStyle.js'} <= set(names)
print(f'PASS: {len(names)} upload files; metadata, license, schema and ten compiled catalogs')
