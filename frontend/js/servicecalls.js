require('core-js/stable');

const QRCode = require('qrcode');

const WEBUI_PORT = 8090;

const availableQuirks = {
  // DILE_VT
  QUIRK_DILE_VT_CREATE_EX: '0x1',
  QUIRK_DILE_VT_NO_FREEZE_CAPTURE: '0x2',
  QUIRK_DILE_VT_DUMP_LOCATION_2: '0x4',
  // vtCapture
  QUIRK_VTCAPTURE_FORCE_CAPTURE: '0x100',
};

let isRoot = false;
let rootingInProgress = false;

// Tracks whether the user has changed a settings-form control locally without
// saving yet, so the periodic getSettings() refresh (added to pick up changes
// made through the browser-based web UI while this app is open) doesn't clobber
// an in-progress, unsaved edit.
let settingsDirty = false;

// Text inputs on this remote-controlled UI are readOnly except while a D-pad OK
// press has put them into edit mode (see setupDeferredKeyboardInputs in ui.js).
// A background settings refresh must not overwrite the field the user is
// currently typing into.
function isEditingSettingsField() {
  return Array.prototype.some.call(
    document.querySelectorAll('#settings input[type="text"]'),
    (input) => input.readOnly === false,
  );
}

function logIt(message) {
  const textareaConsoleLog = document.getElementById('textareaConsoleLog');
  console.log(message);
  textareaConsoleLog.value += `${message}\n`;
}

function onHBExec(result) {
  if (result.returnValue === true) {
    logIt(`HBChannel exec returned. stdout: ${result.stdoutString} stderr: ${result.stderrString}`);
  } else {
    logIt(`HBChannel exec failed! Code: ${result.errorCode}`);
  }
}

function killHyperion() {
  document.getElementById('txtInfoState').innerHTML = 'Killing service..';
  logIt('Calling HBChannel exec to kill hyperion-webos');
  /* eslint-disable no-undef */
  webOS.service.request(
    'luna://org.webosbrew.hbchannel.service',
    {
      method: 'exec',
      parameters: {
        command: 'kill -9 $(pidof hyperion-webos)',
      },
      onSuccess: onHBExec,
      onFailure: onHBExec,
    },
  );
  /* eslint-enable no-undef */
}

function makeServiceRoot() {
  logIt('Rooting..');
  document.getElementById('txtInfoState').innerHTML = 'Rooting app and service..';
  logIt('Calling HBChannel exec to elevate app and service');
  /* eslint-disable no-undef */
  webOS.service.request(
    'luna://org.webosbrew.hbchannel.service',
    {
      method: 'exec',
      parameters: {
        command: '/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service org.webosbrew.piccapplus; /media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service org.webosbrew.piccapplus.service',
      },
      onSuccess(result) {
        onHBExec(result);

        logIt('Elevation completed - killing service process..');
        document.getElementById('txtInfoState').innerHTML = 'Killing service..';
        killHyperion();
      },
      onFailure: onHBExec,
    },
  );
  /* eslint-enable no-undef */

  document.getElementById('txtInfoState').innerHTML = 'Finished making root processing';
}

let checkRootStatusIntervalID = null;
function onCheckRootStatus(result) {
  if (result.returnValue === true) {
    if (result.elevated) {
      logIt('PicCap-Service returned rooted!');
      document.getElementById('txtInfoState').innerHTML = 'Running as root';
      isRoot = true;
      clearInterval(checkRootStatusIntervalID);
      rootingInProgress = false;
      // Load settings the moment we know we're rooted, instead of waiting for
      // a second, independent 3s poll loop to notice isRoot flipped.
      // getSettings is a hoisted function declaration (defined further down
      // in this file), so this is safe at runtime despite the lint rule.
      /* eslint-disable-next-line no-use-before-define */
      getSettings();
    } else {
      if (rootingInProgress === false) {
        logIt('Rooting not in progress yet.');
        makeServiceRoot();
        rootingInProgress = true;
      }
      logIt('PicCap-Service returned not rooted yet! Will check again soon.');
      document.getElementById('txtInfoState').innerHTML = 'Not running as root. Service elevation in progress..';
    }
  } else {
    logIt(`Getting root-status from PicCap-Service failed! Will try again. Code: ${result.errorCode}`);
    document.getElementById('txtInfoState').innerHTML = 'PicCap-Service status failed!';
  }
}

