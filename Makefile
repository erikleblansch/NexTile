UUID = nextile@erikleblansch.github.io
EXTENSION_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: test pack install
test:
	glib-compile-schemas --strict --dry-run schemas
	gjs -m tests/layout.js
	gjs -m tests/panelGeometry.js

pack: test
	python3 tools/pack.py

install: pack
	gnome-extensions install --force dist/$(UUID).shell-extension.zip
	@echo "Installed. Log out and back in if NexTile is not listed, then run:"
	@echo "gnome-extensions enable $(UUID)"
