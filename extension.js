// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {PopupAnimation} from 'resource:///org/gnome/shell/ui/boxpointer.js';
import {Tiler} from './tiler.js';
import {PanelAppearance} from './panel.js';
import {CompactSearch} from './compactSearch.js';
import {TerminalStyle} from './terminalStyle.js';
import {NewWindowLaunch} from './newWindowLaunch.js';

const NexTileToggle = GObject.registerClass(
class NexTileToggle extends QuickSettings.QuickMenuToggle {
    _init(settings, tiler) {
        super._init({title: 'NexTile', iconName: 'view-grid-symbolic', toggleMode: true});
        this._settings = settings;
        this._tiler = tiler;
        settings.bind('tiling-enabled', this, 'checked', Gio.SettingsBindFlags.DEFAULT);
        this.menu.setHeader('view-grid-symbolic', 'NexTile', _('Room for every window'));
        this._gap = new PopupMenu.PopupSubMenuMenuItem(_('Window gaps'));
        this.menu.addMenuItem(this._gap);
        this._gapItems = [0, 4, 8, 12, 16, 24, 32].map(value => {
            const item = this._gap.menu.addAction(`${value} px`, () => settings.set_int('gap', value));
            return [value, item];
        });
        const modes = [['auto', _('Automatic')], ['horizontal', _('Side by side')], ['vertical', _('Stacked')]];
        this._split = new PopupMenu.PopupSubMenuMenuItem(_('Split direction'));
        this.menu.addMenuItem(this._split);
        this._splitItems = modes.map(([value, label]) => {
            const item = this._split.menu.addAction(label, () => settings.set_string('split-mode', value));
            return [value, item];
        });
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._float = new PopupMenu.PopupSwitchMenuItem(_('Float active window'), false);
        this._float.insert_child_below(new St.Icon({
            icon_name: 'dialog-warning-symbolic',
            style_class: 'popup-menu-icon nextile-float-warning',
        }), this._float.label);
        this._float.connect('toggled', () => tiler.toggleFloating(this._focus));
        this.menu.addMenuItem(this._float);
        this._retile = this.menu.addAction(_('Reflow windows'), () => tiler.retile());
        this._restore = new PopupMenu.PopupSwitchMenuItem(_('Restore windows when tiling is off'), true);
        this._restore.connect('toggled', (_item, state) => settings.set_boolean('restore-on-disable', state));
        this.menu.addMenuItem(this._restore);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._panelSwitch = new PopupMenu.PopupSwitchMenuItem(_('Transparent top bar'), true);
        this._panelSwitch.connect('toggled', (_item, state) => settings.set_boolean('panel-enabled', state));
        this.menu.addMenuItem(this._panelSwitch);
        this._searchSwitch = new PopupMenu.PopupSwitchMenuItem(_('Super opens search'), true);
        this._searchSwitch.connect('toggled', (_item, state) => settings.set_boolean('search-enabled', state));
        this.menu.addMenuItem(this._searchSwitch);
        this._newWindowSwitch = new PopupMenu.PopupSwitchMenuItem(_('Always open a new window'), true);
        this._newWindowSwitch.connect('toggled', (_item, state) => settings.set_boolean('new-window-on-launch', state));
        this.menu.addMenuItem(this._newWindowSwitch);
        this._terminalSwitch = new PopupMenu.PopupSwitchMenuItem(_('Transparent terminal'), false);
        this._terminalSwitch.connect('toggled', (_item, state) => settings.set_boolean('terminal-transparent', state));
        this.menu.addMenuItem(this._terminalSwitch);
        this._changedId = settings.connect('changed', () => this._sync());
        this._focusId = global.display.connect('notify::focus-window', () => this._rememberFocus());
        this._panelDestroyId = Main.panel.connect('destroy', () => this._disconnectSignals());
        this.connect('destroy', () => this._disconnectSignals());
        this._rememberFocus();
        this._menuOpenId = this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._sync();
        });
        this._sync();
    }

    _sync() {
        if (this._destroyed)
            return;
        const enabled = this._settings.get_boolean('tiling-enabled');
        const gap = this._settings.get_int('gap');
        const mode = this._settings.get_string('split-mode');
        this.subtitle = enabled ? _('Automatic') : _('Off');
        this._gap.label.text = _('Window gaps · %d px').format(gap);
        for (const [value, item] of this._gapItems)
            item.setOrnament(value === gap ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        for (const [value, item] of this._splitItems)
            item.setOrnament(value === mode ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        this._restore.setToggleState(this._settings.get_boolean('restore-on-disable'));
        this._panelSwitch.setToggleState(this._settings.get_boolean('panel-enabled'));
        this._searchSwitch.setToggleState(this._settings.get_boolean('search-enabled'));
        this._newWindowSwitch.setToggleState(this._settings.get_boolean('new-window-on-launch'));
        this._terminalSwitch.setToggleState(this._settings.get_boolean('terminal-transparent'));
        this._float.setToggleState(this._tiler.isFloating(this._focus));
        this._float.setSensitive(enabled && !!this._focus &&
            this._focus.get_window_type() === Meta.WindowType.NORMAL);
        this._retile.setSensitive(enabled);
    }

    _rememberFocus() {
        if (this._destroyed)
            return;
        const window = global.display.focus_window;
        // Opening Quick Settings can focus the Shell itself. Retain the last
        // application window so the floating action still addresses that window.
        if (!window || window.get_window_type() !== Meta.WindowType.NORMAL || window === this._focus)
            return;
        if (this._focus && this._focusUnmanagedId)
            this._focus.disconnect(this._focusUnmanagedId);
        this._focus = window;
        this._focusUnmanagedId = window.connect('unmanaged', () => {
            window.disconnect(this._focusUnmanagedId);
            this._focusUnmanagedId = 0;
            this._focus = null;
            this._sync();
        });
    }

    _disconnectSignals() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        this._settings.disconnect(this._changedId);
        global.display.disconnect(this._focusId);
        Main.panel.disconnect(this._panelDestroyId);
        if (this._focus && this._focusUnmanagedId)
            this._focus.disconnect(this._focusUnmanagedId);
        this._focusUnmanagedId = 0;
        this._focus = null;
        this.menu.disconnect(this._menuOpenId);
        this._menuOpenId = 0;
        // Quick Settings parents the dropdown in its own overlay. Destroying
        // this button alone leaves that menu, its signals and modal grab alive.
        // GNOME 51 moved open/close into PopupMenuBase and changed their
        // argument to an options object; older versions use an animation enum.
        this.menu.close(PopupMenu.PopupMenuBase.prototype.close ? {animate: false} : PopupAnimation.NONE);
        this.menu.destroy();
        this.menu = null;
    }

    destroy() {
        this._disconnectSignals();
        super.destroy();
    }
});

