// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Layout, inset} from './layout.js';

export class Tiler {
    constructor(settings) {
        this.settings = settings;
        this._mutterSettings = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        this._signals = [];
        this._windows = new Map();
        this._groups = new Map();
        this._original = new Map();
        this._floating = new Set();
        this._maximized = new Set();
        this._source = 0;
        this._settleSource = 0;
        this._running = false;
        this._grabbing = false;
        this._applying = false;
    }

    start() {
        if (this._running)
            return;
        this._running = true;
        const connect = (object, signal, callback) =>
            this._signals.push([object, object.connect(signal, callback)]);
        connect(global.display, 'window-created', (_display, window) => this._watch(window));
        connect(global.window_manager, 'map', (_wm, actor) => {
            this._watch(actor.meta_window);
            this.queue();
        });
        for (const signal of ['workareas-changed', 'window-entered-monitor', 'window-left-monitor'])
            connect(global.display, signal, () => this.queue());
        connect(Main.layoutManager, 'monitors-changed', () => {
            this._groups.clear();
            this.queue();
        });
        connect(global.workspace_manager, 'active-workspace-changed', () => this.queue());
        connect(this._mutterSettings, 'changed::workspaces-only-on-primary', () => {
            this._groups.clear();
            this.queue();
        });
        connect(global.display, 'grab-op-begin', () => { this._grabbing = true; });
        connect(global.display, 'grab-op-end', (_display, window, op) => {
            this._grabbing = false;
            if (op === Meta.GrabOp.MOVING || op === Meta.GrabOp.KEYBOARD_MOVING)
                this._swapAtDrop(window);
            this.queue();
        });
        for (const actor of global.get_window_actors())
            this._watch(actor.meta_window);
        this.queue();
    }

    _watch(window) {
        if (!window || this._windows.has(window))
            return;
        const ids = [];
        for (const signal of ['workspace-changed', 'notify::minimized', 'notify::fullscreen'])
            ids.push(window.connect(signal, () => this.queue()));
        for (const signal of ['notify::maximized-horizontally', 'notify::maximized-vertically']) {
            ids.push(window.connect(signal, () => {
                if (this._applying || !this._original.has(window))
                    return;
                if (window.get_maximized())
                    this._maximized.add(window);
                else
                    this._maximized.delete(window);
                this.queue();
            }));
        }
        ids.push(window.connect('unmanaged', () => {
            for (const id of ids)
                window.disconnect(id);
            this._windows.delete(window);
            this._original.delete(window);
            this._floating.delete(window);
            this._maximized.delete(window);
            this.queue();
        }));
        this._windows.set(window, ids);
        this.queue();
    }

