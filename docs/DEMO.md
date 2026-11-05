# NexTile in motion

[Play the demo in your browser](https://erikleblansch.github.io/NexTile/).

The MP4 is an actual GNOME Shell 48.7 X11 recording of NexTile 0.7.0. It uses H.264, 30 fps, a 1440 × 900 frame and progressive playback (`faststart`). The browser player has native controls, optional English captions and a text description. There is no soundtrack, tracking code or external player service.

All window contents and wallpaper are synthetic. `Studio Notes` and `Project Board` are GTK 3 demonstration applications; the terminal is GNOME Terminal. The bottom captions are added by the isolated recording driver, not by the installed extension. Network tiles are hidden in that session to exclude host connection names. Window placement, resizing, dragging, search results, workspace animation and the NexTile menu are the real extension UI.

## Reproduce the recording

On GNOME 48 with X11 support, install GJS, GTK 3 Python bindings, GNOME Terminal, D-Bus, FFmpeg and Xvfb or Xephyr:

```sh
make translations
NEXTILE_XVFB="$(command -v Xvfb)" bash tools/record-demo.sh
```

The outputs are `docs/demo.mp4` and `docs/submission/screenshot.png`. The script starts a separate X server, session bus, settings directory and Shell instance. It does not restart your desktop. With Xvfb there is no visible test window; without it the script uses Xephyr. Override `NEXTILE_FFMPEG` or `NEXTILE_DEMO_OUTPUT` if needed.

The recorder source, example windows, terminal content and wallpaper are included in the repository and licensed under GPL-3.0-or-later. None is included in the extension ZIP.
