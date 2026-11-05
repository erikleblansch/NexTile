import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Cogl from 'gi://Cogl';
import Clutter from 'gi://Clutter';
import GdkPixbuf from 'gi://GdkPixbuf';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Test the same version adapters used by the installed extension.
import {maximizeFlags, maximize, unmaximize} from '../nextile@erikleblansch.github.io/compatibility.js';

const delay = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));
const rect = window => {
    const r = window.get_frame_rect();
    return {x: r.x, y: r.y, width: r.width, height: r.height};
};

export default class TestDriver extends Extension {
    enable() {
        this._run().catch(async error => {
            try {
                const file = Gio.File.new_for_path(`${GLib.getenv('NEXTILE_TEST_RESULT')}.failure.png`);
                const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                await new Promise((resolve, reject) => new Shell.Screenshot().screenshot(false, stream, (source, result) => {
                    try { source.screenshot_finish(result); resolve(); } catch (e) { reject(e); }
                }));
                stream.close(null);
            } catch { /* Preserve the original failure even if capture fails. */ }
            this._finish(`${this._log?.join('\n')}\nFAIL: ${error.message}\n${error.stack}`);
        });
    }

    _finish(message) {
        GLib.file_set_contents(GLib.getenv('NEXTILE_TEST_RESULT'), message);
    }

