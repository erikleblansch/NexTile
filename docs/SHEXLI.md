# Shexli development check — NexTile 0.7.2

Checked on 5 November 2026 with **Shexli 0.2.1**, rules dated 2026-04-02,
tree-sitter 0.25.2 and tree-sitter-javascript 0.25.0.

**Result: four findings, no warnings.** The raw status is still `issues_found`:
three errors caused by checker limitations and one manual-review item. This is
not a claim of zero findings or GNOME approval.

The [complete JSON report](shexli-report.json) is retained. The release
also supplies the report and a checksum of the extension ZIP.

Checked ZIP SHA-256: `55b07e07ffc724b93ca97533e49def4705830927e7b895bfae01ea1f40bf263c`.

## Corrected in 0.7.1

| Rule | Correction and verification |
| --- | --- |
| EGO-P-006 | Removed `schemas/gschemas.compiled`; kept strict XML validation. The native installer compiles the schema when installing the actual ZIP in each isolated compositor test. |
| EGO-X-004 | Terminal file reads, directory creation, backups and writes are asynchronous and cancellable. Tests cover ordered rapid changes, existing CSS, symlinks, permissions, etag conflicts and cancellation. |
| EGO-L-003 | Disconnect the menu signal, close without animation and explicitly destroy the separately parented dropdown. Runtime tests disable with the menu open, check its removal and released grab, then re-enable without accumulating menus. |

## Remaining findings

| Rule | Assessment |
| --- | --- |
| EGO-C49-004 | Shexli matches `get_maximized()` without evaluating its feature guard. NexTile prefers `get_maximize_flags()` and only uses the fallback when the newer method is absent. Tests explicitly cover modern zero flags and legacy stubs that throw if called. |
| EGO-C49-003 | Shexli matches the name `unmaximize` and its flags argument without resolving the import. This is NexTile's compatibility function, which dispatches to `set_unmaximize_flags()` on modern Mutter. |
| EGO-M-004 | Shexli 0.2.1's metadata rule contains `if major > 50`, so it flags supported GNOME 51. The compatibility matrix retains the versions actually exercised. |
| EGO-A-005 | Activating a native search result with `clipboardText` copies that text, matching GNOME's native behavior. Metadata and reviewer notes disclose it. No clipboard reads occur. This remains a manual-review finding in the analyzer. |

These assessments follow the installed checker's source and NexTile's source;
they are not exemptions granted by GNOME. Publication on extensions.gnome.org is no longer planned. See the [historical reviewer notes](submission/REVIEWER-NOTES.md),
[validation](VALIDATION.md) and [GNOME review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).

## Reproduce

```sh
make pack
python3 -m venv /tmp/nextile-review
. /tmp/nextile-review/bin/activate
pip install -r tools/review-requirements.txt
python3 tools/review.py
```

The wrapper records the full, unfiltered JSON before comparing each finding's
rule, severity, file and snippet with `tests/review-expectations.json`. Changes
to this baseline require investigation; even disappearing findings prompt a
review of the documentation. CI runs the same check. A successful wrapper exit
means only that the findings match this assessment.

The parser is pinned because tree-sitter 0.26.0 caused a segmentation fault with
this Shexli release. No analyzer rule has been modified. Shexli itself returns
exit code zero even when findings exist; its JSON status is therefore inspected.
