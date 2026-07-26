# PicCap-Plus – Standalone Bias Lighting for LG webOS TVs

PicCap-Plus is a fork of [PicCap](https://github.com/TBSniller/piccap) /
[hyperion-webos](https://github.com/webosbrew/hyperion-webos) that lets an LG
webOS TV drive a screen-synced bias-lighting LED strip **entirely on its
own** – no PC, Raspberry Pi, or separate HyperHDR/Hyperion instance required
in between.

hyperion-webos still does the heavy lifting: it talks to webOS's own
(reverse-engineered, undocumented) capture internals to grab a live, low-res
copy of whatever is currently on screen. PicCap-Plus adds everything needed to
turn that into a fully self-contained appliance:

- **Direct-to-WLED output** – computes the per-LED colors itself and streams
  them straight to a [WLED](https://kno.wled.ge/) controller over DDP, with
  configurable rise/fall smoothing to avoid flicker. The classic path (sending
  frames to a Hyperion/HyperHDR receiver) still works and can be used instead.
- **Embedded web config UI** – the service ships its own HTTP server, reachable
  at `http://<tv-ip>:8090/` (scan the QR code shown on the TV app's Home tab).
  Full settings, live status, and a HyperHDR-style LED layout editor with a
  live preview, all from a phone or desktop browser.
- **Letterbox/pillarbox detection** – automatically crops the LED mapping to
  the actual picture instead of the raw capture frame when black bars are
  present (movies, old 4:3 content), with hysteresis so it doesn't flicker on
  scene cuts.
- **Scene brightness dimming** – optionally dims all LEDs together during
  predominantly dark scenes for a more atmospheric look.
- **White/color balance calibration** – adjustable per-channel gain, applied
  live while dragging, plus a one-tap full-screen white calibration test
  pattern on the TV.
- **WLED discovery** – scans the local network for WLED controllers and
  cross-checks their reported LED count against the configured layout.
- **Persistent logging** – an in-memory log ring buffer exposed both as a raw
  TCP "telnet" port and as a Log tab in the web UI (survives a service
  restart, unlike a one-shot log dump), for catching intermittent issues that
  are too short to observe live.

Like the original PicCap, this only works with content that isn't
DRM-protected (webOS won't hand hyperion-webos a copy of Netflix/Amazon Prime
Video frames) – anything arriving over a plain HDMI input (a PC, Fire TV
Stick, Chromecast, game console, ...) is unaffected.

## Installation

### Requirements
- [Root access](https://cani.rootmy.tv) on your TV
- webOS 3.4 or newer
- [Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel)
  installed (used to elevate the service to root on first launch)

### Manual install
Build it yourself (see below) or grab a pre-built `.ipk` from
[Releases](https://github.com/ICEbAIR82/piccapplus/releases), then:

```sh
# Copy the IPK to the TV
scp org.webosbrew.piccapplus_<version>_all.ipk root@<tv-ip>:/tmp/

# Install it on the TV
luna-send -i -f luna://com.webos.appInstallService/dev/install \
  '{"id":"org.webosbrew.piccapplus","ipkUrl":"/tmp/org.webosbrew.piccapplus_<version>_all.ipk","subscribe":true}'
```

## Usage

On first launch, give the app a few seconds to elevate root permissions via
the Homebrew Channel service – the status line at the bottom of the screen
shows when that's done. From there:

- Use the TV app's own Settings screen with the remote, or
- Scan the QR code on the Home tab and configure everything from the embedded
  web UI instead – same settings, plus the LED layout editor and live log.

### Backends and device quirks
Different TV generations need different capture backends; some devices also
need one of a handful of "quirk" workarounds enabled for reliable capture.
Both are explained inline (with short descriptions) in the Settings screen and
the web UI, and described in more detail in the
[hyperion-webos README](https://github.com/webosbrew/hyperion-webos/tree/main#backends).

## Development

### Dependencies
- [Node.js](https://nodejs.org/en/download/)
- [buildroot-nc4](https://github.com/openlgtv/buildroot-nc4) (cross toolchain
  for the hyperion-webos native service)

### Building

```sh
# Set up the buildroot-nc4 toolchain (needed for hyperion-webos)
cd /desired/path
wget -O toolchain.tar.gz $TOOLCHAIN_URL_FROM_RELEASES
tar -xvzf toolchain.tar.gz
rm toolchain.tar.gz
arm-webos-linux-gnueabi_sdk-buildroot/relocate-sdk.sh
export TOOLCHAIN_FILE=/desired/path/arm-webos-linux-gnueabi_sdk-buildroot/share/buildroot/toolchainfile.cmake

# Clone this repo and its submodule
git clone --recursive https://github.com/ICEbAIR82/piccapplus.git
cd piccapplus
npm install

# Build
npm run-script build-all        # frontend + hyperion-webos + deps
npm run-script build-frontend   # frontend only
npm run-script build-backend    # hyperion-webos + deps only

# Package the .ipk for TV installation
npm run-script package
```

## Known issues

Some newer LG models' "AI Picture Pro" / "AI Brightness" / "AI Genre
Selection" / "AI Image Game Optimizer" / "AI Game Sound" options use the same
capture path as hyperion-webos and can cause brief capture dropouts (LEDs
turning off momentarily). Workaround: disable these under
Settings → General → AI Service.

See [hyperion-webos's known issues](https://github.com/webosbrew/hyperion-webos/tree/main#known-issues)
for anything specific to the backend/capture side.

## Credits

None of this exists without the original [PicCap](https://github.com/TBSniller/piccap)
and [hyperion-webos](https://github.com/webosbrew/hyperion-webos) projects –
hyperion-webos in particular is doing the real heavy lifting of talking to
webOS's capture internals in the first place. Thanks to
[@TBSniller](https://github.com/TBSniller), [@Mariotaku](https://github.com/mariotaku),
[@Informatic](https://github.com/Informatic), [@tuxuser](https://github.com/tuxuser),
and everyone else who contributed to either project.

Questions or discussion: [OpenLG Discord](https://discord.gg/9sqAgHVRhP).

## License

MIT – see [LICENSE](LICENSE).