function checkRoot() {
  document.getElementById('txtServiceStatus').innerHTML = 'Processing root check';
  logIt('Starting loop for PicCap-Service to get root-status');

  let firstCall = true;
  const check = () => {
    logIt('Calling PicCap-Service to get root-status');
    document.getElementById('txtInfoState').innerHTML = 'Checking root status';
    /* eslint-disable no-undef */
    webOS.service.request(
      'luna://org.webosbrew.piccapplus.service',
      {
        method: 'status',
        parameters: {},
        onSuccess: onCheckRootStatus,
        onFailure: onCheckRootStatus,
      },
    );
    /* eslint-enable no-undef */

    if (rootingInProgress === false && isRoot === false && firstCall === false) {
      logIt('Not rooted and rooting not in progress yet.');
      makeServiceRoot();
      rootingInProgress = true;
    }
    firstCall = false;
  };

  // Check immediately instead of waiting out a full interval tick first -
  // that alone used to add a very noticeable delay before anything showed up.
  check();
  checkRootStatusIntervalID = window.setInterval(check, 3000);
}

function getStatus() {
  document.getElementById('txtInfoState').innerHTML = 'Getting status info..';
  /* eslint-disable no-undef */
  webOS.service.request(
    'luna://org.webosbrew.piccapplus.service',
    {
      method: 'status',
      parameters: {},
      onSuccess(result) {
        if (result.returnValue === true) {
          document.getElementById('txtServiceVersion').innerHTML = result.version;
          document.getElementById('txtServiceStatus').innerHTML = result.isRunning
            ? (result.directOutput ? `Streaming to WLED ${result.wledAddress}` : 'Capturing')
            : 'Not capturing';

          document.getElementById('txtInfoReceiver').innerHTML = result.directOutput
            ? `WLED ${result.wledAddress} (DDP)`
            : (result.connected ? 'Connected' : 'Disconnected');
          document.getElementById('txtInfoVideo').innerHTML = result.videoRunning ? `Capturing with ${result.videoBackend}` : 'Not capturing';
          document.getElementById('txtInfoUI').innerHTML = result.uiRunning ? `Capturing with ${result.uiBackend}` : 'Not capturing';
          document.getElementById('txtInfoFPS').innerHTML = result.framerate.toFixed(2); /* Round to 2 decimal points */

          if (result.isRunning === true) {
            document.getElementById('ambilightIndicator').classList.add('running');
          } else {
            document.getElementById('ambilightIndicator').classList.remove('running');
          }

          document.getElementById('txtInfoState').innerHTML = 'Status info refreshed';
        } else {
          logIt('Getting status info from PicCap-Service failed! Return value false!');
          document.getElementById('txtInfoState').innerHTML = 'Getting status info failed!';
        }
      },
      onFailure(result) {
        logIt(`Getting status info from PicCap-Service failed! Code: ${result.errorCode}`);
        document.getElementById('txtInfoState').innerHTML = 'Getting status info failed!';
      },
    },
  );
  /* eslint-enable no-undef */
}

function showWebUiQrCode(ipAddress) {
  const url = `http://${ipAddress}:${WEBUI_PORT}/`;

  QRCode.toCanvas(document.getElementById('webuiQrCanvas'), url, { width: 380, margin: 2 }, (err) => {
    if (err) {
      logIt(`Failed to render web UI QR code: ${err}`);
    }
  });
  document.getElementById('webuiQrUrl').innerHTML = url;
}

function detectWebUiAddress() {
  /* eslint-disable no-undef */
  webOS.service.request(
    'luna://com.webos.service.connectionmanager',
    {
      method: 'getStatus',
      parameters: {},
      onSuccess(result) {
        const ipAddress = (result.wired && result.wired.state === 'connected' && result.wired.ipAddress)
          || (result.wifi && result.wifi.state === 'connected' && result.wifi.ipAddress);

        if (ipAddress) {
          showWebUiQrCode(ipAddress);
        } else {
          logIt('detectWebUiAddress: no connected network interface with an IP address found.');
          document.getElementById('webuiQrUrl').innerHTML = 'Could not detect TV IP address. Check Network settings.';
        }
      },
      onFailure(result) {
        logIt(`detectWebUiAddress failed! Code: ${result.errorCode}`);
        document.getElementById('webuiQrUrl').innerHTML = 'Could not detect TV IP address. Check Network settings.';
      },
    },
  );
  /* eslint-enable no-undef */
}

