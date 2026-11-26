/*
 * ============================================================
 *  Songlap PhonicsStrip Studio Pro — main app
 * ============================================================
 *  LICENSING CONFIG
 *  Each buyer has a UNIQUE code, registered to their name by
 *  the license server (Google Apps Script + Google Sheet).
 *  The app sends { name, code } to LICENSE_API_URL and unlocks
 *  only when the server says ok.
 *  >> After deploying the Apps Script web app, paste its URL
 *     in place of the placeholder below. That is the ONLY
 *     change needed to go live. <<
 * ============================================================
 */
const LICENSE_API_URL = "https://script.google.com/macros/s/AKfycbzG6efCWwGk6BALXrosqIYZS5vD_s7Mjxg1E7HjAGGMecGunduAeAi7fH8TH81kqFTo/exec";

/* ---------- License response handling (pure, unit-tested) ---------- */

var LICENSE_ERROR_MESSAGES = {
  invalid_code: 'This code was not found. Please check the code from your purchase.',
  code_registered_to_another_name: 'This code is already registered to another buyer. If this is your code, please contact support.',
  missing_fields: 'Please enter both your name and your code.',
  network: 'Could not verify your code. Please check your internet connection and try again.'
};

function licenseErrorMessage(errorCode) {
  return LICENSE_ERROR_MESSAGES[errorCode] || LICENSE_ERROR_MESSAGES.network;
}

/* Turn a parsed license-server response into an app decision. */
function interpretLicenseResponse(data) {
  if (!data || typeof data !== 'object') {
    return { action: 'error', message: licenseErrorMessage('network') };
  }
  if (data.ok === true) {
    return { action: 'unlock', test: data.test === true };
  }
  return { action: 'error', message: licenseErrorMessage(data.error) };
}