    async _run() {
        await delay(2000);
        Main.overview.hide();
        const ext = Main.extensionManager.lookup('nextile@erikleblansch.github.io')?.stateObj;
        const log = [];
        this._log = log;
        const assert = (value, message) => {
            if (!value)
                throw new Error(message);
            log.push(`PASS: ${message}`);
        };
        assert(ext?._tiler?._running, 'Extension loads and tiler starts');
        assert(ext._toggle.title === 'NexTile' && !!ext._toggle.menu, 'Native Quick Settings toggle with menu');
        await ext._terminalTask;
        const floatChildren = ext._toggle._float.get_children();
        const warning = floatChildren.find(child => child.icon_name === 'dialog-warning-symbolic');
        assert(warning && floatChildren.indexOf(warning) < floatChildren.indexOf(ext._toggle._float.label),
            'Warning icon precedes the floating-window switch label');
        if (GLib.getenv('NEXTILE_TEST_ONLY') === 'settings') {
            await this._settingsTests(ext, assert);
            this._finish(log.join('\n'));
            return;
        }
        if (GLib.getenv('NEXTILE_TEST_ONLY') === 'search') {
            await this._searchTests(ext, assert);
            this._finish(log.join('\n'));
            return;
        }
        if (GLib.getenv('NEXTILE_TEST_ONLY') === 'terminal') {
            const background = new Gio.Settings({schema_id: 'org.gnome.desktop.background'});
            background.set_string('picture-options', 'none');
            background.set_string('primary-color', '#0b5e63');
            await delay(800);
            await this._terminalTests(ext, assert);
            this._finish(log.join('\n'));
            return;
        }
        if (GLib.getenv('NEXTILE_TEST_ONLY') !== 'tiling') {
            await this._settingsTests(ext, assert);
            await this._panelTests(ext, assert);
            await this._searchTests(ext, assert);
            await this._terminalTests(ext, assert);
        }
        const spawn = async (name, mode = null) => {
            Gio.Subprocess.new(['python3', GLib.getenv('NEXTILE_TEST_FIXTURE'), name,
                ...(mode ? [mode === true ? 'large' : mode] : [])], Gio.SubprocessFlags.NONE);
            await delay(1000);
            const window = global.get_window_actors().map(actor => actor.meta_window)
                .find(win => win.title === name);
            assert(!!window, `GTK window ${name} mapped`);
            return window;
        };
        const a = await spawn('NexTile A');
        const saved = ext._tiler._original.get(a).rect;
        const original = {width: saved.width, height: saved.height};
        const area = a.get_work_area_current_monitor();
        assert(rect(a).width === area.width - 16, 'First window fills work area with outer gap');
        const b = await spawn('NexTile B');
        const a2 = rect(a);
        const b2 = rect(b);
        assert(a2.width + b2.width + 24 === area.width, 'Second window halves largest tile');
        const c = await spawn('NexTile C');
        assert(rect(a).height + rect(c).height + 24 === area.height, 'Third window splits longest side');
        assert(JSON.stringify(rect(b)) === JSON.stringify(b2), 'Unrelated tile remains stable');
        c.delete(global.get_current_time());
        await delay(600);
        assert(JSON.stringify(rect(a)) === JSON.stringify(a2), 'Closing restores sibling space');
        b.minimize();
        await delay(600);
        assert(rect(a).width === area.width - 16, 'Minimize releases tile');
        b.unminimize();
        await delay(600);
        assert(rect(a).width === a2.width, 'Unminimize rejoins tiling');
        b.make_fullscreen();
        await delay(600);
        assert(b.fullscreen && rect(a).width === area.width - 16, 'Fullscreen is respected');
        b.unmake_fullscreen();
        await delay(600);
        assert(rect(a).width === a2.width, 'Fullscreen exit rejoins tiling');
        ext._tiler.toggleFloating(b);
        await delay(600);
        assert(ext._tiler.isFloating(b) && rect(a).width === area.width - 16, 'Floating releases tile');
        ext._tiler.toggleFloating(b);
        await delay(600);
        assert(rect(a).width === a2.width, 'Floating off rejoins tiling');
        ext._settings.set_int('gap', 12);
        await delay(600);
        assert(rect(a).width + rect(b).width + 36 === area.width, 'Gap changes apply immediately');
        ext._settings.set_int('gap', 8);
        ext._settings.set_string('split-mode', 'vertical');
        ext._tiler.retile();
        await delay(600);
        assert(rect(a).width === area.width - 16 && rect(a).height + rect(b).height + 24 === area.height,
            'Split orientation and reflow work');
        ext._settings.set_string('split-mode', 'auto');
        ext._tiler.retile();
        await delay(600);
        maximize(b, Meta.MaximizeFlags.BOTH);
        await delay(600);
        assert(maximizeFlags(b) && rect(a).width === area.width - 16, 'Manual maximize is respected');
        unmaximize(b, Meta.MaximizeFlags.BOTH);
        await delay(600);
        assert(rect(a).width === a2.width, 'Manual unmaximize rejoins tiling');
        for (const mode of ['maximized', 'late-maximized', 'late-restore']) {
            const window = await spawn(`NexTile ${mode}`, mode);
            const isTiled = () => {
                const group = ext._tiler._findGroup(window);
                const target = group?.layout.rectangles(ext._tiler._area(group), ext._settings.get_int('gap')).get(window);
                return target && !maximizeFlags(window) && !window.minimized && !ext._tiler.isFloating(window) &&
                    ['x', 'y', 'width', 'height'].every(key => Math.abs(rect(window)[key] - target[key]) <= 2);
            };
            const tiled = isTiled();
            assert(tiled, `New ${mode} window opens normally and tiles without a mouse move` + (tiled ? '' :
                ` ${JSON.stringify({frame: rect(window), target: ext._tiler._targets.get(window), max: maximizeFlags(window),
                    floating: ext._tiler.isFloating(window), excluded: ext._tiler._maximized.has(window),
                    opening: ext._tiler._opening.get(window), resize: window.allows_resize(), move: window.allows_move()})}`));
            if (mode === 'late-restore') {
                // Slow software-rendered sessions can map late within spawn's
                // delay. Test a deliberate maximize after the actual startup
                // deadline, not a fixed interval after launching the process.
                const deadline = ext._tiler._opening.get(window) ?? 0;
                await delay(Math.max(500, (deadline - GLib.get_monotonic_time()) / 1000 + 100));
                assert(GLib.get_monotonic_time() > deadline,
                    'Startup normalization has ended before deliberate maximization');
                maximize(window, Meta.MaximizeFlags.BOTH);
                await delay(600);
                assert(!!maximizeFlags(window), 'User can still maximize a window after startup' +
                    (maximizeFlags(window) ? '' : ` ${JSON.stringify({deadline,
                        now: GLib.get_monotonic_time(), opening: ext._tiler._opening.get(window),
                        excluded: ext._tiler._maximized.has(window), floating: ext._tiler.isFloating(window)})}`));
                Gio.Subprocess.new(['kill', '-USR1', String(window.get_pid())], Gio.SubprocessFlags.NONE);
                await delay(850);
                assert(isTiled(), 'Unmaximize with a delayed client resize retiles without mouse interaction');
                window.minimize();
                await delay(400);
                window.unminimize();
                await delay(600);
                assert(isTiled(), 'Restoring a previously maximized, minimized window immediately retiles');
            }
            window.delete(global.get_current_time());
            await delay(400);
        }
        const large = await spawn('NexTile minimum size', true);
        await delay(600);
        assert(ext._tiler.isFloating(large), 'Client minimum size floats incompatible window');
        large.delete(global.get_current_time());
        await delay(300);
        const workspace = a.get_workspace();
        const otherWorkspace = global.workspace_manager.get_workspace_by_index(workspace.index() + 1);
        assert(!!otherWorkspace, 'Second workspace is available');
        b.change_workspace(otherWorkspace);
        await delay(600);
        assert(rect(a).width === area.width - 16, 'Moving to another workspace releases source tile');
        otherWorkspace.activate(global.get_current_time());
        await delay(600);
        assert(rect(b).width === area.width - 16, 'Destination workspace has independent layout');
        b.change_workspace(workspace);
        workspace.activate(global.get_current_time());
        await delay(600);
        assert(rect(a).width === a2.width, 'Returning to workspace tiles again');
        if (Main.layoutManager.monitors.length > 1) {
            const sourceMonitor = a.get_monitor();
            const targetMonitor = (sourceMonitor + 1) % Main.layoutManager.monitors.length;
            b.move_to_monitor(targetMonitor);
            await delay(600);
            assert(rect(a).width === area.width - 16, 'Moving monitors releases source tile');
            assert(b.get_monitor() === targetMonitor && rect(b).width === b.get_work_area_current_monitor().width - 16,
                'Second monitor has independent work area and layout');
            b.move_to_monitor(sourceMonitor);
            await delay(600);
            assert(rect(a).width === a2.width, 'Returning to monitor tiles again');
        }
        const inserted = await spawn('NexTile Insert');
        const targetBefore = rect(b);
        const freedBefore = rect(inserted);
        const dragPointer = (global.stage.context?.get_backend() ?? Clutter.get_default_backend()).get_default_seat()
            .create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        a.activate(global.get_current_time());
        await delay(200);
        const origin = rect(a);
        dragPointer.notify_absolute_motion(GLib.get_monotonic_time(), origin.x + origin.width / 2, origin.y + 22);
        await delay(150);
        dragPointer.notify_button(GLib.get_monotonic_time(), 1, Clutter.ButtonState.PRESSED);
        await delay(150);
        dragPointer.notify_absolute_motion(GLib.get_monotonic_time(), origin.x + origin.width / 2 + 30, origin.y + 42);
        await delay(150);
        assert(ext._tiler._grabbing, 'Dragging the title bar starts a real Mutter window move');
        dragPointer.notify_absolute_motion(GLib.get_monotonic_time(), targetBefore.x + targetBefore.width * 0.75,
            targetBefore.y + targetBefore.height * 0.75);
        await delay(200);
        dragPointer.notify_button(GLib.get_monotonic_time(), 1, Clutter.ButtonState.RELEASED);
        await delay(600);
        assert(rect(inserted).width * rect(inserted).height > freedBefore.width * freedBefore.height,
            'Source siblings fill the space released by the dragged window');
        assert(rect(a).x >= targetBefore.x && rect(b).x >= targetBefore.x &&
            (rect(a).width < targetBefore.width || rect(a).height < targetBefore.height),
            'Target is split along its longest direction instead of swapping positions');
        inserted.delete(global.get_current_time());
        await delay(300);
        ext._tiler.retile();
        await delay(500);
        await this._borderTests(ext, a, b, assert);
        ext._tiler.retile();
        await delay(500);
        // Exercise the actual menu and its native submenu items.
        a.activate(global.get_current_time());
        await delay(200);
        Main.panel.statusArea.quickSettings.menu.open();
        ext._toggle.menu.open();
        await delay(300);
        assert(ext._toggle.menu.isOpen && ext._toggle._gapItems.length === 7,
            'Quick Settings dropdown opens with gap choices');
        assert(ext._toggle._focus === a, 'Dropdown retains the active app window while Shell has focus');
        ext._toggle._float.emit('toggled', true);
        await delay(600);
        assert(ext._tiler.isFloating(a), 'Floating action works from the open dropdown');
        ext._toggle._float.emit('toggled', false);
        await delay(600);
        assert(!ext._tiler.isFloating(a), 'Dropdown returns active window to tiling');
        const stream = Gio.File.new_for_path(`${GLib.getenv('NEXTILE_TEST_RESULT')}.png`)
            .replace(null, false, Gio.FileCreateFlags.NONE, null);
        const screenshot = new Shell.Screenshot();
        const [x, y] = ext._toggle.menu.actor.get_transformed_position();
        const [width, height] = ext._toggle.menu.actor.get_transformed_size();
        await new Promise((resolve, reject) => screenshot.screenshot_area(
            Math.floor(x), Math.floor(y), Math.ceil(width), Math.ceil(height), stream, (source, result) => {
            try {
                source.screenshot_area_finish(result);
                resolve();
            } catch (error) {
                reject(error);
            }
            }));
        stream.close(null);
        ext._toggle.menu.close();
        Main.panel.statusArea.quickSettings.menu.close();
        ext._toggle.checked = false;
        await delay(600);
        assert(!ext._tiler._running && ext._tiler._signals.length === 0 &&
            ext._tiler._windows.size === 0 && !ext._tiler._source && !ext._tiler._settleSource,
        'Toggle off disconnects signals and removes sources');
        assert(rect(a).width === original.width && rect(a).height === original.height,
            'Toggle off restores original window size');
        ext._toggle.checked = true;
        await delay(600);
        assert(ext._tiler._running && rect(a).width === a2.width, 'Toggle on retiles existing windows');
        const tiler = ext._tiler;
        const appearance = ext._appearance;
        const search = ext._search;
        const menu = ext._toggle.menu;
        const menuParent = menu.actor.get_parent();
        const menuCount = menuParent.get_n_children();
        let menuDestroyed = false;
        menu.connect('destroy', () => { menuDestroyed = true; });
        // Hold a real file read across disable/re-enable. A late result from
        // the old instance must not change the new instance's preference/UI.
        ext._settings.set_boolean('terminal-transparent', false);
        await ext._terminalTask;
        const terminal = ext._terminal;
        const read = terminal._read.bind(terminal);
        let release;
        let started;
        const blocked = new Promise(resolve => { release = resolve; });
        const entered = new Promise(resolve => { started = resolve; });
        terminal._read = async () => {
            const snapshot = await read();
            started();
            await blocked;
            return snapshot;
        };
        ext._settings.set_boolean('terminal-transparent', true);
        const pendingTerminal = ext._terminalTask;
        await entered;
        const modalCount = Main.modalCount;
        Main.panel.statusArea.quickSettings.menu.open();
        menu.open();
        await delay(100);
        await Main.extensionManager.disableExtension('nextile@erikleblansch.github.io');
        assert(menuDestroyed && menuParent.get_n_children() === menuCount - 1,
            'Disable destroys the separately parented Quick Settings menu');
        assert(!menu.isOpen && !Main.panel.statusArea.quickSettings.menu._activeMenu,
            'Disabling an open dropdown releases its active-menu reference');
        Main.panel.statusArea.quickSettings.menu.close();
        assert(Main.modalCount === modalCount, 'Disable releases the open dropdown modal grab');
        assert(terminal._cancellable.is_cancelled() && !ext._terminalTask && !ext._terminal,
            'Disable cancels terminal work and clears owned references synchronously');
        await delay(600);
        assert(!tiler._running && tiler._signals.length === 0 && tiler._windows.size === 0 && !ext._toggle,
            'Extension disable destroys UI and all owned resources');
        assert(tiler._opening.size === 0 && tiler._targets.size === 0,
            'Disable clears startup tracking and expected window geometry');
        assert(appearance._destroyed && !appearance._source && appearance._signals.length === 0 &&
            appearance._windowSignals.size === 0 && !Main.panel.has_style_class_name('nextile-panel') &&
            Main.panel.statusArea.dateMenu.container.get_parent() === Main.panel._centerBox &&
            Main.panel.statusArea.activities.container.visible, 'Disable restores native panel and releases panel resources');
        assert(search._destroyed && !search._results._timeout && !search._grab && !search._nativeHandler &&
            search._signals.length === 0, 'Disable removes search modal, signals and restores Super handler');
        await Main.extensionManager.enableExtension('nextile@erikleblansch.github.io');
        await ext._terminalTask;
        ext._settings.set_boolean('terminal-transparent', false);
        await ext._terminalTask;
        const currentTask = ext._terminalTask;
        release();
        await pendingTerminal;
        assert(ext._terminalTask === currentTask && !ext._settings.get_boolean('terminal-transparent') &&
            !await ext._terminal.readEnabled(), 'Late cancelled terminal work cannot change the re-enabled instance');
        assert(menuParent.get_n_children() === menuCount, 'Re-enable adds exactly one dropdown without accumulating menus');
        await delay(600);
        assert(ext._tiler._running, 'Extension can be enabled again');
        if (!GLib.getenv('NEXTILE_TEST_KEEP_WINDOWS')) {
            a.delete(global.get_current_time());
            b.delete(global.get_current_time());
        }
        this._finish(log.join('\n'));
    }

