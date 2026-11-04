#!/usr/bin/env python3
"""Install/remove a scoped GTK style, preserving other user CSS and a backup."""
import argparse
import datetime
import os
from pathlib import Path
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--remove', action='store_true', help='Remove only the NexTile CSS block')
args = parser.parse_args()
start = '/* BEGIN NEXTILE TERMINAL TRANSPARENCY */'
end = '/* END NEXTILE TERMINAL TRANSPARENCY */'
config = Path(os.environ.get('XDG_CONFIG_HOME', Path.home() / '.config'))
target = (config / 'gtk-3.0/gtk.css').resolve()
target.parent.mkdir(parents=True, exist_ok=True)
original = target.read_text() if target.exists() else ''
updated = original
if start in updated:
    left = updated.index(start)
    right = updated.index(end, left) + len(end)
    updated = updated[:left] + updated[right:].lstrip('\n')
if not args.remove:
    css = (Path(__file__).resolve().parents[1] / 'extras/terminal-transparency.css').read_text().rstrip()
    updated = updated.rstrip() + ('\n\n' if updated.strip() else '') + f'{start}\n{css}\n{end}\n'
if updated == original:
    print('Terminal CSS already configured.')
else:
    stamp = datetime.datetime.now().strftime('%Y%m%dT%H%M%S%f')
    backup = target.with_name(f'gtk.css.nextile-backup-{stamp}')
    backup.write_text(original)
    mode = target.stat().st_mode & 0o777 if target.exists() else 0o644
    with tempfile.NamedTemporaryFile(mode='w', dir=target.parent, prefix='.nextile-', delete=False) as temporary:
        temporary.write(updated)
        temp_path = Path(temporary.name)
    temp_path.chmod(mode)
    temp_path.replace(target)
    print(f'Updated: {target}')
    print(f'Backup: {backup}')
    print('GNOME Terminal: use theme colors in the profile; restart Terminal or log in again to load CSS.')