export default class NexTileExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._newWindowLauncher = new NewWindowLaunch(this._settings);
        this._terminal = new TerminalStyle(this.dir.get_child('extras').get_child('terminal-transparency.css'));
        this._terminalRequest = 0;
        this._tiler = new Tiler(this._settings);
        this._indicator = new QuickSettings.SystemIndicator();
        this._toggle = new NexTileToggle(this._settings, this._tiler);
        this._indicator.quickSettingsItems.push(this._toggle);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        this._settingsId = this._settings.connect('changed', (_settings, key) => {
            if (key === 'tiling-enabled')
                this._sync();
            else if (key === 'gap' || key === 'split-mode')
                this._tiler.queue();
            else if (key === 'panel-enabled')
                this._syncPanel();
            else if (key === 'search-enabled')
                this._syncSearch();
            else if (key === 'terminal-transparent')
                this._syncTerminal(true);
        });
        this._syncPanel();
        this._syncSearch();
        this._sync();
        this._syncTerminal(false);
    }

    _syncTerminal(notify) {
        if (this._updatingTerminal)
            return;
        const terminal = this._terminal;
        const settings = this._settings;
        const request = ++this._terminalRequest;
        const current = () => this._terminal === terminal && this._terminalRequest === request;
        const setState = enabled => {
            this._updatingTerminal = true;
            try {
                settings.set_boolean('terminal-transparent', enabled);
            } finally {
                this._updatingTerminal = false;
            }
        };
        this._terminalTask = (async () => {
            try {
                // Adopt the old optional CSS only if the user has not changed
                // this preference while the asynchronous read was pending.
                if (settings.get_user_value('terminal-transparent') === null) {
                    const enabled = await terminal.readEnabled();
                    if (!current())
                        return;
                    if (settings.get_user_value('terminal-transparent') === null)
                        setState(enabled);
                }
                const changed = await terminal.apply(settings.get_boolean('terminal-transparent'));
                if (current() && changed && notify)
                    Main.notify('NexTile', _('Close all GNOME Terminal windows and reopen Terminal to apply. Enable “Use colors from system theme” in your Terminal profile.'));
            } catch (error) {
                if (!current() || error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    return;
                console.warn(`NexTile terminal: ${error.message}`);
                // Only the latest request may roll the switch back or notify.
                try {
                    const enabled = await terminal.readEnabled();
                    if (current())
                        setState(enabled);
                } catch {
                    // Leave the preference intact if the file is unreadable.
                }
                if (current())
                    Main.notify('NexTile', _('Could not update the terminal style. Check that your GTK configuration is writable and the NexTile CSS markers are intact.'));
            }
        })();
        return this._terminalTask;
    }

    _syncPanel() {
        this._search?.close(false);
        if (this._settings.get_boolean('panel-enabled'))
            this._appearance ??= new PanelAppearance();
        else {
            this._appearance?.destroy();
            this._appearance = null;
        }
    }

    _syncSearch() {
        if (this._settings.get_boolean('search-enabled')) {
            this._search ??= new CompactSearch(
                () => this._appearance?.getActivePillRect(),
                () => this._appearance?.queueContrast(),
                (progress, width) => this._appearance?.setSearchExpansion(progress, width));
        } else {
            this._search?.destroy();
            this._search = null;
        }
    }

    _sync() {
        if (this._settings.get_boolean('tiling-enabled'))
            this._tiler.start();
        else
            this._tiler.stop();
    }

    disable() {
        this._settings?.disconnect(this._settingsId);
        this._newWindowLauncher?.destroy();
        this._newWindowLauncher = null;
        this._terminal?.destroy();
        this._terminal = null;
        this._terminalTask = null;
        this._search?.destroy();
        this._search = null;
        this._appearance?.destroy();
        this._appearance = null;
        this._tiler?.stop();
        this._toggle?.destroy();
        if (this._indicator)
            this._indicator.quickSettingsItems = [];
        this._indicator?.destroy();
        this._toggle = null;
        this._indicator = null;
        this._tiler = null;
        this._settings = null;
    }
}
