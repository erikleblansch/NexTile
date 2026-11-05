import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { resolve(); return GLib.SOURCE_REMOVE; }));
export default class Demo extends Extension {
    enable() { this.run().catch(e => GLib.file_set_contents(GLib.getenv('NEXTILE_TEST_RESULT'), `FAIL: ${e.stack}`)); }
    async run() {
        await wait(3500);
        Main.overview.hide();
        const ext = Main.extensionManager.lookup('nextile@erikleblansch.github.io').stateObj;
        const settings = new Gio.Settings({schema_id: 'org.gnome.desktop.background'});
        const wallpaper = Gio.File.new_for_path(`${GLib.getenv('NEXTILE_DEMO_ROOT')}/docs/demo-wallpaper.svg`).get_uri();
        settings.set_string('picture-uri', wallpaper);
        settings.set_string('picture-uri-dark', wallpaper);
        settings.set_string('picture-options', 'zoom');
        new Gio.Settings({schema_id: 'org.gnome.desktop.interface'}).set_boolean('enable-animations', true);
        new Gio.Settings({schema_id: 'org.gnome.mutter'}).set_boolean('dynamic-workspaces', false);
        new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'}).set_int('num-workspaces', 4);
        ext._settings.set_int('gap', 12);
        // The nested session shares system services. Omit the network tiles so
        // the recording cannot expose a host connection name or VPN profile.
        for (const item of Main.panel.statusArea.quickSettings._network.quickSettingsItems)
            item.hide();
        this.overlay = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL,
            style: 'background-color: rgba(9, 22, 29, 0.94); border: 1px solid rgba(141, 225, 212, 0.25); border-radius: 18px; padding: 20px 28px; spacing: 5px;'});
        this.title = new St.Label({style: 'font-size: 24px; font-weight: bold; color: #e6fffb;'});
        this.subtitle = new St.Label({style: 'font-size: 16px; color: #9ac7c1;'});
        this.overlay.add_child(this.title); this.overlay.add_child(this.subtitle);
        Main.layoutManager.addTopChrome(this.overlay);
        this.overlay.set_position(28, global.stage.height - 124);
        this.caption('NexTile', 'Room for every window.');
        await wait(1800);
        const seat = Clutter.get_default_backend().get_default_seat();
        this.pointer = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        this.keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        this.pointer.notify_absolute_motion(GLib.get_monotonic_time(), global.stage.width - 30, global.stage.height - 30);
        const progress = Gio.File.new_for_path(`${GLib.getenv('NEXTILE_TEST_RESULT')}.recording`);
        const recorder = Gio.Subprocess.new([GLib.getenv('NEXTILE_FFMPEG'), '-y', '-loglevel', 'warning',
            '-progress', progress.get_path(),
            '-f', 'x11grab', '-framerate', '30', '-video_size', `${global.stage.width}x${global.stage.height}`,
            '-i', GLib.getenv('DISPLAY'), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', GLib.getenv('NEXTILE_DEMO_OUTPUT')], Gio.SubprocessFlags.NONE);
        for (let i = 0; i < 60; i++) {
            if (progress.query_exists(null) && progress.query_info('standard::size', 0, null).get_size() > 0)
                break;
            await wait(100);
        }
        await wait(2200);
        this.caption('Open a window. Find your flow.', 'New windows automatically share the largest tile.');
        const notes = await this.spawn('Studio Notes');
        await wait(1300);
        const tasks = await this.spawn('Project Board');
        await wait(1300);
        Gio.Subprocess.new(['gnome-terminal', '--title=Terminal', '--', 'python3',
            `${GLib.getenv('NEXTILE_DEMO_ROOT')}/tools/demo-terminal.py`], Gio.SubprocessFlags.NONE);
        await wait(2400);
        this.caption('Make room for what matters.', 'Drag the boundary. Both windows adjust together.');
        const divider = [...ext._tiler._borders._actors.values()].find(r => r.item.axis === 'horizontal');
        const r = divider.actor;
        await this.move(r.x + r.width / 2, r.y + r.height * 0.35, 500);
        this.button(true);
        await this.move(r.x + 150, r.y + r.height * 0.35, 1300);
        this.button(false);
        await wait(1900);
        this.caption('A workspace that moves with you.', 'Drop a window onto another tile to split its space.');
        const a = notes.get_frame_rect(), b = tasks.get_frame_rect();
        await this.move(a.x + a.width / 2, a.y + 20, 500);
        this.button(true);
        await this.move(a.x + a.width / 2 + 35, a.y + 45, 300);
        await this.move(b.x + b.width * 0.6, b.y + b.height * 0.6, 1100);
        this.button(false);
        await wait(2100);
        this.caption('One key. Everything within reach.', 'Super turns the active workspace pill into search.');
        this.key(Clutter.KEY_Super_L);
        await wait(1200);
        for (const char of 'terminal') { this.key(char.charCodeAt(0)); await wait(130); }
        await wait(1700);
        this.caption('Keep your place. Change your workspace.', 'Scroll while searching. The active workspace stays centered.');
        this.pointer.notify_discrete_scroll(GLib.get_monotonic_time(), Clutter.ScrollDirection.DOWN, Clutter.ScrollSource.WHEEL);
        await wait(1300);
        this.pointer.notify_discrete_scroll(GLib.get_monotonic_time(), Clutter.ScrollDirection.DOWN, Clutter.ScrollSource.WHEEL);
        await wait(1300);
        this.pointer.notify_discrete_scroll(GLib.get_monotonic_time(), Clutter.ScrollDirection.UP, Clutter.ScrollSource.WHEEL);
        await wait(1300);
        this.key(Clutter.KEY_Escape);
        await wait(600);
        global.workspace_manager.get_workspace_by_index(0).activate(global.get_current_time());
        await wait(700);
        this.caption('Your desktop. Your settings.', 'Tiling, gaps, top bar, search and terminal transparency.');
        Main.panel.statusArea.quickSettings.menu.open();
        await wait(600);
        ext._toggle.menu.open();
        await wait(3800);
        this.overlay.hide();
        await wait(100);
        const file = Gio.File.new_for_path(`${GLib.getenv('NEXTILE_DEMO_ROOT')}/docs/submission/screenshot.png`);
        const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        await new Promise((resolve, reject) => new Shell.Screenshot().screenshot(false, stream, (source, result) => {
            try { source.screenshot_finish(result); resolve(); } catch (e) { reject(e); }
        }));
        stream.close(null);
        this.overlay.show();
        ext._toggle.menu.close();
        Main.panel.statusArea.quickSettings.menu.close();
        this.caption('NexTile', 'GNOME 46–51  ·  Eleven languages  ·  Open source');
        await wait(2800);
        recorder.send_signal(2);
        await new Promise((resolve, reject) => recorder.wait_async(null, (p, result) => {
            try { p.wait_finish(result); resolve(); } catch (e) { reject(e); }
        }));
        GLib.file_set_contents(GLib.getenv('NEXTILE_TEST_RESULT'), 'PASS: Real GNOME demo recorded with synthetic content');
    }
    caption(title, subtitle) { this.title.text = title; this.subtitle.text = subtitle; }
    async spawn(name) {
        Gio.Subprocess.new(['python3', `${GLib.getenv('NEXTILE_DEMO_ROOT')}/tools/demo-window.py`, name], Gio.SubprocessFlags.NONE);
        await wait(1100);
        return global.get_window_actors().map(a => a.meta_window).find(w => w.title === name);
    }
    key(symbol) {
        this.keyboard.notify_keyval(GLib.get_monotonic_time(), symbol, Clutter.KeyState.PRESSED);
        this.keyboard.notify_keyval(GLib.get_monotonic_time(), symbol, Clutter.KeyState.RELEASED);
    }
    button(down) { this.pointer.notify_button(GLib.get_monotonic_time(), 1, down ? Clutter.ButtonState.PRESSED : Clutter.ButtonState.RELEASED); }
    async move(x, y, duration) {
        const [sx, sy] = global.get_pointer();
        for (let i = 1; i <= 30; i++) {
            const t = i / 30, smooth = t * t * (3 - 2 * t);
            this.pointer.notify_absolute_motion(GLib.get_monotonic_time(), sx + (x - sx) * smooth, sy + (y - sy) * smooth);
            await wait(duration / 30);
        }
    }
    disable() { this.overlay?.destroy(); }
}
