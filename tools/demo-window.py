#!/usr/bin/env python3
"""Synthetic demo content; never opens the user's files."""
import sys
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk
name = sys.argv[1]
window = Gtk.Window(title=name)
window.set_default_size(620, 420)
header = Gtk.HeaderBar(title=name, show_close_button=True)
window.set_titlebar(header)
css = Gtk.CssProvider()
css.load_from_data(b'''window {background: #17262c; color: #e8f4f3;} headerbar {background: #22383f; color: #e8f4f3; border: none;} textview, textview text {background: #17262c; color: #c4e7e2; font: 15px monospace;} label {color: #d4e6e5;}''')
Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=20, margin=28)
if name == 'Studio Notes':
    title = Gtk.Label(xalign=0)
    title.set_markup('<span size="23000" weight="bold">A little room to think.</span>')
    box.pack_start(title, False, False, 0)
    subtitle = Gtk.Label(label='PROJECT JOURNAL  /  NOVEMBER 2026', xalign=0)
    box.pack_start(subtitle, False, False, 0)
    text = Gtk.TextView(editable=False, cursor_visible=False, wrap_mode=Gtk.WrapMode.WORD_CHAR)
    text.get_buffer().set_text('Good tools stay out of your way.\n\nOpen a window. Make something.\nLet the desktop find its own rhythm.\n\nToday\n  • Sketch the next idea\n  • Find the right reference\n  • Leave some breathing room\n\nOne workspace. Many possibilities.')
    box.pack_start(text, True, True, 0)
else:
    title = Gtk.Label(xalign=0)
    title.set_markup('<span size="23000" weight="bold">Small steps. Clear focus.</span>')
    box.pack_start(title, False, False, 0)
    for title, sub in [('01   Collect ideas', 'A quiet place to start'), ('02   Shape the details', 'Move, resize, make it yours'), ('03   Keep the flow', 'Everything within reach')]:
        label = Gtk.Label(xalign=0)
        label.set_markup(f'<span size="15000" weight="bold">{title}</span>\n<span foreground="#81b6b0">{sub}</span>')
        box.pack_start(label, False, False, 12)
window.add(box)
window.connect('destroy', Gtk.main_quit)
window.show_all()
Gtk.main()
