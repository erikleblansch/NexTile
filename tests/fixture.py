#!/usr/bin/env python3
"""Disposable GTK window used only in the isolated Shell integration test."""
import sys
import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk

window = Gtk.Window(title=sys.argv[1])
window.set_default_size(360, 240)
if len(sys.argv) > 2:
    window.set_size_request(1000, 700)
window.add(Gtk.Label(label=sys.argv[1]))
window.connect("destroy", Gtk.main_quit)
window.show_all()
Gtk.main()
