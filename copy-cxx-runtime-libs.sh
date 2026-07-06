#!/bin/bash
# Bundles libstdc++/libgcc_s from the buildroot toolchain next to hyperion-webos,
# since target webOS devices (e.g. webOS 5.5) ship an older libstdc++ that lacks
# the GLIBCXX symbol versions our GCC 14 toolchain links against.
set -euo pipefail

TOOLCHAIN_ROOT="$(dirname "$(dirname "$(dirname "$TOOLCHAIN_FILE")")")"
LIBDIR="$TOOLCHAIN_ROOT/arm-webos-linux-gnueabi/lib"
STRIP="$TOOLCHAIN_ROOT/bin/arm-webos-linux-gnueabi-strip"
DEST="./build/hyperion-webos"

cp -L "$LIBDIR/libstdc++.so.6" "$DEST/libstdc++.so.6"
cp -L "$LIBDIR/libgcc_s.so.1" "$DEST/libgcc_s.so.1"
"$STRIP" "$DEST/libstdc++.so.6" "$DEST/libgcc_s.so.1"
