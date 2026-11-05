#!/usr/bin/env python3
"""Build a small, reproducible extension archive without GNOME Shell running."""
import pathlib
import subprocess
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
NAME = "nextile@erikleblansch.github.io.shell-extension.zip"
FILES = ["metadata.json", "compatibility.js", "terminalStyle.js", "newWindowLaunch.js", "extras/terminal-transparency.css", "extension.js", "layout.js", "tiler.js", "tileBorders.js", "panel.js", "panelGeometry.js", "compactSearch.js", "nativeSearch.js", "stylesheet.css", "LICENSE",
         "schemas/org.gnome.shell.extensions.nextile.gschema.xml"]

(ROOT / "dist").mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix="nextile-pack-") as temporary:
    subprocess.run(["glib-compile-schemas", "--strict", f"--targetdir={temporary}",
                    str(ROOT / "schemas")], check=True)
    with zipfile.ZipFile(ROOT / "dist" / NAME, "w", zipfile.ZIP_DEFLATED) as archive:
        # GNOME 45+ compiles the XML when installing the extension. Keep strict
        # validation above, but do not ship its generated binary in the ZIP.
        for name in FILES + sorted(str(p.relative_to(ROOT)) for p in (ROOT / "locale").rglob("*.mo")):
            source = ROOT / name
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes())
print(ROOT / "dist" / NAME)