function getSettings() {
  document.getElementById('txtInfoState').innerHTML = 'Loading settings..';
  /* eslint-disable no-undef */
  webOS.service.request(
    'luna://org.webosbrew.piccapplus.service',
    {
      method: 'getSettings',
      parameters: {},
      onSuccess(result) {
        if (result.returnValue === true) {
          document.getElementById('selectSettingsVideoBackend').value = result.novideo === true ? 'disabled' : result.backend || 'auto';
          document.getElementById('selectSettingsGraphicalBackend').value = result.nogui === true ? 'disabled' : result.uibackend || 'auto';

          document.getElementById('checkSettingsDirectWled').checked = result.directledoutput === true;
          directWledChanged(document.getElementById('checkSettingsDirectWled'));
          document.getElementById('txtInputSettingsWledAddress').value = result.wledaddress || '';
          document.getElementById('txtInputSettingsWledPort').value = result.wledport;

          document.getElementById('checkSettingsLocalSocket').checked = result['unix-socket'];
          socketCheckChanged(document.getElementById('checkSettingsLocalSocket'));

          if (result.address.includes('/')) {
            switch (result.address) {
              case '/tmp/hyperhdr-domain':
                document.getElementById('selectSettingsSocket').value = 'hyperhdr';
                break;
              default:
                document.getElementById('selectSettingsSocket').value = 'manual';
                document.getElementById('txtInputSettingsAddress').value = result.address;
            }
            document.getElementById('txtInputSettingsAddress').value = '127.0.0.1';
            socketSelectChanged(document.getElementById('selectSettingsSocket'));
          } else {
            document.getElementById('txtInputSettingsAddress').value = result.address || '127.0.0.1';
          }

          document.getElementById('txtInputSettingsPort').value = result.port;
          document.getElementById('txtInputSettingsPriority').value = result.priority;

          document.getElementById('txtInputSettingsFPS').value = result.fps;

          // Process Height/Width for easier selection
          switch (result.width * result.height) {
            case 57600:
              document.getElementById('selectSettingsResolution').value = '320x180';
              break;
            case 36864:
              document.getElementById('selectSettingsResolution').value = '256x144';
              break;
            case 20736:
              document.getElementById('selectSettingsResolution').value = '192x108';
              break;
            case 9984:
              document.getElementById('selectSettingsResolution').value = '128x78';
              break;
            default:
              document.getElementById('selectSettingsResolution').value = 'manual';
              document.getElementById('txtInputSettingsWidth').value = result.width;
              document.getElementById('txtInputSettingsHeight').value = result.height;
              break;
          }

          Object.keys(availableQuirks).forEach((quirk) => {
            logIt(`Processing: ${quirk}`);
            const quirkval = availableQuirks[quirk];
            /* eslint-disable eqeqeq */
            if ((result.quirks & quirkval) == quirkval) {
              logIt(`Quirk ${quirk} enabled!`);
              document.getElementById(`checkSettings${quirk}`).checked = true;
            }
            /* eslint-enable eqeqeq */
          });

          document.getElementById('checkSettingsVSync').checked = result.vsync;
          document.getElementById('checkSettingsAutostart').checked = result.autostart;
          document.getElementById('checkSettingsNoHDR').checked = result.nohdr;
          document.getElementById('checkSettingsNoPowerstate').checked = result.nopowerstate;
          document.getElementById('checkSettingsNV12').checked = result.nv12;

          settingsDirty = false;
          logIt('Loading settings done!');
          document.getElementById('txtInfoState').innerHTML = 'Settings loaded';
        } else {
          logIt('Getting settings from PicCap-Service failed! Return value false!');
          document.getElementById('txtInfoState').innerHTML = 'Getting settings failed!';
        }
      },
      onFailure(result) {
        logIt(`Getting settings from PicCap-Service failed! Code: ${result.errorCode}`);
        document.getElementById('txtInfoState').innerHTML = 'Getting settings failed!';
      },
    },
  );
  /* eslint-enable no-undef */
}

window.restartHyperion = () => {
  document.getElementById('txtInfoState').innerHTML = 'Killing hyperion.. Will be started again through status loop';
  killHyperion();
};

function saveSettings(config) {
  /* eslint-disable no-undef */
  webOS.service.request(
    'luna://org.webosbrew.piccapplus.service',
    {
      method: 'setSettings',
      parameters: config,
      onSuccess(result) {
        if (result.returnValue === true) {
          logIt('Saving settings success!');
          document.getElementById('txtInfoState').innerHTML = 'Save settings success!';
          getSettings();
        } else {
          logIt('Save settings for PicCap-Service failed! Return value false!');
          document.getElementById('txtInfoState').innerHTML = 'Save settings failed!';
        }
      },
      onFailure(result) {
        logIt(`Save settings for PicCap-Service failed! Code: ${result.errorCode}`);
        document.getElementById('txtInfoState').innerHTML = 'Sace settings failed!';
      },
    },
  );
  /* eslint-enable no-undef */
}

