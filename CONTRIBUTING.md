# Contributing to NexTile

Bug reports, translations and focused improvements are welcome. Please keep changes small enough to review and explain the user-visible behavior they address.

## Report a problem

Include your GNOME Shell version (`gnome-shell --version`), distribution, Wayland or X11 session, NexTile version, monitor setup and steps to reproduce. Mention other extensions that affect tiling, the panel or search. Attach only the relevant error lines; remove personal information from logs and screenshots.

## Development

```sh
make test  # schemas, geometry, compatibility, CSS handling and translations
make pack  # reproducible installable ZIP
```

Requires GJS, GLib tools, GNU gettext, Python 3 and Make. Run the isolated compositor harness for window-management or Shell UI changes. See [validation](docs/VALIDATION.md) and [compatibility](docs/COMPATIBILITY.md).

Keep enable/disable symmetric: disconnect signals, remove timeout sources, release modal grabs, destroy owned actors and restore GNOME state. Preserve existing windows and settings. Never add the runtime test driver to the release archive.

## Translations

English strings in the JavaScript source are the fallback. Catalogs live in `po/{nl,de,fr,es}.po`; `make translations` compiles them into `locale/`. GNU gettext follows the session locale, including regional variants. Native GNOME/provider labels are translated by GNOME or the provider itself.

After changing user-facing strings, update the template:

```sh
xgettext --language=JavaScript --from-code=UTF-8 --keyword=_ \
  --package-name=NexTile --package-version=0.6.0 --output=po/nextile.pot *.js
```

Update all four catalogs, keep `%d` placeholders intact, and run `make test`. Accessibility labels and notifications need translations too. No language selector is needed.

## Demo assets

The demo uses synthetic content in a separate GNOME session. Recording sources are in `tools/demo-*`; see [the recording guide](docs/DEMO.md). Do not record your personal desktop, notifications or files for a public demo.

Contributions are licensed under GPL-3.0-or-later, like NexTile itself.