    async _borderTests(ext, a, b, assert) {
        const tiler = ext._tiler;
        const seat = (global.stage.context?.get_backend() ?? Clutter.get_default_backend()).get_default_seat();
        const pointer = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        const keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        const move = async (x, y) => {
            pointer.notify_absolute_motion(GLib.get_monotonic_time(), x, y);
            await delay(100);
        };
        const press = async state => {
            pointer.notify_button(GLib.get_monotonic_time(), 1, state);
            await delay(120);
        };
        const record = [...tiler._borders._actors.values()][0];
        assert(!!record?.actor.visible, 'Shared tile boundary has a draggable handle');
        const item = record.item;
        const start = rect(a);
        const before = rect(b);
        await move(item.position, item.rect.y + item.rect.height * 0.4);
        const modalCount = Main.modalCount;
        await press(Clutter.ButtonState.PRESSED);
        assert(!!tiler._borders._drag && Main.modalCount === modalCount + 1,
            'Real mouse press grabs the shared boundary');
        await move(item.position + 90, item.rect.y + item.rect.height * 0.4);
        await delay(200);
        assert(rect(a).width > start.width + 50 && rect(b).width < before.width - 50,
            'Dragging the boundary resizes both adjacent windows live');
        await press(Clutter.ButtonState.RELEASED);
        await delay(500);
        assert(!tiler._borders._drag && Main.modalCount === modalCount && rect(a).width > start.width + 50,
            'Boundary release persists the ratio and releases the input grab');
        const retained = rect(a).width;
        const current = record.item;
        await move(current.position, current.rect.y + current.rect.height * 0.4);
        await press(Clutter.ButtonState.PRESSED);
        await move(current.position + 100, current.rect.y + current.rect.height * 0.4);
        keyboard.notify_keyval(GLib.get_monotonic_time(), Clutter.KEY_Escape, Clutter.KeyState.PRESSED);
        keyboard.notify_keyval(GLib.get_monotonic_time(), Clutter.KEY_Escape, Clutter.KeyState.RELEASED);
        await press(Clutter.ButtonState.RELEASED);
        await delay(500);
        assert(Math.abs(rect(a).width - retained) <= 1 && Main.modalCount === modalCount,
            'Escape restores the previous split ratio');
        // Exercise the native resize handler with a programmatic frame change.
        tiler._beginResize(a, Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN);
        assert(!tiler._resizeGrab, 'Undirected keyboard resize does not accidentally select north/west borders');
        ext._settings.set_int('gap', 0);
        await delay(400);
        tiler._grabbing = true;
        tiler._beginResize(a, Meta.GrabOp.RESIZING_E);
        const nativeStart = rect(a);
        a.move_resize_frame(true, nativeStart.x, nativeStart.y, nativeStart.width + 60, nativeStart.height);
        await delay(400);
        tiler._updateResize();
        tiler._resizeGrab = null;
        tiler._grabbing = false;
        tiler.queue();
        await delay(500);
        assert(rect(a).width > nativeStart.width + 30, 'Native window-edge resizing updates and retains the tile split');
        assert([...tiler._borders._actors.values()][0].actor.width >= 6,
            'Zero-gap layouts retain a usable boundary hit target');
        ext._settings.set_int('gap', 8);
        ext._settings.set_string('split-mode', 'vertical');
        tiler.retile();
        await delay(500);
        const vertical = [...tiler._borders._actors.values()][0].item;
        const top = rect(a).height;
        const bottom = rect(b).height;
        await move(vertical.rect.x + vertical.rect.width / 2, vertical.position);
        await press(Clutter.ButtonState.PRESSED);
        await move(vertical.rect.x + vertical.rect.width / 2, vertical.position + 60);
        await press(Clutter.ButtonState.RELEASED);
        await delay(400);
        assert(rect(a).height > top + 30 && rect(b).height < bottom - 30,
            'Horizontal boundary drags resize the upper and lower tile');
        const active = [...tiler._borders._actors.values()][0].item;
        await move(active.rect.x + active.rect.width / 2, active.position);
        await press(Clutter.ButtonState.PRESSED);
        const borders = tiler._borders;
        assert(!!borders._drag, 'Boundary owns a grab before disabling tiling');
        ext._toggle.checked = false;
        await press(Clutter.ButtonState.RELEASED);
        assert(!borders._drag && borders._actors.size === 0 && !tiler._borders && Main.modalCount === modalCount,
            'Disabling during a boundary drag removes handles and releases the grab');
        ext._settings.set_string('split-mode', 'auto');
        ext._toggle.checked = true;
        await delay(500);
        Gio.Subprocess.new(['python3', GLib.getenv('NEXTILE_TEST_FIXTURE'), 'NexTile resize constraint', 'minimum'],
            Gio.SubprocessFlags.NONE);
        await delay(1000);
        const constrained = global.get_window_actors().map(actor => actor.meta_window)
            .find(window => window.title === 'NexTile resize constraint');
        assert(!!constrained && !tiler.isFloating(constrained), 'Constrained app fits before dragging the boundary');
        const boundary = [...tiler._borders._actors.values()].find(record => record.item.axis === 'horizontal').item;
        const initial = rect(constrained);
        await move(boundary.position, boundary.rect.y + boundary.rect.height * 0.3);
        await press(Clutter.ButtonState.PRESSED);
        assert(tiler._borders._drag?.record.item.node === boundary.node, 'Minimum-size test grabs the intended boundary');
        await move(boundary.rect.x + 400, boundary.rect.y + boundary.rect.height * 0.3);
        await press(Clutter.ButtonState.RELEASED);
        await delay(700);
        const restored = !tiler.isFloating(constrained) && Math.abs(rect(constrained).width - initial.width) <= 1;
        assert(restored, 'Client minimum size restores the previous ratio without floating the app' +
            (restored ? '' : ` (before=${initial.width}, after=${rect(constrained).width}, floating=${tiler.isFloating(constrained)}, ratio=${boundary.node.ratio})`));
        constrained.delete(global.get_current_time());
        await delay(400);
    }

