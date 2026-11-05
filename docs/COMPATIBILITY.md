# GNOME compatibility

NexTile 0.7.1 targets GNOME Shell **46, 47, 48, 49, 50 and 51**. The release includes API adaptations, not just additional metadata entries.

| GNOME Shell / Mutter | Runtime environment | Session |
| --- | --- | --- |
| 46.0 / Mutter 46.2 | Ubuntu 24.04 container, software renderer | Wayland, two virtual monitors |
| 47.10 | Fedora 41 container, software renderer | Wayland, two virtual monitors |
| 48.7 | Debian host, isolated session | X11 and Wayland |
| 49.10 | Fedora 43 container, software renderer | Wayland, two virtual monitors |
| 50.6 | Fedora 44 container, software renderer | Wayland, two virtual monitors |
| 51.1 | Fedora 45 container, software renderer | Wayland, two virtual monitors |

See [validation](VALIDATION.md) for results and limits. GNOME 50 and 51 no longer provide an X11 Shell session. XWayland applications can still run inside a Wayland desktop; the integration fixtures here use native GTK Wayland windows.

## API differences handled

- **Mutter 46/47:** resize cursors use `EAST_RESIZE` / `SOUTH_RESIZE`; later releases abbreviate these names. Undefined enum values must never reach Mutter.
- **Ubuntu GNOME Terminal:** its transparency patch overrides CSS alpha with a GTK style property. NexTile emits that property only when the patch's schema key exists.
- **Mutter 49:** flag-specific maximization uses `get_maximize_flags()`, `set_maximize_flags()` and `set_unmaximize_flags()`. On 46–48 the older flag-taking methods are retained. Partial maximization flags survive restoration.
- **GNOME 50:** native search widgets return a Promise instead of invoking a completion callback. NexTile handles both and completes each request once.
- **Mutter 50:** cursor shapes belong to Clutter actors; the old display cursor setter is retained only on earlier versions. Modal grabs no longer expose `get_seat_state()` after X11 support was removed.
- **GNOME 46/47 and 51:** St uses `vertical` on 46/47. `orientation` was added in 48 and `vertical` removed in 51. NexTile checks the widget property before construction. GNOME 51 moved menu open/close into `PopupMenuBase` and accepts an options object; teardown detects that API and closes with `{animate: false}`, retaining `PopupAnimation.NONE` on older versions. Input-event signals remain supported; they are deprecated upstream but not removed in 51.
- **Workspace motion:** while search is open, a single local animation follows the selected workspace. Intermediate values from Shell cannot pull the expanded ribbon back toward the previous workspace.
- **Background lifecycle:** the panel reconnects to background managers after Shell startup as well as after monitor changes.

Capability checks are used for backported APIs. The extension's `disable()` is synchronous and releases signals, timers, UI actors and modal grabs.

## Upstream references

- [GNOME 46 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-46.html)
- [GNOME 47 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-47.html)
- [GNOME 48 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-48.html)
- [GNOME 49 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-49.html)
- [GNOME 50 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-50.html)
- [GNOME 51 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-51.html)
- [GNOME extension translations](https://gjs.guide/extensions/development/translations.html)
- [GNOME Shell source](https://gitlab.gnome.org/GNOME/gnome-shell)
- [Mutter source](https://gitlab.gnome.org/GNOME/mutter)

Future major versions are not declared compatible until their interfaces and behavior have been checked.

## Repeat the container checks

With Docker installed:

```sh
bash tests/runtime-container.sh 46
bash tests/runtime-container.sh 47
bash tests/runtime-container.sh 49
bash tests/runtime-container.sh 50
bash tests/runtime-container.sh 51
```

Base image digests are pinned; distribution packages are resolved at build time, and each run prints the actual Shell version. The containers use their own system and session buses, a software renderer and two virtual monitors. They do not mount the host home, display socket, system bus or GPU. Evidence is copied to the printed temporary directory before the container is removed. GitHub Actions runs the same five-version Wayland matrix.

GNOME 46/47 are tested on their older distribution packages without sharing the host system bus. Their X11 sessions have not been separately exercised; the local X11 regression uses GNOME 48.7. Fedora 41 is an older test environment, not a recommendation to install an unsupported distribution.
