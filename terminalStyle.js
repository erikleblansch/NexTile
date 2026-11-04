// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const START = '/* BEGIN NEXTILE TERMINAL TRANSPARENCY */';
const END = '/* END NEXTILE TERMINAL TRANSPARENCY */';

export function mergeTerminalStyle(original, css, enabled) {
    const left = original.indexOf(START);
    const right = original.indexOf(END);
    if ((left < 0) !== (right < 0) || right < left ||
        (left >= 0 && (original.indexOf(START, left + START.length) >= 0 ||
            original.indexOf(END, right + END.length) >= 0)))
        throw new Error('Invalid NexTile CSS markers');
    const block = enabled ? `${START}\n${css.trim()}\n${END}` : '';
    if (left < 0)
        return enabled ? `${original}${original && !original.endsWith('\n') ? '\n' : ''}${block}\n` : original;
    return original.slice(0, left) + block + original.slice(right + END.length);
}

export class TerminalStyle {
    constructor(cssFile, configDir = GLib.get_user_config_dir()) {
        this._cssFile = cssFile;
        this._file = Gio.File.new_for_path(GLib.build_filenamev([configDir, 'gtk-3.0', 'gtk.css']));
    }

    _read() {
        try {
            const [, bytes, etag] = this._file.load_contents(null);
            return [new TextDecoder('utf-8', {fatal: true}).decode(bytes), etag];
        } catch (error) {
            if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                return ['', null];
            throw error;
        }
    }

    get enabled() {
        const [text] = this._read();
        return text.includes(START) && text.includes(END);
    }

    apply(enabled) {
        const [original, etag] = this._read();
        const [, bytes] = this._cssFile.load_contents(null);
        const updated = mergeTerminalStyle(original, new TextDecoder().decode(bytes), enabled);
        if (updated === original)
            return false;
        const parent = this._file.get_parent();
        if (!parent.query_exists(null))
            parent.make_directory_with_parents(null);
        if (this._file.query_exists(null)) {
            const stamp = GLib.DateTime.new_now_local().format('%Y%m%dT%H%M%S%f');
            this._file.copy(parent.get_child(`gtk.css.nextile-backup-${stamp}`),
                Gio.FileCopyFlags.NONE, null, null);
        }
        // The etag prevents overwriting concurrent edits. Default replacement
        // follows symlinks and retains permissions; no shell command is used.
        this._file.replace_contents(updated, etag, false, Gio.FileCreateFlags.NONE, null);
        return true;
    }
}
