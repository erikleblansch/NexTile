// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const START = '/* BEGIN NEXTILE TERMINAL TRANSPARENCY */';
const END = '/* END NEXTILE TERMINAL TRANSPARENCY */';

// Keep Promise adapters local; do not modify Gio prototypes shared with Shell.
function load(file, cancellable) {
    return new Promise((resolve, reject) => {
        file.load_contents_async(cancellable, (source, result) => {
            try {
                const [, bytes, etag] = source.load_contents_finish(result);
                resolve([new TextDecoder('utf-8', {fatal: true}).decode(bytes), etag]);
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function makeDirectory(file, cancellable) {
    try {
        await new Promise((resolve, reject) => {
            file.make_directory_async(GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
                try { resolve(source.make_directory_finish(result)); } catch (error) { reject(error); }
            });
        });
    } catch (error) {
        if (error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
            return;
        const parent = file.get_parent();
        if (!parent || !error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            throw error;
        await makeDirectory(parent, cancellable);
        await makeDirectory(file, cancellable);
    }
}

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
        this._cancellable = new Gio.Cancellable();
        this._queue = Promise.resolve();
    }

    _enqueue(action) {
        const request = (this._queue ?? Promise.resolve()).then(() => {
            this._cancellable.set_error_if_cancelled();
            return action();
        });
        // A failed request must not prevent a later user change. The caller
        // still receives the original rejection, including cancellation.
        if (!this._cancellable.is_cancelled())
            this._queue = request.catch(() => {});
        return request;
    }

    async _read() {
        try {
            const [text, etag] = await load(this._file, this._cancellable);
            return [text, etag, true];
        } catch (error) {
            if (error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                return ['', null, false];
            throw error;
        }
    }

    readEnabled() {
        return this._enqueue(async () => {
            const [text] = await this._read();
            return text.includes(START) && text.includes(END);
        });
    }

    apply(enabled) {
        return this._enqueue(() => this._apply(enabled));
    }

    async _apply(enabled) {
        const file = this._file;
        const cssFile = this._cssFile;
        const cancellable = this._cancellable;
        const [original, etag, exists] = await this._read();
        let css = '';
        if (enabled)
            [css] = await load(cssFile, cancellable);
        // Ubuntu's Terminal transparency patch ignores the normal CSS alpha
        // and reads this GTK style property instead. Emit it only when that
        // patch's schema key exists, so upstream Terminal sees no unknown CSS.
        const profile = Gio.SettingsSchemaSource.get_default()?.lookup('org.gnome.Terminal.Legacy.Profile', true);
        if (profile?.has_key('use-theme-transparency'))
            css += '\nterminal-window vte-terminal { -TerminalScreen-background-darkness: 0.5; }\n';
        const updated = mergeTerminalStyle(original, css, enabled);
        cancellable.set_error_if_cancelled();
        if (updated === original)
            return false;
        const parent = file.get_parent();
        await makeDirectory(parent, cancellable);
        if (exists) {
            const stamp = GLib.DateTime.new_now_local().format('%Y%m%dT%H%M%S%f');
            await new Promise((resolve, reject) => {
                file.copy_async(parent.get_child(`gtk.css.nextile-backup-${stamp}`),
                    Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, cancellable, null, (source, result) => {
                        try { resolve(source.copy_finish(result)); } catch (error) { reject(error); }
                    });
            });
        }
        // The etag prevents overwriting concurrent edits. Default replacement
        // follows symlinks and retains permissions; no shell command is used.
        // GBytes keeps the buffer alive until the asynchronous write finishes.
        const bytes = new GLib.Bytes(new TextEncoder().encode(updated));
        await new Promise((resolve, reject) => {
            file.replace_contents_bytes_async(bytes, etag, false, Gio.FileCreateFlags.NONE,
                cancellable, (source, result) => {
                    try { resolve(source.replace_contents_finish(result)); } catch (error) { reject(error); }
                });
        });
        return true;
    }

    destroy() {
        this._cancellable.cancel();
        this._queue = null;
        this._file = null;
        this._cssFile = null;
    }
}
