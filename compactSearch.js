// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class CompactSearch {
    constructor(getAnchor, onVisibilityChanged) {
        this._nativeHandler = GObject.signal_handler_find(global.display, {signalId: 'overlay-key'});
        if (!this._nativeHandler)
            throw new Error('NexTile: native Super handler unavailable');
        this._getAnchor = getAnchor;
        this._visibilityChanged = onVisibilityChanged;
        this._signals = [];
        this._generation = 0;
        this._timeout = 0;
        this._open = false;
        this._destroyed = false;
        this._rows = [];
        this._selected = -1;
        this._lastScroll = 0;
        this._smoothScroll = 0;
        this._provider = new AppDisplay.AppSearchProvider();
        this._a11y = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.keyboard'});
        this._backdrop = new St.Widget({style_class: 'nextile-search-band', visible: false});
        // Chrome actors can be disposed before the panel during Shell shutdown.
        this._backdrop.connect('destroy', () => this.destroy(true));
        Main.layoutManager.addChrome(this._backdrop, {affectsInputRegion: false});
        Main.uiGroup.set_child_below_sibling(this._backdrop, Main.layoutManager.panelBox);
        this._root = new St.Widget({visible: false, reactive: true});
        this._surface = new St.Widget({style_class: 'nextile-search-surface', reactive: true,
            clip_to_allocation: true, layout_manager: new Clutter.BinLayout()});
        this._entry = new St.Entry({style_class: 'nextile-search-entry', hint_text: 'Typ om te zoeken',
            can_focus: true, x_expand: true, y_expand: true, accessible_name: 'Programma zoeken'});
        this._entry.set_primary_icon(new St.Icon({icon_name: 'edit-find-symbolic', icon_size: 18}));
        this._surface.add_child(this._entry);
        this._results = new St.BoxLayout({style_class: 'nextile-search-results',
            orientation: Clutter.Orientation.VERTICAL, visible: false});
        this._root.add_child(this._surface);
        this._root.add_child(this._results);
        Main.layoutManager.addTopChrome(this._root);
        this._connect(this._entry.clutter_text, 'text-changed', () => this._queueSearch());
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
        this._connect(Shell.AppSystem.get_default(), 'installed-changed', () => this._queueSearch());
        this._connect(this._provider._parentalControlsManager, 'app-filter-changed', () => this._queueSearch());
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
        this._root.remove_all_transitions();
        this._surface.remove_all_transitions();
        this._backdrop.remove_all_transitions();
        this._entry.remove_all_transitions();
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
        this._monitor = monitor;
        this._scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const width = Math.min(440 * this._scale, monitor.width - 32 * this._scale);
        const height = 40 * this._scale;
        this._target = {x: Math.round(monitor.x + (monitor.width - width) / 2),
            y: Math.round(monitor.y + Main.panel.height + 12 * this._scale), width, height};
        const anchor = this._getAnchor() ?? {x: monitor.x + monitor.width / 2 - 24 * this._scale,
            y: monitor.y + 6 * this._scale, width: 48 * this._scale, height: 24 * this._scale};
        this._entry.set_text('');
        this._clearRows();
        this._surface.set_position(anchor.x, anchor.y);
        this._surface.set_size(anchor.width, anchor.height);
        this._entry.opacity = 0;
        this._backdrop.set_position(monitor.x, monitor.y);
        this._backdrop.set_size(monitor.width, Main.panel.height);
        this._backdrop.opacity = 0;
        this._backdrop.show();
        this._results.set_position(this._target.x, this._target.y + height + 8 * this._scale);
        this._results.width = width;
        this._surface.ease({...this._target, duration: 340, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        this._entry.ease({opacity: 255, duration: 200, delay: 80, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        this._resizeBand();
        this._entry.grab_key_focus();
        this._visibilityChanged();
        return true;
    }

    close(animate = true) {
        if (!this._open)
            return;
        this._open = false;
        this._generation++;
        this._cancelSearch();
        this._clearRows();
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        this._entry.set_text('');
        this._surface.remove_all_transitions();
        this._entry.remove_all_transitions();
        this._backdrop.remove_all_transitions();
        const finish = () => {
            this._root.hide();
            this._backdrop.hide();
            this._visibilityChanged();
        };
        const anchor = animate ? this._getAnchor() : null;
        if (anchor) {
            this._entry.ease({opacity: 0, duration: 100});
            this._backdrop.ease({opacity: 0, duration: 200});
            this._surface.ease({...anchor, duration: 220, mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
                onComplete: finish});
        } else {
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
            this._select(this._selected + 1);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Up || key === Clutter.KEY_ISO_Left_Tab) {
            this._select(this._selected - 1);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
            if (this._timeout || this._cancellable)
                this._runSearch(true);
            else
                this._activate(this._rows[this._selected]?.id);
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

    _cancelSearch() {
        if (this._timeout)
            GLib.Source.remove(this._timeout);
        this._timeout = 0;
        this._cancellable?.cancel();
        this._cancellable = null;
    }

    _queueSearch() {
        this._generation++;
        this._cancelSearch();
        if (!this._open)
            return;
        this._clearRows();
        this._resizeBand();
        if (!this._entry.get_text().trim())
            return;
        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._timeout = 0;
            this._runSearch();
            return GLib.SOURCE_REMOVE;
        });
    }

    async _runSearch(activate = false) {
        this._cancelSearch();
        const generation = ++this._generation;
        const terms = this._entry.get_text().trim().split(/\s+/).filter(Boolean);
        if (!this._open || !terms.length || !this._provider._parentalControlsManager.initialized)
            return;
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        try {
            const ids = await this._provider.getInitialResultSet(terms, cancellable);
            if (!this._open || this._destroyed || generation !== this._generation)
                return;
            const space = this._monitor.y + this._monitor.height - this._results.y - 24 * this._scale;
            const limit = Math.max(1, Math.min(6, Math.floor(space / (48 * this._scale))));
            const metas = await this._provider.getResultMetas(ids.filter(id => id.endsWith('.desktop')).slice(0, limit));
            if (!this._open || this._destroyed || generation !== this._generation)
                return;
            this._clearRows();
            for (const meta of metas) {
                const button = new St.Button({style_class: 'nextile-search-result', x_expand: true,
                    can_focus: true, reactive: true, accessible_name: meta.name});
                const content = new St.BoxLayout({style_class: 'nextile-search-result-content'});
                content.add_child(meta.createIcon(28));
                content.add_child(new St.Label({text: meta.name, y_align: Clutter.ActorAlign.CENTER}));
                button.set_child(content);
                button.connect('clicked', () => this._activate(meta.id));
                this._results.add_child(button);
                this._rows.push({id: meta.id, button});
            }
            if (!metas.length)
                this._results.add_child(new St.Label({text: 'Geen programma’s gevonden', style_class: 'nextile-search-empty'}));
            this._results.show();
            this._select(0);
            this._resizeBand();
            if (activate)
                this._activate(this._rows[0]?.id);
        } catch (error) {
            if (!this._destroyed && generation === this._generation)
                console.error(`NexTile search: ${error.message}`);
        } finally {
            if (this._cancellable === cancellable)
                this._cancellable = null;
        }
    }

    _select(index) {
        if (!this._rows.length)
            return;
        this._selected = (index + this._rows.length) % this._rows.length;
        this._rows.forEach((row, i) => {
            if (i === this._selected)
                row.button.add_style_pseudo_class('selected');
            else
                row.button.remove_style_pseudo_class('selected');
        });
    }

    _activate(id) {
        const app = id ? Shell.AppSystem.get_default().lookup_app(id) : null;
        if (!app || !this._provider._parentalControlsManager.shouldShowApp(app.app_info))
            return;
        this.close(false);
        app.activate();
    }

    _clearRows() {
        this._results.destroy_all_children();
        this._rows = [];
        this._selected = -1;
        this._results.hide();
    }

    _resizeBand() {
        if (!this._open)
            return;
        const resultsHeight = this._results.visible ? this._results.get_preferred_height(this._target.width)[1] : 0;
        const height = Math.max(132 * this._scale,
            this._target.y - this._monitor.y + this._target.height + resultsHeight + 24 * this._scale);
        this._backdrop.ease({height, opacity: 255, duration: 240, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
    }

    destroy(backdropDestroyed = false) {
        if (this._destroyed)
            return;
        this.close(false);
        this._destroyed = true;
        this._generation++;
        this._cancelSearch();
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
        if (GObject.signal_handler_is_connected(global.display, this._nativeHandler))
            GObject.signal_handler_unblock(global.display, this._nativeHandler);
        this._nativeHandler = 0;
        this._root.destroy();
        if (!backdropDestroyed)
            this._backdrop.destroy();
        this._provider = null;
        this._a11y = null;
    }
}
