import packageJSON from '../../package.json';

/* eslint-disable func-names */
window.switchView = function (view) {
  const home = document.getElementById('home');
  const logs = document.getElementById('logs');
  const about = document.getElementById('about');

  const btnhome = document.getElementById('btnNavHome');
  const btnlogs = document.getElementById('btnNavLogs');
  const btnabout = document.getElementById('btnNavAbout');

  switch (view) {
    case 'home':
      home.style.display = 'flex';
      btnhome.style.background = 'white';
      btnhome.style.color = 'black';

      logs.style.display = 'none';
      btnlogs.style.background = null;
      btnlogs.style.color = null;

      about.style.display = 'none';
      btnabout.style.background = null;
      btnabout.style.color = null;
      break;
    case 'logs':
      home.style.display = 'none';
      btnhome.style.background = null;
      btnhome.style.color = null;

      logs.style.display = 'block';
      btnlogs.style.background = 'white';
      btnlogs.style.color = 'black';

      about.style.display = 'none';
      btnabout.style.background = null;
      btnabout.style.color = null;
      break;
    case 'about':
      home.style.display = 'none';
      btnhome.style.background = null;
      btnhome.style.color = null;

      logs.style.display = 'none';
      btnlogs.style.background = null;
      btnlogs.style.color = null;

      about.style.display = 'block';
      btnabout.style.background = 'white';
      btnabout.style.color = 'black';
      break;
    default:
      home.style.display = null;
      btnhome.style.background = null;
      btnhome.style.color = null;

      logs.style.display = null;
      about.style.display = null;
      break;
  }
};

window.resolutionChanged = function (elem) {
  document.getElementById('manualres').style.display = elem.value === 'manual' ? 'inline' : 'none';
};

window.socketCheckChanged = function (elem) {
  if (elem.checked === true) {
    document.getElementById('settingaddressport').style.display = 'none';
    document.getElementById('settingsocket').style.display = 'flex';
  } else {
    document.getElementById('settingaddressport').style.display = 'flex';
    document.getElementById('settingsocket').style.display = 'none';
  }
};

window.socketSelectChanged = function (elem) {
  document.getElementById('manualsocket').style.display = elem.value === 'manual' ? 'inline' : 'none';
};

window.directWledChanged = function (elem) {
  document.getElementById('wledoutputsettings').style.display = elem.checked ? 'flex' : 'none';
  document.getElementById('hyperionreceiversettings').style.display = elem.checked ? 'none' : 'block';
};

window.toggleAdvanced = function () {
  const settingItemsAdv = document.getElementById('settingItemsAdv');
  const settingItemsNormal = document.getElementById('settingItemsNormal');
  const btnAdvanced = document.getElementById('btnSettingsAdvanced');
  if (settingItemsNormal.style.display === 'block') {
    btnAdvanced.style.background = 'white';
    btnAdvanced.style.color = 'black';
    settingItemsNormal.style.display = 'none';
    settingItemsAdv.style.display = 'block';
  } else {
    btnAdvanced.style.background = null;
    btnAdvanced.style.color = null;
    settingItemsNormal.style.display = 'block';
    settingItemsAdv.style.display = 'none';
  }
};

window.switchLog = function (location) {
  const divConsoleLog = document.getElementById('consoleLog');
  const divHyperionLog = document.getElementById('hyperionLog');
  const btnLogSwitchPicCap = document.getElementById('btnLogSwitchPicCap');
  const btnLogSwitchHyperion = document.getElementById('btnLogSwitchHyperion');

  if (location === 'hyperion') {
    divConsoleLog.style.display = 'none';
    divHyperionLog.style.display = 'block';

    btnLogSwitchHyperion.style.background = 'white';
    btnLogSwitchHyperion.style.color = 'black';
    btnLogSwitchPicCap.style.background = null;
    btnLogSwitchPicCap.style.color = null;
  } else {
    divConsoleLog.style.display = 'block';
    divHyperionLog.style.display = 'none';

    btnLogSwitchPicCap.style.background = 'white';
    btnLogSwitchPicCap.style.color = 'black';
    btnLogSwitchHyperion.style.background = null;
    btnLogSwitchHyperion.style.color = null;
  }
};

