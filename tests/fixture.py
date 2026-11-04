#!/usr/bin/env python3
"""Disposable GTK window used only in the isolated Shell integration test."""
import sys
import signal
import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, GLib

window = Gtk.Window(title=sys.argv[1])
window.set_default_size(360, 240)
mode = sys.argv[2] if len(sys.argv) > 2 else ''
if mode in ('minimum', 'large'):
    window.set_size_request(*((500, 100) if mode == 'minimum' else (1000, 700)))
if mode == 'maximized':
    window.maximize()
window.add(Gtk.Label(label=sys.argv[1]))
window.connect("destroy", Gtk.main_quit)
window.show_all()
if mode == 'late-maximized':
    GLib.timeout_add(200, lambda: (window.maximize(), False)[1])
if mode == 'late-restore':
    def restore():
        window.unmaximize()
        def resize():
            window.resize(360, 240)
            window.move(50, 50)
            return False
        GLib.timeout_add(180, resize)
        return True
    GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGUSR1, restore)
Gtk.main()