window.serviceResetSettings = () => {
  document.getElementById('txtInfoState').innerHTML = 'Loading default settings..';
  const config = {
    backend: 'auto',
    uibackend: 'auto',

    novideo: false,
    nogui: false,

    address: '172.16.24.1',
    port: 19400,
    priority: 150,

    fps: 0,

    width: 320,
    height: 180,
    quirks: 0,

    vsync: true,
    autostart: false,
    nv12: false,

    directledoutput: true,
    wledaddress: '172.16.24.60',
    wledport: 4048,
  };
  logIt(config);

  document.getElementById('txtInfoState').innerHTML = 'Sending default settings..';
  saveSettings(config);
};

window.serviceSaveSettings = () => {
  document.getElementById('txtInfoState').innerHTML = 'Collecting settings..';

  let quirkcalc = 0;
  Object.keys(availableQuirks).forEach((quirk) => {
    logIt(`Processing quirk: ${quirk}`);
    const quirkval = availableQuirks[quirk];
    logIt(`Quirk val: ${quirkval}`);
    if (document.getElementById(`checkSettings${quirk}`).checked === true) {
      quirkcalc |= quirkval;
      logIt(`Quirkcalc: ${quirkcalc}`);
    }
  });

  let width;
  let height;
  switch (document.getElementById('selectSettingsResolution').value) {
    case '320x180':
      width = 320;
      height = 180;
      break;
    case '256x144':
      width = 256;
      height = 144;
      break;
    case '192x108':
      width = 192;
      height = 108;
      break;
    case '128x78':
      width = 128;
      height = 78;
      break;
    case 'manual':
      width = parseInt(document.getElementById('txtInputSettingsWidth').value, 10);
      height = parseInt(document.getElementById('txtInputSettingsHeight').value, 10);
      break;
    default:
      width = 320;
      height = 180;
      break;
  }

  let address;
  if (document.getElementById('checkSettingsLocalSocket').checked === true) {
    switch (document.getElementById('selectSettingsSocket').value) {
      case 'hyperhdr':
        address = '/tmp/hyperhdr-domain';
        break;
      case 'manual':
        address = document.getElementById('txtInputSettingsSocketPath').value;
        break;
      default:
        address = undefined;
        logIt('Address wasnt found!');
        break;
    }
  } else {
    address = document.getElementById('txtInputSettingsAddress').value;
  }

  const config = {
    backend: document.getElementById('selectSettingsVideoBackend').value === 'disabled' ? 'auto' : document.getElementById('selectSettingsVideoBackend').value,
    uibackend: document.getElementById('selectSettingsGraphicalBackend').value === 'disabled' ? 'auto' : document.getElementById('selectSettingsGraphicalBackend').value,

    novideo: document.getElementById('selectSettingsVideoBackend').value === 'disabled',
    nogui: document.getElementById('selectSettingsGraphicalBackend').value === 'disabled',

    'unix-socket': document.getElementById('checkSettingsLocalSocket').checked,
    address,
    port: parseInt(document.getElementById('txtInputSettingsPort').value, 10) || undefined,
    priority: parseInt(document.getElementById('txtInputSettingsPriority').value, 10) || undefined,

    fps: parseInt(document.getElementById('txtInputSettingsFPS').value, 10) || 0,

    width: width || undefined,
    height: height || undefined,
    quirks: quirkcalc,

    vsync: document.getElementById('checkSettingsVSync').checked,
    autostart: document.getElementById('checkSettingsAutostart').checked,
    nohdr: document.getElementById('checkSettingsNoHDR').checked,
    nopowerstate: document.getElementById('checkSettingsNoPowerstate').checked,
    nv12: document.getElementById('checkSettingsNV12').checked,

    directledoutput: document.getElementById('checkSettingsDirectWled').checked,
    wledaddress: document.getElementById('txtInputSettingsWledAddress').value,
    wledport: parseInt(document.getElementById('txtInputSettingsWledPort').value, 10) || undefined,
};

  logIt(`Config: ${JSON.stringify(config)}`);

  document.getElementById('txtInfoState').innerHTML = 'Sending settings..';
  saveSettings(config);
};

window.reloadHyperionLog = () => {
  logIt('Calling HBCHannel to get latest 200 hyperion-webos log lines.');
  /* eslint-disable no-undef */
  webOS.service.request(
    'luna://org.webosbrew.hbchannel.service',
    {
      method: 'exec',
      parameters: {
        command: 'grep hyperion-webos /var/log/messages | tail -n200',
      },
      onSuccess(result) {
        onHBExec(result);
        const textareaHyperionLog = document.getElementById('textareaHyperionLog');
        textareaHyperionLog.value += `${result.stdoutString}\r\n`;
      },
      onFailure: onHBExec,
    },
  );
  /* eslint-enable no-undef */
};

