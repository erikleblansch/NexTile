#!/usr/bin/env python3
"""Real single-instance GTK app with an explicit new-window desktop action."""
import sys
import gi

gi.require_version('Gtk', '3.0')
from gi.repository import Gio, GLib, Gtk

kind = sys.argv[1]
app_id = f'org.gnome.NexTileLaunch{kind}'
GLib.set_prgname(app_id)


class LaunchFixture(Gtk.Application):
    def __init__(self):
        super().__init__(application_id=app_id, flags=Gio.ApplicationFlags.HANDLES_COMMAND_LINE)
        self.serial = 0

    def do_command_line(self, command_line):
        if '--new-window' in command_line.get_arguments() and kind == 'Multi':
            self.new_window()
        else:
            self.activate()
        return 0

    def do_activate(self):
        windows = self.get_windows()
        if windows:
            windows[0].present()
        else:
            self.new_window()

    def new_window(self):
        self.serial += 1
        window = Gtk.ApplicationWindow(application=self, title=f'NexTile Launch {kind} {self.serial}')
        window.set_default_size(360, 240)
        window.add(Gtk.Label(label=window.get_title()))
        window.show_all()
        window.present()


LaunchFixture().run(sys.argv)
