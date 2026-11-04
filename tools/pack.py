#!/usr/bin/env python3
"""Build a small, reproducible extension archive without GNOME Shell running."""
import pathlib
import subprocess
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
NAME = "nextile@erikleblansch.github.io.shell-extension.zip"
FILES = ["metadata.json", "extension.js", "layout.js", "tiler.js", "panel.js", "panelGeometry.js", "compactSearch.js", "stylesheet.css", "LICENSE",
         "schemas/org.gnome.shell.extensions.nextile.gschema.xml"]

(ROOT / "dist").mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix="nextile-pack-") as temporary:
    subprocess.run(["glib-compile-schemas", "--strict", f"--targetdir={temporary}",
                    str(ROOT / "schemas")], check=True)
    with zipfile.ZipFile(ROOT / "dist" / NAME, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in FILES + ["schemas/gschemas.compiled"]:
            source = pathlib.Path(temporary) / "gschemas.compiled" if name.endswith(".compiled") else ROOT / name
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes())
print(ROOT / "dist" / NAME)
