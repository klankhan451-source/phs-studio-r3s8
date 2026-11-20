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
    ? { PHS_LEVELS: PHS_LEVELS, PHS_SEQUENCES: PHS_SEQUENCES, PHS_ACTIVITIES: PHS_ACTIVITIES, phsLevelById: phsLevelById, phsActivityById: phsActivityById, phsCumulative: phsCumulative, PHS_PICTURE_PACKS: PHS_PICTURE_PACKS, phsPicturePackById: phsPicturePackById, PHS_PIC_LIB: typeof PHS_PIC_LIB !== 'undefined' ? PHS_PIC_LIB : {}, PHS_STORYBOOK: typeof PHS_STORYBOOK !== 'undefined' ? PHS_STORYBOOK : {} }
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

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = nameInput.value.trim();
      var code = codeInput.value.trim();
      if (!name || !code) { showError(licenseErrorMessage('missing_fields')); return; }
      errorEl.hidden = true;
      button.disabled = true;
      button.textContent = 'Checking…';
      fetch(LICENSE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ name: name, code: code })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var decision = interpretLicenseResponse(data);
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
    if ((name === 'content' || name === 'book') && buildDirty) {
      generateDraft('Settings changed — items were regenerated and edits reset.');
    }
  }

  /* ================= build tab ================= */

  function currentLevel() { return C.phsLevelById(parseInt($('level-select').value, 10)); }

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
      return '<option value="' + escapeAttr(n.w) + '">' +
        escapeHtml(E.picFor(C, currentPack().id, n)) + ' ' + escapeHtml(n.w) +
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
    $('level-info').textContent = '📖 ' + lv.patterns + ' · ' + cum.nouns.length + ' reading words, ' +
      cum.verbs.length + ' action words — every level keeps all earlier sounds.';
    $('level-sight').textContent = 'Focus words (sight words) so far: ' + cum.sight.join(' · ');
    $('seed-note').textContent = 'Sentence set #' + seedVariant + ' for this book.';
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
        '<span class="count-field">Items <input type="number" class="act-count" min="0" max="60" value="' + count + '"></span></div>' +
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
    $('print-btn').disabled = true;
    $('png-btn').disabled = true;
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
      pack: s.pack,
      activities: s.activities, customText: s.customText,
      customPics: s.customPics, customWords: s.customWords,
      picVariants: variantSel
    }, C);
    picRotation.last = variantSel;
    savePicRotation();
    buildDirty = false;
    renderEditor();
    if (note) $('editor-status').textContent = note;
    $('build-status').textContent = 'Draft ready: ' + draft.sections.reduce(function (a, x) { return a + x.items.length; }, 0) +
      ' items. Review them in the Content editor, then build the book.';
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
        '<label class="ed-pic">Near-miss 1 <select class="ed-d1">' + distractorOptions(itemCat(item), others[0] && others[0].w, item.correct.w, item.sentence) + '</select></label>' +
        '<label class="ed-pic">Near-miss 2 <select class="ed-d2">' + distractorOptions(itemCat(item), others[1] && others[1].w, item.correct.w, item.sentence) + '</select></label>' +
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
          E.picFor(C, draft.pack, nn) + ' ' + escapeHtml(nn.w) + '</option>';
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
        return '<div class="ed-pics"><label class="ed-pic" style="flex:1">Step ' + (sIdx + 1) + ' ' + st.pic +
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
     order, and the answer keys (from the printed rows). */
  function prepareDraftForBuild() {
    var rng = E.makeRng(draft.id + '|build');
    draft.sections.forEach(function (section) {
      section.items.forEach(function (item) {
        if (item.type === 'builder') {
          var noun = findNoun(item.answer);
          if (noun && item.sentence.toLowerCase().indexOf(item.answer) !== -1) {
            item.pic = { w: noun.w, e: E.picFor(C, draft.pack, noun, draft.customPics, draft.picVariants) };
            item.blanked = item.sentence.replace(new RegExp('\\b' + item.answer + '\\b', 'i'), '______');
            var ds = E.distractorsFor(C, draft.level, item.sentence, noun, rng,
              { pack: draft.pack, customPics: draft.customPics, picVariants: draft.picVariants });
            item.choices = E.shuffle([noun.w].concat(ds.map(function (x) { return x.w; })), rng);
          }
        } else if (item.type === 'seq') {
          item.printed = item.printed.map(function (p) {
            var match = item.correctOrder.filter(function (st) { return st.pic === p.pic; })[0];
            return match ? { pic: p.pic, s: match.s } : p;
          });
        }
      });
    });
    draft.answerKeys = E.deriveAnswerKeys(draft.sections);
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
      business: $('in-business').value || 'Songlap Deals'
    };
  }

  function doBuild() {
    if (!draft) generateDraft();
    prepareDraftForBuild();
    var opts = readBookOpts();
    $('wrap-style').textContent = '';
    var book = BK.buildBook(draft, opts);
    $('book-style').textContent = BK.bookCss(opts.design, opts);
    $('book-preview').innerHTML = book.html;
    builtBook = { book: book, opts: opts, design: opts.design };
    $('print-btn').disabled = false;
    $('png-btn').disabled = false;
    $('build-status').textContent = '✅ Book built: ' + book.pageCount + ' pages · ' +
      draft.sections.length + ' activity sections · Book ' + draft.id + '. Preview below — check it, then Print / Save PDF.';
    $('wrap-pages').value = book.pageCount;
    updateWrapDims();
  }

  function doPrint() {
    if (!builtBook) return;
    var w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups for this site so the print view can open.'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><base href="' +
      escapeAttr(location.href) + '"><title>' +
      escapeHtml(draft.title) + ' (' + draft.id + ')</title><style>' +
      BK.bookCss(builtBook.design, builtBook.opts) + '</style></head><body>' +
      builtBook.book.html + '</body></html>');
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 350);
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

  /* ================= wrap cover ================= */

  function updateWrapDims() {
    var pages = Math.max(1, parseInt($('wrap-pages').value, 10) || 80);
    var dims = BK.wrapCoverDims(pages, $('wrap-paper').value, $('wrap-trim').value);
    $('wrap-dims').textContent = 'Spine width: ' + dims.spineIn.toFixed(3) + ' in · Full wrap size: ' +
      dims.totalWidthIn.toFixed(3) + ' in × ' + dims.totalHeightIn.toFixed(2) +
      ' in (0.125 in bleed included on every side).';
    return dims;
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
    var w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups for this site so the print view can open.'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wrap cover — ' +
      escapeHtml(wrapBuilt.meta.title) + '</title><style>' +
      BK.wrapCoverCss(wrapBuilt.design, wrapBuilt.dims) + '</style></head><body>' +
      BK.wrapCoverHtml(wrapBuilt.meta, wrapBuilt.design, wrapBuilt.dims, wrapBuilt.pack) + '</body></html>');
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 350);
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
      inkSaver: $('inksaver-on').checked, bw: $('bw-on').checked
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
    updateLevelChrome();
    $('design-select').value = st.designId || 'bohorainbow';
    $('trim-select').value = st.trim || 'letter';
    $('in-business').value = st.business || 'Songlap Deals';
    $('cover-on').checked = st.cover !== false;
    $('backcover-on').checked = st.backCover !== false;
    $('inksaver-on').checked = !!st.inkSaver;
    $('bw-on').checked = !!st.bw;
    updateDesignChrome();
    draft = st.draft || null;
    buildDirty = !draft;
    if (draft) renderEditor();
    builtBook = null;
    $('print-btn').disabled = true;
    $('png-btn').disabled = true;
    $('book-preview').innerHTML = '';
  }

  function renderProjects() {
    var list = loadProjects();
    var box = $('projects-list');
    box.innerHTML = list.length ? '' : '<p class="hint">No saved projects yet.</p>';
    list.forEach(function (p, idx) {
      var row = document.createElement('div');
      row.className = 'project-row';
      row.innerHTML = '<span class="p-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="p-meta">' + escapeHtml(p.savedAt) + '</span>';
      var load = document.createElement('button');
      load.className = 'btn btn-ghost btn-small'; load.textContent = 'Load';
      load.addEventListener('click', function () { applyState(p.state); switchTab('build'); });
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
    lvSel.addEventListener('change', function () { updateLevelChrome(); populateWordSelect(); markDirty(); });
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
    dSel.addEventListener('change', updateDesignChrome);
    $('build-btn').addEventListener('click', doBuild);
    $('print-btn').addEventListener('click', doPrint);
    $('png-btn').addEventListener('click', doPng);
    ['wrap-pages', 'wrap-paper', 'wrap-trim'].forEach(function (id) {
      $(id).addEventListener('change', updateWrapDims);
    });
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

    renderActivities(null);
    updateLevelChrome();
    updatePackChrome();
    initCustomPictures();
    updateDesignChrome();
    updateWrapDims();
    generateDraft();
    renderProjects();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initGate);
  }
})();