/* eslint-enable func-names */

/* eslint-disable func-names */
function getJSON(url, callback) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'json';

  xhr.onload = function () {
    const { status } = xhr;

    if (status === 200) {
      callback(null, xhr.response);
    } else {
      callback(status);
    }
  };

  xhr.send();
}
/* eslint-enable func-names */

function getContributors(owner, repo) {
  getJSON(`https://api.github.com/repos/${owner}/${repo}/contributors`, (err, data) => {
    if (err != null) {
      console.error(err);
    } else {
      const resp = data;
      let div = document.querySelector('.hyperionwebosContributors');
      if (repo === 'piccap') {
        div = document.querySelector('.piccapContributors');
      }
      const users = resp.map((u) => u.login);
      const avatars = resp.map((a) => a.avatar_url);
      let count = 0;
      let pos = 0;
      let last = document.createElement('ul');
      users.forEach((user) => {
        const lielem = document.createElement('li');
        lielem.setAttribute('id', `li${user}`);
        const pelem = document.createElement('p');

        const imgelem = document.createElement('img');
        imgelem.setAttribute('src', avatars[pos]);
        pos += 1;

        pelem.appendChild(imgelem);
        pelem.innerHTML += user;

        lielem.appendChild(pelem);

        if (count >= 3) {
          const brelem = document.createElement('br');
          div.appendChild(brelem);
          last = document.createElement('ul');
          div.appendChild(last);
          count = 0;
        }
        count += 1;

        last.appendChild(lielem);
        div.appendChild(last);
      });
    }
  });
}
getContributors('webosbrew', 'hyperion-webos');
getContributors('tbsniller', 'piccap');

// Text inputs are readonly by default so simply passing over them with the
// remote's D-pad doesn't pop up the on-screen keyboard. Pressing OK/Enter (or
// clicking) makes the field editable and re-focuses it to actually trigger
// the keyboard; pressing OK/Enter again (or leaving the field) exits edit
// mode and gives focus back so the D-pad can move on.
//
// Note this is NOT just cosmetic: the spatial-navigation polyfill's own
// arrow-key handling (handlingEditableElement) treats any focused
// type="text" input as a real text-cursor widget regardless of our readOnly
// flag - left/up only navigate away once the caret is at position 0, right/
// down only once it's at the end. So merely flipping readOnly back to true
// while STILL focused would not free up the D-pad at all; the field has to
// actually lose focus (blur()) for normal spatial navigation to resume in
// every direction.
/* eslint-disable no-param-reassign */
function setupDeferredKeyboardInputs() {
  const enterEditMode = (input) => {
    // Must stay synchronous (no requestAnimationFrame/setTimeout): webOS only
    // shows the on-screen keyboard on a focus() call that happens within the
    // original user-gesture (keydown/click) callstack.
    // blur() fires its listener synchronously, so without this flag it would
    // immediately re-set readOnly=true again before focus() below ever runs,
    // silently undoing this whole function and leaving the field stuck.
    input.dataset.ignoreBlur = 'true';
    input.readOnly = false;
    input.blur();
    input.focus();
  };

  const exitEditMode = (input) => {
    input.readOnly = true;
    input.blur();
  };

  document.querySelectorAll('input[type="text"]').forEach((input) => {
    input.readOnly = true;

    input.addEventListener('keydown', (e) => {
      if (e.keyCode !== 13) return;
      e.preventDefault();
      if (input.readOnly) {
        enterEditMode(input);
      } else {
        exitEditMode(input);
      }
    });

    input.addEventListener('click', () => {
      if (input.readOnly) {
        enterEditMode(input);
      }
    });

    input.addEventListener('blur', () => {
      if (input.dataset.ignoreBlur === 'true') {
        delete input.dataset.ignoreBlur;
        return;
      }
      input.readOnly = true;
    });
  });
}
/* eslint-enable no-param-reassign */

window.addEventListener('load', () => {
  /* eslint-disable no-undef */
  switchView('home');
  switchLog('piccap');
  /* eslint-enable no-undef */

  setupDeferredKeyboardInputs();

  const piccapVersion = packageJSON.version;
  document.getElementById('txtPicCapVersion').innerHTML = `v${piccapVersion}`;
});
