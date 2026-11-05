# Contributing to NexTile

Bug reports, translations and focused improvements are welcome. Please keep changes small enough to review and explain the user-visible behavior they address.

## Report a problem

Include your GNOME Shell version (`gnome-shell --version`), distribution, Wayland or X11 session, NexTile version, monitor setup and steps to reproduce. Mention other extensions that affect tiling, the panel or search. Attach only the relevant error lines; remove personal information from logs and screenshots.

## Development

```sh
npm ci --ignore-scripts
npm run lint
make test  # schemas, geometry, compatibility, CSS handling and translations
make pack  # reproducible installable ZIP
```

Requires GJS, GLib tools, GNU gettext, Python 3 and Make. Run the isolated compositor harness for window-management or Shell UI changes. See [validation](docs/VALIDATION.md) and [compatibility](docs/COMPATIBILITY.md).

The development-only `minimatch` override pins 11.0.1 to address GHSA-g3hv-75wg-m249 while upstream ESLint still depends on the older major. The lint check exercises this combination; no npm packages are shipped.

Keep enable/disable symmetric: disconnect signals, remove timeout sources, release modal grabs, destroy owned actors and restore GNOME state. Preserve existing windows and settings. Never add the runtime test driver to the release archive.

## Translations

English strings in the JavaScript source are the fallback. Catalogs live in `po/{nl,de,fr,es,pt,it,pl,ja,zh,uk}.po`; `make translations` compiles them into `locale/`. GNU gettext follows the session locale, including regional variants. Native GNOME/provider labels are translated by GNOME or the provider itself.

After changing user-facing strings, update the template:

```sh
xgettext --language=JavaScript --from-code=UTF-8 --keyword=_ \
  --package-name=NexTile --package-version=0.7.0 --output=po/nextile.pot *.js
```

Update all ten catalogs, keep `%d` placeholders intact, and run `make test`. Accessibility labels and notifications need translations too. No language selector is needed. `pt` provides Portuguese for regional Portuguese locales; `zh` currently provides Simplified Chinese. Native-speaker improvements and additional regional catalogs are welcome.

## Demo assets

The demo uses synthetic content in a separate GNOME session. Recording sources are in `tools/demo-*`; see [the recording guide](docs/DEMO.md). Do not record your personal desktop, notifications or files for a public demo.

Contributions are licensed under GPL-3.0-or-later, like NexTile itself.
