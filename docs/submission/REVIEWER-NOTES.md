# NexTile 0.7.1 — reviewer notes

NexTile automatically tiles normal, resizable windows by splitting the largest tile along its longest side. It provides draggable shared borders, destination splitting on window drops, and a Quick Settings toggle with a settings submenu. Optional appearance features provide a transparent adaptive panel, numbered workspaces, compact Super-key search and GNOME Terminal transparency.

Source: https://github.com/erikleblansch/NexTile/tree/v0.7.1

Runtime evidence and limitations: https://github.com/erikleblansch/NexTile/blob/v0.7.1/docs/VALIDATION.md

## Code map and lifecycle

- `extension.js`: enable/disable coordination, native Quick Settings controls and GSettings. Each independently enabled feature has a corresponding teardown path. The dropdown is explicitly closed without animation and destroyed because GNOME parents it separately in its overlay. Terminal completions check both the originating instance and the latest request before changing settings or notifying the user.
- `layout.js`: pure binary split-tree geometry. `tiler.js` tracks windows and coalesces work; `tileBorders.js` owns chrome actors and temporary modal resize grabs. Closing, minimizing or moving a window removes its old leaf and fills the space. Disable clears window/global signals, timers, maps and grabs, and optionally restores window geometry according to the user's preference.
- `panel.js` and `panelGeometry.js`: panel placement, numbered workspace animation and contrast. The clock's original parent/index, menu alignment, activities visibility and center translation are restored on disable. Screen sampling reads two rows at the panel edge into a `Gio.MemoryOutputStream`; it neither writes screenshots nor sends pixels anywhere. The capture API is asynchronous and has no cancellable parameter; late completions check the destroyed state and close the streams without touching UI.
- `compactSearch.js`: temporarily blocks Shell's existing overlay-key handler, restores it on teardown, and owns the search entry/modal grab. It closes when the overview opens, monitors change or session mode changes. No unlock-dialog session mode is requested.
- `nativeSearch.js`: reuses Shell's native list/grid result widgets and its configured providers. Each widget gets a private provider wrapper, leaving GNOME's original displays intact. Requests have cancellation and generation checks. A 150 ms debounce source is removed on teardown. Activating a provider result can copy its `clipboardText`, following the native behavior; this is declared in metadata. NexTile never reads the clipboard. Provider configuration and any provider networking remain under GNOME/application control.
- `compatibility.js`: small feature checks for Mutter maximization and callback/Promise search APIs. Search layout selects `vertical` on GNOME 46/47 or `orientation` on 48–51. Cursor/grab API differences are handled in their respective UI modules.
- `terminalStyle.js`: an explicit, persistent user preference. It edits only a marked block in `$XDG_CONFIG_HOME/gtk-3.0/gtk.css` (normally `~/.config/gtk-3.0/gtk.css`), backs up the existing file before changes, checks its etag, preserves symlinks and rejects malformed ownership markers. It uses Gio file APIs, not subprocesses or GTK imports. Ubuntu's patched Terminal is detected through its schema and receives its supported `-TerminalScreen-background-darkness` CSS property; no Terminal profile settings are changed. Existing managed configuration is adopted on upgrade. The preference persists when the extension is disabled; switching Transparent terminal off removes the managed block. GNOME Terminal must be restarted to read GTK CSS.

All runtime instances originate from `enable()`. Registered GObject classes are declarations at module scope. The extension has no preferences process, downloaded executable code, helper subprocess, package installation, telemetry, remote account or privilege request.

Terminal reads, recursive directory creation, backups and writes are asynchronous. Operations are serialized; a `Gio.Cancellable` cancels active and queued work on disable. Late completions cannot alter a re-enabled extension. Promise adapters are local functions, without modifying shared Gio prototypes. Writes use `GLib.Bytes` to keep their buffer alive, retain etag checks and follow existing symlinks. An already committed persistent preference is intentionally retained after disable.

## Packaging and translations

The ZIP is built from an explicit file list. It contains readable JavaScript, CSS, metadata, the GPL-3.0-or-later license, schema XML and ten compiled gettext catalogs. Development tools, Python test fixtures, npm dependencies, source PO files, test drivers, docs and videos are excluded. English is the source fallback; Dutch, German, French, Spanish, Portuguese, Italian, Polish, Japanese, Simplified Chinese and Ukrainian follow the session locale automatically.

The numeric version is omitted for extensions.gnome.org to assign. The UUID is stable. This is an initial submission, not a fork of another extension. Runtime search classes are imported from GNOME Shell rather than copied into the archive.

GNOME 45+ compiles the schema XML at installation; `gschemas.compiled` is intentionally excluded. The integration harness installs the actual ZIP with `gnome-extensions install` and checks the resulting schema, instead of manually compiling it for the test session.

## Shexli 0.2.1

The [complete report and triage](https://github.com/erikleblansch/NexTile/blob/v0.7.1/docs/SHEXLI.md) are provided without suppressions. The three warnings seen in 0.7.0 are fixed. Four findings remain:

- `EGO-C49-004`: `get_maximized()` is guarded by the availability of `get_maximize_flags()`. It is used only on old Mutter; even a modern return value of zero does not enter the fallback.
- `EGO-C49-003`: `unmaximize(window, flags)` refers to NexTile's imported wrapper, not `Meta.Window.unmaximize()`. It calls `set_unmaximize_flags()` on modern Mutter.
- `EGO-M-004`: this checker release unconditionally treats major versions greater than 50 as implausible. GNOME 51 is covered by the runtime matrix.
- `EGO-A-005`: user-activated native search results can write provider-supplied text to the clipboard, as disclosed in metadata. No clipboard content is read. This remains for the reviewer to assess.

The first three findings are limitations of the static checker, supported by source inspection and runtime/adapter tests. No API names have been obscured and no GNOME version removed to evade detection. The raw status remains `issues_found`; passing our expected-findings check is not a GNOME approval claim.

Development has included AI assistance. The repository supplies source, explanations and reproducible tests for review; approval is not assumed from these checks.