/* Allow the Node test suite to exercise the pure logic above. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LICENSE_API_URL: LICENSE_API_URL,
    LICENSE_ERROR_MESSAGES: LICENSE_ERROR_MESSAGES,
    licenseErrorMessage: licenseErrorMessage,
    interpretLicenseResponse: interpretLicenseResponse
  };
}

(function () {
  'use strict';

  /* In the browser these come from the script tags; in Node
     (unit tests) they are required directly. */
  var C = typeof PHS_LEVELS !== 'undefined'
    ? { PHS_LEVELS: PHS_LEVELS, PHS_SEQUENCES: PHS_SEQUENCES, PHS_ACTIVITIES: PHS_ACTIVITIES, phsLevelById: phsLevelById, phsActivityById: phsActivityById, phsCumulative: phsCumulative, PHS_PICTURE_PACKS: PHS_PICTURE_PACKS, phsPicturePackById: phsPicturePackById, PHS_PIC_LIB: typeof PHS_PIC_LIB !== 'undefined' ? PHS_PIC_LIB : {}, PHS_STORYBOOK: typeof PHS_STORYBOOK !== 'undefined' ? PHS_STORYBOOK : {}, PHS_EMOTION_ADJS: PHS_EMOTION_ADJS, PHS_MASS_NOUNS: PHS_MASS_NOUNS, PHS_PLURAL_NOUNS: PHS_PLURAL_NOUNS, PHS_VERB_FRAMES: PHS_VERB_FRAMES, phsNounClass: phsNounClass, phsIsAnimateClass: phsIsAnimateClass, PHS_ADJ_FIT: PHS_ADJ_FIT, phsAdjFit: phsAdjFit, phsPlaceFit: phsPlaceFit, phsSoundList: phsSoundList, PHS_LEVEL_BLURBS: PHS_LEVEL_BLURBS, phsLevelBlurb: phsLevelBlurb }
    : require('./content.js');
  var D = typeof PHS_DESIGNS !== 'undefined' ? { PHS_DESIGNS: PHS_DESIGNS, phsDesignById: phsDesignById } : require('./designs.js');
  var E = typeof PhonicsEngine !== 'undefined' ? PhonicsEngine : require('./engine.js');
  var BK = typeof PhonicsBook !== 'undefined' ? PhonicsBook : require('./book.js');

  /* ================= License gate ================= */

  var NAME_KEY = 'phonics_license_name';
  var CODE_KEY = 'phonics_license_code';
  var PROJECTS_KEY = 'phonics_projects_v1';
  var appStarted = false;

  function unlock() {
    document.getElementById('lock-screen').hidden = true;
    document.getElementById('app').hidden = false;
    if (!appStarted) { appStarted = true; initApp(); }
  }

  function showLicenseBar(name, code) {
    document.getElementById('license-name').textContent = name;
    document.getElementById('license-code').textContent = code;
    document.getElementById('license-bar').hidden = false;
  }

  function storedLicense() {
    try {
      var name = localStorage.getItem(NAME_KEY);
      var code = localStorage.getItem(CODE_KEY);
      if (name && code) return { name: name, code: code };
    } catch (e) { /* private mode */ }
    return null;
  }

  function initGate() {
    var saved = storedLicense();
    if (saved) { showLicenseBar(saved.name, saved.code); unlock(); return; }

    var form = document.getElementById('lock-form');
    var nameInput = document.getElementById('lock-name');
    var codeInput = document.getElementById('lock-input');
    var button = document.getElementById('lock-submit');
    var errorEl = document.getElementById('lock-error');

    /* Warm-up: the license server (Apps Script) cold-starts
       slowly — a no-await GET while the buyer is still
       typing wakes it, so the real check lands fast. */
    try { fetch(LICENSE_API_URL, { method: 'GET' }).then(function (r) { return r.text(); }).catch(function () { }); } catch (e) { /* offline */ }

    function showError(message) {
      errorEl.classList.remove('info');
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
    function showInfo(message) {
      errorEl.classList.add('info');
      errorEl.textContent = message;
      errorEl.hidden = false;
    }

    /* One check attempt with a 45-second timeout. The
       server can take up to ~30 s on a cold start; without
       a timeout and a patience note, that wait reads as
       "nothing works" — the owner's original complaint. */
    function checkLicense(name, code) {
      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 45000) : null;
      var opts = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ name: name, code: code })
      };
      if (controller) opts.signal = controller.signal;
      return fetch(LICENSE_API_URL, opts)
        .then(function (res) { return res.json(); })
        .then(function (data) { if (timer) clearTimeout(timer); return interpretLicenseResponse(data); })
        .catch(function (err) { if (timer) clearTimeout(timer); throw err; });
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = nameInput.value.trim();
      var code = codeInput.value.trim();
      if (!name || !code) { showError(licenseErrorMessage('missing_fields')); return; }
      button.disabled = true;
      button.textContent = 'Checking…';
      showInfo('Checking your code — the first check can take up to 30 seconds, please wait…');
      checkLicense(name, code)
        .catch(function () {
          /* one automatic retry on a network failure /
             timeout before the buyer sees an error */
          showInfo('Still checking — the server was slow to answer, trying once more…');
          return checkLicense(name, code);
        })
        .then(function (decision) {
          if (decision.action === 'unlock') {
            try {
              localStorage.setItem(NAME_KEY, name);
              localStorage.setItem(CODE_KEY, code.toUpperCase());
            } catch (e) { /* private mode */ }
            showLicenseBar(name, code.toUpperCase());
            unlock();
          } else {
            showError(decision.message);
          }
        })
        .catch(function () { showError(licenseErrorMessage('network')); })
        .finally(function () {
          button.disabled = false;
          button.textContent = 'Unlock';
        });
    });
  }

  /* ================= app state ================= */

  function $(id) { return document.getElementById(id); }
  var draft = null;          // bookData from the engine (editable)
  var builtBook = null;      // { book, opts, design } after Build
  var wrapBuilt = null;      // { meta, design, dims }
  var seedVariant = 1;
  var buildDirty = true;
  /* word-theme filter: chip id -> bank categories it leans
     generation toward (engine ctx.themeCats) */
  var THEMES = [
    { id: 'all', name: 'All words', cats: null },
    { id: 'animals', name: 'Animals', cats: ['animals'] },
    { id: 'food', name: 'Food', cats: ['food'] },
    { id: 'home', name: 'Home & School', cats: ['objects', 'clothes', 'home', 'body'] },
    { id: 'outdoors', name: 'Outdoors', cats: ['nature', 'transport'] },
    { id: 'people', name: 'People', cats: ['people'] }
  ];
  var themeFilter = 'all';
  /* paginated preview state */
  var preview = { page: 0, pages: [] };
  /* what the main Print button prints: the document the
     preview is currently showing (single book or series) */
  var currentPrint = null;
  /* combined series document after a Series Builder build:
     { html, css, pageCount, title } */
  var seriesDoc = null;
  var AUTOSAVE_KEY = 'phonics_autosave_v1';
  var autosaveTimer = null;
  /* buyer's own pictures: { word: dataURL } replaces that
     word's picture everywhere; buyer's own words (max 3):
     [ { w, img, c, level } ], each validated as decodable
     at its level before it was accepted */
  var customPics = {};
  var customWords = [];
  var pendingWordPic = null; // uploaded picture waiting for "Add word"
  /* illustrated-picture rotation: the variant selection the
     last generated book used, per word. Every new book picks
     a DIFFERENT variant for every word that has 2+, so a
     series never looks copy-pasted. Persisted on the device
     and inside each saved project. */
  var ROTATION_KEY = 'phonics_pic_rotation_v1';
  /* sbNext: the art source the NEXT Storybook-pack book will
     use throughout ('storybook' watercolour or 'svg'
     illustrated) — flipped after every Storybook build, so
     consecutive books alternate but one book never mixes. */
  var picRotation = { last: {}, nonce: 0, sbNext: 'storybook' };
  function loadPicRotation() {
    try {
      var raw = localStorage.getItem(ROTATION_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.last) picRotation = { last: parsed.last, nonce: parsed.nonce || 0, sbNext: parsed.sbNext === 'svg' ? 'svg' : 'storybook' };
      }
    } catch (e) { /* private mode */ }
  }
  function savePicRotation() {
    try { localStorage.setItem(ROTATION_KEY, JSON.stringify(picRotation)); } catch (e) { /* full/blocked */ }
  }

  var DEFAULT_COUNTS = { circle: 12, draw: 6, comp: 2, trace: 9, seq: 2, builder: 12 };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  /* ================= tabs ================= */

  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === name);
    });
    ['build', 'content', 'book', 'books'].forEach(function (t) {
      $('tab-' + t).hidden = t !== name;
    });
    /* the phone CSS keys the sticky action bar + bottom
       padding off this attribute */
    document.body.dataset.tab = name;
    if ((name === 'content' || name === 'book') && buildDirty) {
      generateDraft('Settings changed — the pages were remade and your edits were reset.');
    }
    if (name === 'book') updatePrintCheck();
    /* the preview's fit-scale is measured from the panel, so it
       must be (re)done once this panel is actually visible: a
       build runs while the Build tab is showing and the hidden
       panel measures 0 wide, which used to leave the book
       preview collapsed to an empty strip on phones */
    if (name === 'book' && preview.pages && preview.pages.length) applyPreview();
  }

  /* ================= build tab ================= */

  function currentLevel() { return C.phsLevelById(parseInt($('level-select').value, 10)); }

  /* The bank categories the active theme chip leans
     toward, narrowed to categories that actually have
     words at the current level (null = no filter). */
  function themeCatsForFilter(levelId) {
    var theme = null;
    THEMES.forEach(function (t) { if (t.id === themeFilter) theme = t; });
    if (!theme || !theme.cats) return null;
    var cum = C.phsCumulative(levelId || currentLevel().id);
    var present = {};
    cum.nouns.forEach(function (n) { present[n.c] = true; });
    var cats = theme.cats.filter(function (c) { return present[c]; });
    return cats.length ? cats : null;
  }
  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }

  /* ================= picture pack ================= */

  function currentPack() { return C.phsPicturePackById($('pack-select').value); }

  function isDataUrl(s) { return typeof s === 'string' && s.indexOf('data:image/') === 0; }
  function isAssetPath(s) { return typeof s === 'string' && s.indexOf('assets/') === 0; }
  /* A picture value as inline HTML: an <img> for image
     pictures (own uploads + illustrated artwork), the emoji
     itself otherwise. */
  function picInline(pic) {
    return (isDataUrl(pic) || isAssetPath(pic)) ? '<img class="pp-img" src="' + pic + '" alt="">' : escapeHtml(pic);
  }
  /* Find a noun by word: the buyer's own words first, then
     the level's cumulative bank. */
  function findNoun(word) {
    for (var i = 0; i < customWords.length; i++) {
      if (customWords[i].w === word) {
        return { w: word, e: customWords[i].img, c: customWords[i].c, custom: true };
      }
    }
    return E.nounByWord(C, draft ? draft.level : currentLevel().id, word);
  }
  /* Same-category nouns for the editor's near-miss pickers,
     including the buyer's own words in that group. */
  function categoryNouns(cat, levelId) {
    var pool = E.nounsInCategory(C, levelId, cat).slice();
    customWords.forEach(function (cw) {
      if (cw.c === cat && cw.level <= levelId && !pool.some(function (n) { return n.w === cw.w; })) {
        pool.push({ w: cw.w, e: cw.img, c: cw.c, custom: true });
      }
    });
    return pool;
  }

  var PACK_SAMPLE_WORDS = ['cat', 'dog', 'pig', 'fish', 'bird', 'cake'];
  function updatePackChrome() {
    var pack = currentPack();
    $('pack-blurb').textContent = pack.blurb;
    var all = {};
    C.PHS_LEVELS.forEach(function (lv) {
      lv.nouns.forEach(function (n) { if (!all[n.w]) all[n.w] = n; });
    });
    $('pack-preview').innerHTML = PACK_SAMPLE_WORDS.map(function (w) {
      var n = all[w];
      if (!n) return '';
      return '<span class="pp-item">' + picInline(E.picFor(C, pack.id, n, customPics, picRotation.last)) +
        '<span class="pp-word">' + escapeHtml(w) + '</span></span>';
    }).join('') +
      (pack.deco ? '<span class="pp-item">' + pack.deco.star +
        '<span class="pp-word">tracker</span></span>' : '');
    syncPackCards();
  }

  /* ================= your own pictures ================= */

  /* Read a chosen image file, downscale it (max ~600px,
     JPEG on white) and hand back the data URL. */
  function fileToDataUrl(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 600;
        var scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
        var w = Math.max(1, Math.round((img.width || max) * scale));
        var h = Math.max(1, Math.round((img.height || max) * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* The word picker lists the current level's cumulative
     reading words (everything the books can picture). */
  function populateWordSelect() {
    var sel = $('cp-word');
    if (!sel) return;
    var keep = sel.value;
    var cum = C.phsCumulative(currentLevel().id);
    sel.innerHTML = cum.nouns.map(function (n) {
      /* an <option> cannot show an image: when the pack
         draws this word as a picture file, label it with
         the bank emoji instead of the raw file path */
      var p = E.picFor(C, currentPack().id, n);
      var label = (isDataUrl(p) || isAssetPath(p)) ? n.e : p;
      return '<option value="' + escapeAttr(n.w) + '">' +
        escapeHtml(label) + ' ' + escapeHtml(n.w) +
        (customPics[n.w] ? ' — your picture ✓' : '') + '</option>';
    }).join('');
    if (keep && cum.nouns.some(function (n) { return n.w === keep; })) sel.value = keep;
    updateWordPicChrome();
  }

  function updateWordPicChrome() {
    var word = $('cp-word').value;
    var has = !!customPics[word];
    var prev = $('cp-preview');
    prev.hidden = !has;
    if (has) prev.src = customPics[word];
    $('cp-remove').disabled = !has;
  }

  function refreshCustomLists() {
    var cpBox = $('cp-list');
    var words = Object.keys(customPics);
    cpBox.innerHTML = words.length ? '' : '<p class="hint">No words have your own picture yet.</p>';
    words.forEach(function (w) {
      var chip = document.createElement('span');
      chip.className = 'cp-chip';
      chip.innerHTML = '<img src="' + customPics[w] + '" alt=""> ' + escapeHtml(w);
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'cp-x'; x.textContent = '✕';
      x.title = 'Remove your picture for “' + w + '”';
      x.addEventListener('click', function () {
        delete customPics[w];
        $('cp-status').textContent = '“' + w + '” uses the normal picture again.';
        customsChanged();
      });
      chip.appendChild(x);
      cpBox.appendChild(chip);
    });
    var cwBox = $('cw-list');
    cwBox.innerHTML = customWords.length ? '' : '<p class="hint">No words added yet (up to 3).</p>';
    customWords.forEach(function (cw, idx) {
      var chip = document.createElement('span');
      chip.className = 'cp-chip';
      chip.innerHTML = '<img src="' + cw.img + '" alt=""> ' + escapeHtml(cw.w) +
        ' <span class="cp-meta">' + escapeHtml(cw.c) + ' · Level ' + cw.level + '</span>';
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'cp-x'; x.textContent = '✕';
      x.title = 'Remove your word “' + cw.w + '”';
      x.addEventListener('click', function () {
        customWords.splice(idx, 1);
        $('cw-status').textContent = '“' + cw.w + '” removed.';
        customsChanged();
      });
      chip.appendChild(x);
      cwBox.appendChild(chip);
    });
  }

  function customsChanged() {
    populateWordSelect();
    refreshCustomLists();
    updatePackChrome();
    markDirty();
  }

  function initCustomPictures() {
    /* category picker for own words: the groups the bank uses */
    var cats = [];
    C.PHS_LEVELS.forEach(function (lv) {
      lv.nouns.forEach(function (n) { if (cats.indexOf(n.c) === -1) cats.push(n.c); });
    });
    $('cw-cat').innerHTML = cats.map(function (c) {
      return '<option value="' + escapeAttr(c) + '">' + escapeHtml(c) + '</option>';
    }).join('');

    $('cp-word').addEventListener('change', updateWordPicChrome);
    $('cp-file').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      var word = $('cp-word').value;
      fileToDataUrl(file, function (url) {
        customPics[word] = url;
        $('cp-status').textContent = 'Done — “' + word + '” now uses your picture in every book.';
        customsChanged();
      });
    });
    $('cp-remove').addEventListener('click', function () {
      var word = $('cp-word').value;
      delete customPics[word];
      $('cp-status').textContent = '“' + word + '” uses the normal picture again.';
      customsChanged();
    });
    $('cw-file').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      fileToDataUrl(file, function (url) {
        pendingWordPic = url;
        var prev = $('cw-preview');
        prev.src = url;
        prev.hidden = false;
        $('cw-status').textContent = 'Picture ready — now press “Add word”.';
      });
    });
    $('cw-add').addEventListener('click', function () {
      var word = $('cw-word').value.trim().toLowerCase();
      if (customWords.length >= 3) {
        $('cw-status').textContent = 'You can add up to 3 of your own words. Remove one first.';
        return;
      }
      if (!pendingWordPic) {
        $('cw-status').textContent = 'Please upload a picture for the word first.';
        return;
      }
      if (customWords.some(function (cw) { return cw.w === word; })) {
        $('cw-status').textContent = '“' + word + '” is already one of your words.';
        return;
      }
      var levelId = currentLevel().id;
      var v = E.validateCustomWord(C, levelId, word);
      if (!v.ok) {
        $('cw-status').textContent =
          v.reason === 'letters' ? 'Please type one word, letters only (no spaces or numbers).' :
          v.reason === 'bank' ? '“' + word + '” is already in this level’s word bank — just give it your own picture above instead.' :
          '“' + word + '” doesn’t fit this level’s sounds yet — try a later level, or a word that only uses the sounds taught so far.';
        return;
      }
      customWords.push({ w: v.word, img: pendingWordPic, c: $('cw-cat').value, level: levelId });
      pendingWordPic = null;
      $('cw-preview').hidden = true;
      $('cw-word').value = '';
      $('cw-status').textContent = 'Added — “' + v.word + '” can now appear in this level’s books with your picture.';
      customsChanged();
    });
    populateWordSelect();
    refreshCustomLists();
  }

  function updateLevelChrome() {
    var lv = currentLevel();
    var cum = C.phsCumulative(lv.id);
    $('level-info').textContent = 'Sounds in this level: ' + lv.patterns + ' · ' + cum.nouns.length + ' reading words and ' +
      cum.verbs.length + ' action words to practise.';
    $('level-sight').textContent = 'Words to learn by heart so far (they can’t be sounded out): ' + cum.sight.join(' · ');
    $('seed-note').textContent = 'This book uses sentence mix #' + seedVariant + ' — press the button for a different mix of sentences.';
    syncLevelCards();
  }

  function renderActivities(preset) {
    var list = $('activities-list');
    list.innerHTML = '';
    C.PHS_ACTIVITIES.forEach(function (def) {
      var row = document.createElement('div');
      row.className = 'game-row';
      row.dataset.activity = def.id;
      var checked = preset && preset.selected ? preset.selected.indexOf(def.id) !== -1 : true;
      var count = preset && preset.counts && preset.counts[def.id] ? preset.counts[def.id] : DEFAULT_COUNTS[def.id];
      row.innerHTML =
        '<div class="game-head"><label class="check"><input type="checkbox" class="act-check" ' +
        (checked ? 'checked' : '') + '> ' + def.name + '</label>' +
        '<span class="count-field">How many <input type="number" class="act-count" min="0" max="60" value="' + count + '"></span></div>' +
        '<p class="game-blurb">' + def.blurb + '</p>';
      list.appendChild(row);
      function sync() { row.classList.toggle('on', row.querySelector('.act-check').checked); markDirty(); }
      row.querySelector('.act-check').addEventListener('change', sync);
      row.querySelector('.act-count').addEventListener('change', markDirty);
      row.classList.toggle('on', checked);
    });
  }

  function readBuildSettings() {
    var activities = [];
    document.querySelectorAll('#activities-list .game-row').forEach(function (row) {
      if (row.querySelector('.act-check').checked) {
        activities.push({
          id: row.dataset.activity,
          count: Math.max(0, parseInt(row.querySelector('.act-count').value, 10) || 0)
        });
      }
    });
    return {
      level: parseInt($('level-select').value, 10),
      title: $('in-title').value.trim() || 'My Reading Book',
      childName: $('in-child').value.trim(),
      pack: $('pack-select').value,
      theme: themeFilter,
      activities: activities,
      customText: $('custom-text').value,
      customPics: Object.assign({}, customPics),
      customWords: customWords.map(function (cw) {
        return { w: cw.w, img: cw.img, c: cw.c, level: cw.level };
      })
    };
  }

  function markDirty() {
    buildDirty = true;
    builtBook = null;
    currentPrint = null;
    $('print-btn').disabled = true;
    $('png-btn').disabled = true;
    if ($('m-print-btn')) { $('m-print-btn').disabled = true; $('m-png-btn').disabled = true; }
    if ($('lk-backpng-btn')) { $('lk-backpng-btn').disabled = true; $('lk-samplepng-btn').disabled = true; }
    scheduleAutosave();
  }

  function generateDraft(note) {
    var s = readBuildSettings();
    var seed = 'L' + s.level + '|' + s.title + '|' + s.childName + '|v' + seedVariant;
    /* rotate the pictures: this book uses a different
       picture than the last book for every word that has
       more than one. Under the Storybook pack the art
       SOURCE alternates at book level — this whole book is
       storybook watercolour, the next whole book is
       illustrated SVG art — so a single book never mixes
       the two styles; the per-word index still rotates
       which SVG variant a word gets. */
    var variantSel = E.nextVariantSelection(C, s.level, picRotation.last, picRotation.nonce);
    if (s.pack === 'storybook') {
      var sbMode = picRotation.sbNext === 'svg' ? 'svg' : 'storybook';
      variantSel.__src = sbMode;
      picRotation.sbNext = sbMode === 'storybook' ? 'svg' : 'storybook';
    }
    draft = E.buildBookData({
      level: s.level, title: s.title, childName: s.childName, seed: seed,
      pack: s.pack, themeCats: themeCatsForFilter(),
      activities: s.activities, customText: s.customText,
      customPics: s.customPics, customWords: s.customWords,
      picVariants: variantSel
    }, C);
    picRotation.last = variantSel;
    savePicRotation();
    buildDirty = false;
    renderEditor();
    updateThemeNote();
    if (note) $('editor-status').textContent = note;
    $('build-status').textContent = 'Your choices are ready: ' + draft.sections.reduce(function (a, x) { return a + x.items.length; }, 0) +
      ' activities picked. No book yet — press “Generate my book” to make the book.';
    updatePrintCheck();
    scheduleAutosave();
  }

  /* Honest theme feedback: if the chosen theme produced
     no themed target words at this level, say so plainly
     (the book then simply uses the full word bank). */
  function updateThemeNote() {
    var note = $('theme-note');
    if (!note) return;
    if (themeFilter === 'all' || !draft) { note.textContent = ''; return; }
    var cats = themeCatsForFilter();
    if (!cats) {
      note.textContent = 'The ' + themeById(themeFilter).name + ' theme has no words at this level yet — the book uses the full word bank.';
      return;
    }
    var themed = 0, total = 0;
    draft.sections.forEach(function (s) {
      s.items.forEach(function (it) {
        var w = it.type === 'circle' ? it.correct.w : (it.type === 'builder' ? it.answer : null);
        if (!w) return;
        total++;
        var noun = findNoun(w);
        if (noun && cats.indexOf(noun.c) !== -1) themed++;
      });
    });
    note.textContent = total && themed === 0
      ? 'This level ran out of ' + themeById(themeFilter).name.toLowerCase() + ' words, so this book uses the full word bank.'
      : 'Theme on: ' + themed + ' of ' + total + ' picture-strip answers are ' + themeById(themeFilter).name.toLowerCase() + ' words.';
  }

  /* ================= content editor ================= */

  /* Option labels are TEXT: the pack/emoji picture, never an
     image path or data URL (an <option> cannot show an
     image) — image pictures fall back to the bank emoji. */
  function picLabel(n) {
    var p = E.picFor(C, draft.pack, n, null, draft.picVariants);
    return (isDataUrl(p) || isAssetPath(p)) ? n.e : p;
  }
  function nounOptions(selectedWord) {
    var cum = C.phsCumulative(draft.level);
    var opts = cum.nouns.map(function (n) {
      return '<option value="' + escapeAttr(n.w) + '"' + (n.w === selectedWord ? ' selected' : '') + '>' +
        picLabel(n) + ' ' + escapeHtml(n.w) + '</option>';
    }).join('');
    (draft.customWords || []).forEach(function (cw) {
      if (cw.level > draft.level) return;
      if (cum.nouns.some(function (n) { return n.w === cw.w; })) return;
      opts += '<option value="' + escapeAttr(cw.w) + '"' + (cw.w === selectedWord ? ' selected' : '') + '>' +
        '🖼 ' + escapeHtml(cw.w) + ' (your word)</option>';
    });
    return opts;
  }
  function distractorOptions(cat, selectedWord, excludeWord, sentence) {
    var pool = categoryNouns(cat, draft.level).filter(function (n) {
      return n.w !== excludeWord;
    });
    return pool.map(function (n) {
      return '<option value="' + escapeAttr(n.w) + '"' + (n.w === selectedWord ? ' selected' : '') + '>' +
        picLabel(n) + ' ' + escapeHtml(n.w) + '</option>';
    }).join('');
  }

  function renderEditor() {
    var box = $('editor-list');
    box.innerHTML = '';
    if (!draft) { box.innerHTML = '<p class="hint">No draft yet.</p>'; return; }
    draft.sections.forEach(function (section, si) {
      var sec = document.createElement('div');
      sec.className = 'ed-section';
      sec.innerHTML = '<h3>' + escapeHtml(section.activity.name) + ' (' + section.items.length + ')</h3>';
      section.items.forEach(function (item, ii) {
        sec.appendChild(editorRow(section, item, si, ii));
      });
      box.appendChild(sec);
    });
  }

  function editorRow(section, item, si, ii) {
    var row = document.createElement('div');
    row.className = 'ed-item';
    var n = '<span class="ed-n">' + (ii + 1) + '.</span>';
    if (item.type === 'circle') {
      var others = item.options.filter(function (o) { return o.w !== item.correct.w; });
      var thumb = isDataUrl(item.correct.e)
        ? '<img class="ed-thumb" src="' + item.correct.e + '" alt="" title="Your own picture for “' + escapeAttr(item.correct.w) + '”">'
        : '';
      row.innerHTML = n +
        '<input type="text" class="ed-sentence" value="' + escapeAttr(item.sentence) + '">' +
        '<div class="ed-pics">' +
        '<label class="ed-pic">Correct picture ' + thumb + '<select class="ed-correct">' + nounOptions(item.correct.w) + '</select></label>' +
        '<label class="ed-pic">Spare picture 1 <select class="ed-d1">' + distractorOptions(itemCat(item), others[0] && others[0].w, item.correct.w, item.sentence) + '</select></label>' +
        '<label class="ed-pic">Spare picture 2 <select class="ed-d2">' + distractorOptions(itemCat(item), others[1] && others[1].w, item.correct.w, item.sentence) + '</select></label>' +
        '</div>';
      row.querySelector('.ed-sentence').addEventListener('change', function (ev) { item.sentence = ev.target.value; });
      row.querySelector('.ed-correct').addEventListener('change', function (ev) {
        var noun = findNoun(ev.target.value);
        if (!noun) return;
        item.correct = { w: noun.w, e: E.picFor(C, draft.pack, noun, draft.customPics, draft.picVariants) };
        /* refresh the two near-miss pickers for the new category */
        var ds = E.distractorsFor(C, draft.level, item.sentence, noun, E.makeRng(draft.id + item.sentence),
          { pack: draft.pack, customPics: draft.customPics, picVariants: draft.picVariants });
        var pool = categoryNouns(noun.c, draft.level);
        var d1 = ds[0] || pool.filter(function (x) { return x.w !== noun.w; })[0];
        var d2 = ds[1] || pool.filter(function (x) { return x.w !== noun.w && (!d1 || x.w !== d1.w); })[0];
        item.options = [item.correct,
          d1 ? { w: d1.w, e: E.picFor(C, draft.pack, d1, draft.customPics, draft.picVariants) } : item.correct,
          d2 ? { w: d2.w, e: E.picFor(C, draft.pack, d2, draft.customPics, draft.picVariants) } : item.correct];
        renderEditor();
      });
      row.querySelector('.ed-d1').addEventListener('change', function (ev) { setDistractor(item, 0, ev.target.value); });
      row.querySelector('.ed-d2').addEventListener('change', function (ev) { setDistractor(item, 1, ev.target.value); });
    } else if (item.type === 'builder') {
      var inSentence = E.nounsInSentence(C, draft.level, item.sentence);
      var ansOpts = inSentence.map(function (nn) {
        return '<option value="' + escapeAttr(nn.w) + '"' + (nn.w === item.answer ? ' selected' : '') + '>' +
          picLabel(nn) + ' ' + escapeHtml(nn.w) + '</option>';
      }).join('');
      row.innerHTML = n +
        '<input type="text" class="ed-sentence" value="' + escapeAttr(item.sentence) + '">' +
        '<div class="ed-pics"><label class="ed-pic">Missing word <select class="ed-answer">' + ansOpts + '</select></label></div>';
      row.querySelector('.ed-sentence').addEventListener('change', function (ev) {
        item.sentence = ev.target.value;
        renderEditor();
      });
      row.querySelector('.ed-answer').addEventListener('change', function (ev) { item.answer = ev.target.value; });
    } else if (item.type === 'draw' || item.type === 'trace') {
      row.innerHTML = n + '<input type="text" class="ed-sentence" value="' + escapeAttr(item.sentence) + '">';
      row.querySelector('.ed-sentence').addEventListener('change', function (ev) { item.sentence = ev.target.value; });
    } else if (item.type === 'comp') {
      var qHtml = item.questions.map(function (q, qi) {
        var opts = q.choices.map(function (c) {
          return '<option value="' + escapeAttr(c) + '"' + (c === q.answer ? ' selected' : '') + '>' + escapeHtml(c) + '</option>';
        }).join('');
        return '<div class="ed-pics"><label class="ed-pic" style="flex:2">Question ' + (qi + 1) +
          ' <input type="text" class="ed-q" data-q="' + qi + '" value="' + escapeAttr(q.q) + '"></label>' +
          '<label class="ed-pic">Answer <select class="ed-a" data-q="' + qi + '">' + opts + '</select></label></div>';
      }).join('');
      row.innerHTML = n + '<textarea class="ed-passage">' + escapeHtml(item.passage) + '</textarea>' + qHtml;
      row.querySelector('.ed-passage').addEventListener('change', function (ev) { item.passage = ev.target.value; });
      row.querySelectorAll('.ed-q').forEach(function (inp) {
        inp.addEventListener('change', function (ev) { item.questions[parseInt(inp.dataset.q, 10)].q = ev.target.value; });
      });
      row.querySelectorAll('.ed-a').forEach(function (sel) {
        sel.addEventListener('change', function (ev) { item.questions[parseInt(sel.dataset.q, 10)].answer = ev.target.value; });
      });
    } else if (item.type === 'seq') {
      var steps = item.correctOrder.map(function (st, sIdx) {
        return '<div class="ed-pics"><label class="ed-pic" style="flex:1">Step ' + (sIdx + 1) + ' ' + picInline(st.pic) +
          ' <input type="text" class="ed-step" data-s="' + sIdx + '" value="' + escapeAttr(st.s) + '"></label></div>';
      }).join('');
      row.innerHTML = n + '<b>' + escapeHtml(item.title) + '</b> (correct order)' + steps;
      row.querySelectorAll('.ed-step').forEach(function (inp) {
        inp.addEventListener('change', function (ev) {
          item.correctOrder[parseInt(inp.dataset.s, 10)].s = ev.target.value;
        });
      });
    }
    return row;
  }

  function itemCat(item) {
    var noun = findNoun(item.correct.w);
    return noun ? noun.c : 'animals';
  }
  function setDistractor(item, which, word) {
    var noun = findNoun(word);
    if (!noun) return;
    var others = item.options.filter(function (o) { return o.w !== item.correct.w; });
    others[which] = { w: noun.w, e: E.picFor(C, draft.pack, noun, draft.customPics, draft.picVariants) };
    item.options = [item.correct].concat(others);
  }

  /* Re-derive everything that depends on edited items, right
     before building: builder blanks/choices, sequence print
     order, circle correct-word repair, and the answer keys
     (from the printed rows). The logic lives in the engine
     (finalizeBookData) so the Series Builder finalises its
     books exactly the same way. */
  function prepareDraftForBuild() {
    E.finalizeBookData(C, draft);
  }

  /* ================= book tab ================= */

  function updateDesignChrome() {
    var d = D.phsDesignById($('design-select').value);
    $('design-blurb').textContent = d.blurb;
    $('design-swatches').innerHTML =
      '<span class="swatch" style="background:' + d.pageBg + '"></span>' +
      '<span class="swatch" style="background:' + d.headerBg + '"></span>' +
      '<span class="swatch" style="background:' + d.accent + '"></span>' +
      '<span class="swatch" style="background:' + d.cardBg + '"></span>';
    /* visual cover chooser: one card per design, mini
       preview in the design's own cover colours + motif */
    var cards = $('design-cards');
    cards.innerHTML = '';
    D.PHS_DESIGNS.forEach(function (des) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'design-card' + (des.id === d.id ? ' on' : '');
      card.innerHTML =
        '<span class="dc-preview" style="background:' + des.coverBg + '">' +
        '<span class="dc-band" style="background:' + des.bandBg + '"></span>' +
        '<span class="dc-hero">' + (des.hero || [des.motif]).join(' ') + '</span>' +
        '<span class="dc-cluster">' + des.cluster.join(' ') + '</span></span>' +
        '<span class="dc-name">' + escapeHtml(des.name) + '</span>';
      card.addEventListener('click', function () {
        $('design-select').value = des.id;
        updateDesignChrome();
      });
      cards.appendChild(card);
    });
  }

  function readBookOpts() {
    return {
      trim: $('trim-select').value,
      design: D.phsDesignById($('design-select').value),
      pack: currentPack(),
      cover: $('cover-on').checked,
      backCover: $('backcover-on').checked,
      inkSaver: $('inksaver-on').checked,
      bw: $('bw-on').checked,
      density: $('density-select').value,
      rowStyle: $('rowstyle-select').value,
      markStyle: $('markstyle-select').value,
      business: $('in-business').value || 'Songlap Deals'
    };
  }

  /* ---------- progress modal ---------- */

  var pmCancelled = false;
  function pmShow(title, step, pct, cancellable) {
    pmCancelled = false;
    $('progress-modal').hidden = false;
    $('pm-title').textContent = title;
    $('pm-step').textContent = step;
    $('pm-bar').style.width = pct + '%';
    $('pm-cancel').hidden = !cancellable;
  }
  function pmStep(step, pct) {
    $('pm-step').textContent = step;
    $('pm-bar').style.width = pct + '%';
  }
  function pmHide() { $('progress-modal').hidden = true; }
  function tick() { return new Promise(function (res) { setTimeout(res, 30); }); }
  /* Yield long enough for the browser to PAINT a frame.
     Used right after the progress modal is shown, so the
     buyer actually SEES it before the heavy synchronous
     build blocks the main thread — without this, a slow
     phone shows nothing at all and Generate looks dead. */
  function paintTick() {
    return new Promise(function (res) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () { setTimeout(res, 0); });
      } else { setTimeout(res, 30); }
    });
  }

  /* ---------- build ---------- */

  async function doBuild(silent) {
    if (!silent) pmShow('Generating your book…', 'Writing sentences…', 15, false);
    try {
      /* let the progress modal paint before any heavy
         synchronous work, so the press visibly does
         something even on a slow phone */
      await paintTick();
      /* ALWAYS build from the CURRENT selections: if the
         buyer changed the level, the activities or any
         other setting since the draft was made, remake the
         draft from those selections first (the same
         regeneration "Give me different sentences" does) —
         never silently rebuild the old book */
      if (!draft || buildDirty) generateDraft();
      await tick();
      prepareDraftForBuild();
      if (!silent) pmStep('Placing pictures…', 45);
      await tick();
      var opts = readBookOpts();
      $('wrap-style').textContent = '';
      var book = BK.buildBook(draft, opts);
      if (!silent) pmStep('Generating answer keys…', 75);
      await tick();
      $('book-style').textContent = BK.bookCss(opts.design, opts);
      builtBook = { book: book, opts: opts, design: opts.design };
      currentPrint = { html: book.html, css: BK.bookCss(opts.design, opts) };
      renderPreview(book.html, opts);
      $('print-btn').disabled = false;
      $('png-btn').disabled = false;
      $('m-print-btn').disabled = false;
      $('m-png-btn').disabled = false;
      $('lk-backpng-btn').disabled = false;
      $('lk-samplepng-btn').disabled = false;
      $('build-status').textContent = '✅ Your book is made: ' + book.pageCount + ' pages · ' +
        draft.sections.length + ' kinds of activities. Look through it below — then press Print / Save PDF.';
      $('wrap-pages').value = book.pageCount;
      updateWrapDims();
      updatePrintCheck();
      refreshListingKit();
      /* auto-save: the built book becomes a project AND the
         restore point, so a reload never loses it */
      autoSaveProject('Auto — ' + draft.title + ' — ' + new Date().toLocaleDateString());
      saveLastState();
    } finally {
      if (!silent) pmHide();
    }
  }

  /* After a restore (reload or project load) the saved
     state holds the draft but not the built book, which
     used to leave Print disabled until the buyer pressed
     Build again. Rebuild quietly instead — the build is
     deterministic (seeded from the draft), so the buyer
     gets the same book back and can print at once. */
  function rebuildAfterRestore() {
    if (!draft) return;
    doBuild(true).then(function () {
      if (builtBook && draft) {
        $('build-status').textContent = '✅ Your last book was restored and regenerated: ' +
          builtBook.book.pageCount + ' pages — ready to print below.';
      }
    }).catch(function () { /* the restored draft still works */ });
  }

  /* ---------- paginated preview ---------- */

  function renderPreview(html, opts) {
    var box = $('book-preview');
    box.innerHTML = '<div class="pv-viewport"><div class="pv-scale">' + html + '</div></div>';
    preview.pages = Array.prototype.slice.call(box.querySelectorAll('.bk-page'));
    /* pages render at their true print size (trim minus
       margins) and are then SCALED to fit — never reflowed */
    var T = BK.TRIMS[opts.trim] || BK.TRIMS.letter;
    var wmm = (T.wmm - 20) + 'mm';
    preview.pages.forEach(function (p) { p.style.width = wmm; });
    preview.page = 0;
    box.dataset.mode = $('pv-mode').value || 'single';
    $('pv-bar').hidden = false;
    applyPreview();
  }

  function applyPreview() {
    var box = $('book-preview');
    var mode = box.dataset.mode || 'single';
    var per = mode === 'spread' ? 2 : 1;
    preview.pages.forEach(function (p, i) {
      var on = mode === 'all' || (i >= preview.page && i < preview.page + per);
      p.classList.toggle('pv-on', on);
    });
    var total = preview.pages.length;
    $('pv-label').textContent = mode === 'all'
      ? 'All ' + total + ' pages'
      : 'Page ' + Math.min(preview.page + 1, total) + (mode === 'spread' && preview.page + 1 < total ? '–' + (preview.page + 2) : '') + ' of ' + total;
    $('pv-prev').disabled = preview.page <= 0;
    $('pv-next').disabled = preview.page + per >= total;
    layoutPreviewScale();
  }

  /* Scale the (true-size) pages to the chosen zoom / fit.
     The scale wrapper keeps the layout height honest by
     reserving scaled space around the transformed pages. */
  function layoutPreviewScale() {
    var box = $('book-preview');
    var scaleEl = box.querySelector('.pv-scale');
    var viewport = box.querySelector('.pv-viewport');
    if (!scaleEl || !viewport || !preview.pages.length) return;
    /* hidden panel (e.g. while a build runs on the Build tab):
       measuring now would stamp 0-size styles over the preview —
       keep the last good layout; switchTab re-fits on arrival */
    if (!viewport.clientWidth) return;
    scaleEl.style.transform = '';
    scaleEl.style.width = '';
    scaleEl.style.height = '';
    scaleEl.style.marginLeft = '';
    scaleEl.style.marginRight = '';
    scaleEl.style.marginBottom = '';
    var mode = box.dataset.mode || 'single';
    var per = mode === 'spread' ? 2 : 1;
    var visible = preview.pages.filter(function (p, i) {
      return mode === 'all' || (i >= preview.page && i < preview.page + per);
    });
    if (!visible.length) return;
    var naturalW = visible.reduce(function (a, p) { return a + p.offsetWidth; }, 0) + (mode === 'spread' ? 18 : 0);
    var naturalH = mode === 'all'
      ? visible.reduce(function (a, p) { return a + p.offsetHeight + 18; }, 0)
      : Math.max.apply(null, visible.map(function (p) { return p.offsetHeight; }));
    var zoomVal = $('pv-zoom').value;
    var avail = Math.max(200, viewport.clientWidth - 4);
    var s = zoomVal === 'fit' ? Math.min(1, avail / naturalW) : parseInt(zoomVal, 10) / 100;
    scaleEl.style.width = naturalW + 'px';
    scaleEl.style.height = naturalH + 'px';
    scaleEl.style.transform = 'scale(' + s + ')';
    scaleEl.style.marginBottom = (naturalH * (s - 1)) + 'px';
    scaleEl.style.marginRight = (naturalW * (s - 1)) + 'px';
    /* Centre the pages when the scaled footprint is narrower
       than the viewport; when it is wider, start flush at the
       left edge so the scrollable area covers every pixel.
       (Auto margins used to shove wide pages partly outside
       the reachable scroll area — the page looked clipped
       with no way to scroll to the cut-off part.) */
    var footprint = naturalW * s;
    scaleEl.style.marginLeft = footprint < avail
      ? Math.round((avail - footprint) / 2) + 'px' : '0px';
  }

  /* ---------- printing (hidden iframe) ---------- */

  /* Print through a throwaway hidden iframe. The MAIN
     document is never put into a print state: its styles,
     classes and content are not touched, so the studio
     stays fully clickable before, during and after the
     print dialog. (The previous same-tab flow swapped the
     main document's stylesheets, filled a print root in
     the page and relied on the window's 'afterprint' to
     put everything back; in a real browser that stranded
     buyers on dead tabs whenever the restore never ran.)
     The frame removes itself when its own 'afterprint'
     fires; a safety timer and the start of the next print
     also remove it, so repeated prints always work. */
  var printFrame = null;
  var printFrameTimer = null;

  function removePrintFrame() {
    if (printFrameTimer) { clearTimeout(printFrameTimer); printFrameTimer = null; }
    if (printFrame && printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
    printFrame = null;
  }

  function printDocument(html, cssText) {
    saveLastState();
    removePrintFrame(); /* a previous print can never linger */
    var frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', 'Print');
    /* NOT display:none — some browsers refuse to print a
       display:none frame. 1px, transparent, click-through,
       pinned to a corner: invisible and inert. */
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;' +
      'border:0;margin:0;padding:0;opacity:0;pointer-events:none;';
    document.body.appendChild(frame);
    printFrame = frame;
    var frameDoc = frame.contentDocument ||
      (frame.contentWindow && frame.contentWindow.document);
    if (!frameDoc) { removePrintFrame(); return; }
    frameDoc.open();
    frameDoc.write('<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<style>' + cssText + '\nhtml, body { margin: 0; padding: 0; background: #fff; }</style>' +
      '</head><body>' + html + '</body></html>');
    frameDoc.close();
    try {
      frame.contentWindow.addEventListener('afterprint', function () {
        setTimeout(removePrintFrame, 100);
      });
    } catch (e) { /* the safety timer still cleans up */ }
    printFrameTimer = setTimeout(removePrintFrame, 60000);
    waitForFrameImages(frame, 0);
  }

  /* Print only once the frame's pictures have loaded, so
     the printout never shows blank picture boxes; give up
     waiting after ~4s and print anyway. */
  function waitForFrameImages(frame, waited) {
    if (frame !== printFrame) return; /* a newer print took over */
    var doc = frame.contentDocument, pending = 0;
    if (doc && doc.images) {
      for (var i = 0; i < doc.images.length; i++) {
        if (!doc.images[i].complete) pending++;
      }
    }
    if (pending && waited < 4000) {
      setTimeout(function () { waitForFrameImages(frame, waited + 120); }, 120);
      return;
    }
    setTimeout(function () {
      if (frame !== printFrame) return;
      var cw = frame.contentWindow;
      if (!cw) return;
      try { cw.focus(); cw.print(); }
      catch (e) { /* dialog refused — the studio is unaffected */ }
    }, 150);
  }

  function doPrint() {
    if (!currentPrint) return;
    printDocument(currentPrint.html, currentPrint.css);
  }

  /* Front cover PNG, drawn on canvas (same approach as our
     other tools): 8.5in wide at 200dpi. */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrapLines(ctx, text, maxWidth) {
    var words = String(text).split(' ');
    var lines = [], line = '';
    words.forEach(function (word) {
      var test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }
  /* PNG export follows the same master cover template as
     the printed cover (series pill · corner level badge ·
     big title · subtitle · belongs-to ribbon · hero row ·
     brand footband). Canvas cannot reproduce the printed
     cover's layered gradients or the what's-inside card, so
     those two stay print-only. */
  function doPng() {
    if (!builtBook || !draft) return;
    var d = builtBook.design, opts = builtBook.opts;
    var W = 1700, H = opts.trim === '8.5x10' ? 2000 : 2200;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = d.pageBg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = d.cardBg;
    roundRect(ctx, 60, 60, W - 120, H - 120, 26); ctx.fill();
    ctx.strokeStyle = d.accent; ctx.lineWidth = 10;
    roundRect(ctx, 60, 60, W - 120, H - 120, 26); ctx.stroke();
    ctx.lineWidth = 3;
    roundRect(ctx, 85, 85, W - 170, H - 170, 20); ctx.stroke();
    ctx.textAlign = 'center';
    /* series pill */
    ctx.fillStyle = d.headerBg;
    var badge = 'EARLY READER SERIES';
    ctx.font = '600 38px Arial';
    var bw = ctx.measureText(badge).width + 100;
    roundRect(ctx, W / 2 - bw / 2, 140, bw, 80, 40); ctx.fill();
    ctx.fillStyle = d.headerText;
    ctx.fillText(badge, W / 2, 193);
    /* corner level badge */
    ctx.fillStyle = d.accent;
    roundRect(ctx, W - 500, 250, 380, 118, 20); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px ' + d.headerFont;
    ctx.fillText(draft.levelName, W - 310, 300);
    ctx.font = '30px Arial';
    ctx.fillText('AGES 4–7', W - 310, 345);
    /* title — the largest element */
    ctx.fillStyle = d.headerBg === '#ffffff' ? d.cellText : d.headerBg;
    ctx.font = 'bold 112px ' + d.headerFont;
    var lines = wrapLines(ctx, draft.title, W - 340);
    var y = 330;
    lines.forEach(function (ln) { ctx.fillText(ln, W / 2, y); y += 126; });
    ctx.font = '48px ' + d.cellFont;
    ctx.fillStyle = d.cellText;
    ctx.fillText(draft.patterns, W / 2, y + 6); y += 84;
    ctx.font = '600 54px ' + d.cellFont;
    ctx.fillStyle = d.accent;
    ctx.fillText('Phonics • Sounds • First Words', W / 2, y); y += 78;
    ctx.font = 'bold 40px ' + d.cellFont;
    ctx.fillText('✓ 100% DECODABLE · ✓ ANSWER KEYS INSIDE', W / 2, y); y += 96;
    /* belongs-to ribbon */
    var belongs = 'This book belongs to: ' + (draft.childName || '____________');
    ctx.font = '52px ' + d.cellFont;
    var rw = ctx.measureText(belongs).width + 110;
    ctx.fillStyle = d.accent;
    roundRect(ctx, W / 2 - rw / 2, y - 58, rw, 92, 46); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(belongs, W / 2, y + 6); y += 130;
    /* hero stage: soft ground ellipse + the design's hero row */
    ctx.fillStyle = d.accent;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.ellipse(W / 2, y + 210, 560, 190, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var hero = (d.hero && d.hero.length ? d.hero : [d.motif || '📚']);
    ctx.font = '190px "Segoe UI Emoji", sans-serif';
    ctx.fillText(hero[0], W / 2, y + 240);
    if (hero.length > 1) {
      ctx.font = '120px "Segoe UI Emoji", sans-serif';
      ctx.fillText(hero.slice(1).join('  '), W / 2, y + 400);
    }
    /* brand footband */
    ctx.fillStyle = d.headerBg;
    roundRect(ctx, 150, H - 330, W - 300, 118, 18); ctx.fill();
    ctx.fillStyle = d.headerText;
    ctx.font = '42px ' + d.cellFont;
    ctx.fillText((d.tagline || 'Read · Circle · Grow') + ' — PhonicsStrip Studio Pro', W / 2, H - 256);
    ctx.fillStyle = d.cellText;
    ctx.font = '40px ' + d.cellFont;
    ctx.fillText(opts.business || 'Songlap Deals', W / 2, H - 140);
    canvas.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'phonicsstrip-front-cover-' + draft.id + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }, 'image/png');
  }

  /* ================= visual card selectors ================= */

  function renderLevelCards() {
    var box = $('level-cards');
    if (!box) return;
    box.innerHTML = '';
    C.PHS_LEVELS.forEach(function (lv) {
      var cum = C.phsCumulative(lv.id);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card' + (lv.id === currentLevel().id ? ' on' : '');
      card.dataset.level = lv.id;
      var short = lv.name.indexOf('·') !== -1 ? lv.name.split('·')[1].trim() : lv.name;
      card.innerHTML = '<span class="lc-num">Level ' + lv.id + '</span>' +
        '<span class="lc-name">' + escapeHtml(short) + '</span>' +
        '<span class="lc-pat">' + escapeHtml(lv.patterns) + '</span>' +
        '<span class="lc-count">' + cum.nouns.length + ' reading words</span>';
      card.addEventListener('click', function () {
        $('level-select').value = lv.id;
        updateLevelChrome();
        populateWordSelect();
        renderThemeChips();
        markDirty();
      });
      box.appendChild(card);
    });
  }
  function syncLevelCards() {
    var box = $('level-cards');
    if (!box) return;
    var cur = $('level-select').value;
    box.querySelectorAll('.level-card').forEach(function (card) {
      card.classList.toggle('on', card.dataset.level === String(cur));
    });
  }

  function renderPackCards() {
    var box = $('pack-cards');
    if (!box) return;
    box.innerHTML = '';
    var all = {};
    C.PHS_LEVELS.forEach(function (lv) {
      lv.nouns.forEach(function (n) { if (!all[n.w]) all[n.w] = n; });
    });
    C.PHS_PICTURE_PACKS.forEach(function (pack) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'pack-card' + (pack.id === currentPack().id ? ' on' : '');
      card.dataset.pack = pack.id;
      var pics = ['cat', 'dog', 'fish'].map(function (w) {
        var n = all[w];
        if (!n) return '';
        var p = E.picFor(C, pack.id, n, customPics, picRotation.last);
        return (isDataUrl(p) || isAssetPath(p))
          ? '<img src="' + p + '" alt="">'
          : '<span class="pc-emoji">' + escapeHtml(p) + '</span>';
      }).join('');
      card.innerHTML = '<span class="pc-pics">' + pics + '</span>' +
        '<span class="pc-name">' + escapeHtml(pack.name) + '</span>';
      card.addEventListener('click', function () {
        $('pack-select').value = pack.id;
        updatePackChrome();
        markDirty();
      });
      box.appendChild(card);
    });
  }
  function syncPackCards() {
    var box = $('pack-cards');
    if (!box) return;
    var cur = $('pack-select').value;
    box.querySelectorAll('.pack-card').forEach(function (card) {
      card.classList.toggle('on', card.dataset.pack === cur);
    });
  }

  /* ================= word-theme chips ================= */

  function renderThemeChips() {
    var box = $('theme-chips');
    if (!box) return;
    box.innerHTML = '';
    var cum = C.phsCumulative(currentLevel().id);
    var present = {};
    cum.nouns.forEach(function (n) { present[n.c] = true; });
    THEMES.forEach(function (t) {
      if (t.cats && !t.cats.some(function (c) { return present[c]; })) return;
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'theme-chip' + (themeFilter === t.id ? ' on' : '');
      chip.textContent = t.name;
      chip.addEventListener('click', function () {
        themeFilter = t.id;
        renderThemeChips();
        markDirty();
      });
      box.appendChild(chip);
    });
  }

  /* ================= collapsible panels ================= */

  function initCollapsibles() {
    document.querySelectorAll('.panel[data-collapsible]').forEach(function (panel) {
      var h2 = panel.querySelector('h2');
      if (!h2 || panel.querySelector('.panel-head')) return;
      var head = document.createElement('div');
      head.className = 'panel-head';
      h2.parentNode.insertBefore(head, h2);
      head.appendChild(h2);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'panel-toggle';
      btn.setAttribute('aria-label', 'Collapse or expand this section');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
      btn.addEventListener('click', function () {
        panel.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded', panel.classList.contains('collapsed') ? 'false' : 'true');
      });
      head.appendChild(btn);
      /* Advanced / pro panels start CLOSED, so a first-time
         buyer sees only the simple path; one tap opens them
         and every control inside works exactly as before. */
      if (panel.hasAttribute('data-start-closed')) {
        panel.classList.add('collapsed');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  /* Sub-panel disclosures (e.g. the Advanced options box
     inside the design panel): a labelled button that shows
     or hides the box's body. Starts closed. */
  function initSubDisclosures() {
    document.querySelectorAll('[data-collapsible-sub]').forEach(function (box) {
      var btn = box.querySelector('.adv-toggle');
      var body = box.querySelector('.adv-body');
      if (!btn || !body) return;
      btn.addEventListener('click', function () {
        var open = body.hidden;
        body.hidden = !open;
        box.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  /* One-click quick book: apply the proven defaults —
     Level 1, every activity ticked at its standard count,
     the Storybook picture style, the standard US Letter
     size — then generate. Nothing is locked in: the buyer
     can change anything afterwards and generate again. */
  async function quickBook() {
    $('level-select').value = '1';
    seedVariant = 1;
    themeFilter = 'all';
    $('pack-select').value = 'storybook';
    if (!$('in-title').value.trim()) $('in-title').value = 'My First Reading Book';
    renderActivities(null);
    renderThemeChips();
    updateLevelChrome();
    populateWordSelect();
    updatePackChrome();
    $('trim-select').value = 'letter';
    markDirty();
    /* show the progress modal and let it PAINT before the
       heavy draft generation starts, so the press has
       visible feedback even on a slow phone */
    pmShow('Generating your book…', 'Writing sentences…', 15, false);
    await paintTick();
    generateDraft();
    switchTab('book');
    doBuild();
  }

  /* ================= series builder ================= */

  function buildSeriesChips() {
    var box = $('series-levels');
    if (!box) return;
    box.innerHTML = '';
    C.PHS_LEVELS.forEach(function (lv) {
      var lab = document.createElement('label');
      lab.className = 'series-level' + (lv.id <= 3 ? ' on' : '');
      var short = lv.name.indexOf('·') !== -1 ? lv.name.split('·')[1].trim() : lv.name;
      lab.innerHTML = '<input type="checkbox" value="' + lv.id + '"' + (lv.id <= 3 ? ' checked' : '') + '> L' + lv.id + ' · ' + escapeHtml(short);
      lab.querySelector('input').addEventListener('change', function (ev) {
        var checked = box.querySelectorAll('input:checked');
        if (checked.length > 8) { ev.target.checked = false; return; }
        lab.classList.toggle('on', ev.target.checked);
      });
      box.appendChild(lab);
    });
  }

  function saveSeriesProject(data, design) {
    var st = readState();
    st.level = data.level;
    st.title = data.title;
    st.childName = data.childName;
    st.pack = data.pack;
    st.designId = design.id;
    st.draft = data;
    var list = loadProjects();
    list.unshift({
      name: 'Series — L' + data.level + ' — ' + data.title,
      savedAt: new Date().toLocaleString(), state: st
    });
    saveProjects(list.slice(0, 24));
    renderProjects();
  }

  async function buildSeries() {
    var levels = Array.prototype.slice.call(
      document.querySelectorAll('#series-levels input:checked'))
      .map(function (i) { return parseInt(i.value, 10); }).sort(function (a, b) { return a - b; });
    if (!levels.length) {
      $('series-status').textContent = 'Tick at least one level above, then generate the series.';
      return;
    }
    var base = readBuildSettings();
    var seriesTitle = $('series-title').value.trim() || 'My First Reading Series';
    var designs = D.PHS_DESIGNS;
    var startIdx = 0;
    designs.forEach(function (d, i) { if (d.id === $('design-select').value) startIdx = i; });
    var baseOpts = readBookOpts();
    var localSel = E.nextVariantSelection(C, 8, picRotation.last, picRotation.nonce);
    pmShow('Generating your series…', 'Starting…', 4, true);
    /* let the modal paint before the first book's heavy
       synchronous generation blocks the main thread */
    await paintTick();
    var booksMeta = [], parts = [], scoped = [], firstOpts = null, firstDesign = null;
    var totalPages = 1; /* the contents page */
    try {
      for (var k = 0; k < levels.length; k++) {
        if (pmCancelled) {
          $('series-status').textContent = 'Series build cancelled — no series was made.';
          return;
        }
        var levelId = levels[k];
        pmStep('Generating Book ' + (k + 1) + ' of ' + levels.length + ' — Level ' + levelId + '…',
          Math.round(5 + (k / levels.length) * 85));
        await tick();
        var data = E.buildBookData({
          level: levelId, title: base.title, childName: base.childName,
          seed: 'series|L' + levelId + '|' + base.title + '|' + base.childName + '|v' + seedVariant,
          pack: base.pack, themeCats: themeCatsForFilter(levelId),
          activities: base.activities, customText: '',
          customPics: base.customPics, customWords: base.customWords,
          picVariants: localSel
        }, C);
        E.finalizeBookData(C, data);
        var design = designs[(startIdx + k) % designs.length];
        var opts = Object.assign({}, baseOpts, {
          design: design, seriesIndex: k + 1, seriesTotal: levels.length
        });
        if (!firstOpts) { firstOpts = opts; firstDesign = design; }
        var built = BK.buildBook(data, opts);
        booksMeta.push({ n: k + 1, levelName: data.levelName, designName: design.name, pages: built.pageCount });
        parts.push('<div class="series-scope-' + (k + 1) + '">' + built.html + '</div>');
        scoped.push(BK.scopeCss(BK.bookCss(design, opts), '.series-scope-' + (k + 1)));
        totalPages += built.pageCount;
        saveSeriesProject(data, design);
      }
      pmStep('Joining the books…', 95);
      await tick();
      var firstCss = BK.bookCss(firstDesign, firstOpts);
      var pageRule = (firstCss.match(/@page\s*{[^}]*}/) || [''])[0];
      var contents = '<div class="series-scope-1">' +
        BK.seriesContentsPage(seriesTitle, booksMeta, base.childName, baseOpts.business) + '</div>';
      var css = pageRule + '\n' + scoped.join('\n');
      var html = contents + '\n' + parts.join('\n');
      seriesDoc = { html: html, css: css, pageCount: totalPages, title: seriesTitle };
      currentPrint = { html: html, css: css };
      $('book-style').textContent = css;
      $('wrap-style').textContent = '';
      renderPreview(html, firstOpts);
      $('series-print-btn').disabled = false;
      $('series-status').textContent = '✅ Your series is made: ' + levels.length + ' books · ' + totalPages +
        ' pages in one file (contents page first). Look through it above — “Print series / Save PDF” saves the whole set. ' +
        'Each book was also saved on its own in My Books.';
      saveLastState();
    } finally {
      pmHide();
    }
  }

  /* ================= listing kit ================= */

  function refreshListingKit() {
    if (!builtBook || !draft) return;
    var T = BK.TRIMS[builtBook.opts.trim] || BK.TRIMS.letter;
    var kit = BK.listingKitFor(draft, {
      pageCount: builtBook.book.pageCount, trimLabel: T.label, business: builtBook.opts.business
    });
    $('lk-kdp-title').value = kit.kdpTitle;
    $('lk-kdp-subtitle').value = kit.kdpSubtitle;
    $('lk-kdp-desc').value = kit.kdpDescription;
    $('lk-keywords').value = kit.keywords.join('\n');
    $('lk-etsy-title').value = kit.etsyTitle;
    $('lk-etsy-desc').value = kit.etsyDescription + '\n\nInside the book:\n' +
      kit.bullets.map(function (b) { return '• ' + b; }).join('\n');
    $('lk-note').textContent = 'Written from this book’s real facts: ' + kit.pageCount + ' pages · ' +
      kit.totalItems + ' activities · ' + draft.levelName + ' · design ' + builtBook.design.name + '.';
  }

  function copyListingText(id, btn) {
    var el = $(id);
    if (!el || !el.value) return;
    function done() {
      var old = btn.textContent;
      btn.textContent = 'Copied ✓';
      setTimeout(function () { btn.textContent = old; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(el.value).then(done).catch(function () {
        el.select(); document.execCommand('copy'); done();
      });
    } else {
      el.select(); document.execCommand('copy'); done();
    }
  }

  function downloadCanvas(canvas, filename) {
    canvas.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }, 'image/png');
  }

  /* Back cover PNG: a canvas rendering of the back cover's
     facts (what's inside, the 8-level staircase with this
     level lit, barcode box with the book ID) in the built
     book's design colours — for marketplace listing images. */
  function doBackPng() {
    if (!builtBook || !draft) return;
    var d = builtBook.design, opts = builtBook.opts;
    var W = 1700, H = opts.trim === '8.5x10' ? 2000 : 2200;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = d.pageBg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = d.cardBg;
    roundRect(ctx, 70, 70, W - 140, H - 140, 26); ctx.fill();
    ctx.strokeStyle = d.accent; ctx.lineWidth = 8;
    roundRect(ctx, 70, 70, W - 140, H - 140, 26); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = d.headerBg;
    ctx.font = 'bold 74px ' + d.headerFont;
    /* per-level back-cover words (the built book's blurb) —
       no beginner wording on advanced books */
    var blurb = draft.blurb || { head: 'A gentle first step into reading', body: '' };
    wrapLines(ctx, blurb.head, W - 360).forEach(function (ln, i) {
      ctx.fillText(ln, W / 2, 250 + i * 86);
    });
    ctx.font = '42px ' + d.cellFont;
    ctx.fillStyle = d.cellText;
    var y = 470;
    var blurbText = String(blurb.body || '').replace(/<[^>]+>/g, '');
    blurbText = blurbText.charAt(0).toUpperCase() + blurbText.slice(1);
    wrapLines(ctx, blurbText, W - 380)
      .forEach(function (ln) { ctx.fillText(ln, W / 2, y); y += 56; });
    y += 30;
    ctx.font = 'bold 50px ' + d.headerFont;
    ctx.fillStyle = d.headerBg;
    ctx.fillText('What’s inside this book', W / 2, y); y += 70;
    ctx.font = '42px ' + d.cellFont;
    ctx.fillStyle = d.cellText;
    ctx.textAlign = 'left';
    draft.sections.forEach(function (s) {
      ctx.fillText('✓  ' + s.activity.name + ' — ' + s.items.length + (s.items.length === 1 ? ' activity' : ' activities'), 300, y);
      y += 58;
    });
    ctx.textAlign = 'center';
    y += 36;
    ctx.font = 'bold 50px ' + d.headerFont;
    ctx.fillStyle = d.headerBg;
    ctx.fillText('Collect all 8 levels', W / 2, y); y += 40;
    /* staircase */
    var sw = 150, gap = 18, totalW = 8 * sw + 7 * gap, x0 = (W - totalW) / 2, baseY = y + 300;
    for (var i = 0; i < 8; i++) {
      var hgt = 60 + i * 34, x = x0 + i * (sw + gap), cur = (i + 1) === draft.level;
      ctx.fillStyle = cur ? d.headerBg : d.cellBg;
      roundRect(ctx, x, baseY - hgt, sw, hgt, 10); ctx.fill();
      ctx.strokeStyle = d.headerBg; ctx.lineWidth = 4;
      roundRect(ctx, x, baseY - hgt, sw, hgt, 10); ctx.stroke();
      ctx.fillStyle = cur ? d.headerText : d.headerBg;
      ctx.font = 'bold 40px ' + d.cellFont;
      ctx.fillText('L' + (i + 1), x + sw / 2, baseY - 16);
    }
    y = baseY + 90;
    ctx.font = '46px ' + d.headerFont;
    ctx.fillStyle = d.headerBg;
    ctx.fillText('★ Finish this book to earn the Super Reader Certificate inside!', W / 2, y); y += 80;
    ctx.font = '44px ' + d.cellFont;
    ctx.fillText('Happy reading!', W / 2, y); y += 90;
    /* barcode box */
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, W / 2 - 300, y, 600, 300, 8); ctx.fill();
    ctx.strokeStyle = '#999999'; ctx.lineWidth = 3;
    roundRect(ctx, W / 2 - 300, y, 600, 300, 8); ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    var seedStr = String(draft.id || 'PHONICS'), bx = W / 2 - 240;
    for (var b = 0; b < 34; b++) {
      var code = seedStr.charCodeAt(b % seedStr.length) + b * 7;
      var bw2 = [5, 9, 14][code % 3];
      ctx.fillRect(bx, y + 50, bw2, 150);
      bx += bw2 + 6;
    }
    ctx.font = '34px ' + d.cellFont;
    ctx.fillText(draft.id, W / 2, y + 258);
    ctx.fillStyle = d.cellText;
    ctx.font = '38px ' + d.cellFont;
    ctx.fillText(opts.business || 'Songlap Deals', W / 2, H - 130);
    downloadCanvas(canvas, 'phonicsstrip-back-cover-' + draft.id + '.png');
  }

  /* Sample page PNG: the first activity page of the built
     book, drawn on canvas at print size (header band +
     strips with their real sentences and pictures) — a
     listing image a seller can upload as-is. */
  function doSamplePng() {
    if (!builtBook || !draft || !draft.sections.length) return;
    var section = draft.sections[0];
    /* page 1 of the first section, exactly as it prints */
    var entryPages = BK.paginateItems(section.items,
      function (it) {
        return section.activity.id === 'custom'
          ? (it.type === 'draw' ? 2 : BK.capacityFor('custom', builtBook.opts.density))
          : BK.capacityFor(section.activity.id, builtBook.opts.density);
      },
      function (it) { return section.activity.id === 'custom' ? it.type : section.activity.id; });
    var pageItems = (entryPages[0] || []).map(function (x) { return x.it; });
    if (!pageItems.length) return;
    var d = builtBook.design, opts = builtBook.opts;
    var W = 1700, H = opts.trim === '8.5x10' ? 2000 : 2200;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    /* header band */
    ctx.fillStyle = d.headerBg;
    roundRect(ctx, 60, 60, W - 120, 170, 24); ctx.fill();
    ctx.fillStyle = d.headerText;
    ctx.font = 'bold 62px ' + d.headerFont;
    ctx.textAlign = 'left';
    ctx.fillText(section.activity.name, 110, 168);
    /* load any image pictures first, then draw */
    var urls = {};
    pageItems.forEach(function (it) {
      if (it.type === 'circle') it.options.forEach(function (o) {
        if (isDataUrl(o.e) || isAssetPath(o.e)) urls[o.e] = true;
      });
      if (it.type === 'builder' && (isDataUrl(it.pic.e) || isAssetPath(it.pic.e))) urls[it.pic.e] = true;
    });
    var loaded = {};
    var pending = Object.keys(urls).map(function (u) {
      return new Promise(function (res2) {
        var img = new Image();
        img.onload = function () { loaded[u] = img; res2(); };
        img.onerror = function () { res2(); };
        img.src = u;
      });
    });
    Promise.all(pending).then(function () {
      var y = 300;
      function drawPic(e, cx, cy, size) {
        if (loaded[e]) {
          var img = loaded[e];
          var sc = Math.min(size / img.width, size / img.height);
          ctx.drawImage(img, cx - (img.width * sc) / 2, cy - (img.height * sc) / 2, img.width * sc, img.height * sc);
        } else if (isDataUrl(e) || isAssetPath(e)) {
          /* image failed to load — fall back to no glyph */
        } else {
          ctx.font = size + 'px "Segoe UI Emoji", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(e, cx, cy + size * 0.36);
        }
      }
      pageItems.forEach(function (it, idx) {
        if (it.type === 'circle') {
          ctx.strokeStyle = d.cellBorder; ctx.lineWidth = 5;
          roundRect(ctx, 60, y, W - 120, 330, 20); ctx.stroke();
          ctx.fillStyle = d.accent;
          ctx.font = 'bold 52px ' + d.cellFont;
          ctx.textAlign = 'left';
          ctx.fillText((idx + 1) + '.', 100, y + 84);
          ctx.fillStyle = d.cellText;
          ctx.font = '54px ' + d.cellFont;
          wrapLines(ctx, it.sentence, W - 320).forEach(function (ln, li) {
            ctx.fillText(ln, 210, y + 84 + li * 66);
          });
          var bw3 = (W - 240) / 3;
          it.options.forEach(function (o, oi) {
            var cx = 120 + bw3 * oi + bw3 / 2;
            ctx.strokeStyle = d.cellBorder; ctx.lineWidth = 4;
            roundRect(ctx, 120 + bw3 * oi + 10, y + 150, bw3 - 20, 160, 16); ctx.stroke();
            drawPic(o.e, cx, y + 232, 110);
          });
          y += 360;
        } else if (it.type === 'builder') {
          ctx.strokeStyle = d.cellBorder; ctx.lineWidth = 5;
          roundRect(ctx, 60, y, W - 120, 330, 20); ctx.stroke();
          drawPic(it.pic.e, 190, y + 165, 130);
          ctx.fillStyle = d.accent;
          ctx.font = 'bold 52px ' + d.cellFont;
          ctx.textAlign = 'left';
          ctx.fillText((idx + 1) + '.', 330, y + 100);
          ctx.fillStyle = d.cellText;
          ctx.font = '54px ' + d.cellFont;
          wrapLines(ctx, it.blanked, W - 560).forEach(function (ln, li) {
            ctx.fillText(ln, 430, y + 100 + li * 66);
          });
          ctx.font = '46px ' + d.cellFont;
          ctx.fillText(it.choices.join('      '), 330, y + 268);
          y += 360;
        } else {
          ctx.fillStyle = d.cellText;
          ctx.font = '52px ' + d.cellFont;
          ctx.textAlign = 'left';
          wrapLines(ctx, (idx + 1) + '. ' + (it.sentence || it.passage || ''), W - 200)
            .forEach(function (ln, li) { ctx.fillText(ln, 100, y + 70 + li * 64); });
          y += 200;
        }
      });
      ctx.fillStyle = d.cellText;
      ctx.font = '36px ' + d.cellFont;
      ctx.textAlign = 'left';
      ctx.fillText(opts.business || 'Songlap Deals', 60, H - 60);
      ctx.textAlign = 'right';
      ctx.fillText(draft.id + ' · ' + draft.levelName, W - 60, H - 60);
      downloadCanvas(canvas, 'phonicsstrip-sample-page-' + draft.id + '.png');
    });
  }

  /* ================= wrap cover ================= */

  function updateWrapDims() {
    var pages = Math.max(1, parseInt($('wrap-pages').value, 10) || 80);
    var dims = BK.wrapCoverDims(pages, $('wrap-paper').value, $('wrap-trim').value);
    $('wrap-dims').textContent = 'Folded edge (spine) width: ' + dims.spineIn.toFixed(3) + ' in · Whole cover size: ' +
      dims.totalWidthIn.toFixed(3) + ' in × ' + dims.totalHeightIn.toFixed(2) +
      ' in — including the 0.125 in extra edge (bleed) that KDP asks for on every side.';
    wrapCheck();
    return dims;
  }

  /* KDP paperbacks need at least 24 interior pages. Say so
     in plain words, right where the buyer is working —
     never a silent dead-end (the old builder simply did
     nothing under 24 pages, and its stylesheet used to
     break the whole studio layout). Returns true when the
     count is usable. */
  function wrapCheck() {
    var pages = parseInt($('wrap-pages').value, 10);
    var msg = $('wrap-msg');
    if (!isFinite(pages) || pages < 1) {
      msg.textContent = 'Please type your book’s page count (a whole number).';
      msg.classList.remove('info');
      msg.hidden = false;
      return false;
    }
    if (pages < 24) {
      msg.textContent = 'Amazon KDP paperbacks need at least 24 pages inside — this count is ' + pages +
        '. Make a bigger book first (add more activities, or raise the “How many” numbers on the Build tab), ' +
        'then come back here: this page count updates by itself.';
      msg.classList.remove('info');
      msg.hidden = false;
      return false;
    }
    msg.textContent = 'Good — ' + pages + ' pages is enough for a KDP paperback (24 or more). Press “Preview the cover” when you are ready.';
    msg.classList.add('info');
    msg.hidden = false;
    return true;
  }

  function wrapMeta() {
    var inside = draft ? draft.sections.map(function (s) { return s.activity.name + ' (' + s.items.length + ')'; })
      : ['Read & Circle', 'Read & Draw', 'Picture Comprehension', 'Trace the Sentence', 'Story Sequencing', 'Sentence Builder'];
    return {
      title: $('wrap-title').value || 'My Reading Book',
      subtitle: $('wrap-subtitle').value,
      author: $('wrap-author').value || 'Songlap Deals',
      level: draft ? draft.level : 1,
      levelLine: draft ? draft.levelName : 'Level 1 · Short A',
      insideList: inside,
      blurb: 'Every sentence in this book is 100% decodable: only this level’s sounds plus the focus words. The three pictures on each strip come from the same group, so young readers read the words — not guess.'
    };
  }

  function doWrapPreview() {
    if (!wrapCheck()) {
      $('wrap-preview').innerHTML = '';
      wrapBuilt = null;
      $('wrap-print-btn').disabled = true;
      $('wrap-msg').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    var dims = updateWrapDims();
    var design = D.phsDesignById($('design-select').value);
    var meta = wrapMeta();
    var pack = currentPack();
    $('wrap-style').textContent = BK.wrapCoverCss(design, dims);
    $('wrap-preview').innerHTML = BK.wrapCoverHtml(meta, design, dims, pack);
    wrapBuilt = { meta: meta, design: design, dims: dims, pack: pack };
    $('wrap-print-btn').disabled = false;
  }

  function doWrapPrint() {
    if (!wrapBuilt) return;
    printDocument(
      BK.wrapCoverHtml(wrapBuilt.meta, wrapBuilt.design, wrapBuilt.dims, wrapBuilt.pack),
      BK.wrapCoverCss(wrapBuilt.design, wrapBuilt.dims));
  }

  /* ================= print check ================= */

  /* The live Print-Check panel: page count vs the KDP
     24-page minimum, trim/paper/spine summary, the
     sentence-supply meter, and any shortfall where a level
     ran out of unique sentences for an activity. */
  function updatePrintCheck() {
    var body = $('pc-body');
    if (!body) return;
    if (!draft) { body.innerHTML = '<p class="hint">Your checks appear here once the book’s pages are ready.</p>'; return; }
    var opts = readBookOpts();
    var pages = builtBook ? builtBook.book.pageCount : BK.estimatePageCount(draft, opts);
    var est = !builtBook;
    var paper = $('wrap-paper').value;
    var dims = BK.wrapCoverDims(pages, paper, opts.trim === '8.5x10' ? '8.5x10' : '8.5x11');
    var rows = '';
    rows += '<div class="pc-row ' + (pages >= 24 ? 'pc-ok' : 'pc-warn') + '"><span class="pc-ic">' +
      (pages >= 24 ? '✓' : '!') + '</span><span><b>' + pages + ' pages</b>' + (est ? ' (a close guess — press Generate for the exact count)' : '') +
      (pages >= 24
        ? ' — enough for an Amazon KDP paperback (24 pages or more).'
        : ' — Amazon KDP paperbacks need at least 24 pages. Add ' + (24 - pages) + ' more pages: raise the “How many” numbers on the Build tab.') +
      '</span></div>';
    var T = BK.TRIMS[opts.trim] || BK.TRIMS.letter;
    rows += '<div class="pc-row pc-info"><span class="pc-ic">i</span><span>Page size <b>' + T.label + '</b> · KDP cover paper: <b>' +
      (paper === 'cream' ? 'Cream' : 'White') + '</b> · the book’s folded edge (spine) would be <b>' + dims.spineIn.toFixed(2) + ' in</b> wide · whole cover ' +
      dims.totalWidthIn.toFixed(2) + ' × ' + dims.totalHeightIn.toFixed(2) + ' in.</span></div>';
    /* sentence supply: unique sentences used vs the level's
       unique-sentence space (templates × target nouns is a
       fair proxy for the pair space the engine draws from) */
    var cum = C.phsCumulative(draft.level);
    var usedKeys = {};
    var usedCount = 0;
    draft.sections.forEach(function (s) {
      s.items.forEach(function (it) {
        if (it.sentence) {
          var k = E.normalizeSentenceKey(it.sentence);
          if (!usedKeys[k]) { usedKeys[k] = true; usedCount++; }
        }
      });
    });
    var pairSpace = cum.templates.length * Math.max(1, cum.nouns.length);
    var pct = Math.min(100, Math.round(100 * usedCount / Math.max(1, pairSpace)));
    rows += '<div class="pc-row pc-info"><span class="pc-ic">i</span><span style="flex:1">This book uses <b>' + usedCount +
      ' different sentences</b> — none of them repeats. They are built from ' + cum.nouns.length + ' reading words and ' +
      cum.templates.length + ' sentence patterns at this level.' +
      '<span class="pc-meter"><i style="width:' + pct + '%"></i></span></span></div>';
    /* shortfalls: an activity that delivered fewer items
       than requested means the level's supply ran dry */
    var settings = readBuildSettings();
    settings.activities.forEach(function (a) {
      var sec = null;
      draft.sections.forEach(function (s) { if (s.activity.id === a.id) sec = s; });
      var got = sec ? sec.items.length : 0;
      if (got < a.count) {
        rows += '<div class="pc-row pc-warn"><span class="pc-ic">!</span><span><b>' +
          escapeHtml(C.phsActivityById(a.id).name) + ':</b> you asked for ' + a.count + ', but this level only has ' +
          got + ' different ones — so the book uses ' + got + '. Lower the number, or add your own sentences on the Build tab.</span></div>';
      }
    });
    rows += '<div class="pc-row pc-ok"><span class="pc-ic">✓</span><span>Answer keys are drawn from the printed pages themselves — they always match.</span></div>';
    body.innerHTML = rows;
  }

  /* ================= auto-save ================= */

  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveLastState, 1200);
  }

  /* The restore point: full studio state (settings + draft
     with edits) in localStorage, refreshed on every change
     and every build. Reopening the studio restores it. */
  function saveLastState() {
    try {
      if (!draft && !buildDirty) return;
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(readState()));
      var note = $('saved-note');
      if (note) note.textContent = 'Auto-saved ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) { /* storage full/blocked — projects still work */ }
  }

  function loadLastState() {
    try {
      var raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return null;
      var st = JSON.parse(raw);
      return (st && typeof st === 'object') ? st : null;
    } catch (e) { return null; }
  }

  /* Every successful build also lands in My Books as an
     "Auto —" project (the previous auto entry is replaced,
     so the list never floods). */
  function autoSaveProject(name) {
    if (!draft) return;
    var list = loadProjects().filter(function (p) { return !p.auto; });
    list.unshift({ name: name, savedAt: new Date().toLocaleString(), auto: true, state: readState() });
    saveProjects(list.slice(0, 24));
    renderProjects();
  }

  function startFresh() {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* ignore */ }
    $('restore-bar').hidden = true;
    seedVariant = 1;
    themeFilter = 'all';
    applyState({
      level: 1, title: 'My First Reading Book', childName: '', pack: 'storybook',
      activities: null, customText: '', customPics: {}, customWords: [],
      picRotation: { last: {}, nonce: 0, sbNext: 'storybook' }, seedVariant: 1,
      draft: null, designId: 'bohorainbow', trim: 'letter', business: 'Songlap Deals',
      cover: true, backCover: true, inkSaver: false, bw: false,
      theme: 'all', density: 'comfortable', rowStyle: 'cards', markStyle: 'circle'
    });
    generateDraft();
    switchTab('build');
  }

  /* ================= projects ================= */

  function loadProjects() {
    try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveProjects(list) {
    try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)); } catch (e) { /* full */ }
  }

  function readState() {
    var s = readBuildSettings();
    return {
      level: s.level, title: s.title, childName: s.childName, pack: s.pack,
      activities: (function () {
        var sel = [], counts = {};
        document.querySelectorAll('#activities-list .game-row').forEach(function (row) {
          counts[row.dataset.activity] = parseInt(row.querySelector('.act-count').value, 10) || 0;
          if (row.querySelector('.act-check').checked) sel.push(row.dataset.activity);
        });
        return { selected: sel, counts: counts };
      })(),
      customText: s.customText,
      customPics: Object.assign({}, customPics),
      customWords: customWords.map(function (cw) {
        return { w: cw.w, img: cw.img, c: cw.c, level: cw.level };
      }),
      picRotation: { last: Object.assign({}, picRotation.last), nonce: picRotation.nonce, sbNext: picRotation.sbNext },
      seedVariant: seedVariant,
      draft: draft,
      designId: $('design-select').value,
      trim: $('trim-select').value,
      business: $('in-business').value,
      cover: $('cover-on').checked, backCover: $('backcover-on').checked,
      inkSaver: $('inksaver-on').checked, bw: $('bw-on').checked,
      theme: themeFilter,
      density: $('density-select').value, rowStyle: $('rowstyle-select').value,
      markStyle: $('markstyle-select').value
    };
  }

  function applyState(st) {
    $('level-select').value = st.level;
    $('in-title').value = st.title || '';
    $('in-child').value = st.childName || '';
    $('pack-select').value = st.pack || 'storybook';
    updatePackChrome();
    $('custom-text').value = st.customText || '';
    customPics = st.customPics || {};
    customWords = st.customWords || [];
    if (st.picRotation && st.picRotation.last) {
      picRotation = { last: st.picRotation.last, nonce: st.picRotation.nonce || 0, sbNext: st.picRotation.sbNext === 'svg' ? 'svg' : 'storybook' };
      savePicRotation();
    }
    populateWordSelect();
    refreshCustomLists();
    updatePackChrome();
    seedVariant = st.seedVariant || 1;
    renderActivities(st.activities);
    themeFilter = st.theme || 'all';
    renderThemeChips();
    updateLevelChrome();
    renderLevelCards();
    renderPackCards();
    $('design-select').value = st.designId || 'bohorainbow';
    $('trim-select').value = st.trim || 'letter';
    $('in-business').value = st.business || 'Songlap Deals';
    $('cover-on').checked = st.cover !== false;
    $('backcover-on').checked = st.backCover !== false;
    $('inksaver-on').checked = !!st.inkSaver;
    $('bw-on').checked = !!st.bw;
    $('density-select').value = st.density || 'comfortable';
    $('rowstyle-select').value = st.rowStyle || 'cards';
    $('markstyle-select').value = st.markStyle || 'circle';
    updateDesignChrome();
    draft = st.draft || null;
    /* A state saved AFTER the buyer changed selections but
       BEFORE the pages were remade pairs the NEW settings
       with the OLD draft. If the draft's own recorded
       settings disagree with the restored ones, treat the
       draft as stale: the next build (or tab switch) then
       regenerates from the current selections instead of
       silently rebuilding the old book. Only fields the
       draft records verbatim are compared, so a faithfully
       saved book is never needlessly remade. */
    buildDirty = !draft ||
      draft.level !== st.level ||
      draft.title !== (st.title || 'My Reading Book') ||
      (draft.childName || '') !== (st.childName || '') ||
      draft.pack !== (st.pack || 'storybook');
    if (draft) { renderEditor(); updateThemeNote(); }
    builtBook = null;
    currentPrint = null;
    seriesDoc = null;
    $('series-print-btn').disabled = true;
    $('print-btn').disabled = true;
    $('png-btn').disabled = true;
    $('book-preview').innerHTML = '';
    $('pv-bar').hidden = true;
    updatePrintCheck();
  }

  function renderProjects() {
    var list = loadProjects();
    var box = $('projects-list');
    box.innerHTML = list.length ? '' :
      '<div class="empty-state"><b>No saved books yet</b>' +
      'Generate your first book — it will be saved here all by itself, ' +
      'and you can also save named projects with the button above.</div>';
    list.forEach(function (p, idx) {
      var row = document.createElement('div');
      row.className = 'project-row';
      row.innerHTML = '<span class="p-name">' + escapeHtml(p.name) + '</span>' +
        (p.auto ? '<span class="p-auto">Auto-saved</span>' : '') +
        '<span class="p-meta">' + escapeHtml(p.savedAt) + '</span>';
      var load = document.createElement('button');
      load.className = 'btn btn-ghost btn-small'; load.textContent = 'Load';
      load.addEventListener('click', function () { applyState(p.state); switchTab('build'); rebuildAfterRestore(); });
      var del = document.createElement('button');
      del.className = 'btn btn-ghost btn-small'; del.textContent = 'Delete';
      del.addEventListener('click', function () {
        var l = loadProjects(); l.splice(idx, 1); saveProjects(l); renderProjects();
      });
      row.appendChild(load); row.appendChild(del);
      box.appendChild(row);
    });
  }

  /* ================= init ================= */

  function initApp() {
    var lvSel = $('level-select');
    C.PHS_LEVELS.forEach(function (lv) {
      var opt = document.createElement('option');
      opt.value = lv.id; opt.textContent = lv.name + ' — ' + lv.patterns;
      lvSel.appendChild(opt);
    });
    var dSel = $('design-select');
    D.PHS_DESIGNS.forEach(function (d) {
      var opt = document.createElement('option');
      opt.value = d.id; opt.textContent = d.name;
      dSel.appendChild(opt);
    });
    dSel.value = 'bohorainbow';
    var pSel = $('pack-select');
    C.PHS_PICTURE_PACKS.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      pSel.appendChild(opt);
    });
    pSel.value = 'storybook';
    pSel.addEventListener('change', function () { updatePackChrome(); markDirty(); });
    loadPicRotation();
    $('shuffle-pics-btn').addEventListener('click', function () {
      picRotation.nonce++;
      savePicRotation();
      generateDraft('Pictures shuffled — every word with more than one picture now uses a different one.');
    });

    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });
    lvSel.addEventListener('change', function () { updateLevelChrome(); populateWordSelect(); renderThemeChips(); markDirty(); });
    $('in-title').addEventListener('change', markDirty);
    $('in-child').addEventListener('change', markDirty);
    $('custom-text').addEventListener('change', markDirty);
    $('newset-btn').addEventListener('click', function () {
      seedVariant++;
      updateLevelChrome();
      generateDraft('New sentence set #' + seedVariant + ' generated.');
    });
    $('regen-btn').addEventListener('click', function () {
      seedVariant++;
      updateLevelChrome();
      generateDraft('All items regenerated (set #' + seedVariant + ').');
    });
    dSel.addEventListener('change', function () { updateDesignChrome(); updatePrintCheck(); scheduleAutosave(); });
    /* wrapped: a bare doBuild listener would receive the
       click EVENT as its first argument and mistake it for
       the silent flag */
    $('build-btn').addEventListener('click', function () { doBuild(); });
    $('print-btn').addEventListener('click', doPrint);
    $('png-btn').addEventListener('click', doPng);
    ['wrap-pages', 'wrap-paper', 'wrap-trim'].forEach(function (id) {
      $(id).addEventListener('change', updateWrapDims);
      /* recalc as the buyer types, not only on Enter/Tab */
      $(id).addEventListener('input', updateWrapDims);
    });
    $('wrap-paper').addEventListener('change', updatePrintCheck);
    $('wrap-preview-btn').addEventListener('click', doWrapPreview);
    $('wrap-print-btn').addEventListener('click', doWrapPrint);
    $('project-save').addEventListener('click', function () {
      if (!draft) generateDraft();
      var name = $('project-name').value.trim() || 'Untitled project';
      var list = loadProjects();
      list.unshift({ name: name, savedAt: new Date().toLocaleString(), state: readState() });
      saveProjects(list.slice(0, 24));
      renderProjects();
    });

    /* book-option changes refresh the Print-Check panel */
    $('trim-select').addEventListener('change', function () { updatePrintCheck(); scheduleAutosave(); });
    ['density-select', 'rowstyle-select', 'markstyle-select'].forEach(function (id) {
      $(id).addEventListener('change', function () { updatePrintCheck(); scheduleAutosave(); });
    });
    ['cover-on', 'backcover-on', 'inksaver-on', 'bw-on'].forEach(function (id) {
      $(id).addEventListener('change', function () { updatePrintCheck(); scheduleAutosave(); });
    });
    $('in-business').addEventListener('change', scheduleAutosave);

    /* paginated preview controls */
    $('pv-prev').addEventListener('click', function () {
      var per = $('book-preview').dataset.mode === 'spread' ? 2 : 1;
      preview.page = Math.max(0, preview.page - per);
      applyPreview();
    });
    $('pv-next').addEventListener('click', function () {
      var per = $('book-preview').dataset.mode === 'spread' ? 2 : 1;
      preview.page = Math.min(Math.max(0, preview.pages.length - per), preview.page + per);
      applyPreview();
    });
    $('pv-zoom').addEventListener('change', layoutPreviewScale);
    $('pv-mode').addEventListener('change', function () {
      var box = $('book-preview');
      box.dataset.mode = $('pv-mode').value;
      if (box.dataset.mode === 'spread' && window.innerWidth < 1025) {
        /* spreads need room: on smaller screens the two
           pages simply stack at fit width */
      }
      preview.page = Math.max(0, Math.min(preview.page, preview.pages.length - 1));
      applyPreview();
    });
    window.addEventListener('resize', layoutPreviewScale);

    /* print check -> wrap builder one-click sync */
    $('pc-sync-btn').addEventListener('click', function () {
      if (!draft) return;
      var pages = builtBook ? builtBook.book.pageCount : BK.estimatePageCount(draft, readBookOpts());
      $('wrap-pages').value = pages;
      updateWrapDims();
      /* the cover maker starts collapsed (pro section) —
         open it so the buyer lands right on it */
      var wp = document.querySelector('.panel-wrap');
      if (wp) wp.classList.remove('collapsed');
      $('wrap-msg').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    /* series builder + listing kit + phone action bar */
    $('series-build-btn').addEventListener('click', buildSeries);
    $('series-print-btn').addEventListener('click', function () {
      if (seriesDoc) printDocument(seriesDoc.html, seriesDoc.css);
    });
    document.querySelectorAll('.lk-copy').forEach(function (btn) {
      btn.addEventListener('click', function () { copyListingText(btn.dataset.copy, btn); });
    });
    $('lk-backpng-btn').addEventListener('click', doBackPng);
    $('lk-samplepng-btn').addEventListener('click', doSamplePng);
    $('build-generate-btn').addEventListener('click', function () {
      switchTab('book');
      $('build-btn').click();
    });
    $('quick-book-btn').addEventListener('click', quickBook);
    $('m-build-btn').addEventListener('click', function () { doBuild(); });
    $('m-print-btn').addEventListener('click', doPrint);
    $('m-png-btn').addEventListener('click', doPng);
    $('pm-cancel').addEventListener('click', function () { pmCancelled = true; });
    $('start-fresh-btn').addEventListener('click', startFresh);

    renderActivities(null);
    renderLevelCards();
    renderPackCards();
    renderThemeChips();
    buildSeriesChips();
    initCollapsibles();
    initSubDisclosures();
    updateLevelChrome();
    updatePackChrome();
    initCustomPictures();
    updateDesignChrome();
    updateWrapDims();
    document.body.dataset.tab = 'build';
    /* restore the last state (auto-save) instead of
       resetting to Level 1 defaults on every visit */
    var last = loadLastState();
    if (last && last.draft) {
      applyState(last);
      $('restore-bar').hidden = false;
      rebuildAfterRestore();
    } else {
      generateDraft();
    }
    renderProjects();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initGate);
  }
})();
