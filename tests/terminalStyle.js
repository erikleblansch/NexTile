import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {TerminalStyle, mergeTerminalStyle} from '../terminalStyle.js';
const assert = (value, message) => { if (!value) throw new Error(message); };
const css = 'terminal-window vte-terminal { background-color: rgba(32,32,36,0.5); }';
const original = '/* user CSS */\nbutton {color: red;}\n';
const added = mergeTerminalStyle(original, css, true);
assert(added.startsWith(original), 'Existing CSS preserved byte for byte');
assert(mergeTerminalStyle(added, css, true) === added, 'Idempotent enable');
const removed = mergeTerminalStyle(added, css, false);
assert(removed.startsWith(original) && !removed.includes('TRANSPARENCY'), 'Remove only owned block');
assert(mergeTerminalStyle(removed, css, false) === removed, 'Idempotent disable');
for (const broken of ['/* BEGIN NEXTILE TERMINAL TRANSPARENCY */', '/* END NEXTILE TERMINAL TRANSPARENCY */', added + added]) {
    let rejected = false;
    try { mergeTerminalStyle(broken, css, true); } catch { rejected = true; }
    assert(rejected, 'Malformed/duplicate markers rejected without overwriting');
}
const dir = GLib.dir_make_tmp('nextile-css-test-XXXXXX');
const source = Gio.File.new_for_path(`${dir}/style.css`);
source.replace_contents(css, null, false, Gio.FileCreateFlags.NONE, null);
const targetDir = Gio.File.new_for_path(`${dir}/gtk-3.0`);
targetDir.make_directory(null);
const actual = Gio.File.new_for_path(`${dir}/original.css`);
actual.replace_contents(original, null, false, Gio.FileCreateFlags.NONE, null);
const target = targetDir.get_child('gtk.css');
target.make_symbolic_link(actual.get_path(), null);
const style = new TerminalStyle(source, dir);
assert(!style.enabled && style.apply(true) && style.enabled, 'Enable persistent GTK style');
assert(!style.apply(true), 'Unchanged file is not rewritten');
assert(target.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) === Gio.FileType.SYMBOLIC_LINK,
    'Existing symlink preserved');
assert(new TextDecoder().decode(actual.load_contents(null)[1]) === added, 'Symlink target updated');
assert(style.apply(false) && !style.enabled, 'Disable persistent GTK style');
const files = targetDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
let backups = 0;
for (let info; (info = files.next_file(null));) {
    if (info.get_name().startsWith('gtk.css.nextile-backup-')) backups++;
    targetDir.get_child(info.get_name()).delete(null);
}
files.close(null);
assert(backups === 2, 'A backup for each change, none for no-op');
targetDir.delete(null); actual.delete(null); source.delete(null); Gio.File.new_for_path(dir).delete(null);
print('PASS: terminal CSS preservation, removal, idempotency, backups, symlinks and malformed markers');
