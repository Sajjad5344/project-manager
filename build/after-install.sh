#!/bin/sh
# Electron's Chromium sandbox needs chrome-sandbox to be setuid root.
SB=/opt/ProjectManager/chrome-sandbox
if [ -f "$SB" ]; then
  chown root:root "$SB"
  chmod 4755 "$SB"
fi
exit 0
