# NexTile 0.7.0 — reviewer notes

NexTile automatically tiles normal, resizable windows by splitting the largest tile along its longest side. It provides draggable shared borders, destination splitting on window drops, and a Quick Settings toggle with a settings submenu. Optional appearance features provide a transparent adaptive panel, numbered workspaces, compact Super-key search and GNOME Terminal transparency.

Source: https://github.com/erikleblansch/NexTile/tree/v0.7.0

Runtime evidence and limitations: https://github.com/erikleblansch/NexTile/blob/v0.7.0/docs/VALIDATION.md

## Code map and lifecycle

- `extension.js`: enable/disable coordination, native Quick Settings controls and GSettings. Each independently enabled feature has a corresponding teardown path.
- `layout.js`: pure binary split-tree geometry. `tiler.js` tracks windows and coalesces work; `tileBorders.js` owns chrome actors and temporary modal resize grabs. Closing, minimizing or moving a window removes its old leaf and fills the space. Disable clears window/global signals, timers, maps and grabs, and optionally restores window geometry according to the user's preference.
- `panel.js` and `panelGeometry.js`: panel placement, numbered workspace animation and contrast. The clock's original parent/index, menu alignment, activities visibility and center translation are restored on disable. Screen sampling reads two rows at the panel edge into a `Gio.MemoryOutputStream`; it neither writes screenshots nor sends pixels anywhere. The capture API is asynchronous and has no cancellable parameter; late completions check the destroyed state and close the streams without touching UI.
- `compactSearch.js`: temporarily blocks Shell's existing overlay-key handler, restores it on teardown, and owns the search entry/modal grab. It closes when the overview opens, monitors change or session mode changes. No unlock-dialog session mode is requested.
- `nativeSearch.js`: reuses Shell's native list/grid result widgets and its configured providers. Each widget gets a private provider wrapper, leaving GNOME's original displays intact. Requests have cancellation and generation checks. A 150 ms debounce source is removed on teardown. Activating a provider result can copy its `clipboardText`, following the native behavior; this is declared in metadata. NexTile never reads the clipboard. Provider configuration and any provider networking remain under GNOME/application control.
- `compatibility.js`: small feature checks for Mutter maximization and callback/Promise search APIs. Search layout selects `vertical` on GNOME 46/47 or `orientation` on 48–51. Cursor/grab API differences are handled in their respective UI modules.
- `terminalStyle.js`: an explicit, persistent user preference. It edits only a marked block in `$XDG_CONFIG_HOME/gtk-3.0/gtk.css` (normally `~/.config/gtk-3.0/gtk.css`), backs up the existing file before changes, checks its etag, preserves symlinks and rejects malformed ownership markers. It uses Gio file APIs, not subprocesses or GTK imports. Ubuntu's patched Terminal is detected through its schema and receives its supported `-TerminalScreen-background-darkness` CSS property; no Terminal profile settings are changed. Existing managed configuration is adopted on upgrade. The preference persists when the extension is disabled; switching Transparent terminal off removes the managed block. GNOME Terminal must be restarted to read GTK CSS.

All runtime instances originate from `enable()`. Registered GObject classes are declarations at module scope. The extension has no preferences process, downloaded executable code, helper subprocess, package installation, telemetry, remote account or privilege request.

## Packaging and translations

The ZIP is built from an explicit file list. It contains readable JavaScript, CSS, metadata, the GPL-3.0-or-later license, schema XML/compiled data and ten compiled gettext catalogs. Development tools, Python test fixtures, npm dependencies, source PO files, test drivers, docs and videos are excluded. English is the source fallback; Dutch, German, French, Spanish, Portuguese, Italian, Polish, Japanese, Simplified Chinese and Ukrainian follow the session locale automatically.

The numeric version is omitted for extensions.gnome.org to assign. The UUID is stable. This is an initial submission, not a fork of another extension. Runtime search classes are imported from GNOME Shell rather than copied into the archive.

Development has included AI assistance. The repository supplies source, explanations and reproducible tests for review; approval is not assumed from these checks.
