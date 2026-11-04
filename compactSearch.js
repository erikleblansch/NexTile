// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {NativeSearch} from './nativeSearch.js';

export class CompactSearch {
    constructor(getAnchor, onVisibilityChanged, setExpansion) {
        this._nativeHandler = GObject.signal_handler_find(global.display, {signalId: 'overlay-key'});
        if (!this._nativeHandler)
            throw new Error('NexTile: native Super handler unavailable');
        this._getAnchor = getAnchor;
        this._visibilityChanged = onVisibilityChanged;
        this._setExpansion = setExpansion;
        this._signals = [];
        this._open = false;
        this._destroyed = false;
        this._lastScroll = 0;
        this._smoothScroll = 0;
        this._a11y = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.keyboard'});
        this._root = new St.Widget({visible: false, reactive: true});
        this._surface = new St.Widget({style_class: 'nextile-search-surface', reactive: true,
            clip_to_allocation: true, layout_manager: new Clutter.BinLayout()});
        this._entry = new St.Entry({style_class: 'nextile-search-entry', hint_text: 'Typ om te zoeken',
            can_focus: true, x_expand: true, y_expand: true, accessible_name: 'Zoeken'});
        this._entry.set_primary_icon(new St.Icon({icon_name: 'edit-find-symbolic', icon_size: 16}));
        this._clearIcon = new St.Icon({icon_name: 'edit-clear-symbolic', icon_size: 16});
        this._surface.add_child(this._entry);
        this._results = new NativeSearch();
        this._root.add_child(this._surface);
        this._root.add_child(this._results);
        Main.layoutManager.addTopChrome(this._root);
        this._progress = new St.Adjustment({actor: this._surface, lower: 0, upper: 1, value: 0});
        this._connect(this._progress, 'notify::value', () => this._layoutMorph());
        this._connect(this._entry.clutter_text, 'text-changed', () => {
            const terms = this._entry.get_text().trim().split(/\s+/).filter(Boolean);
            this._entry.set_secondary_icon(terms.length ? this._clearIcon : null);
            if (this._open)
                this._results.setTerms(terms);
        });
        this._connect(this._entry, 'secondary-icon-clicked', () => {
            this._entry.set_text('');
            this._entry.grab_key_focus();
        });
        this._connect(this._results, 'activated', () => this.close(false));
        this._connect(this._root, 'captured-event', (_actor, event) => this._onEvent(event));
        this._connect(global.display, 'overlay-key', () => {
            if (this._a11y.get_boolean('stickykeys-enable'))
                return;
            if (this._open)
                this.close();
            else if (Main.overview.visible)
                Main.overview.hide();
            else
                this.open();
        });
        this._connect(Main.overview, 'showing', () => this.close(false));
        this._connect(Main.layoutManager, 'monitors-changed', () => this.close(false));
        this._connect(Main.sessionMode, 'updated', () => this.close(false));
        this._connect(Main.panel, 'destroy', () => this.destroy());
        this._connect(global.workspace_manager, 'active-workspace-changed', () => {
            if (this._open)
                this._entry.grab_key_focus();
        });
        GObject.signal_handler_block(global.display, this._nativeHandler);
    }

    _connect(object, signal, callback) {
        this._signals.push([object, object.connect(signal, callback)]);
    }

