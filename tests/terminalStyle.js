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
const loop = new GLib.MainLoop(null, false);
const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));
const rejects = async (task, code, message) => {
    let rejected = false;
    try { await task; } catch (error) { rejected = error.matches?.(Gio.IOErrorEnum, code); }
    assert(rejected, message);
};
const removeTree = file => {
    if (file.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) === Gio.FileType.DIRECTORY) {
        const entries = file.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        for (let info; (info = entries.next_file(null));)
            removeTree(file.get_child(info.get_name()));
        entries.close(null);
    }
    file.delete(null);
};

(async () => {
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
    actual.set_attribute_uint32('unix::mode', 0o640, Gio.FileQueryInfoFlags.NONE, null);
    assert(!await style.readEnabled() && await style.apply(true) && await style.readEnabled(), 'Enable persistent GTK style');
    assert(!await style.apply(true), 'Unchanged file is not rewritten');
    assert(target.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) === Gio.FileType.SYMBOLIC_LINK,
        'Existing symlink preserved');
    const readActual = () => new TextDecoder().decode(actual.load_contents(null)[1]);
    assert(readActual() === added, 'Symlink target updated');
    assert((actual.query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null).get_attribute_uint32('unix::mode') & 0o777) === 0o640,
        'Existing permissions preserved');
    assert(await style.apply(false) && !await style.readEnabled(), 'Disable persistent GTK style');
    const files = targetDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let backups = 0;
    for (let info; (info = files.next_file(null));) {
        if (info.get_name().startsWith('gtk.css.nextile-backup-')) backups++;
    }
    files.close(null);
    assert(backups === 2, 'A backup for each change, none for no-op');

    const rapid = await Promise.all([style.apply(true), style.apply(false), style.apply(true), style.apply(false)]);
    assert(rapid.every(Boolean) && !await style.readEnabled(), 'Rapid on/off writes are serialized; the last choice wins');
    assert(readActual().startsWith(original), 'Rapid changes preserve unrelated CSS');

    const read = style._read.bind(style);
    const external = '/* edited by another program */\nbutton {color: blue;}\n';
    style._read = async () => {
        const snapshot = await read();
        await wait(10);
        actual.replace_contents(external, null, false, Gio.FileCreateFlags.NONE, null);
        return snapshot;
    };
    await rejects(style.apply(true), Gio.IOErrorEnum.WRONG_ETAG, 'Concurrent external edit rejects a stale write');
    assert(readActual() === external, 'Concurrent external CSS is not overwritten');
    style._read = read;
    assert(await style.apply(true), 'A failed request does not poison the queue');
    await style.apply(false);

    const beforeCancel = readActual();
    let release;
    let started;
    let reads = 0;
    const entered = new Promise(resolve => { started = resolve; });
    const blocked = new Promise(resolve => { release = resolve; });
    style._read = async () => {
        reads++;
        const snapshot = await read();
        started();
        await blocked;
        return snapshot;
    };
    const pending = style.apply(true);
    const queued = style.apply(false);
    await entered;
    await wait(1);
    assert(readActual() === beforeCancel, 'Main loop remains responsive while a read is pending');
    style.destroy();
    release();
    await rejects(pending, Gio.IOErrorEnum.CANCELLED, 'Destroy cancels an in-flight request before it writes');
    await rejects(queued, Gio.IOErrorEnum.CANCELLED, 'Destroy cancels queued requests');
    assert(reads === 1 && readActual() === beforeCancel, 'Cancelled queue neither starts another read nor changes CSS');
    await rejects(style.apply(true), Gio.IOErrorEnum.CANCELLED, 'Destroyed service rejects further requests');

    const freshDir = `${dir}/new/config`;
    const fresh = new TerminalStyle(source, freshDir);
    assert(!await fresh.readEnabled() && !await fresh.apply(false), 'Missing configuration is a no-op when disabled');
    assert(!Gio.File.new_for_path(freshDir).query_exists(null), 'Disabled preference creates no directories');
    assert(await fresh.apply(true) && await fresh.readEnabled(), 'Enable creates missing parent directories asynchronously');
    fresh.destroy();
    removeTree(Gio.File.new_for_path(dir));
    print('PASS: async terminal CSS preservation, backups, symlinks, permissions, queue ordering, etags, cancellation and missing directories');
})().catch(error => { printerr(error.stack); imports.system.exit(1); }).finally(() => loop.quit());
loop.run();
