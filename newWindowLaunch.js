// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {AppIcon} from 'resource:///org/gnome/shell/ui/appDisplay.js';

export class NewWindowLaunch {
    constructor(settings) {
        this._settings = settings;
        this._injections = new InjectionManager();
        const launcher = this;
        this._injections.overrideMethod(AppIcon.prototype, 'activate', original => function (button, ...args) {
            // Use GNOME's existing new-window gesture. It handles stopped apps,
            // startup animation and apps that cannot open another window.
            // Read the preference at activation time: compact search may have
            // captured this method before the user changed the switch.
            const newWindow = launcher._settings?.get_boolean('new-window-on-launch');
            return original.call(this, newWindow ? Clutter.BUTTON_MIDDLE : button, ...args);
        });
    }

    destroy() {
        // Retained callbacks must also fall back to the original behavior.
        this._settings = null;
        this._injections.clear();
    }
}
