import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

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
        this._run().catch(error => this._finish(`${this._log?.join('\n')}\nFAIL: ${error.message}\n${error.stack}`));
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
        const spawn = async (name, large = false) => {
            Gio.Subprocess.new(['python3', GLib.getenv('NEXTILE_TEST_FIXTURE'), name,
                ...(large ? ['large'] : [])], Gio.SubprocessFlags.NONE);
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
        b.maximize(Meta.MaximizeFlags.BOTH);
        await delay(600);
        assert(b.get_maximized() && rect(a).width === area.width - 16, 'Manual maximize is respected');
        b.unmaximize(Meta.MaximizeFlags.BOTH);
        await delay(600);
        assert(rect(a).width === a2.width, 'Manual unmaximize rejoins tiling');
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
        const swapBefore = rect(a);
        const swapTarget = rect(b);
        a.move_frame(false, swapTarget.x, swapTarget.y);
        ext._tiler._swapAtDrop(a);
        ext._tiler.queue();
        await delay(600);
        assert(JSON.stringify(rect(b)) === JSON.stringify(swapBefore), 'Drop geometry swaps tile positions');
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
        await Main.extensionManager.disableExtension('nextile@erikleblansch.github.io');
        await delay(600);
        assert(!tiler._running && tiler._signals.length === 0 && tiler._windows.size === 0 && !ext._toggle,
            'Extension disable destroys UI and all owned resources');
        await Main.extensionManager.enableExtension('nextile@erikleblansch.github.io');
        await delay(600);
        assert(ext._tiler._running, 'Extension can be enabled again');
        a.delete(global.get_current_time());
        b.delete(global.get_current_time());
        this._finish(log.join('\n'));
    }

    disable() {}
}