    async _terminalTests(ext, assert) {
        // Exercise the installed preference, including distribution-specific
        // GTK style properties, before the terminal process reads its CSS.
        ext._settings.set_boolean('terminal-transparent', true);
        await ext._terminalTask;
        Gio.Subprocess.new(['gnome-terminal', '--wait', '--hide-menubar', '--title=NexTile Transparency',
            '--', 'python3', GLib.getenv('NEXTILE_TERMINAL_FIXTURE')], Gio.SubprocessFlags.NONE);
        await delay(1800);
        const window = global.get_window_actors().map(actor => actor.meta_window)
            .find(win => /gnome[.-]terminal/i.test(win.get_wm_class() ?? ''));
        assert(!!window, 'Real GNOME Terminal opens with the isolated transparency configuration');
        const frame = window.get_frame_rect();
        const path = `${GLib.getenv('NEXTILE_TEST_RESULT')}.terminal.png`;
        const stream = Gio.File.new_for_path(path).replace(null, false, Gio.FileCreateFlags.NONE, null);
        const screenshot = new Shell.Screenshot();
        await new Promise((resolve, reject) => screenshot.screenshot_area(frame.x, frame.y,
            frame.width, frame.height, stream, (source, result) => {
                try { source.screenshot_area_finish(result); resolve(); } catch (error) { reject(error); }
            }));
        stream.close(null);
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
        const pixels = pixbuf.get_pixels();
        const offset = (frame.height - 40) * pixbuf.rowstride + (frame.width - 40) * pixbuf.n_channels;
        const actual = Array.from(pixels.slice(offset, offset + 3));
        assert(actual.every((value, i) => Math.abs(value - [22, 63, 68][i]) <= 6),
            `Terminal background blends at 50 percent with the desktop (${actual.join(',')})`);
        assert(window.get_compositor_private().opacity === 255, 'Terminal text is not faded by whole-window opacity');
        window.delete(global.get_current_time());
        await delay(400);
    }

