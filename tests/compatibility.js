import GLib from 'gi://GLib';
import {maximizeFlags, maximize, unmaximize, updateSearch} from '../compatibility.js';
const assert = (value, message) => { if (!value) throw new Error(message); };
for (const modern of [false, true]) {
    let flags = 0;
    const window = modern ? {
        get_maximize_flags: () => flags,
        set_maximize_flags: f => { flags |= f; },
        set_unmaximize_flags: f => { flags &= ~f; },
    } : {
        get_maximized: () => flags,
        maximize: f => { flags |= f; },
        unmaximize: f => { flags &= ~f; },
    };
    maximize(window, 1);
    assert(maximizeFlags(window) === 1, 'Partial maximization preserved');
    maximize(window, 2);
    assert(maximizeFlags(window) === 3, 'Both axes maximized');
    unmaximize(window, 3);
    assert(maximizeFlags(window) === 0, 'Both axes restored');
}
const loop = new GLib.MainLoop(null, false);
(async () => {
    for (const kind of ['callback', 'promise', 'both']) {
        let count = 0;
        const display = {updateSearch(ids, terms, callback) {
            assert(ids[0] === 'app' && terms[0] === 'term', 'Search parameters forwarded');
            if (kind === 'callback') {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { callback(); callback(); return GLib.SOURCE_REMOVE; });
                return undefined;
            }
            return Promise.resolve().then(() => { if (kind === 'both') callback(); });
        }};
        await updateSearch(display, ['app'], ['term'], () => count++);
        await new Promise(resolve => GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { resolve(); return GLib.SOURCE_REMOVE; }));
        assert(count === 1, `Exactly one completion for ${kind}`);
    }
    let rejected = false;
    try {
        await updateSearch({updateSearch: () => Promise.reject(new Error('cancelled'))}, [], [], () => { throw new Error('must not complete'); });
    } catch (error) { rejected = error.message === 'cancelled'; }
    assert(rejected, 'Search failures propagate to cancellation handling');
    print('PASS: Mutter 48 and 49–51 maximize APIs; callback/Promise search completion');
})().catch(error => { printerr(error.stack); imports.system.exit(1); }).finally(() => loop.quit());
loop.run();