    open() {
        if (this._destroyed || this._open || Main.modalCount || Main.overview.visible || Main.sessionMode.isLocked)
            return false;
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return false;
        this._progress.remove_transition('value');
        this._root.set_position(0, 0);
        this._root.set_size(global.stage.width, global.stage.height);
        this._root.show();
        const grab = Main.pushModal(this._root, {actionMode: Shell.ActionMode.NORMAL});
        if (grab.get_seat_state() !== Clutter.GrabState.ALL) {
            Main.popModal(grab);
            this._root.hide();
            return false;
        }
        this._grab = grab;
        this._open = true;
        this._lastScroll = 0;
        this._smoothScroll = 0;
        this._scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const scale = this._scale;
        const side = Math.max(Main.panel._leftBox.width, Main.panel._rightBox.width);
        this._searchWidth = Math.max(120, Math.min(440, (monitor.width - 2 * side) / scale - 144));
        const anchor = this._getAnchor();
        this._pillChannel = anchor?.ink === 'dark' ? 0 : 255;
        this._center = {x: monitor.x + monitor.width / 2,
            y: anchor ? anchor.y + anchor.height / 2 : monitor.y + Main.panel.height / 2};
        this._target = {width: this._searchWidth * scale, height: Math.min(30 * scale, Main.panel.height - 4 * scale)};
        this._target.x = this._center.x - this._target.width / 2;
        this._target.y = this._center.y - this._target.height / 2;
        this._entry.set_text('');
        this._results.setTerms([]);
        const resultWidth = Math.min(1040 * scale, monitor.width - 64 * scale);
        const resultY = monitor.y + Main.panel.height + 24 * scale;
        this._results.set_position(Math.round(monitor.x + (monitor.width - resultWidth) / 2), resultY);
        this._results.set_size(resultWidth, monitor.y + monitor.height - resultY - 24 * scale);
        this._progress.value = 0;
        this._layoutMorph();
        this._progress.ease(1, {duration: 340, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        this._entry.grab_key_focus();
        this._visibilityChanged();
        return true;
    }

    _layoutMorph() {
        if (!this._center)
            return;
        const value = this._progress.value;
        const width = (48 + (this._searchWidth - 48) * value) * this._scale;
        const height = 24 * this._scale + (this._target.height - 24 * this._scale) * value;
        this._surface.set_position(Math.round(this._center.x - width / 2), Math.round(this._center.y - height / 2));
        this._surface.set_size(width, height);
        const channel = Math.round(this._pillChannel + (64 - this._pillChannel) * value);
        this._surface.set_style(`background-color: rgb(${channel}, ${channel}, ${Math.round(channel + value * 5)});`);
        this._entry.opacity = Math.round(255 * Math.max(0, (value - 0.18) / 0.82));
        this._setExpansion(value, this._searchWidth);
    }

    close(animate = true) {
        this._progress.remove_transition('value');
        if (!this._open) {
            if (!animate) {
                this._progress.value = 0;
                this._setExpansion(0, this._searchWidth ?? 440);
                this._root.hide();
            }
            return;
        }
        this._open = false;
        this._results.setTerms([]);
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        this._entry.set_text('');
        const finish = () => {
            this._root.hide();
            this._setExpansion(0, this._searchWidth);
            this._visibilityChanged();
        };
        if (animate) {
            this._progress.ease(0, {duration: 240, mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
                onComplete: finish});
        } else {
            this._progress.value = 0;
            finish();
        }
    }

    _onEvent(event) {
        if (!this._open)
            return Clutter.EVENT_PROPAGATE;
        if (event.type() === Clutter.EventType.SCROLL)
            return this._scrollWorkspace(event);
        if (event.type() === Clutter.EventType.BUTTON_PRESS || event.type() === Clutter.EventType.TOUCH_BEGIN) {
            const actor = global.stage.get_event_actor(event);
            if (!this._surface.contains(actor) && !this._results.contains(actor) &&
                !Main.layoutManager.keyboardBox.contains(actor)) {
                this.close();
                return Clutter.EVENT_STOP;
            }
        }
        if (event.type() !== Clutter.EventType.KEY_PRESS)
            return Clutter.EVENT_PROPAGATE;
        const key = event.get_key_symbol();
        if (this._entry.clutter_text.has_preedit())
            return Clutter.EVENT_PROPAGATE;
        if (key === Clutter.KEY_Escape) {
            this.close();
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Down || key === Clutter.KEY_Tab) {
            this._results.select(this._results._selected + 1);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Up || key === Clutter.KEY_ISO_Left_Tab) {
            this._results.select(this._results._selected - 1);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
            this._results.activateSelected();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
    _scrollWorkspace(event) {
        const now = GLib.get_monotonic_time();
        if (now - this._lastScroll < 180000)
            return Clutter.EVENT_STOP;
        let step = 0;
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
        case Clutter.ScrollDirection.LEFT: step = -1; break;
        case Clutter.ScrollDirection.DOWN:
        case Clutter.ScrollDirection.RIGHT: step = 1; break;
        case Clutter.ScrollDirection.SMOOTH: {
            const [dx, dy] = event.get_scroll_delta();
            this._smoothScroll += Math.abs(dy) >= Math.abs(dx) ? dy : dx;
            if (Math.abs(this._smoothScroll) < 1)
                return Clutter.EVENT_STOP;
            step = Math.sign(this._smoothScroll);
            this._smoothScroll = 0;
            break;
        }
        default: return Clutter.EVENT_STOP;
        }
        this._lastScroll = now;
        const manager = global.workspace_manager;
        const index = Math.max(0, Math.min(manager.n_workspaces - 1, manager.get_active_workspace_index() + step));
        manager.get_workspace_by_index(index)?.activate(global.get_current_time());
        this._entry.grab_key_focus();
        return Clutter.EVENT_STOP;
    }

    destroy() {
        if (this._destroyed)
            return;
        this.close(false);
        this._destroyed = true;
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
        if (GObject.signal_handler_is_connected(global.display, this._nativeHandler))
            GObject.signal_handler_unblock(global.display, this._nativeHandler);
        this._nativeHandler = 0;
        this._root.destroy();
        this._clearIcon.destroy();
        this._a11y = null;
    }
}
