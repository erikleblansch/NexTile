# New-window launch preview

Branch: `feature/always-new-window`. Preview version: `0.7.2-dev`.
The `0.7.1` release awaiting GNOME review is unchanged. This branch has not been merged into `main` or submitted to extensions.gnome.org.

## Behavior

**Always open a new window** lives in the NexTile Quick Settings dropdown and defaults to **on**. Launching an application that is already running requests an additional window from NexTile search, native GNOME application search, the dash and the application grid. The new window participates in tiling as usual. Apps that report no support for extra windows retain their normal activation behavior.

Turn the switch off to restore GNOME's normal app launch behavior. The change applies immediately, including to search results already displayed. Explicit GNOME new-window gestures (Ctrl-click or middle-click) remain available. The preference persists across sessions and is independent of the tiling switch. Disabling NexTile restores the original app-icon method.

This preference concerns GNOME Shell app launchers. Switching to existing windows, opening files, remote search-provider results and launchers supplied by other applications retain their normal behavior. An app ultimately decides how to handle a new-window request.

The setting follows the system language in all eleven supported languages. In Dutch the switch is **Altijd een nieuw venster openen**.

## Implementation and review

`newWindowLaunch.js` uses GNOME's `InjectionManager` to wrap `AppIcon.activate()`. It selects the existing middle-button launch path, allowing GNOME to handle running/stopped apps, capability checks and animation. GNOME's own [Launch New Instance extension](https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/blob/main/extensions/launch-new-instance/extension.js) uses the same entry point. No global `Shell.App` methods are changed.

The wrapper reads the setting at activation time so cached search-result callbacks honor changes immediately. Disable clears the injection and drops the settings reference; retained callbacks then delegate normally. There are no additional timers, signals, processes, files or network requests in the extension's launch policy.

The runtime harness includes a real GTK single-instance application with a new-window desktop action and a second fixture marked as single-window only. It checks repeated compact-search launches, both toggle directions after results were created, native app-icon clicks, ordinary focus, explicit new-window gestures, unsupported apps, automatic tiling and disable/re-enable cleanup.

## Build this branch

```sh
git switch feature/always-new-window
make install
```

Log out and back in to load the preview's JavaScript. The package uses the same extension UUID and settings as `0.7.1`; existing preferences are retained. Reinstall the `0.7.1` release ZIP and log in again to return to the submitted version.