    async _searchTests(ext, assert) {
        new Gio.Settings({schema_id: 'org.gnome.desktop.interface'}).set_boolean('enable-animations', true);
        const search = ext._search;
        const background = new Gio.Settings({schema_id: 'org.gnome.desktop.background'});
        background.set_string('picture-options', 'none');
        background.set_string('primary-color', '#0b5e63');
        let activatedRemote = null;
        let launchedTerms = null;
        const remote = {
            id: 'nextile-fixture-provider', appInfo: Gio.DesktopAppInfo.new('nextile-search-Alpha.desktop'),
            canLaunchSearch: true,
            async getInitialResultSet(terms) {
                await delay(80);
                return terms.join(' ').includes('nextile search test') ? Array.from({length: 8}, (_, i) => `document-${i}`) : [];
            },
            async getResultMetas(ids) {
                return ids.map(id => ({id, name: `Search test ${id}`, description: 'A result from the configured search provider',
                    createIcon: size => new St.Icon({icon_name: 'text-x-generic', icon_size: size})}));
            },
            filterResults: (ids, max) => ids.slice(0, max),
            activateResult: id => { activatedRemote = id; },
            launchSearch: terms => { launchedTerms = terms.join(' '); },
        };
        Main.overview.searchController.addProvider(remote);
        const nativeRemoteDisplay = remote.display;
        const mutter = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        const preferences = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'});
        mutter.set_boolean('dynamic-workspaces', false);
        preferences.set_int('num-workspaces', 4);
        await delay(400);
        const keyboard = (global.stage.context?.get_backend() ?? Clutter.get_default_backend()).get_default_seat()
            .create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        const press = async key => {
            keyboard.notify_keyval(GLib.get_monotonic_time(), key, Clutter.KeyState.PRESSED);
            await delay(40);
            keyboard.notify_keyval(GLib.get_monotonic_time(), key, Clutter.KeyState.RELEASED);
            await delay(120);
        };
        const modalCount = Main.modalCount;
        let expanding = false;
        const widthId = search._surface.connect('notify::width', () => {
            if (search._target && search._surface.width > 60 && search._surface.width < search._target.width - 1)
                expanding = true;
        });
        await press(Clutter.KEY_Super_L);
        await delay(500);
        search._surface.disconnect(widthId);
        assert(search._open && !Main.overview.visible, 'Real Super key opens compact search without Activities');
        assert(search._entry.clutter_text.has_key_focus() && Main.modalCount === modalCount + 1,
            'Search immediately owns keyboard focus and one modal grab');
        assert(!search._results.visible, 'Empty search shows only the search bar');
        assert(Math.abs(search._surface.width - search._target.width) < 1,
            'Search surface expands from pill to final bar width');
        assert(expanding, 'Search expansion includes intermediate animation frames');
        const ribbon = ext._appearance._ribbon;
        const [surfaceX, surfaceY] = search._surface.get_transformed_position();
        const [neighborX] = ribbon._buttons[1].get_transformed_position();
        assert(surfaceY >= 0 && surfaceY + search._surface.height <= Main.panel.height,
            'Search replaces the active pill inside the top bar');
        assert(ribbon._buttons[0].opacity === 0 && neighborX >= surfaceX + search._surface.width + 6,
            'Active pill is replaced and neighboring workspace circles move aside');
        assert(search._root.get_theme_node().get_background_color().alpha === 0,
            'Search overlay has no desktop backdrop');
        const monitor = Main.layoutManager.primaryMonitor;
        const stream = Gio.File.new_for_path(`${GLib.getenv('NEXTILE_TEST_RESULT')}.search.png`)
            .replace(null, false, Gio.FileCreateFlags.NONE, null);
        const screenshot = new Shell.Screenshot();
        await new Promise((resolve, reject) => screenshot.screenshot_area(monitor.x, monitor.y,
            monitor.width, Math.ceil(Main.panel.height + 72), stream, (source, result) => {
                try { source.screenshot_area_finish(result); resolve(); } catch (error) { reject(error); }
            }));
        stream.close(null);
        for (const letter of 'nextile search test')
            await press(letter.charCodeAt(0));
        await delay(500);
        assert(search._entry.get_text() === 'nextile search test', 'Typing after Super enters the query directly');
        assert(search._results._rows.filter(row => row.id.startsWith('nextile-search-')).length === 2,
            'Native GNOME app search finds installed fixture applications');
        const section = search._results._sections.get(remote).display;
        assert(section._content.get_n_children() === 5 && section.providerInfo._moreLabel.text.includes('3'),
            'Native provider layout shows five results and the remaining count');
        assert(Math.abs(section._container.get_theme_node().get_background_color().alpha - 128) <= 1,
            'Provider category cards retain a half-transparent background');
        assert(remote.display === nativeRemoteDisplay, 'Overview provider widgets remain untouched');
        const resultStream = Gio.File.new_for_path(`${GLib.getenv('NEXTILE_TEST_RESULT')}.results.png`)
            .replace(null, false, Gio.FileCreateFlags.NONE, null);
        await new Promise((resolve, reject) => screenshot.screenshot_area(monitor.x, monitor.y,
            monitor.width, monitor.height, resultStream, (source, result) => {
                try { source.screenshot_area_finish(result); resolve(); } catch (error) { reject(error); }
            }));
        resultStream.close(null);
        await press(Clutter.KEY_Down);
        assert(search._results._selected === 1, 'Down selects next application');
        await press(Clutter.KEY_Up);
        assert(search._results._selected === 0, 'Up selects previous application');
        const pointer = (global.stage.context?.get_backend() ?? Clutter.get_default_backend()).get_default_seat()
            .create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        pointer.notify_absolute_motion(GLib.get_monotonic_time(), monitor.x + monitor.width / 2,
            monitor.y + Main.panel.height + 28);
        const circle = ribbon._buttons[2];
        const samples = [circle.get_transformed_position()[0]];
        const motion = [];
        const motionStart = GLib.get_monotonic_time();
        pointer.notify_discrete_scroll(GLib.get_monotonic_time(), Clutter.ScrollDirection.DOWN,
            Clutter.ScrollSource.WHEEL);
        for (let frame = 0; frame < 44; frame++) {
            await delay(16);
            samples.push(circle.get_transformed_position()[0]);
            motion.push({ms: Math.round((GLib.get_monotonic_time() - motionStart) / 1000),
                value: ribbon._position.value, duration: ribbon._position.get_transition('value')?.get_duration()});
        }
        const forwardSmooth = new Set(samples).size > 3 && samples.every((x, i) => i === 0 || x <= samples[i - 1] + 1);
        assert(forwardSmooth, 'Search neighbors slide forward without reversing direction between animation frames' +
            (forwardSmooth ? '' : ` (${samples.join(',')}) ${JSON.stringify(motion)}`));
        assert(global.workspace_manager.get_active_workspace_index() === 1 && search._open &&
            search._entry.get_text() === 'nextile search test' && search._entry.clutter_text.has_key_focus(),
        'Real mouse wheel changes workspace while retaining search and focus' +
            ` (workspace=${global.workspace_manager.get_active_workspace_index()}, open=${search._open}, focus=${global.stage.get_key_focus()}, entryFocus=${search._entry.clutter_text.has_key_focus()})`);
        const [leftX] = ribbon._buttons[0].get_transformed_position();
        const [rightX] = ribbon._buttons[2].get_transformed_position();
        assert(ribbon._buttons[1].opacity === 0 &&
            leftX + ribbon._buttons[0].width <= surfaceX - 6 && rightX >= surfaceX + search._surface.width + 6 &&
            Math.abs(search._surface.x + search._surface.width / 2 - monitor.x - monitor.width / 2) < 1,
        'Workspace scrolling keeps search centered and moves the other circles around it');
        const reverse = [circle.get_transformed_position()[0]];
        pointer.notify_discrete_scroll(GLib.get_monotonic_time(), Clutter.ScrollDirection.UP, Clutter.ScrollSource.WHEEL);
        for (let frame = 0; frame < 44; frame++) {
            await delay(16);
            reverse.push(circle.get_transformed_position()[0]);
        }
        const backwardSmooth = global.workspace_manager.get_active_workspace_index() === 0 && new Set(reverse).size > 3 &&
            reverse.every((x, i) => i === 0 || x >= reverse[i - 1] - 1);
        assert(backwardSmooth, 'Search neighbors also slide backward without bouncing' +
            (backwardSmooth ? '' : ` (${reverse.join(',')})`));
        pointer.notify_discrete_scroll(GLib.get_monotonic_time(), Clutter.ScrollDirection.DOWN, Clutter.ScrollSource.WHEEL);
        await delay(700);
        await press(Clutter.KEY_Return);
        await delay(1000);
        const launched = global.get_window_actors().map(actor => actor.meta_window)
            .find(window => window.title?.startsWith('NexTile Search '));
        assert(!!launched && !search._open && !Main.overview.visible,
            'Enter launches application and closes search without showing Activities');
        assert(launched.get_workspace().index() === 1 && Main.modalCount === modalCount,
            'Application launches on selected workspace and modal grab is released');
        launched.delete(global.get_current_time());
        await delay(300);
        search.open();
        search._entry.set_text('nextile search test');
        await delay(500);
        search._results._rows.find(row => row.id === 'document-0').button.activate();
        assert(activatedRemote === 'document-0' && !search._open && !Main.overview.visible,
            'Native provider result activates and closes search without opening Overview');
        search.open();
        search._entry.set_text('nextile search test');
        await delay(500);
        search._results._sections.get(remote).display.providerInfo.emit('clicked', 1);
        assert(launchedTerms === 'nextile search test' && !search._open && !Main.overview.visible,
            'Provider header opens full provider search without opening Overview');
        await press(Clutter.KEY_Super_L);
        await press(Clutter.KEY_Escape);
        await delay(300);
        assert(!search._open && Main.modalCount === modalCount, 'Escape closes search and releases focus');
        await press(Clutter.KEY_Super_L);
        await press(Clutter.KEY_Super_L);
        await delay(300);
        assert(!search._open && !Main.overview.visible, 'Second Super closes compact search');
        search.open();
        pointer.notify_absolute_motion(GLib.get_monotonic_time(), monitor.x + 20, monitor.y + 300);
        pointer.notify_button(GLib.get_monotonic_time(), 1, Clutter.ButtonState.PRESSED);
        pointer.notify_button(GLib.get_monotonic_time(), 1, Clutter.ButtonState.RELEASED);
        await delay(350);
        assert(!search._open && Main.modalCount === modalCount, 'Clicking outside search closes it and releases the grab');
        search.open();
        search._entry.set_text('nextile search test');
        search._entry.set_text('nextile-query-with-no-results');
        await delay(400);
        assert(search._results._rows.length === 0 && search._results.visible,
            'New query replaces old results and shows empty-result feedback');
        search._entry.set_text('nextile search test');
        search.close(false);
        await delay(300);
        assert(!search._results._timeout && search._results._rows.length === 0 && !search._results.visible,
            'Closing cancels queued searches and prevents results returning');
        assert(ext._appearance._ribbon._searchProgress === 0, 'Closing restores original workspace spacing');
        Main.overview.searchController.removeProvider(remote);
        const provider = Main.overview.searchController._searchResults._providers.find(p => p.id === 'applications');
        const getResults = provider.getInitialResultSet;
        provider.getInitialResultSet = async function (...args) {
            await delay(350);
            return getResults.apply(this, args);
        };
        search.open();
        search._entry.set_text('nextile search test');
        await delay(200);
        assert(!!search._results._pending, 'Delayed application provider has an in-flight search');
        await press(Clutter.KEY_Return);
        await delay(1000);
        const fastLaunch = global.get_window_actors().map(actor => actor.meta_window)
            .find(window => window.title?.startsWith('NexTile Search '));
        assert(!!fastLaunch && !search._open, 'Enter during an in-flight search launches its result');
        fastLaunch.delete(global.get_current_time());
        await delay(300);
        search.open();
        search._entry.set_text('nextile search test');
        await delay(150);
        ext._settings.set_boolean('search-enabled', false);
        await delay(600);
        assert(!ext._search && !search._grab && !search._nativeHandler && Main.modalCount === modalCount,
            'Search setting disables cleanly even while the bar is open');
        assert(search._results._rows.length === 0 && !search._results._pending,
            'Disabling during an in-flight search discards late results');
        provider.getInitialResultSet = getResults;
        await press(Clutter.KEY_Super_L);
        await delay(700);
        assert(Main.overview.visible, 'Disabling compact search restores native Super overview');
        Main.overview.hide();
        await delay(500);
        ext._settings.set_boolean('search-enabled', true);
        await press(Clutter.KEY_Super_L);
        await delay(400);
        assert(ext._search._open && !Main.overview.visible, 'Compact search can be re-enabled');
        ext._search.close(false);
        global.workspace_manager.get_workspace_by_index(0).activate(global.get_current_time());
        preferences.set_int('num-workspaces', 2);
        mutter.set_boolean('dynamic-workspaces', true);
        await delay(600);
    }

