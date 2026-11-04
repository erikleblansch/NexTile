// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class TileBorders {
    constructor(tiler) {
        this._tiler = tiler;
        this._actors = new Map();
        this._drag = null;
        this._hover = null;
    }

    update(items) {
        const alive = new Set(items.map(item => item.node));
        for (const [node, record] of this._actors) {
            if (!alive.has(node)) {
                if (this._drag?.record === record)
                    this._finish(true);
                if (this._hover === record)
                    this._clearCursor();
                record.actor.destroy();
                this._actors.delete(node);
            }
        }
        for (const item of items) {
            let record = this._actors.get(item.node);
            if (!record) {
                const actor = new St.Widget({style_class: 'nextile-tile-border', reactive: true,
                    accessible_name: 'Tegelgrens verslepen'});
                record = {actor, item};
                actor.connect('enter-event', () => {
                    this._hover = record;
                    global.display.set_cursor(item.axis === 'horizontal' ? Meta.Cursor.E_RESIZE : Meta.Cursor.S_RESIZE);
                    return Clutter.EVENT_PROPAGATE;
                });
                actor.connect('leave-event', () => {
                    if (!this._drag)
                        this._clearCursor();
                    return Clutter.EVENT_PROPAGATE;
                });
                actor.connect('button-press-event', (_actor, event) => this._begin(record, event));
                actor.connect('captured-event', (_actor, event) => this._event(event));
                Main.layoutManager.addChrome(actor);
                this._actors.set(item.node, record);
            }
            record.item = item;
            const width = Math.max(6, Math.min(12, item.space || 6));
            const horizontal = item.axis === 'horizontal';
            const rect = horizontal
                ? {x: Math.round(item.position - width / 2), y: item.rect.y, width, height: item.rect.height}
                : {x: item.rect.x, y: Math.round(item.position - width / 2), width: item.rect.width, height: width};
            const visible = !Main.overview.visible && !Main.sessionMode.isLocked &&
                !this._tiler._borderOccluded(item.group, rect);
            if (!visible && this._drag?.record === record)
                this._finish(true);
            if (!visible && this._hover === record)
                this._clearCursor();
            record.actor.set_position(rect.x, rect.y);
            record.actor.set_size(rect.width, rect.height);
            record.actor.visible = visible;
        }
    }

    _begin(record, event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY || Main.modalCount || this._drag)
            return Clutter.EVENT_PROPAGATE;
        const grab = Main.pushModal(record.actor, {actionMode: Shell.ActionMode.NORMAL});
        if (grab.get_seat_state() !== Clutter.GrabState.ALL) {
            Main.popModal(grab);
            return Clutter.EVENT_STOP;
        }
        this._drag = {record, grab, ratio: record.item.node.ratio ?? 0.5};
        this._tiler._saveResize([record.item]);
        record.actor.add_style_pseudo_class('active');
        this._tiler._dividerDragging = true;
        return Clutter.EVENT_STOP;
    }

    _event(event) {
        if (!this._drag)
            return Clutter.EVENT_PROPAGATE;
        if (event.type() === Clutter.EventType.MOTION) {
            const [x, y] = event.get_coords();
            this._tiler._resizeDivider(this._drag.record.item, x, y);
            return Clutter.EVENT_STOP;
        }
        if (event.type() === Clutter.EventType.BUTTON_RELEASE && event.get_button() === Clutter.BUTTON_PRIMARY) {
            const [x, y] = event.get_coords();
            this._tiler._resizeDivider(this._drag.record.item, x, y);
            this._finish();
            return Clutter.EVENT_STOP;
        }
        if (event.type() === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) {
            this._finish(true);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _finish(cancel = false) {
        const drag = this._drag;
        if (!drag)
            return;
        this._drag = null;
        if (cancel)
            drag.record.item.node.ratio = drag.ratio;
        if (cancel)
            this._tiler._resizeBackup = null;
        Main.popModal(drag.grab);
        drag.record.actor.remove_style_pseudo_class('active');
        this._tiler._dividerDragging = false;
        this._clearCursor();
        this._tiler.queue();
    }

    _clearCursor() {
        global.display.set_cursor(Meta.Cursor.DEFAULT);
        this._hover = null;
    }

    destroy() {
        this._finish(true);
        this._clearCursor();
        for (const {actor} of this._actors.values())
            actor.destroy();
        this._actors.clear();
    }
}
