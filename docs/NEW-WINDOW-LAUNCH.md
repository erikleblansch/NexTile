# Always open a new window

Available in **NexTile 0.7.2**, distributed through [GitHub Releases](https://github.com/erikleblansch/NexTile/releases/tag/v0.7.2). The feature was developed on `feature/always-new-window` and merged into `main`.

## Behavior

**Always open a new window** lives in the NexTile Quick Settings dropdown and defaults to **on**. Launching an application that is already running requests an additional window from NexTile search, native GNOME application search, the dash and the application grid. The new window participates in tiling as usual. Apps that report no support for extra windows retain their normal activation behavior.

Turn the switch off to restore GNOME's normal app launch behavior. The change applies immediately, including to search results already displayed. Explicit GNOME new-window gestures (Ctrl-click or middle-click) remain available. The preference persists across sessions and is independent of the tiling switch. Disabling NexTile restores the original app-icon method.

This preference concerns GNOME Shell app launchers. Switching to existing windows, opening files, remote search-provider results and launchers supplied by other applications retain their normal behavior. An app ultimately decides how to handle a new-window request.

The setting follows the system language in all eleven supported languages. In Dutch the switch is **Altijd een nieuw venster openen**.

## Implementation and review

`newWindowLaunch.js` uses GNOME's `InjectionManager` to wrap `AppIcon.activate()`. It selects the existing middle-button launch path, allowing GNOME to handle running/stopped apps, capability checks and animation. GNOME's own [Launch New Instance extension](https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/blob/main/extensions/launch-new-instance/extension.js) uses the same entry point. No global `Shell.App` methods are changed.

The wrapper reads the setting at activation time so cached search-result callbacks honor changes immediately. Disable clears the injection and drops the settings reference; retained callbacks then delegate normally. There are no additional timers, signals, processes, files or network requests in the extension's launch policy.

The runtime harness includes a real GTK single-instance application with a new-window desktop action and a second fixture marked as single-window only. It checks repeated compact-search launches, both toggle directions after results were created, native app-icon clicks, ordinary focus, explicit new-window gestures, unsupported apps, automatic tiling and disable/re-enable cleanup.

## Validation — 2026-11-05

Tested implementation: [`1095ac7`](https://github.com/erikleblansch/NexTile/commit/1095ac7038ff3e49014f5889aad444f2ec0ba9a6). [Hosted GNOME runtime checks](https://github.com/erikleblansch/NexTile/actions/runs/42081212922).

| Shell | Session | Full runtime result |
| --- | --- | --- |
| 46.0 | Wayland, CI | 157 assertions passed |
| 47.10 | Wayland, CI | 157 assertions passed |
| 48.7 | Wayland, local isolated compositor | 157 assertions passed |
| 48.7 | X11, local isolated Xvfb | 154 assertions passed |
| 49.10 | Wayland, CI | 157 assertions passed |
| 50.6 | Wayland, CI | 157 assertions passed |
| 51.1 | Wayland, CI | 157 assertions passed |

The focused launch test also passed all 18 assertions on GNOME 48.7 Wayland. The driver now keeps a single test run when Shell re-enables dependent extensions during the lifecycle checks.

`make pack` and ESLint passed. The package contains 26 files and complete compiled catalogs for all ten translations, with English fallback. Shexli 0.2.1 reports the same four [documented findings](SHEXLI.md) as the submitted version; this change adds no findings and does not imply GNOME approval.

Historical `0.7.2-dev` ZIP SHA-256: `87f225a5f92f2f46b50dcb687db52fdacb02cb19c4c5ba2ec1dc4796f00ba106`.

## Install or build

Install the release ZIP using the [README instructions](../README.md#install), or build the tagged release in a clean checkout:

```sh
git checkout v0.7.2
make install
```

Log out and back in to load the updated JavaScript. The package uses the same extension UUID and settings as `0.7.1` and the development preview; existing preferences are retained. The release package checksum and current checks are listed in [validation](VALIDATION.md).
