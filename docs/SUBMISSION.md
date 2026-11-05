# Submit NexTile to GNOME Extensions

NexTile 0.7.1 is prepared for an initial submission to [extensions.gnome.org](https://extensions.gnome.org/upload/). It has **not been submitted or approved**. GNOME's reviewers decide whether a version is accepted; passing the checks below does not confer approval.

## Upload materials

- **Extension:** `nextile@erikleblansch.github.io.shell-extension.zip` from the [0.7.1 release](https://github.com/erikleblansch/NexTile/releases/tag/v0.7.1).
- **Checksum:** `SHA256SUMS` in the same release.
- **Icon:** [128 × 128 PNG](submission/icon.png), rendered from NexTile's original [SVG](icon.svg).
- **Screenshot:** [actual GNOME session](submission/screenshot.png), using synthetic demo content.
- **Name:** NexTile.
- **Website / issue tracker:** https://github.com/erikleblansch/NexTile.
- **Description:** use the text in [metadata.json](../metadata.json), including its clipboard disclosure.
- **Reviewer notes:** [ready-to-copy technical explanation](submission/REVIEWER-NOTES.md).
- **Shexli:** [report and assessment of the four remaining findings](SHEXLI.md). There are no remaining warnings; the raw report still contains three checker errors and one manual-review item.

The icon, screenshot and notes are separate listing materials; do not put them inside the extension ZIP. The demo and screenshots show GNOME 48.7. The version matrix is documented in [COMPATIBILITY.md](COMPATIBILITY.md), with [validation results](VALIDATION.md).

## Submit

1. Sign in to your GNOME Extensions account and open **Add yours**.
2. Upload the release ZIP. Keep its UUID, `nextile@erikleblansch.github.io`, unchanged for subsequent versions.
3. Check the imported name, description and GNOME version list. Add the icon and screenshot using the listing's image controls when available.
4. Include the reviewer notes in the review discussion and respond to requests for changes there.
5. After approval, add the actual GNOME Extensions listing URL to the README. Do not add an approval badge before acceptance.

The numeric `version` field is intentionally omitted: extensions.gnome.org assigns it. `version-name` identifies the public NexTile release. The extension uses only the default `user` session mode, so it does not request lock-screen operation.

## Checks before uploading a different build

```sh
npm ci --ignore-scripts
npm run lint
make pack
sha256sum dist/nextile@erikleblansch.github.io.shell-extension.zip
python3 -m venv /tmp/nextile-review
. /tmp/nextile-review/bin/activate
pip install -r tools/review-requirements.txt
python3 tools/review.py
```

`make pack` checks geometry, compatibility adapters, terminal CSS, all catalogs, schema validity and the contents of the final ZIP. Repeating it produces the same ZIP for the same sources and toolchain. Node/npm and ESLint are development tools only; none are installed by the extension or included in the ZIP.

`tools/review.py` retains Shexli's full output and fails if its findings differ from the reviewed baseline, including file names and snippets. It does not change or suppress checker rules. The remaining findings must be explained to GNOME's reviewers; a passing baseline check does not mean zero findings or approval. The pinned parser avoids a crash with tree-sitter 0.26.0.

Run the applicable compositor tests after changes to Shell UI or window management. Also review the actual source: package checks cannot prove lifecycle correctness or compliance on their own.

## Review guide

The preparation follows the current [GNOME review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html), checked on 5 November 2026:

| Area | NexTile implementation |
| --- | --- |
| Initialization | Module scope contains imports, constants, functions and GObject class registration; runtime objects are created from `enable()` |
| Cleanup | Disable removes signals, timeout sources, custom UI, pending searches and modal grabs; restores the panel and native Super handler |
| Imports | Shell code uses no Gtk, Gdk or Adw; GdkPixbuf is used for in-memory pixel decoding |
| Packaging | Readable JavaScript, CSS, metadata, GPL license, schema XML and compiled translations only |
| Processes / permissions | The installed extension spawns no helper process, installs no dependency and requests no privilege escalation |
| Privacy | No telemetry or NexTile network service; two panel-edge pixel rows are processed only in memory; GNOME's configured search providers receive search queries |
| Clipboard | Result activation may copy provider-supplied text; disclosed in metadata; no clipboard reads or default clipboard shortcut |
| Persistent preference | Terminal transparency is opt-in GTK CSS with ownership markers and backups; other CSS is preserved; switching it off removes the owned block |
| Metadata | Unique project UUID, repository URL, declared GNOME 46–51, gettext domain, schema ID, no unnecessary session modes or donation keys |
| License | GPL-3.0-or-later, included in the ZIP; original NexTile listing artwork |

This project has used AI-assisted development. GNOME requires the submitting maintainer to understand and explain the code and rejects unnecessary or unreviewable generated code. The module map and technical notes help with that responsibility; automated test results do not replace it.

Version 0.7.1 corrects three issues found after the original 0.7.0 preparation: the unnecessary compiled schema in the package, synchronous terminal file operations, and a dropdown left in the Quick Settings overlay on disable. Use the 0.7.1 ZIP for submission. Native installation of the archive and cleanup with the dropdown open are now part of the compositor tests.