    async _settingsTests(ext, assert) {
        const language = GLib.getenv('NEXTILE_TEST_LANGUAGE') ?? 'en';
        const labels = {
            en: ['Transparent terminal', 'Type to search', 'Workspace 1'],
            nl: ['Transparante terminal', 'Typ om te zoeken', 'Werkruimte 1'],
            de: ['Transparentes Terminal', 'Suchbegriff eingeben', 'Arbeitsfläche 1'],
            fr: ['Terminal transparent', 'Saisissez votre recherche', 'Espace de travail 1'],
            es: ['Terminal transparente', 'Escribe para buscar', 'Espacio de trabajo 1'],
            pt: ['Terminal transparente', 'Escreva para pesquisar', 'Área de trabalho 1'],
            it: ['Terminale trasparente', 'Digita per cercare', 'Spazio di lavoro 1'],
            pl: ['Przezroczysty terminal', 'Wpisz, aby wyszukać', 'Obszar roboczy 1'],
            ja: ['透明な端末', '入力して検索', 'ワークスペース 1'],
            zh: ['透明终端', '输入以搜索', '工作区 1'],
            uk: ['Прозорий термінал', 'Введіть текст для пошуку', 'Робочий простір 1'],
        }[language];
        assert(ext._toggle._terminalSwitch.label.text === labels[0], `Quick Settings follows ${language} locale`);
        assert(ext._search._entry.hint_text === labels[1], `Search follows ${language} locale`);
        assert(ext._appearance._ribbon._buttons[0].accessible_name.startsWith(labels[2]),
            `Workspace accessibility follows ${language} locale`);
        const file = Gio.File.new_for_path(`${GLib.get_user_config_dir()}/gtk-3.0/gtk.css`);
        const read = () => new TextDecoder().decode(file.load_contents(null)[1]);
        const original = read();
        ext._toggle._terminalSwitch.emit('toggled', true);
        await ext._terminalTask;
        await delay(200);
        assert(ext._settings.get_boolean('terminal-transparent') && ext._toggle._terminalSwitch.state,
            'Terminal switch stores and displays enabled state');
        assert(read().startsWith(original) && read().includes('BEGIN NEXTILE TERMINAL TRANSPARENCY'),
            'Terminal toggle adds managed CSS and preserves existing styles');
        ext._toggle._terminalSwitch.emit('toggled', false);
        await ext._terminalTask;
        await delay(200);
        assert(!ext._settings.get_boolean('terminal-transparent') && !ext._toggle._terminalSwitch.state,
            'Terminal switch stores and displays disabled state');
        assert(read().startsWith(original) && !read().includes('BEGIN NEXTILE TERMINAL TRANSPARENCY'),
            'Terminal toggle removes only managed CSS');
    }

