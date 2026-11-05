UUID = nextile@erikleblansch.github.io
EXTENSION_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: test pack install translations
translations:
	python3 tools/translations.py
test: translations
	glib-compile-schemas --strict --dry-run schemas
	gjs -m tests/layout.js
	gjs -m tests/panelGeometry.js
	gjs -m tests/compatibility.js
	gjs -m tests/terminalStyle.js
	python3 tests/translations.py

pack: test
	python3 tools/pack.py
	python3 tests/package.py

install: pack
	gnome-extensions install --force dist/$(UUID).shell-extension.zip
	@echo "Installed. Log out and back in if NexTile is not listed, then run:"
	@echo "gnome-extensions enable $(UUID)"
