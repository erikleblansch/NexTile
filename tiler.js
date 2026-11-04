// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Layout, inset} from './layout.js';
import {TileBorders} from './tileBorders.js';

const STARTUP_SETTLE_US = 1000000;

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
        this._opening = new Map();
        this._targets = new Map();
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
        this._borders = new TileBorders(this);
        const connect = (object, signal, callback) =>
            this._signals.push([object, object.connect(signal, callback)]);
        connect(global, 'shutdown', () => this.stop(false));
        connect(Main.panel, 'destroy', () => this.stop(false));
        connect(global.display, 'window-created', (_display, window) => this._watch(window, true));
        connect(global.window_manager, 'map', (_wm, actor) => {
            this._watch(actor.meta_window, true);
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
        connect(Main.overview, 'showing', () => this._updateBorders());
        connect(Main.overview, 'hidden', () => this._updateBorders());
        connect(Main.sessionMode, 'updated', () => this._updateBorders());
        connect(global.display, 'restacked', () => this._updateBorders());
        connect(global.display, 'grab-op-begin', (_display, window, op) => {
            this._opening.delete(window);
            this._grabbing = true;
            this._moveGroup = this._findGroup(window);
            this._beginResize(window, op);
        });
        connect(global.display, 'grab-op-end', (_display, window, op) => {
            this._grabbing = false;
            this._updateResize();
            if (op === Meta.GrabOp.MOVING || op === Meta.GrabOp.KEYBOARD_MOVING)
                this._dropAt(window, ...global.get_pointer().slice(0, 2));
            this._resizeGrab = null;
            this._moveGroup = null;
            this.queue();
        });
        for (const actor of global.get_window_actors())
            this._watch(actor.meta_window);
        this.queue();
    }

    _watch(window, opening = false) {
        if (!window || this._windows.has(window))
            return;
        if (opening)
            this._opening.set(window, 0);
        const ids = [];
        for (const signal of ['workspace-changed', 'notify::minimized', 'notify::fullscreen', 'notify::mapped', 'shown'])
            ids.push(window.connect(signal, () => this.queue()));
        for (const signal of ['notify::maximized-horizontally', 'notify::maximized-vertically']) {
            ids.push(window.connect(signal, () => {
                if (this._applying)
                    return;
                // Apps can restore their saved maximized state after mapping,
                // including after our first resize. Normalize startup requests;
                // subsequent deliberate maximization remains available.
                if (this._original.has(window) && !this._isOpening(window) && window.get_maximized())
                    this._maximized.add(window);
                else
                    this._maximized.delete(window);
                this.queue();
            }));
        }
        for (const signal of ['size-changed', 'position-changed'])
            ids.push(window.connect(signal, () => {
                if (this._resizeGrab?.window === window && !this._applying)
                    this._updateResize();
                else if (!this._applying && !this._grabbing) {
                    const target = this._targets.get(window);
                    if (target && this._eligible(window)) {
                        const actual = window.get_frame_rect();
                        if (['x', 'y', 'width', 'height'].some(key => Math.abs(actual[key] - target[key]) > 2))
                            this.queue();
                    }
                    this._updateBorders();
                }
            }));
        ids.push(window.connect('unmanaged', () => {
            if (this._resizeGrab?.window === window)
                this._resizeGrab = null;
            for (const id of ids)
                window.disconnect(id);
            this._windows.delete(window);
            this._original.delete(window);
            this._floating.delete(window);
            this._maximized.delete(window);
            this._opening.delete(window);
            this._targets.delete(window);
            this.queue();
        }));
        this._windows.set(window, ids);
        this.queue();
    }

    _isOpening(window) {
        const deadline = this._opening.get(window);
        if (deadline === undefined)
            return false;
        if (deadline === 0 || GLib.get_monotonic_time() <= deadline)
            return true;
        this._opening.delete(window);
        return false;
    }

    queue() {
        if (!this._running || this._source)
            return;
        // Coalesce bursts of map/workspace/monitor notifications; never poll.
        this._source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
            this._source = 0;
            if (!this._grabbing || this._resizeGrab) {
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
            // Mutter reports allows_resize() false while maximized, even for
            // a resizable app. Admit it so startup can actually unmaximize it.
            !window.minimized && !window.fullscreen &&
            (window.allows_resize() || (window.get_maximized() && window.resizeable)) &&
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
        this._targets = targets;
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
                            const opening = this._isOpening(window);
                            if (this._opening.get(window) === 0)
                                this._opening.set(window, GLib.get_monotonic_time() + STARTUP_SETTLE_US);
                            this._original.set(window, {rect: window.get_frame_rect(),
                                maximized: opening ? 0 : window.get_maximized()});
                        }
                        if (window.get_maximized())
                            window.unmaximize(Meta.MaximizeFlags.BOTH);
                        const current = window.get_frame_rect();
                        if (window !== this._resizeGrab?.window &&
                            ['x', 'y', 'width', 'height'].some(key => current[key] !== rect[key]))
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
        this._updateBorders();
        // Apps enforce their own minimum size asynchronously. One settling pass
        // releases incompatible windows instead of repeatedly fighting the client.
        if (this._settleSource)
            GLib.Source.remove(this._settleSource);
        this._settleSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._settleSource = 0;
            if (this._grabbing || this._dividerDragging)
                return GLib.SOURCE_REMOVE;
            let changed = false;
            for (const [window, target] of targets) {
                if (!this._windows.has(window) || !this._eligible(window))
                    continue;
                const actual = window.get_frame_rect();
                if (actual.width > target.width + 2 || actual.height > target.height + 2) {
                    if (this._resizeBackup) {
                        const backup = this._resizeBackup;
                        this._resizeBackup = null;
                        // GNOME 48 does not expose client minimum sizes. Keep
                        // tiled windows tiled if an app refuses a manual resize.
                        for (const [node, ratio] of backup)
                            node.ratio = ratio;
                        this.queue();
                        return GLib.SOURCE_REMOVE;
                    }
                    this._floating.add(window);
                    this._restore(window);
                    changed = true;
                }
            }
            this._resizeBackup = null;
            if (changed)
                this.queue();
            return GLib.SOURCE_REMOVE;
        });
    }

    _findGroup(window) {
        for (const monitors of this._groups.values()) {
            for (const group of monitors.values()) {
                if (group.layout.rectangles(this._area(group), this.settings.get_int('gap')).has(window))
                    return group;
            }
        }
        return null;
    }

    _dropAt(window, x, y) {
        const source = this._moveGroup ?? this._findGroup(window);
        const group = this._group(window);
        if (!source || !group || !this._eligible(window))
            return false;
        const gap = this.settings.get_int('gap');
        const area = this._area(group);
        const rects = group.layout.rectangles(area, gap);
        for (const [other, rect] of rects) {
            if (other === window || x < rect.x || x >= rect.x + rect.width || y < rect.y || y >= rect.y + rect.height)
                continue;
            const before = rect.width >= rect.height ? x < rect.x + rect.width / 2 : y < rect.y + rect.height / 2;
            if (source === group)
                return group.layout.moveTo(window, other, area, gap, before);
            const sourceRoot = source.layout.root;
            const targetRoot = group.layout.root;
            source.layout.remove(window);
            group.layout.insertAt(window, other, area, gap, before);
            if ([...group.layout.rectangles(area, gap).values()].some(r => r.width < 120 || r.height < 80)) {
                source.layout.root = sourceRoot;
                group.layout.root = targetRoot;
                return false;
            }
            return true;
        }
        return false;
    }

    _resizeDivider(item, x, y) {
        if (item.group.layout.resize(item.node, item.axis === 'horizontal' ? x : y,
            this._area(item.group), this.settings.get_int('gap')))
            this.queue();
    }

    _saveResize(items) {
        this._resizeBackup = items.map(item => [item.node, item.node.ratio ?? 0.5]);
    }

    _borderOccluded(group, rect) {
        const members = group.layout.rectangles(this._area(group), this.settings.get_int('gap'));
        for (const window of this._windows.keys()) {
            if (members.has(window) || window.minimized || !window.showing_on_its_workspace() ||
                !window.get_compositor_private()?.visible || window.get_window_type() === Meta.WindowType.DESKTOP)
                continue;
            const frame = window.get_frame_rect();
            if (frame.x < rect.x + rect.width && frame.x + frame.width > rect.x &&
                frame.y < rect.y + rect.height && frame.y + frame.height > rect.y)
                return true;
        }
        return false;
    }

    _updateBorders() {
        if (!this._running || !this._borders)
            return;
        const workspace = global.workspace_manager.get_active_workspace();
        const gap = this.settings.get_int('gap');
        const items = [];
        for (const monitors of this._groups.values()) {
            for (const group of monitors.values()) {
                if (group.monitor >= Main.layoutManager.monitors.length || (!group.shared && group.workspace !== workspace))
                    continue;
                items.push(...group.layout.dividers(this._area(group), gap).map(item => ({...item, group})));
            }
        }
        this._borders.update(items);
    }

    _beginResize(window, op) {
        this._resizeGrab = null;
        const name = Object.keys(Meta.GrabOp).find(key => Meta.GrabOp[key] === op);
        if (!name?.includes('RESIZING'))
            return;
        const group = this._findGroup(window);
        if (!group)
            return;
        const rect = window.get_frame_rect();
        const gap = this.settings.get_int('gap');
        const edges = [];
        const direction = name.split('_').at(-1);
        if (!/^(N|S|E|W|NE|NW|SE|SW)$/.test(direction))
            return;
        for (const item of group.layout.dividers(this._area(group), gap)) {
            const horizontal = item.axis === 'horizontal';
            const overlaps = horizontal
                ? rect.y < item.rect.y + item.rect.height && rect.y + rect.height > item.rect.y
                : rect.x < item.rect.x + item.rect.width && rect.x + rect.width > item.rect.x;
            if (!overlaps)
                continue;
            for (const [letter, edge, position] of horizontal
                ? [['W', 'x', rect.x - gap / 2], ['E', 'right', rect.x + rect.width + gap / 2]]
                : [['N', 'y', rect.y - gap / 2], ['S', 'bottom', rect.y + rect.height + gap / 2]]) {
                if (direction.includes(letter) && Math.abs(item.position - position) <= 3)
                    edges.push({item: {...item, group}, edge});
            }
        }
        if (edges.length) {
            this._resizeGrab = {window, edges};
            this._saveResize(edges.map(edge => edge.item));
        }
    }

    _updateResize() {
        if (!this._resizeGrab)
            return;
        const {window, edges} = this._resizeGrab;
        const rect = window.get_frame_rect();
        const gap = this.settings.get_int('gap');
        for (const {item, edge} of edges) {
            const position = edge === 'right' ? rect.x + rect.width + gap / 2
                : edge === 'bottom' ? rect.y + rect.height + gap / 2 : rect[edge] - gap / 2;
            item.group.layout.resize(item.node, position, this._area(item.group), gap);
        }
        this.queue();
    }

    isFloating(window) {
        return this._floating.has(window);
    }

    toggleFloating(window) {
        if (!window || window.get_window_type() !== Meta.WindowType.NORMAL)
            return;
        this._opening.delete(window);
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

    stop(restore = true) {
        this._running = false;
        this._borders?.destroy();
        this._borders = null;
        this._resizeGrab = null;
        this._resizeBackup = null;
        this._moveGroup = null;
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
        if (restore && this.settings.get_boolean('restore-on-disable')) {
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
        this._opening.clear();
        this._targets.clear();
        this._grabbing = false;
    }
}