    async _panelTests(ext, assert) {
        const panel = Main.panel;
        const appearance = ext._appearance;
        assert(!!appearance && panel.get_theme_node().get_background_color().alpha === 0,
            'Panel is fully transparent');
        assert(panel.statusArea.dateMenu.container.get_parent() === panel._leftBox,
            'Clock and calendar button moved to the left');
        assert(!panel.statusArea.activities.container.visible, 'Native dots hidden while numbered ribbon is present');
        const background = new Gio.Settings({schema_id: 'org.gnome.desktop.background'});
        const mutter = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        const preferences = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'});
        const ui = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        background.set_string('picture-options', 'none');
        background.set_string('color-shading-type', 'solid');
        background.set_string('primary-color', '#ffffff');
        await delay(1400);
        assert(appearance._inks.every(ink => ink === 'dark'), 'White background automatically selects black panel text');
        background.set_string('primary-color', '#000000');
        await delay(1400);
        assert(appearance._inks.every(ink => ink === 'light'), 'Black background automatically selects white panel text');
        const [, white] = (Cogl.Color?.from_string ? Cogl.Color : Clutter.Color).from_string('#ffffff');
        const compositorBackground = Main.layoutManager._bgManagers[Main.layoutManager.primaryIndex]
            .backgroundActor.content.background;
        let backgroundChanges = 0;
        const backgroundId = compositorBackground.connect('changed', () => backgroundChanges++);
        compositorBackground.set_color(white);
        // Compositor readback can finish later under parallel nested sessions.
        // Wait for the event-driven sample; do not trigger a sample ourselves.
        for (let attempt = 0; attempt < 50 && !appearance._inks.every(ink => ink === 'dark'); attempt++)
            await delay(50);
        compositorBackground.disconnect(backgroundId);
        assert(appearance._inks.every(ink => ink === 'dark'),
            'Compositor background updates trigger contrast without a settings change' +
            (appearance._inks.every(ink => ink === 'dark') ? '' : ` (ink=${appearance._inks}, pending=${appearance._source}, busy=${appearance._busy}, changed=${backgroundChanges}, tracked=${appearance._backgroundSignals.some(([obj]) => obj === compositorBackground)}, sample=${appearance._ribbon._sample?.values[100]}, current=${Main.layoutManager._bgManagers[Main.layoutManager.primaryIndex].backgroundActor.content.background === compositorBackground})`));
        const wallpaper = `${GLib.getenv('NEXTILE_TEST_RESULT')}.svg`;
        GLib.file_set_contents(wallpaper, '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><path fill="white" d="M0 0h960v1080H0z"/><path fill="black" d="M960 0h960v1080H960z"/></svg>');
        background.set_string('picture-uri', Gio.File.new_for_path(wallpaper).get_uri());
        background.set_string('picture-uri-dark', Gio.File.new_for_path(wallpaper).get_uri());
        background.set_string('picture-options', 'stretched');
        await delay(1600);
        assert(appearance._inks[0] === 'dark' && appearance._inks[2] === 'light',
            'Light and dark wallpaper regions get independent readable text colors');
        let samples = 0;
        const sampleContrast = appearance._sampleContrast;
        appearance._sampleContrast = function () {
            samples++;
            return sampleContrast.call(this);
        };
        await delay(1600);
        appearance._sampleContrast = sampleContrast;
        assert(samples <= 1 && !appearance._source && !appearance._busy,
            'Stable desktop has no recurring contrast sampling or pending timers');
        mutter.set_boolean('dynamic-workspaces', false);
        preferences.set_int('num-workspaces', 6);
        ui.set_boolean('enable-animations', true);
        await delay(500);
        const ribbon = appearance._ribbon;
        assert(ribbon._buttons[1]._ink === 'light', 'Each workspace circle adapts to its own background region');
        assert(ribbon._buttons.length === 6 && ribbon._buttons[5].label === '6',
            'Workspace count and numbering follow GNOME');
        const isCentered = index => {
            const button = ribbon._buttons[index];
            const [x] = button.get_transformed_position();
            const monitor = Main.layoutManager.primaryMonitor;
            return Math.abs(x + button.width / 2 - monitor.x - monitor.width / 2) <= 1;
        };
        assert(isCentered(0), 'First active pill is at the physical screen center');
        let intermediate = false;
        const animationId = ribbon._position.connect('notify::value', () => {
            const value = ribbon._position.value;
            if (value > 0 && value < 3)
                intermediate = true;
        });
        ribbon._buttons[3].emit('clicked', 1);
        await delay(1000);
        ribbon._position.disconnect(animationId);
        assert(global.workspace_manager.get_active_workspace_index() === 3, 'Clicking number switches workspace');
        assert(intermediate, 'Workspace motion includes intermediate animation frames');
        assert(isCentered(3), 'New active pill settles exactly at center');
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        assert(ribbon._buttons[3].width === 48 * scale && ribbon._buttons[2].width === 24 * scale,
            'Active workspace is a large pill and inactive workspace a numbered circle');
        global.workspace_manager.get_workspace_by_index(5).activate(global.get_current_time());
        await delay(900);
        assert(isCentered(5), 'Last active pill remains centered with clipped overflow');
        global.workspace_manager.get_workspace_by_index(0).activate(global.get_current_time());
        await delay(900);
        ribbon._buttons[0].emit('clicked', 1);
        await delay(700);
        assert(Main.overview.visible, 'Clicking active workspace opens Activities overview');
        Main.overview.hide();
        await delay(700);
        panel.statusArea.dateMenu.menu.open();
        await delay(300);
        assert(panel.statusArea.dateMenu.menu.isOpen, 'Moved clock still opens calendar');
        panel.statusArea.dateMenu.menu.close();
        await delay(500);
        const stream = Gio.File.new_for_path(`${GLib.getenv('NEXTILE_TEST_RESULT')}.panel.png`)
            .replace(null, false, Gio.FileCreateFlags.NONE, null);
        const [x, y] = panel.get_transformed_position();
        const screenshot = new Shell.Screenshot();
        await new Promise((resolve, reject) => screenshot.screenshot_area(Math.floor(x), Math.floor(y),
            Math.floor(panel.width), Math.floor(panel.height), stream, (source, result) => {
                try { source.screenshot_area_finish(result); resolve(); } catch (error) { reject(error); }
            }));
        stream.close(null);
        ext._settings.set_boolean('panel-enabled', false);
        await delay(400);
        assert(!ext._appearance && panel.statusArea.dateMenu.container.get_parent() === panel._centerBox &&
            panel.statusArea.activities.container.visible, 'Panel option restores original layout independently of tiling');
        ext._settings.set_boolean('panel-enabled', true);
        await delay(600);
        assert(!!ext._appearance && ext._tiler._running, 'Panel customization can be enabled again');
        ui.set_boolean('enable-animations', false);
        preferences.set_int('num-workspaces', 2);
        mutter.set_boolean('dynamic-workspaces', true);
        await delay(500);
        assert(ext._appearance._ribbon._buttons.length === global.workspace_manager.n_workspaces,
            'Ribbon follows removal of workspaces');
    }

    disable() {}
}
