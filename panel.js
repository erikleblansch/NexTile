// SPDX-License-Identifier: GPL-3.0-or-later
import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {workspaceFrames, luminance, contrastingInk, sampleBrightness} from './panelGeometry.js';

const WorkspaceRibbon = GObject.registerClass(
class WorkspaceRibbon extends St.Widget {
    _init() {
        super._init({style_class: 'nextile-workspaces', reactive: true,
            clip_to_allocation: true, accessible_name: 'Werkruimtes',
            accessible_role: Atk.Role.PANEL});
        this._buttons = [];
        this._adjustment = Main.createWorkspacesAdjustment(this);
        this._position = new St.Adjustment({actor: this, lower: 0,
            upper: this._adjustment.upper, page_size: 1, value: this._adjustment.value});
        this._position.connectObject('notify::value', () => this.queue_relayout(), this);
        this._adjustment.connectObject('notify::value', () => this._followPosition(),
            'notify::upper', () => this._syncCount(), this);
        this.connect('destroy', () => this._position.remove_transition('value'));
        this.connect('scroll-event', (_actor, event) => Main.wm.handleWorkspaceScroll(event));
        this._syncCount();
    }

    _syncCount() {
        const count = global.workspace_manager.n_workspaces;
        this._position.upper = count;
        while (this._buttons.length > count)
            this._buttons.pop().destroy();
        while (this._buttons.length < count) {
            const index = this._buttons.length;
            const button = new St.Button({style_class: 'nextile-workspace',
                label: String(index + 1), can_focus: true, reactive: true,
                accessible_name: `Werkruimte ${index + 1}`,
                accessible_role: Atk.Role.PUSH_BUTTON});
            button.connect('clicked', () => {
                if (global.workspace_manager.get_active_workspace_index() === index)
                    Main.overview.toggle();
                else
                    global.workspace_manager.get_workspace_by_index(index)?.activate(global.get_current_time());
            });
            this._buttons.push(button);
            this.add_child(button);
        }
        this.queue_relayout();
    }

    _followPosition() {
        const value = this._adjustment.value;
        this._position.remove_transition('value');
        // Follow continuous touchpad/overview motion directly. A direct jump
        // (e.g. empty workspaces) gets the same gentle settling motion locally.
        if (Number.isInteger(value) && Math.abs(value - this._position.value) > 0.02) {
            this._position.ease(value, {duration: 360,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        } else {
            this._position.value = value;
        }
    }

    _scale() {
        return St.ThemeContext.get_for_stage(global.stage).scale_factor;
    }

    vfunc_get_preferred_width() {
        const monitor = Main.layoutManager.primaryMonitor;
        const width = Math.min(280 * this._scale(), (monitor?.width ?? 1280) * 0.28);
        return [width, width];
    }

    vfunc_get_preferred_height() {
        return [36 * this._scale(), 36 * this._scale()];
    }

    vfunc_allocate(box) {
        this.set_allocation(box);
        const width = box.x2 - box.x1;
        const height = box.y2 - box.y1;
        const scale = this._scale();
        const frames = workspaceFrames(this._buttons.length, this._position.value, width, scale);
        const active = global.workspace_manager.get_active_workspace_index();
        const [stageX] = this.get_transformed_position();
        frames.forEach((frame, index) => {
            const button = this._buttons[index];
            const allocation = new Clutter.ActorBox();
            allocation.x1 = Math.round(frame.x);
            allocation.x2 = Math.round(frame.x + frame.width);
            allocation.y1 = Math.round((height - 24 * scale) / 2);
            allocation.y2 = allocation.y1 + 24 * scale;
            button.allocate(allocation);
            // Fade at the edges without changing the center or growing the panel.
            const edge = Math.min(frame.x + frame.width / 2, width - frame.x - frame.width / 2);
            button.opacity = Math.round(255 * Math.max(0, Math.min(1, edge / (28 * scale))));
            button.reactive = edge > 0;
            button.can_focus = edge > 0;
            const brightness = this._sample ? sampleBrightness(this._sample, stageX + frame.x, frame.width) : null;
            const ink = brightness === null ? this._ink : contrastingInk(brightness, button._ink);
            button._ink = ink;
            const inverse = frame.expansion > 0.5;
            const darkText = (ink === 'dark') !== inverse;
            const border = darkText ? 0 : 255;
            const style = `background-color: ${this._fill(frame.expansion, ink)}; color: ${darkText ? '#000000' : '#ffffff'}; border-color: rgba(${border}, ${border}, ${border}, 0.4);`;
            if (button.get_style() !== style)
                button.set_style(style);
            if (index === active) {
                button.add_style_pseudo_class('active');
                button.accessible_name = `Werkruimte ${index + 1}, actief — overzicht openen`;
            } else {
                button.remove_style_pseudo_class('active');
                button.accessible_name = `Naar werkruimte ${index + 1}`;
            }
        });
    }

    _fill(expansion, ink) {
        const channel = ink === 'dark' ? 0 : 255;
        return `rgba(${channel}, ${channel}, ${channel}, ${0.12 + 0.88 * expansion})`;
    }

    setInk(ink) {
        this._ink = ink;
        this.queue_relayout();
    }

    setContrastSample(sample) {
        this._sample = sample;
        this.queue_relayout();
    }
});

export class PanelAppearance {
    constructor() {
        this._signals = [];
        this._windowSignals = new Map();
        this._styledItems = new Map();
        this._geometry = new Map();
        this._backgroundSignals = [];
        this._source = 0;
        this._busy = false;
        this._dirty = false;
        this._destroyed = false;
        this._panel = Main.panel;
        this._date = Main.panel.statusArea.dateMenu;
        this._activities = Main.panel.statusArea.activities;
        const container = this._date.container;
        this._dateParent = container.get_parent();
        this._dateIndex = this._dateParent.get_children().indexOf(container);
        this._activitiesVisible = this._activities.container.visible;
        this._oldArrow = this._date.menu._boxPointer._sourceAlignment;
        this._oldCenterTranslation = this._panel._centerBox.translation_x;
        this._ribbon = new WorkspaceRibbon();
        this._zones = [this._panel._leftBox, this._panel._centerBox, this._panel._rightBox];
        this._inks = [null, null, null];
        this._panel.add_style_class_name('nextile-panel');
        this._moveClock();
        this._panel._centerBox.add_child(this._ribbon);
        this._date.menu.setSourceAlignment(0);
        this._activities.container.hide();
        this._zones.forEach((zone, index) => this._setInk(index, 'light'));
        this._connect(this._panel, 'notify::allocation', () => {
            this._centerRibbon();
            this._geometryChanged(this._panel);
        });
        for (const zone of this._zones)
            this._connect(zone, 'notify::allocation', () => this._geometryChanged(zone));
        this._connect(this._ribbon, 'notify::allocation', () => this._centerRibbon());
        this._connect(Main.layoutManager, 'monitors-changed', () => {
            this._watchBackgrounds();
            this._ribbon.queue_relayout();
            this.queueContrast();
        });
        this._connect(Main.sessionMode, 'updated', () => {
            if (Main.sessionMode.currentMode === 'user') {
                this._moveClock();
                this._activities.container.hide();
            }
        });
        for (const signal of ['shown', 'hidden'])
            this._connect(Main.overview, signal, () => this.queueContrast());
        this._connect(global.workspace_manager, 'active-workspace-changed', () => this.queueContrast());
        for (const signal of ['restacked', 'workareas-changed'])
            this._connect(global.display, signal, () => this.queueContrast());
        this._connect(global.display, 'window-created', (_display, window) => this._watchWindow(window));
        this._connect(this._panel, 'notify::mapped', () => this.queueContrast());
        this._connect(this._panel, 'destroy', () => this.destroy(false));
        this._background = new Gio.Settings({schema_id: 'org.gnome.desktop.background'});
        this._interface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        this._connect(this._background, 'changed', () => this.queueContrast());
        this._connect(this._interface, 'changed::color-scheme', () => this.queueContrast());
        this._watchBackgrounds();
        for (const actor of global.get_window_actors())
            this._watchWindow(actor.meta_window);
        this.queueContrast();
    }

    _connect(object, signal, callback) {
        this._signals.push([object, object.connect(signal, callback)]);
    }

    _moveClock() {
        const container = this._date.container;
        if (container.get_parent() !== this._panel._leftBox) {
            container.get_parent()?.remove_child(container);
            this._panel._leftBox.insert_child_at_index(container, 0);
        }
    }

    _geometryChanged(actor) {
        const [x, y] = actor.get_transformed_position();
        const geometry = `${x},${y},${actor.width},${actor.height}`;
        if (this._geometry.get(actor) !== geometry) {
            this._geometry.set(actor, geometry);
            this.queueContrast();
        }
    }

    _centerRibbon() {
        const center = this._panel._centerBox;
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor || !center.has_allocation())
            return;
        const [x] = center.get_transformed_position();
        const offset = monitor.x + monitor.width / 2 - (x - center.translation_x + center.width / 2);
        if (Math.abs(center.translation_x - offset) > 0.5)
            center.translation_x = offset;
    }

    _watchWindow(window) {
        if (this._windowSignals.has(window))
            return;
        const ids = ['position-changed', 'size-changed'].map(signal =>
            window.connect(signal, () => this.queueContrast()));
        ids.push(window.connect('unmanaged', () => {
            for (const id of ids)
                window.disconnect(id);
            this._windowSignals.delete(window);
            this.queueContrast();
        }));
        this._windowSignals.set(window, ids);
    }

    _watchBackgrounds() {
        for (const [object, id] of this._backgroundSignals)
            object.disconnect(id);
        this._backgroundSignals = [];
        for (const manager of Main.layoutManager._bgManagers) {
            const id = manager.connect('changed', () => {
                this._watchBackgrounds();
                this.queueContrast();
            });
            this._backgroundSignals.push([manager, id]);
            const background = manager.backgroundActor?.content?.background;
            if (background) {
                this._backgroundSignals.push([background,
                    background.connect('changed', () => this.queueContrast())]);
            }
        }
    }

    queueContrast() {
        if (this._destroyed)
            return;
        this._dirty = true;
        if (this._source || this._busy)
            return;
        this._source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
            this._source = 0;
            this._sampleContrast();
            return GLib.SOURCE_REMOVE;
        });
    }

    async _sampleContrast() {
        if (this._destroyed || this._busy || !this._panel.mapped)
            return;
        this._busy = true;
        this._dirty = false;
        const stream = Gio.MemoryOutputStream.new_resizable();
        let input = null;
        try {
            const [x, y] = this._panel.get_transformed_position();
            const width = Math.floor(this._panel.width);
            if (width < 1)
                return;
            // Only two rows at the transparent panel's top edge: no text or
            // icons feed back into the result. Pixels never leave memory.
            const screenshot = new Shell.Screenshot();
            await new Promise((resolve, reject) => screenshot.screenshot_area(
                Math.floor(x), Math.floor(y) + 1, width, 2, stream, (source, result) => {
                    try {
                        source.screenshot_area_finish(result);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }));
            stream.close(null);
            if (this._destroyed)
                return;
            input = Gio.MemoryInputStream.new_from_bytes(stream.steal_as_bytes());
            const pixels = GdkPixbuf.Pixbuf.new_from_stream(input, null);
            const data = pixels.get_pixels();
            const channels = pixels.n_channels;
            const values = new Float32Array(pixels.width);
            for (let column = 0; column < pixels.width; column++) {
                const offset = column * channels;
                values[column] = luminance(data[offset], data[offset + 1], data[offset + 2]);
            }
            const sample = {x, width, values};
            this._zones.forEach((zone, index) => {
                const [left] = zone.get_transformed_position();
                const brightness = sampleBrightness(sample, left, zone.width);
                if (brightness !== null)
                    this._setInk(index, contrastingInk(brightness, this._inks[index]));
                if (index !== 1) {
                    for (const item of zone.get_children()) {
                        if (!item.visible)
                            continue;
                        const [itemX] = item.get_transformed_position();
                        const value = sampleBrightness(sample, itemX, item.width);
                        if (value !== null)
                            this._setItemInk(item, contrastingInk(value, this._styledItems.get(item)?.ink));
                    }
                }
            });
            this._ribbon.setContrastSample(sample);
        } catch (error) {
            // The compositor can reject capture during monitor changes/locking.
            // Keep the previous color and let the next desktop event retry.
            if (!this._destroyed)
                console.debug(`NexTile contrast unavailable: ${error.message}`);
        } finally {
            input?.close(null);
            if (!stream.is_closed())
                stream.close(null);
            this._busy = false;
            if (this._dirty && !this._destroyed)
                this.queueContrast();
        }
    }

    _setInk(index, ink) {
        if (this._inks[index] === ink)
            return;
        const zone = this._zones[index];
        zone.remove_style_class_name(`nextile-ink-${this._inks[index]}`);
        zone.add_style_class_name(`nextile-ink-${ink}`);
        this._inks[index] = ink;
        if (index === 1)
            this._ribbon.setInk(ink);
    }

    _setItemInk(item, ink) {
        let record = this._styledItems.get(item);
        if (!record) {
            record = {ink: null, id: item.connect('destroy', () => this._styledItems.delete(item))};
            this._styledItems.set(item, record);
            item.add_style_class_name('nextile-panel-item');
        }
        if (record.ink !== ink) {
            item.remove_style_class_name(`nextile-ink-${record.ink}`);
            item.add_style_class_name(`nextile-ink-${ink}`);
            record.ink = ink;
        }
    }

    destroy(restore = true) {
        if (this._destroyed)
            return;
        this._destroyed = true;
        if (this._source)
            GLib.Source.remove(this._source);
        this._source = 0;
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
        for (const [object, id] of this._backgroundSignals)
            object.disconnect(id);
        this._backgroundSignals = [];
        for (const [window, ids] of this._windowSignals) {
            for (const id of ids)
                window.disconnect(id);
        }
        this._windowSignals.clear();
        for (const [item, record] of this._styledItems) {
            item.disconnect(record.id);
            if (restore) {
                item.remove_style_class_name('nextile-panel-item');
                item.remove_style_class_name(`nextile-ink-${record.ink}`);
            }
        }
        this._styledItems.clear();
        this._geometry.clear();
        if (restore) {
            this._ribbon.destroy();
            const container = this._date.container;
            container.get_parent()?.remove_child(container);
            this._dateParent.insert_child_at_index(container, this._dateIndex);
            this._date.menu.setSourceAlignment(this._oldArrow);
            this._panel._centerBox.translation_x = this._oldCenterTranslation;
            this._activities.container.visible = this._activitiesVisible;
            this._panel.remove_style_class_name('nextile-panel');
            this._zones.forEach(zone => {
                zone.remove_style_class_name('nextile-ink-light');
                zone.remove_style_class_name('nextile-ink-dark');
            });
        }
        this._background = null;
        this._interface = null;
    }
}
