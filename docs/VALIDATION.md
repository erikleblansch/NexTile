# Validation — NexTile 0.6.0

Tested on **5 November 2026**. The final source was exercised in real, isolated GNOME Shell sessions, not only checked against version metadata.

| Check | Result |
| --- | --- |
| Split-tree geometry | 2,431 GJS assertions passed |
| Panel geometry and contrast | 102,075 assertions passed |
| Compatibility adapters | Old/new maximize APIs, partial flags, callback/Promise completion and error propagation passed |
| Terminal CSS | Preservation, removal, repeated application, backups, symlinks and malformed-marker rejection passed |
| Translation catalogs | All 25 strings present in Dutch, German, French and Spanish; placeholders, regional variants and English fallback passed |
| GNOME 48.7 / X11 | [124 runtime assertions passed](runtime-x11.txt) |
| GNOME 48.7 / Wayland | [127 runtime assertions passed](runtime-wayland.txt), two virtual monitors |
| GNOME 49.10 / Wayland | [127 runtime assertions passed](runtime-gnome49.txt), Fedora 43 container |
| GNOME 50.6 / Wayland | [127 runtime assertions passed](runtime-gnome50.txt), Fedora 44 container |
| GNOME 51.1 / Wayland | [127 runtime assertions passed](runtime-gnome51.txt), Fedora 45 container |
| Language and terminal-switch UI | [Six isolated GNOME 48.7 sessions passed](runtime-locales.txt): en_US, nl_NL, de_DE, fr_FR, es_ES, and ja_JP using the English fallback |
| Final Shell logs | No JavaScript errors, GJS criticals, CSS parsing errors or NexTile search/contrast errors, including compositor shutdown |
| Schema | Strict GLib schema compilation passed |
| Release archive | Deterministic ZIP, explicit file list, compiled translations and schema, no test/demo driver |
| Demo | Real 1440 × 900 GNOME recording, H.264, 30 fps, about 35 seconds; browser playback, seeking and mobile layout checked |

## What the runtime tests cover

**Windows:** loading and restarting the extension; largest-tile splitting; stable unrelated tiles; closing, minimizing and restoring; fullscreen; manual maximization; floating; gap and split settings; per-workspace and per-monitor layouts; and restoring original geometry when tiling is disabled. Real GTK apps request maximization before mapping and shortly after mapping, or resize again after unmaximizing. They must join the layout without a mouse move.

**Dragging:** a virtual pointer moves a real title bar through Mutter and inserts the window by splitting the destination. Shared boundaries resize both adjacent windows; ratios persist after release. Escape restores a split, disabling during a grab releases it, and a GTK minimum-size refusal restores the previous ratio. The ordinary window-edge path is also exercised programmatically at zero gaps; that particular check is not a physical pointer drag along the app's own edge.

**Panel:** transparency, clock position and calendar; black/white text on solid and mixed backgrounds; direct compositor background changes; per-workspace contrast; no recurring sampling on a stable desktop; workspace counts, click navigation and intermediate animation frames; centered active pills; independent enable/disable and restoration. The startup lifecycle fix reconnects to the background managers that Shell recreates after extension loading.

**Search:** virtual Super, typed input, arrows, Tab, Enter, Escape, outside click and wheel events. Tests check the in-panel morph, displaced neighboring circles, monotonic motion in both directions, query/focus retention, launch on the selected workspace, delayed results and cancellation. An asynchronous provider in the real GNOME registry exercises native category cards, counts, result activation and provider-header activation. GNOME's own overview widgets remain intact. General search background is transparent; category-card alpha is 128/255.

**Terminal and languages:** a real GNOME Terminal window uses isolated GTK configuration. Pixel readback confirms a half-transparent background while the window actor remains opaque. Separate language sessions verify the translated menu, search placeholder and workspace accessibility label, then toggle the managed terminal CSS on and off and check persistence and preservation of pre-existing styles.

The refreshed [menu](quick-settings.png), [panel](topbar.png), [search](search.png), [results](search-results.png) and [terminal](terminal.png) screenshots come from isolated GNOME 48 tests. The [demo](DEMO.md) uses separate synthetic content.

## Reproduction

See the [README](../README.md#build-and-contribute) for the local harness and the [compatibility guide](COMPATIBILITY.md#repeat-the-container-checks) for Docker commands. GitHub Actions runs pure tests, packaging and the three-version 49/50/51 Wayland matrix. Container tests use software rendering; the user's running desktop is never replaced.

Virtual input devices initially appear at the top-left corner. The isolated harness disables the overview hot corner so creating a test pointer cannot unexpectedly open Overview and invalidate a search or title-bar drag. This is a test-session setting; NexTile does not change the user's hot-corner preference.

## Limits

- Installation on the existing desktop is staged for the next login. The running user session is not restarted automatically.
- These checks do not cover physical monitor hotplug, mixed HiDPI, lock/unlock, physical touchpad gestures, screen readers, on-screen keyboards, input-method pre-edit or prolonged daily use.
- External provider layout and activation are tested using an asynchronous fixture. Individual Files, Software, Settings and other providers depend on the installed applications and have not all been tested separately.
- Container coverage uses native Wayland GTK 3 clients. XWayland clients on GNOME 49–51 and every application's minimum-size constraints are not individually verified.
- Startup maximization requests are normalized for one second after the first tile placement. A later request is treated as deliberate maximization; Mutter does not identify whether the app or user initiated it.
- GNOME Terminal transparency requires theme colors and a Terminal restart. Console, Ptyxis and Flatpak override configuration are outside this option's scope.
- An older 0.3 test that forcibly stopped the compositor with search still focused produced GNOME/IBus disposed-widget warnings. This special forced-shutdown case has not been claimed fixed. Normal close, disable during an in-flight query and final shutdown with search closed pass.
- Earlier 0.5 Wayland tests intermittently missed compositor-only contrast changes. This release found and fixed a startup background-manager subscription gap; the final tests pass on all four versions. This does not establish every possible compositor timing scenario.
- No separate CPU or memory benchmark is claimed. Event-driven behavior and the absence of recurring contrast timers on a stable desktop are tested.