// Using this function to setup logging for now.
// Future start/stop of currently not implemented hyperion-webos log method.
window.startStopLogging = () => {
  logIt('Setup logging using HBChannel');
  document.getElementById('txtInfoState').innerHTML = 'Calling HBChannel for log setup';
  /* eslint-disable no-undef */
  webOS.service.request(
    'luna://org.webosbrew.hbchannel.service',
    {
      method: 'exec',
      parameters: {
        command: '/media/developer/apps/usr/palm/services/org.webosbrew.piccapplus.service/setuplegacylogging.sh',
      },
      onSuccess: onHBExec,
      onFailure: onHBExec,
    },
  );
  /* eslint-enable no-undef */
/*
  // Future Stuff
  const btnLogStartStop = document.getElementById('btnLogStartStop');
  if (!loggingStarted) {
    loggingStarted = true;
    btnLogStartStop.innerHTML = 'Stop logging';
  } else {
    loggingStarted = false;
    btnLogStartStop.innerHTML = 'Start logging';
  } */
};

function onServiceCallback(result) {
  if (result.returnValue === true) {
    logIt('Servicecall returned successfully.');
    document.getElementById('txtInfoState').innerHTML = 'Servicecall success!';
  } else {
    logIt(`Servicecall failed! Code: ${result.errorCode}`);
    document.getElementById('txtInfoState').innerHTML = 'Servicecall failed!';
  }
}

window.serviceStart = () => {
  logIt('Start clicked');
  try {
    document.getElementById('txtServiceStatus').innerHTML = 'Starting service...';
    document.getElementById('txtInfoState').innerHTML = 'Sending start command';
    /* eslint-disable no-undef */
    webOS.service.request(
      'luna://org.webosbrew.piccapplus.service',
      {
        method: 'start',
        parameters: {},
        onSuccess: onServiceCallback,
        onFailure: onServiceCallback,
      },
    );
    /* eslint-enable no-undef */
  } catch (err) {
    document.getElementById('txtServiceStatus').innerHTML = `Failed: ${JSON.stringify(err)}`;
  }
  document.getElementById('txtInfoState').innerHTML = 'Start command send';
};

window.serviceStop = () => {
  logIt('Stop clicked');
  try {
    document.getElementById('txtServiceStatus').innerHTML = 'Stopping service...';
    document.getElementById('txtInfoState').innerHTML = 'Sending stop command';
    /* eslint-disable no-undef */
    webOS.service.request(
      'luna://org.webosbrew.piccapplus.service',
      {
        method: 'stop',
        parameters: {},
        onSuccess: onServiceCallback,
        onFailure: onServiceCallback,
      },
    );
    /* eslint-enable no-undef */
  } catch (err) {
    document.getElementById('txtServiceStatus').innerHTML = `Failed: ${JSON.stringify(err)}`;
  }
  document.getElementById('txtInfoState').innerHTML = 'Stop command send';
};

window.serviceReload = () => {
  logIt('Reload clicked');
  getSettings();
};

window.tvReboot = () => {
  logIt('Trying to reboot TV using HBChannel..');
  document.getElementById('txtInfoState').innerHTML = 'Rebooting TV..';
  /* eslint-disable no-undef */
  webOS.service.request(
    'luna://org.webosbrew.hbchannel.service',
    {
      method: 'reboot',
      parameters: {},
      onSuccess: onServiceCallback,
      onFailure: onServiceCallback,
    },
  );
  /* eslint-enable no-undef */
};

window.addEventListener('load', () => {
  logIt('Startup of PicCap...');
  checkRoot();

  logIt('Starting status loop...');
  getStatus();
  setInterval(() => {
    getStatus();
  }, 4000);

  // Settings can also be changed through the browser-based web UI (served by
  // hyperion-webos's own HTTP server) while this app is sitting open on the
  // TV. Without this, those changes would only ever show up here after a
  // manual reload. Skipped while the user has an unsaved local edit pending,
  // or is mid-edit on a text field, so this can't clobber their own in-flight
  // change.
  const settingsContainer = document.getElementById('settings');
  settingsContainer.addEventListener('input', () => { settingsDirty = true; });
  settingsContainer.addEventListener('change', () => { settingsDirty = true; });
  setInterval(() => {
    if (isRoot && !settingsDirty && !isEditingSettingsField()) {
      getSettings();
    }
  }, 4000);

  detectWebUiAddress();
});