    queue() {
        if (!this._running || this._source)
            return;
        // Coalesce bursts of map/workspace/monitor notifications; never poll.
        this._source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
            this._source = 0;
            if (!this._grabbing) {
                try {
                    this._reconcile();
                } catch (error) {
                    console.error(`NexTile: ${error.stack ?? error}`);
                }
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _eligible(window) {
        return window.get_window_type() === Meta.WindowType.NORMAL &&
            !window.is_override_redirect() && !window.get_transient_for() &&
            (!window.is_on_all_workspaces() || this._sharedMonitor(window)) && !window.skip_taskbar &&
            !window.minimized && !window.fullscreen && window.allows_resize() &&
            window.allows_move() && window.get_compositor_private()?.visible &&
            !this._floating.has(window) && !this._maximized.has(window);
    }

    _group(window) {
        if (!window)
            return null;
        const shared = this._sharedMonitor(window);
        const workspace = shared ? 'shared' : window.get_workspace();
        const monitor = window.get_monitor();
        if (!workspace || monitor < 0 || monitor >= Main.layoutManager.monitors.length)
            return null;
        if (!this._groups.has(workspace))
            this._groups.set(workspace, new Map());
        const monitors = this._groups.get(workspace);
        if (!monitors.has(monitor))
            monitors.set(monitor, {workspace, monitor, shared, layout: new Layout()});
        return monitors.get(monitor);
    }

    _area(group) {
        const workspace = group.shared ? global.workspace_manager.get_active_workspace() : group.workspace;
        return inset(workspace.get_work_area_for_monitor(group.monitor),
            this.settings.get_int('gap'));
    }

    _sharedMonitor(window) {
        return this._mutterSettings.get_boolean('workspaces-only-on-primary') &&
            !window.is_on_primary_monitor();
    }

    _reconcile() {
        const desired = new Map();
        for (const window of this._windows.keys()) {
            if (this._eligible(window)) {
                const group = this._group(window);
                if (group)
                    desired.set(window, group);
            }
        }
        const gap = this.settings.get_int('gap');
        for (const [workspace, monitors] of this._groups) {
            for (const [monitor, group] of monitors) {
                if (monitor >= Main.layoutManager.monitors.length) {
                    monitors.delete(monitor);
                    continue;
                }
                for (const window of group.layout.rectangles(this._area(group), gap).keys()) {
                    if (desired.get(window) !== group)
                        group.layout.remove(window);
                }
            }
            if (!monitors.size)
                this._groups.delete(workspace);
        }
        for (const [window, group] of desired) {
            group.layout.insert(window, this._area(group), gap,
                this.settings.get_string('split-mode'));
            if ([...group.layout.rectangles(this._area(group), gap).values()]
                .some(rect => rect.width < 120 || rect.height < 80)) {
                group.layout.remove(window);
                this._floating.add(window);
                this._restore(window);
            }
        }
        const targets = new Map();
        this._applying = true;
        try {
            for (const [workspace, monitors] of this._groups) {
                for (const [monitor, group] of monitors) {
                    if (!group.layout.root) {
                        monitors.delete(monitor);
                        continue;
                    }
                    for (const [window, rect] of group.layout.rectangles(this._area(group), gap)) {
                        targets.set(window, rect);
                        if (!this._original.has(window)) {
                            this._original.set(window, {rect: window.get_frame_rect(),
                                maximized: window.get_maximized()});
                        }
                        if (window.get_maximized())
                            window.unmaximize(Meta.MaximizeFlags.BOTH);
                        const current = window.get_frame_rect();
                        if (['x', 'y', 'width', 'height'].some(key => current[key] !== rect[key]))
                            window.move_resize_frame(false, rect.x, rect.y,
                                Math.max(1, rect.width), Math.max(1, rect.height));
                    }
                }
                if (!monitors.size)
                    this._groups.delete(workspace);
            }
        } finally {
            this._applying = false;
        }
        // Apps enforce their own minimum size asynchronously. One settling pass
        // releases incompatible windows instead of repeatedly fighting the client.
        if (this._settleSource)
            GLib.Source.remove(this._settleSource);
        this._settleSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._settleSource = 0;
            if (this._grabbing)
                return GLib.SOURCE_REMOVE;
            let changed = false;
            for (const [window, target] of targets) {
                if (!this._windows.has(window) || !this._eligible(window))
                    continue;
                const actual = window.get_frame_rect();
                if (actual.width > target.width + 2 || actual.height > target.height + 2) {
                    this._floating.add(window);
                    this._restore(window);
                    changed = true;
                }
            }
            if (changed)
                this.queue();
            return GLib.SOURCE_REMOVE;
        });
    }

    _swapAtDrop(window) {
        const group = this._group(window);
        if (!group)
            return;
        const rects = group.layout.rectangles(this._area(group), this.settings.get_int('gap'));
        if (!rects.has(window))
            return;
        const frame = window.get_frame_rect();
        const x = frame.x + frame.width / 2;
        const y = frame.y + frame.height / 2;
        for (const [other, rect] of rects) {
            if (other !== window && x >= rect.x && x < rect.x + rect.width &&
                y >= rect.y && y < rect.y + rect.height) {
                group.layout.swap(window, other);
                break;
            }
        }
    }

    isFloating(window) {
        return this._floating.has(window);
    }

    toggleFloating(window) {
        if (!window || window.get_window_type() !== Meta.WindowType.NORMAL)
            return;
        if (this._floating.delete(window)) {
            this._maximized.delete(window);
        } else {
            this._floating.add(window);
            this._restore(window);
        }
        this.queue();
    }

    retile() {
        this._groups.clear();
        this.queue();
    }

    _restore(window) {
        const saved = this._original.get(window);
        this._original.delete(window);
        if (!saved || window.fullscreen || this._maximized.has(window))
            return;
        // Keep a window on its current monitor/workspace after the user moves it.
        const area = window.get_work_area_current_monitor();
        const width = Math.min(saved.rect.width, area.width);
        const height = Math.min(saved.rect.height, area.height);
        const x = Math.max(area.x, Math.min(saved.rect.x, area.x + area.width - width));
        const y = Math.max(area.y, Math.min(saved.rect.y, area.y + area.height - height));
        window.move_resize_frame(false, x, y, width, height);
        if (saved.maximized)
            window.maximize(saved.maximized);
    }

    stop() {
        this._running = false;
        if (this._source)
            GLib.Source.remove(this._source);
        this._source = 0;
        if (this._settleSource)
            GLib.Source.remove(this._settleSource);
        this._settleSource = 0;
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
        for (const [window, ids] of this._windows) {
            for (const id of ids)
                window.disconnect(id);
        }
        if (this.settings.get_boolean('restore-on-disable')) {
            for (const window of this._original.keys()) {
                try {
                    this._restore(window);
                } catch (error) {
                    console.error(`NexTile restore: ${error.message}`);
                }
            }
        }
        this._windows.clear();
        this._original.clear();
        this._groups.clear();
        this._floating.clear();
        this._maximized.clear();
        this._grabbing = false;
    }
}
