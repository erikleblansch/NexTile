# Validation — NexTile 0.7.2

The release integrates the **Always open a new window** feature from `feature/always-new-window`. Production JavaScript, styles and schema are unchanged from the tested development preview; the package version is now `0.7.2`. Distribution is through GitHub Releases, with no GNOME approval claim.

The [feature validation](NEW-WINDOW-LAUNCH.md#validation--2026-11-05) records 157 assertions on each of GNOME 46, 47, 48, 49, 50 and 51 Wayland, and 154 on GNOME 48.7 X11. It covers repeated launches, the Quick Settings switch, single-window applications, ordinary focus and extension disable/re-enable. [Development CI run 42081212922](https://github.com/erikleblansch/NexTile/actions/runs/42081212922) passed all six jobs.

The release package contains **26 files**, including the new launch module and ten compiled translation catalogs. All **26 translatable strings** have complete catalogs, with regional and English fallback checks. Schema, geometry, compatibility, asynchronous terminal behavior, package validation and JavaScript lint remain part of the build checks. Shexli retains the same four documented findings; see the [report and assessment](SHEXLI.md).

Release ZIP SHA-256: `55b07e07ffc724b93ca97533e49def4705830927e7b895bfae01ea1f40bf263c`. The local release build, catalog/package checks, ESLint and Shexli baseline check passed on 5 November 2026.

## Release verification note

The [initial release check](https://github.com/erikleblansch/NexTile/actions/runs/42089122972) passed all 157 functional assertions on GNOME 50.6 but failed the strict Shell-log check on accesses to an already disposed `MetaWindowActorWayland`. The other five jobs passed. A local full GNOME 50.6 run and a focused launch test with animations enabled both passed without the warning. Its cause has not been established; no production fix is claimed.

The runtime harness now includes stacktrace context when a Shell error occurs, and the focused launch test explicitly enables animations. The error check remains strict, with no suppression or weaker assertions. This intermittent observation is retained here rather than treating a passing rerun as proof that its cause has been fixed.

## Historical validation — NexTile 0.7.1

Tested on **5 November 2026**. [GitHub Actions run 42054860335](https://github.com/erikleblansch/NexTile/actions/runs/42054860335) passed all six jobs for commit `a7c057f`: pure/package/lint and Shexli triage, plus GNOME 46, 47, 49, 50 and 51 Wayland. Each Wayland runtime passed 142 assertions, including native ZIP installation, open-menu cleanup and cancellation across disable/re-enable. GNOME 48.7 was tested locally on Wayland (142 assertions) and X11 (139). The five container logs below are from this CI run. The previous [0.7.0 evidence](https://github.com/erikleblansch/NexTile/blob/v0.7.0/docs/VALIDATION.md) remains available separately.

| Check | Result |
| --- | --- |
| Split-tree geometry | 2,431 GJS assertions passed |
| Panel geometry and contrast | 102,075 assertions passed |
| Compatibility adapters | Old/new maximize APIs, partial flags, callback/Promise completion and error propagation passed |
| Terminal CSS | Asynchronous I/O, serialized rapid changes, cancellation, etag conflicts, permission/symlink preservation, backups, missing directories and malformed-marker rejection passed |
| Translation catalogs | All 25 strings present in Dutch, German, French, Spanish, Portuguese, Italian, Polish, Japanese, Simplified Chinese and Ukrainian; placeholders, regional variants and English fallback passed |
| GNOME 46.0 / Wayland | [142 runtime assertions passed](runtime-gnome46.txt), Ubuntu 24.04 container, Mutter 46.2 |
| GNOME 47.10 / Wayland | [142 runtime assertions passed](runtime-gnome47.txt), Fedora 41 container |
| GNOME 48.7 / X11 | [139 runtime assertions passed](runtime-x11.txt) |
| GNOME 48.7 / Wayland | [142 runtime assertions passed](runtime-wayland.txt), two virtual monitors |
| GNOME 49.10 / Wayland | [142 runtime assertions passed](runtime-gnome49.txt), Fedora 43 container |
| GNOME 50.6 / Wayland | [142 runtime assertions passed](runtime-gnome50.txt), Fedora 44 container |
| GNOME 51.1 / Wayland | [142 runtime assertions passed](runtime-gnome51.txt), Fedora 45 container |
| Language and terminal-switch UI | Earlier 0.7.0 evidence: [seven isolated GNOME 48.7 sessions passed](runtime-locales.txt): pt_PT, it_IT, pl_PL, ja_JP, zh_CN, uk_UA, and ko_KR using the English fallback. Existing en/nl/de/fr/es UI checks passed for 0.6.0; all ten catalogs are checked for this release |
| Final Shell logs | No JavaScript errors, GJS criticals, CSS parsing errors or NexTile search/contrast errors, including compositor shutdown |
| JavaScript lint | ESLint recommended rules, no warnings |
| Schema | Strict GLib schema compilation passed |
| Release archive | Local and CI builds have identical SHA-256 `89acbd00cda1db6d95b1c643a78a6d8ae207b8bcd420bbdf90c1f611d18fc2db`; 25 files; metadata, license, schema and all ten compiled catalogs checked; no test/demo driver |
| Demo | Unchanged 0.7.0 recording: real 1440 × 900 GNOME recording, H.264, 30 fps, 36.6 seconds; browser playback, seeking and mobile layout checked |

## Review regression checks

The raw [Shexli report](SHEXLI.md) contains four assessed findings and zero warnings. CI fails if those findings change, including their evidence. The three warnings from 0.7.0 were corrected; three checker limitations and one clipboard review item remain visible rather than suppressed.

The compositor harness installs the actual XML-only ZIP with GNOME's installer and checks that it compiles the schema. Every full runtime run now tests the terminal toggle, disables while the dropdown is open and a file read is pending, checks that the overlay loses the menu and the modal grab is released, then re-enables before releasing the old read. The late cancelled work must leave the new preference and UI alone. The overlay must contain exactly one replacement menu.

## What the runtime tests cover

**Windows:** loading and restarting the extension; largest-tile splitting; stable unrelated tiles; closing, minimizing and restoring; fullscreen; manual maximization; floating; gap and split settings; per-workspace and per-monitor layouts; and restoring original geometry when tiling is disabled. Real GTK apps request maximization before mapping and shortly after mapping, or resize again after unmaximizing. They must join the layout without a mouse move.

**Dragging:** a virtual pointer moves a real title bar through Mutter and inserts the window by splitting the destination. Shared boundaries resize both adjacent windows; ratios persist after release. Escape restores a split, disabling during a grab releases it, and a GTK minimum-size refusal restores the previous ratio. The ordinary window-edge path is also exercised programmatically at zero gaps; that particular check is not a physical pointer drag along the app's own edge.

**Panel:** transparency, clock position and calendar; black/white text on solid and mixed backgrounds; direct compositor background changes; per-workspace contrast; no recurring sampling on a stable desktop; workspace counts, click navigation and intermediate animation frames; centered active pills; independent enable/disable and restoration. The startup lifecycle fix reconnects to the background managers that Shell recreates after extension loading.

**Search:** virtual Super, typed input, arrows, Tab, Enter, Escape, outside click and wheel events. Tests check the in-panel morph, displaced neighboring circles, monotonic motion in both directions, query/focus retention, launch on the selected workspace, delayed results and cancellation. An asynchronous provider in the real GNOME registry exercises native category cards, counts, result activation and provider-header activation. GNOME's own overview widgets remain intact. General search background is transparent; category-card alpha is 128/255.

**Terminal and languages:** a real GNOME Terminal window uses isolated GTK configuration. Pixel readback confirms a half-transparent background while the window actor remains opaque. Separate language sessions verify the translated menu, search placeholder and workspace accessibility label, then toggle the managed terminal CSS on and off and check persistence and preservation of pre-existing styles.

The [submission screenshot](submission/screenshot.png) shows the warning icon before the floating switch. The refreshed [menu](quick-settings.png), [panel](topbar.png), [search](search.png), [results](search-results.png) and [terminal](terminal.png) screenshots come from isolated GNOME 48 tests. The [demo](DEMO.md) uses separate synthetic content.

## Reproduction

See the [README](../README.md#build-and-contribute) for the local harness and the [compatibility guide](COMPATIBILITY.md#repeat-the-container-checks) for Docker commands. GitHub Actions runs pure tests, packaging and the five-version 46/47/49/50/51 Wayland matrix. Container tests use software rendering; the user's running desktop is never replaced.

Virtual input devices initially appear at the top-left corner. The isolated harness disables the overview hot corner so creating a test pointer cannot unexpectedly open Overview and invalidate a search or title-bar drag. This is a test-session setting; NexTile does not change the user's hot-corner preference.

## Limits

- Installation on the existing desktop is staged for the next login. The running user session is not restarted automatically.
- These checks do not cover physical monitor hotplug, mixed HiDPI, lock/unlock, physical touchpad gestures, screen readers, on-screen keyboards, input-method pre-edit or prolonged daily use.
- External provider layout and activation are tested using an asynchronous fixture. Individual Files, Software, Settings and other providers depend on the installed applications and have not all been tested separately.
- Container coverage uses native Wayland GTK 3 clients. XWayland clients on GNOME 49–51 and every application's minimum-size constraints are not individually verified.
- Startup maximization requests are normalized for one second after the first tile placement. A later request is treated as deliberate maximization; Mutter does not identify whether the app or user initiated it.
- GNOME Terminal transparency requires theme colors and a Terminal restart. Ubuntu's patched Terminal also requires its default Use transparency from system theme setting; its extra CSS property is detected and tested. Console, Ptyxis and Flatpak override configuration are outside this option's scope.
- An older 0.3 test that forcibly stopped the compositor with search still focused produced GNOME/IBus disposed-widget warnings. This special forced-shutdown case has not been claimed fixed. Normal close, disable during an in-flight query and final shutdown with search closed pass.
- Earlier 0.5 Wayland tests intermittently missed compositor-only contrast changes. Version 0.6 fixed a startup background-manager subscription gap; the current 46–51 checks include that regression. This does not establish every possible compositor timing scenario.
- No separate CPU or memory benchmark is claimed. Event-driven behavior and the absence of recurring contrast timers on a stable desktop are tested.

## Submission preparation

The [submission guide](SUBMISSION.md) records the review against GNOME’s published rules, listing assets and a module-by-module explanation. Clipboard writes on result activation are declared in metadata. The numeric version is omitted for EGO to assign. No submission or approval is claimed.
