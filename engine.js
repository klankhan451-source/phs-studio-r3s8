/*
 * ============================================================
 *  PhonicsStrip Studio Pro — content engine
 * ============================================================
 *  Pure logic (browser + Node):
 *   - seeded RNG (same mulberry32 family as our other tools)
 *   - sentence validation: a sentence is decodable at a level
 *     when EVERY word is in the level's cumulative bank or
 *     sight list (the banks are the source of truth)
 *   - sentence generation from the level's templates + banks,
 *     with per-book uniqueness tracking
 *   - strip generation with SAME-CATEGORY near-miss
 *     distractors and an exactly-one-match guarantee: the
 *     correct picture's word is in the sentence, and neither
 *     distractor's word appears anywhere in the sentence
 *   - book-data assembly: sections of items in the buyer's
 *     chosen order, and answer keys derived from the SAME
 *     item objects that print — a key can never drift
 * ============================================================
 */
'use strict';

/* ---------- seeded RNG ---------- */

function hashSeedString(str) {
  var h = 2166136261 >>> 0;
  str = String(str == null ? '' : str);
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seedString) { return mulberry32(hashSeedString(seedString)); }

function shuffle(arr, rng) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

/* ---------- word / sentence validation ---------- */

/* All single words allowed at a level (lowercase set). */
function allowedWordSet(C, levelId) {
  var cum = C.phsCumulative(levelId);
  var set = {};
  cum.nouns.forEach(function (n) { set[n.w] = true; });
  ['verbs', 'adjectives', 'places', 'extras', 'sight'].forEach(function (k) {
    cum[k].forEach(function (w) { set[String(w).toLowerCase()] = true; });
  });
  cum.names.forEach(function (n) { set[n.toLowerCase()] = true; });
  return set;
}

function sentenceWords(sentence) {
  return String(sentence == null ? '' : sentence)
    .replace(/[.!?,;:'"“”]/g, ' ')
    .split(/\s+/)
    .filter(function (w) { return w.length > 0; });
}

/* Uniqueness key for a sentence: lowercased, punctuation
   stripped, and the articles a / an / the removed — so
   "I see the rat." and "I see a rat." count as the SAME
   strip when a book is assembled (the owner's complaint). */
function normalizeSentenceKey(sentence) {
  return sentenceWords(sentence)
    .map(function (w) { return w.toLowerCase(); })
    .filter(function (w) { return w !== 'a' && w !== 'an' && w !== 'the'; })
    .join(' ');
}

/* The picture for a noun under a picture pack: the buyer's
   own uploaded picture for the word when one is set
   (customPics: { word: dataURL } — a custom picture always
   wins, packs never override it); under the Illustrated
   pack, the word's illustrated artwork (PHS_PIC_LIB),
   choosing the variant named by variantSel ({ word: index },
   the rotation state) when given; else the pack's emoji
   variant when it has one for this word; else the bank
   emoji. Word-based rules (validation, exactly-one-match)
   never see pictures, so pictures cannot break them. The
   picture VALUE (emoji, asset path or data URL) is the
   token the no-repeat-on-a-page rule compares, so any
   picture kind behaves exactly like the emoji it replaces. */
/* The ordered picture candidates for a word under an
   artwork pack: under the Storybook pack, our own storybook
   illustration (assets/storybook/<word>.png, when the word
   has one) comes first, then the Illustrated library
   variants as fallbacks; under the Illustrated pack, just
   the library variants. Rotation (variantSel) indexes into
   this list when the selection carries no book-level art
   source (see picFor). */
function picCandidates(C, pack, noun) {
  var out = [];
  if (!noun || !pack) return out;
  if (pack.storybook && C.PHS_STORYBOOK && C.PHS_STORYBOOK[noun.w]) {
    out.push('assets/storybook/' + noun.w + '.png');
  }
  if ((pack.illustrated || pack.storybook) && C.PHS_PIC_LIB && C.PHS_PIC_LIB[noun.w]) {
    C.PHS_PIC_LIB[noun.w].forEach(function (v) { out.push(v.src); });
  }
  return out;
}

function picFor(C, packId, noun, customPics, variantSel) {
  if (!noun) return '';
  if (customPics && customPics[noun.w]) return customPics[noun.w];
  var pack = (C && C.phsPicturePackById && packId) ? C.phsPicturePackById(packId) : null;
  if (pack && (pack.illustrated || pack.storybook)) {
    var idx = variantSel && variantSel[noun.w] != null ? variantSel[noun.w] : 0;
    /* Book-level art source (Storybook pack): when the
       selection carries __src ('storybook' or 'svg'), EVERY
       word in the book uses that one source — the watercolour
       storybook art throughout, or the illustrated SVG art
       throughout — so a single book never mixes the two
       styles on a page. Consecutive books alternate __src
       (the app flips it per build), which keeps the owner's
       book-to-book rotation without word-by-word mixing.
       The per-word index still rotates the SVG variant. */
    var src = pack.storybook && variantSel ? variantSel.__src : null;
    if (src === 'storybook' || src === 'svg') {
      var lib = (C.PHS_PIC_LIB && C.PHS_PIC_LIB[noun.w]) || [];
      if (src === 'storybook' && C.PHS_STORYBOOK && C.PHS_STORYBOOK[noun.w]) {
        return 'assets/storybook/' + noun.w + '.png';
      }
      if (lib.length) {
        return lib[((idx % lib.length) + lib.length) % lib.length].src;
      }
      if (C.PHS_STORYBOOK && C.PHS_STORYBOOK[noun.w]) {
        return 'assets/storybook/' + noun.w + '.png';
      }
      /* no artwork at all for this word: fall through to
         the pack's emoji variant / the bank emoji */
    } else {
      var cands = picCandidates(C, pack, noun);
      if (cands.length) {
        return cands[((idx % cands.length) + cands.length) % cands.length];
      }
    }
  }
  if (pack && pack.variants && pack.variants[noun.w]) return pack.variants[noun.w];
  return noun.e;
}

/* The variant selection for the NEXT book at a level:
   every word with 2+ illustrated variants gets a DIFFERENT
   variant than `prev` (the last book's selection) used —
   so a buyer's second book visibly differs from the first.
   `salt` (the Shuffle button) re-rolls which different
   variant each word lands on. Words with one variant keep
   index 0. Pure and deterministic.
   `extra` (optional, { word: count }) widens a word's
   candidate count for callers that index into the combined
   candidate list. The app no longer passes it: under the
   Storybook pack the art source alternates at BOOK level
   (variantSel.__src, see picFor), so these indexes count
   SVG variants only. Indexes stay valid for narrower packs
   because picFor indexes modulo the candidate count. */
function nextVariantSelection(C, levelId, prev, salt, extra) {
  var lib = C.PHS_PIC_LIB || {};
  var sel = {};
  var prevSel = prev || {};
  C.phsCumulative(levelId).nouns.forEach(function (n) {
    var vars = lib[n.w];
    var count = (vars ? vars.length : 0) + ((extra && extra[n.w]) || 0);
    if (!count) return;
    if (count < 2) { sel[n.w] = 0; return; }
    var p = prevSel[n.w] || 0;
    var step = 1 + (hashSeedString(n.w + '|' + (salt || 0)) % (count - 1));
    sel[n.w] = (p + step) % count;
  });
  return sel;
}

/* A word counts as allowed when it is in the set directly, or
   is a regular plural (s / es) of a bank noun. */
function wordAllowed(word, set, nounWords) {
  var w = String(word).toLowerCase();
  if (set[w]) return true;
  if (w.length > 2 && w.slice(-1) === 's') {
    var base = w.slice(0, -1);
    if (nounWords[base]) return true;
    if (w.slice(-2) === 'es' && nounWords[w.slice(0, -2)]) return true;
  }
  return false;
}

/* validateSentence(sentence, levelId, C) -> { ok, bad: [words] } */
function validateSentence(sentence, levelId, C) {
  var cum = C.phsCumulative(levelId);
  var set = allowedWordSet(C, levelId);
  var nounWords = {};
  cum.nouns.forEach(function (n) { nounWords[n.w] = true; });
  var bad = [];
  sentenceWords(sentence).forEach(function (w) {
    if (!wordAllowed(w, set, nounWords)) bad.push(w);
  });
  return { ok: bad.length === 0, bad: bad };
}

/* ---------- lookups ---------- */

function nounByWord(C, levelId, word) {
  var cum = C.phsCumulative(levelId);
  for (var i = 0; i < cum.nouns.length; i++) if (cum.nouns[i].w === word) return cum.nouns[i];
  return null;
}

function nounsInCategory(C, levelId, cat) {
  return C.phsCumulative(levelId).nouns.filter(function (n) { return n.c === cat; });
}

/* Every bank noun whose word appears in the sentence. */
function nounsInSentence(C, levelId, sentence) {
  var words = {};
  sentenceWords(sentence).forEach(function (w) { words[w.toLowerCase()] = true; });
  return C.phsCumulative(levelId).nouns.filter(function (n) { return !!words[n.w]; });
}

/* ---------- sentence generation ---------- */

/* Fill one template with bank words. Returns
   { sentence, target, template } where target is the noun
   object the {noun} slot filled (the strip's correct
   picture), or null when the template has no {noun} slot.
   With a book context (ctx), noun slots prefer the
   least-used nouns in the book so far — picture usage is
   balanced across the whole book instead of clustering. */
function fillTemplate(C, levelId, template, rng, ctx) {
  var cum = C.phsCumulative(levelId);
  var used = {};
  function takeNoun() {
    var pool = cum.nouns.filter(function (n) { return !used[n.w]; });
    if (!pool.length) pool = cum.nouns;
    var n;
    pool = themed(pool);
    if (ctx && ctx.nounUse) {
      var min = Math.min.apply(null, pool.map(function (x) { return ctx.nounUse[x.w] || 0; }));
      var least = pool.filter(function (x) { return (ctx.nounUse[x.w] || 0) === min; });
      n = pick(rng, least);
    } else {
      n = pick(rng, pool);
    }
    used[n.w] = true;
    if (ctx && ctx.nounUse) ctx.nounUse[n.w] = (ctx.nounUse[n.w] || 0) + 1;
    return n;
  }
  var target = null;
  /* word-theme filter (ctx.themeCats): noun slots prefer
     nouns from the chosen theme's categories while they
     last, then fall back to the full bank — generation
     never starves, it just leans themed first. */
  function themed(pool) {
    if (ctx && ctx.themeCats && ctx.themeCats.length) {
      var t = pool.filter(function (n) { return ctx.themeCats.indexOf(n.c) !== -1; });
      if (t.length) return t;
    }
    return pool;
  }
  function plural(w) { return /(s|x|ch|sh)$/.test(w) ? w + 'es' : w + 's'; }
  var name1 = pick(rng, cum.names);
  var name2 = pick(rng, cum.names.filter(function (n) { return n !== name1; }).concat(name1));
  var verb1 = pick(rng, cum.verbs);
  var verb2 = pick(rng, cum.verbs.filter(function (v) { return v !== verb1; }).concat(verb1));
  var text = template.replace(/\{nounPl\}|\{noun2\}|\{noun\}|\{name2\}|\{name\}|\{verb2\}|\{verb\}|\{adj\}|\{place\}/g,
    function (slot) {
      switch (slot) {
        case '{noun}': { var n0 = takeNoun(); if (!target) target = n0; return n0.w; }
        case '{noun2}': return takeNoun().w;
        case '{nounPl}': return plural(takeNoun().w);
        case '{name}': return name1;
        case '{name2}': return name2;
        case '{verb}': return verb1;
        case '{verb2}': return verb2;
        case '{adj}': return pick(rng, cum.adjectives);
        case '{place}': return pick(rng, cum.places);
        default: return slot;
      }
    });
  return { sentence: text, target: target, template: template };
}

/* Record a finished item's (template + target noun) pair in
   the book context. Called by the item builders only after
   every item-level check has passed, so rejected candidates
   never consume a pair. */
function commitPair(ctx, filled) {
  if (ctx && filled && filled.target && filled.template) {
    ctx.pairs[filled.template + '|' + filled.target.w] = true;
  }
}

/* Generate one validated, unique sentence at a level.
   `usedSet` (object) tracks sentences already in the book,
   keyed by normalizeSentenceKey (article-only differences
   count as duplicates). With a book context (ctx):
   - the same (template + target noun) pair never repeats
     in one book (checked here, recorded by commitPair);
   - when ctx.requireTarget is set (picture strips), the
     target must exist and sit in a category with at least
     3 members, so near-miss distractors can always be
     drawn from its own group. */
function generateSentence(C, levelId, rng, usedSet, ctx) {
  var cum = C.phsCumulative(levelId);
  for (var attempt = 0; attempt < 200; attempt++) {
    var tpl = pick(rng, cum.templates);
    var filled = fillTemplate(C, levelId, tpl, rng, ctx);
    if (ctx && ctx.requireTarget) {
      if (!filled.target) continue;
      if (nounsInCategory(C, levelId, filled.target.c).length < 3) continue;
    }
    if (ctx && filled.target && ctx.pairs[filled.template + '|' + filled.target.w]) continue;
    var key = normalizeSentenceKey(filled.sentence);
    if (usedSet && usedSet[key]) continue;
    var v = validateSentence(filled.sentence, levelId, C);
    if (!v.ok) continue; // should not happen — banks are the truth; belt & braces
    if (usedSet) usedSet[key] = true;
    return filled;
  }
  return null;
}

/* ---------- near-miss distractors ---------- */

/* Two distractors for a target noun: same category, and
   neither word may appear in the sentence (exactly-one-match).
   Pictures must also be emoji-distinct from the target's
   picture and from each other under the active picture
   pack — two bank words can share one emoji (dog/pup 🐶,
   jet/plane ✈️), and a strip may never show the same
   picture twice. With a book context, the least-used
   pictures in the book are preferred. Returns [] when the
   category cannot supply two clean distractors. */
function distractorsFor(C, levelId, sentence, target, rng, ctx) {
  var packId = ctx ? ctx.pack : null;
  var customs = ctx ? ctx.customPics : null;
  var vsel = ctx ? ctx.picVariants : null;
  var targetPic = picFor(C, packId, target, customs, vsel);
  var inSentence = {};
  sentenceWords(sentence).forEach(function (w) { inSentence[w.toLowerCase()] = true; });
  var pool = nounsInCategory(C, levelId, target.c).filter(function (n) {
    return n.w !== target.w && !inSentence[n.w] && picFor(C, packId, n, customs, vsel) !== targetPic;
  });
  if (pool.length < 2) return [];
  var shuffled = shuffle(pool, rng);
  if (ctx && ctx.picUse) {
    shuffled.sort(function (a, b) {
      return (ctx.picUse[picFor(C, packId, a, customs, vsel)] || 0) - (ctx.picUse[picFor(C, packId, b, customs, vsel)] || 0);
    });
  }
  var chosen = [];
  var usedPics = {};
  usedPics[targetPic] = true;
  for (var i = 0; i < shuffled.length && chosen.length < 2; i++) {
    var p = picFor(C, packId, shuffled[i], customs, vsel);
    if (usedPics[p]) continue;
    usedPics[p] = true;
    chosen.push(shuffled[i]);
  }
  return chosen.length === 2 ? chosen : [];
}

function exactlyOneMatch(sentence, correctWord, distractors) {
  var words = {};
  sentenceWords(sentence).forEach(function (w) { words[w.toLowerCase()] = true; });
  if (!words[String(correctWord).toLowerCase()]) return false;
  for (var i = 0; i < distractors.length; i++) {
    if (words[String(distractors[i].w || distractors[i]).toLowerCase()]) return false;
  }
  return true;
}

/* ---------- item builders (one activity row each) ---------- */

/* True when every noun that could serve as a picture-strip
   target at this level (its category has 3+ members) has
   already been a correct answer in this section — only
   then may a target noun repeat within the section. */
function targetPoolExhausted(C, levelId, ctx) {
  if (!ctx || !ctx.targetUse) return true;
  var pool = C.phsCumulative(levelId).nouns.filter(function (n) {
    return nounsInCategory(C, levelId, n.c).length >= 3;
  });
  if (!pool.length) return true;
  return pool.every(function (n) { return !!ctx.targetUse[n.w]; });
}

/* Shared success bookkeeping for picture items. */
function commitPictureItem(ctx, filled, pics) {
  commitPair(ctx, filled);
  if (!ctx) return;
  if (filled.target) ctx.targetUse[filled.target.w] = (ctx.targetUse[filled.target.w] || 0) + 1;
  (pics || []).forEach(function (p) { ctx.picUse[p] = (ctx.picUse[p] || 0) + 1; });
}

/* Read & Circle strip: { type:'circle', sentence, correct:{w,e},
   options: [3 noun objects shuffled] } */
function makeCircleItem(C, levelId, rng, usedSet, ctx) {
  for (var attempt = 0; attempt < 200; attempt++) {
    var filled = generateSentence(C, levelId, rng, null, ctx);
    if (!filled || !filled.target) continue;
    /* rotation: a target noun repeats in this section only
       once the whole target pool has been used */
    if (ctx && ctx.targetUse[filled.target.w] && !targetPoolExhausted(C, levelId, ctx)) continue;
    var ds = distractorsFor(C, levelId, filled.sentence, filled.target, rng, ctx);
    if (ds.length < 2) continue;
    var key = normalizeSentenceKey(filled.sentence);
    if (usedSet && usedSet[key]) continue;
    if (usedSet) usedSet[key] = true;
    var packId = ctx ? ctx.pack : null;
    var customs = ctx ? ctx.customPics : null;
    var vsel = ctx ? ctx.picVariants : null;
    var options = shuffle([filled.target].concat(ds), rng).map(function (n) {
      return { w: n.w, e: picFor(C, packId, n, customs, vsel) };
    });
    commitPictureItem(ctx, filled, options.map(function (o) { return o.e; }));
    return {
      type: 'circle', sentence: filled.sentence,
      correct: { w: filled.target.w, e: picFor(C, packId, filled.target, customs, vsel) },
      options: options
    };
  }
  return null;
}

/* Sentence Builder item: the sentence with its target noun
   blanked; choices = the noun + 2 same-category words. */
function makeBuilderItem(C, levelId, rng, usedSet, ctx) {
  for (var attempt = 0; attempt < 200; attempt++) {
    var filled = generateSentence(C, levelId, rng, null, ctx);
    if (!filled || !filled.target) continue;
    if (ctx && ctx.targetUse[filled.target.w] && !targetPoolExhausted(C, levelId, ctx)) continue;
    var ds = distractorsFor(C, levelId, filled.sentence, filled.target, rng, ctx);
    if (ds.length < 2) continue;
    var key = normalizeSentenceKey(filled.sentence);
    if (usedSet && usedSet[key]) continue;
    if (usedSet) usedSet[key] = true;
    var packId = ctx ? ctx.pack : null;
    var pic = { w: filled.target.w, e: picFor(C, packId, filled.target, ctx ? ctx.customPics : null, ctx ? ctx.picVariants : null) };
    commitPictureItem(ctx, filled, [pic.e]);
    var blanked = filled.sentence.replace(new RegExp('\\b' + filled.target.w + '\\b', 'i'), '______');
    return {
      type: 'builder', sentence: filled.sentence, blanked: blanked,
      pic: pic,
      answer: filled.target.w,
      choices: shuffle([filled.target.w].concat(ds.map(function (n) { return n.w; })), rng)
    };
  }
  return null;
}

/* Read & Draw / Trace item: just a validated sentence. */
function makeTextItem(C, levelId, rng, usedSet, type, ctx) {
  var filled = generateSentence(C, levelId, rng, usedSet, ctx);
  if (!filled) return null;
  commitPair(ctx, filled);
  return { type: type, sentence: filled.sentence };
}

/* Picture Comprehension item, generated from level data so the
   passage always validates and the answers always match it.
   Scene: name + noun + (place from level 2 up, else an
   adjective the picture shows). Where-answers at level 1 come
   from the picture (place emoji in the scene) — a decodable
   Where sentence needs on/in, which arrive at Level 2. */
function makeCompItem(C, levelId, rng, usedSet, ctx) {
  var cum = C.phsCumulative(levelId);
  var packId = ctx ? ctx.pack : null;
  var customs = ctx ? ctx.customPics : null;
  var vsel = ctx ? ctx.picVariants : null;
  for (var attempt = 0; attempt < 200; attempt++) {
    var name = pick(rng, cum.names);
    var nounPool = cum.nouns.filter(function (n) {
      return nounsInCategory(C, levelId, n.c).length >= 3;
    });
    if (ctx && ctx.themeCats && ctx.themeCats.length) {
      var themedPool = nounPool.filter(function (n) { return ctx.themeCats.indexOf(n.c) !== -1; });
      if (themedPool.length) nounPool = themedPool;
    }
    if (!nounPool.length) return null;
    /* prefer the least-used scene picture in the book */
    var noun = pick(rng, nounPool);
    if (ctx && ctx.picUse) {
      var minUse = Math.min.apply(null, nounPool.map(function (n) { return ctx.picUse[picFor(C, packId, n, customs, vsel)] || 0; }));
      var least = nounPool.filter(function (n) { return (ctx.picUse[picFor(C, packId, n, customs, vsel)] || 0) === minUse; });
      noun = pick(rng, least);
    }
    var adj = pick(rng, cum.adjectives);
    var s1 = name + ' has a ' + noun.w + '.';
    var s2, place = null;
    if (levelId >= 2) {
      place = pick(rng, cum.places);
      s2 = 'The ' + noun.w + ' is on the ' + place + '.';
      if (rng() < 0.5) s2 = 'The ' + noun.w + ' is in the ' + place + '.';
    } else {
      s2 = 'The ' + noun.w + ' is ' + adj + '.';
    }
    var passage = s1 + ' ' + s2;
    var pkey = normalizeSentenceKey(passage);
    if (usedSet && usedSet[pkey]) continue;
    var v = validateSentence(passage, levelId, C);
    if (!v.ok) continue;
    if (usedSet) usedSet[pkey] = true;
    var nameChoices = shuffle([name].concat(
      shuffle(cum.names.filter(function (n) { return n !== name; }), rng).slice(0, 2)), rng);
    var nounChoices = shuffle(nounsInCategory(C, levelId, noun.c)
      .filter(function (n) { return n.w !== noun.w; }), rng).slice(0, 2)
      .map(function (n) { return n.w; });
    nounChoices = shuffle([noun.w].concat(nounChoices), rng);
    var questions = [
      { label: 'Who', q: 'Who has a ' + noun.w + '?', choices: nameChoices, answer: name },
      { label: 'What', q: 'What does ' + name + ' have?', choices: nounChoices, answer: noun.w }
    ];
    if (levelId >= 2 && place) {
      var placeChoices = shuffle([place].concat(
        shuffle(cum.places.filter(function (p) { return p !== place; }), rng).slice(0, 2)), rng)
        .map(function (p) { return 'the ' + p; });
      questions.push({ label: 'Where', q: 'Where is the ' + noun.w + '?', choices: placeChoices, answer: 'the ' + place });
    } else {
      var adjChoices = shuffle([adj].concat(
        shuffle(cum.adjectives.filter(function (a) { return a !== adj; }), rng).slice(0, 2)), rng);
      questions.push({ label: 'What', q: 'What is the ' + noun.w + ' like?', choices: adjChoices, answer: adj });
      questions[2].label = 'How';
    }
    /* scene: a child + the passage's noun, in the active
       picture pack. The child glyph changes when the noun
       IS the kid, so the scene never shows one picture
       twice. */
    var nounPic = picFor(C, packId, noun, customs, vsel);
    var scene = (noun.w === 'kid' ? '👦' : '🧒') + ' ' + nounPic;
    if (ctx) ctx.picUse[nounPic] = (ctx.picUse[nounPic] || 0) + 1;
    return { type: 'comp', passage: passage, scene: scene, questions: questions };
  }
  return null;
}

/* Story Sequencing item: a sequence whose min level fits,
   steps shuffled for printing; `order` holds the correct
   step indexes in print order -> answer key derives from it. */
function makeSeqItem(C, levelId, rng, usedSeq) {
  var pool = C.PHS_SEQUENCES.filter(function (s) {
    return s.min <= levelId && !(usedSeq && usedSeq[s.id]);
  });
  if (!pool.length) return null;
  var seq = pick(rng, pool);
  if (usedSeq) usedSeq[seq.id] = true;
  var order = shuffle([0, 1, 2], rng);
  return {
    type: 'seq', title: seq.title, seqId: seq.id,
    printed: order.map(function (i) { return seq.steps[i]; }),
    correctOrder: seq.steps.slice()
  };
}

/* ---------- own sentences (custom level) ---------- */

/* Parse the buyer's own-sentences text: one per line,
   "Sentence | 🐱" — the emoji is optional; when given it must
   be a bank noun's emoji (any level) so distractors can be
   drawn from its category. */
function parseCustomSentences(C, text) {
  var byEmoji = {};
  [1, 2, 3, 4, 5, 6, 7, 8].forEach(function (lv) {
    C.phsCumulative(lv).nouns.forEach(function (n) { byEmoji[n.e] = n; });
  });
  var items = [];
  String(text || '').split('\n').forEach(function (line) {
    var raw = line.trim();
    if (!raw) return;
    var parts = raw.split('|');
    var sentence = parts[0].trim();
    var emoji = parts.length > 1 ? parts[1].trim() : '';
    if (!sentence) return;
    items.push({ sentence: sentence, noun: emoji ? (byEmoji[emoji] || null) : null, emoji: emoji });
  });
  return items.slice(0, 150);
}

/* Turn parsed own-sentences into circle strips. When the buyer
   picked a picture, it is the correct one; distractors are
   auto-drawn from the same category, never using a word that
   appears in the sentence. Without a picture, the first bank
   noun found in the sentence becomes the target. A buyer's
   own uploaded picture for a word (customPics) replaces its
   emoji here too. */
function makeCustomItems(C, parsed, rng, customPics, packId, variantSel) {
  function picOf(n) { return picFor(C, packId, n, customPics, variantSel); }
  var items = [];
  parsed.forEach(function (p) {
    var target = p.noun;
    if (!target) {
      var found = nounsInSentence(C, 8, p.sentence);
      if (found.length) target = found[0];
    }
    if (!target) { items.push({ type: 'draw', sentence: p.sentence, custom: true }); return; }
    var inSentence = {};
    sentenceWords(p.sentence).forEach(function (w) { inSentence[w.toLowerCase()] = true; });
    var targetPic = picOf(target);
    var pool = C.phsCumulative(8).nouns.filter(function (n) {
      return n.c === target.c && n.w !== target.w && !inSentence[n.w] && picOf(n) !== targetPic;
    });
    if (pool.length < 2) { items.push({ type: 'draw', sentence: p.sentence, custom: true }); return; }
    /* two distractors whose pictures also differ from
       each other — a strip never shows one picture twice */
    var shuffledPool = shuffle(pool, rng);
    var ds = [];
    var seenPics = {};
    seenPics[targetPic] = true;
    for (var di = 0; di < shuffledPool.length && ds.length < 2; di++) {
      if (seenPics[picOf(shuffledPool[di])]) continue;
      seenPics[picOf(shuffledPool[di])] = true;
      ds.push(shuffledPool[di]);
    }
    if (ds.length < 2) { items.push({ type: 'draw', sentence: p.sentence, custom: true }); return; }
    items.push({
      type: 'circle', sentence: p.sentence, custom: true,
      correct: { w: target.w, e: targetPic },
      options: shuffle([target].concat(ds), rng).map(function (n) { return { w: n.w, e: picOf(n) }; })
    });
  });
  return items;
}

/* ---------- buyer's own words + pictures ---------- */

/* Multi-letter graphemes of English phonics. A grapheme is
   AVAILABLE at a level only when it actually occurs inside
   a cumulative bank word at that level (nouns / verbs /
   adjectives / places / extras — sight words are whole-word
   exceptions and never lend their letters). This keeps the
   custom-word check honest: "sh" unlocks exactly when the
   bank itself starts using it (Level 4), vowel teams at
   Level 7, and so on. */
var PHS_GRAPHEMES = ['tch', 'dge', 'igh',
  'sh', 'ch', 'th', 'wh', 'ck', 'ng', 'nk', 'qu', 'ph',
  'ai', 'ay', 'ea', 'ee', 'ey', 'ie', 'oa', 'oe', 'oo', 'ou', 'ow', 'oy', 'oi',
  'au', 'aw', 'ew', 'ue', 'ar', 'er', 'ir', 'or', 'ur'];

function graphemeInventory(C, levelId) {
  var cum = C.phsCumulative(levelId);
  var words = [];
  cum.nouns.forEach(function (n) { words.push(n.w); });
  ['verbs', 'adjectives', 'places', 'extras'].forEach(function (k) {
    cum[k].forEach(function (w) { words.push(String(w).toLowerCase()); });
  });
  var graphemes = {};
  PHS_GRAPHEMES.forEach(function (g) {
    if (words.some(function (w) { return w.indexOf(g) !== -1; })) graphemes[g] = true;
  });
  words.forEach(function (w) {
    for (var i = 0; i < w.length; i++) graphemes[w[i]] = true;
  });
  /* split digraphs (a_e as in cake): vowel + consonant +
     final e, available when a bank word shows the pattern */
  var split = {};
  words.forEach(function (w) {
    var m = /^.+([aeiou])[bcdfghjklmnpqrstvwxz]e$/.exec(w);
    if (m) split[m[1] + '_e'] = true;
  });
  return { graphemes: graphemes, split: split };
}

/* Try to segment a word into available graphemes
   (longest-first, with backtracking). A standalone final
   "e" is never a grapheme — a word-final e must arrive via
   a split digraph or a vowel team. Returns the grapheme
   list, or null when the word cannot be sounded out with
   the level's patterns. */
function segmentWord(word, inv) {
  function rec(pos, acc, hasVowel) {
    if (pos === word.length) return hasVowel ? acc : null;
    /* split digraph, only as the last three letters */
    if (pos + 3 === word.length && word[pos + 2] === 'e' &&
        'aeiou'.indexOf(word[pos]) !== -1 &&
        'bcdfghjklmnpqrstvwxz'.indexOf(word[pos + 1]) !== -1 &&
        inv.split[word[pos] + '_e']) {
      var done = rec(pos + 3, acc.concat(word[pos] + '_e'), true);
      if (done) return done;
    }
    var rest = word.slice(pos);
    var candidates = PHS_GRAPHEMES.filter(function (g) {
      return inv.graphemes[g] && rest.indexOf(g) === 0;
    }).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < candidates.length; i++) {
      var g = candidates[i];
      var r = rec(pos + g.length, acc.concat(g), hasVowel || /[aeiou]/.test(g));
      if (r) return r;
    }
    var ch = word[pos];
    if (inv.graphemes[ch] && !(ch === 'e' && pos === word.length - 1)) {
      return rec(pos + 1, acc.concat(ch), hasVowel || 'aeiou'.indexOf(ch) !== -1);
    }
    return null;
  }
  return rec(0, [], false);
}

/* validateCustomWord(C, levelId, word) -> { ok, reason?, word }
   The gate for the buyer's own added words:
   - 'letters': not one clean a-z word (2-14 letters);
   - 'bank': already usable at this level (bank word or a
     regular plural) — no need to add it;
   - 'sounds': cannot be sounded out with this level's
     graphemes (also rejects words that merely CONTAIN a
     not-yet-taught grapheme, e.g. "fish" before Level 4,
     even though f-i-s-h are all known letters). */
function validateCustomWord(C, levelId, rawWord) {
  var word = String(rawWord == null ? '' : rawWord).trim().toLowerCase();
  if (!/^[a-z]{2,14}$/.test(word)) return { ok: false, reason: 'letters', word: word };
  if (validateSentence(word, levelId, C).ok) return { ok: false, reason: 'bank', word: word };
  var inv = graphemeInventory(C, levelId);
  for (var i = 0; i < PHS_GRAPHEMES.length; i++) {
    var g = PHS_GRAPHEMES[i];
    if (!inv.graphemes[g] && word.indexOf(g) !== -1) {
      return { ok: false, reason: 'sounds', word: word };
    }
  }
  var seg = segmentWord(word, inv);
  if (!seg) return { ok: false, reason: 'sounds', word: word };
  return { ok: true, word: word, graphemes: seg };
}

/* A content view whose cumulative banks also carry the
   buyer's own words (at most 3, enforced by the caller):
   each custom word joins the nouns from the level it was
   validated at upwards, with its uploaded picture as its
   picture. Words that duplicate a bank noun are skipped —
   the customPics override covers those. Everything else
   about the content module is forwarded untouched. */
function contentWithCustomWords(C, customWords) {
  var list = (customWords || []).filter(function (cw) {
    return cw && cw.w && cw.img && cw.c;
  });
  if (!list.length) return C;
  var wrapped = {};
  Object.keys(C).forEach(function (k) { wrapped[k] = C[k]; });
  wrapped.phsCumulative = function (levelId) {
    var cum = C.phsCumulative(levelId);
    var have = {};
    cum.nouns.forEach(function (n) { have[n.w] = true; });
    var extra = list.filter(function (cw) {
      return (cw.level || 1) <= levelId && !have[cw.w];
    }).map(function (cw) {
      return { w: cw.w, e: cw.img, c: cw.c, custom: true };
    });
    if (extra.length) {
      cum = {
        nouns: cum.nouns.concat(extra), verbs: cum.verbs, adjectives: cum.adjectives,
        places: cum.places, names: cum.names, extras: cum.extras,
        sight: cum.sight, templates: cum.templates
      };
    }
    return cum;
  };
  return wrapped;
}

/* Map from a bank emoji to the buyer's uploaded picture,
   for the places that print a raw bank emoji rather than
   going through picFor: story-sequence step pictures and
   the covers' decorative sets. Only UNAMBIGUOUS emojis are
   mapped — an emoji shared by two bank words (🐶 = dog and
   pup) is never remapped, so one word's picture can never
   leak onto another word's story. */
function customDecoMap(C, customPics) {
  var map = {};
  if (!customPics) return map;
  var counts = {};
  C.phsCumulative(8).nouns.forEach(function (n) { counts[n.e] = (counts[n.e] || 0) + 1; });
  Object.keys(customPics).forEach(function (word) {
    var noun = nounByWord(C, 8, word);
    if (noun && counts[noun.e] === 1) map[noun.e] = customPics[word];
  });
  return map;
}

/* ---------- book data assembly ---------- */

/*
 * buildBookData(cfg, C) -> bookData
 * cfg: {
 *   level, title, childName, seed,
 *   pack: picture pack id (optional; 'classic' default) —
 *         changes the pictures, never the words,
 *   activities: [ { id, count } in print order ],
 *   customText: buyer's own-sentences text (optional; its
 *               strips join the Read & Circle section, or form
 *               their own section when circle is not selected),
 *   customPics: { word: dataURL } — the buyer's own uploaded
 *               pictures; they replace that word's picture
 *               everywhere and beat every picture pack,
 *   customWords: [ { w, img, c, level } ] — up to 3 words the
 *               buyer added with their own picture; each was
 *               validated as decodable at its level before
 *               being accepted (see validateCustomWord),
 *   picVariants: { word: variantIndex } — the rotation
 *               selection for the Illustrated pack (see
 *               nextVariantSelection); ignored by other packs
 * }
 * bookData: { id, level, levelName, title, childName,
 *   focusWords: [sight words], sections: [{ activity, items }],
 *   answerKeys: [{ activity, entries: [strings] }] }
 * Answer keys are derived HERE from the finished sections —
 * the same item objects the book prints.
 */
function buildBookData(cfg, C) {
  var level = C.phsLevelById(cfg.level);
  var customPics = cfg.customPics || {};
  var customWords = (cfg.customWords || []).slice(0, 3);
  /* from here on the engine works against a content view
     that also carries the buyer's own words */
  C = contentWithCustomWords(C, customWords);
  var seed = cfg.seed || ('L' + level.id + '|' + (cfg.title || '') + '|' + (cfg.childName || ''));
  var rng = makeRng(seed);
  var bookId = 'BOOK-' + hashSeedString(seed).toString(36).toUpperCase().slice(0, 6);
  var usedSet = {};
  var usedSeq = {};
  var sections = [];
  /* book context: pair uniqueness, per-section target
     rotation, and book-wide picture balancing */
  var pack = C.phsPicturePackById ? C.phsPicturePackById(cfg.pack || 'classic') : null;
  var ctx = {
    pairs: {}, nounUse: {}, picUse: {}, targetUse: {},
    pack: pack ? pack.id : 'classic', requireTarget: false,
    customPics: customPics, picVariants: cfg.picVariants || {},
    themeCats: (cfg.themeCats && cfg.themeCats.length) ? cfg.themeCats.slice() : null
  };

  (cfg.activities || []).forEach(function (act) {
    var def = C.phsActivityById(act.id);
    if (!def || !act.count) return;
    ctx.targetUse = {}; // target rotation is per section
    ctx.requireTarget = (act.id === 'circle' || act.id === 'builder');
    var items = [];
    for (var i = 0; i < act.count; i++) {
      var item = null;
      if (act.id === 'circle') item = makeCircleItem(C, level.id, rng, usedSet, ctx);
      else if (act.id === 'builder') item = makeBuilderItem(C, level.id, rng, usedSet, ctx);
      else if (act.id === 'draw') item = makeTextItem(C, level.id, rng, usedSet, 'draw', ctx);
      else if (act.id === 'trace') item = makeTextItem(C, level.id, rng, usedSet, 'trace', ctx);
      else if (act.id === 'comp') item = makeCompItem(C, level.id, rng, usedSet, ctx);
      else if (act.id === 'seq') item = makeSeqItem(C, level.id, rng, usedSeq);
      if (item) items.push(item);
    }
    if (items.length) sections.push({ activity: def, items: items });
  });
  ctx.requireTarget = false;

  /* sequence step pictures + cover decorations: a picture
     that is one word's unambiguous bank emoji takes that
     word's artwork in the book's one art source (under an
     artwork pack, at the rotated variant) — and the buyer's
     own uploaded picture still wins over the artwork. An
     emoji shared by 2+ bank words (🐶 = dog/pup) resolves
     through the step's own sentence, which names the word
     the step depicts. Glyphs that depict no bank word
     (actions, states, the reader character) stay emoji in
     every pack — they are scene dressing, not word art. */
  var decoMap = {};
  var nounsByEmoji = {};
  var artworkPack = pack && (pack.illustrated || pack.storybook) && C.PHS_PIC_LIB;
  if (artworkPack) {
    var emojiCount = {};
    var allNouns = C.phsCumulative(8).nouns;
    allNouns.forEach(function (n) {
      emojiCount[n.e] = (emojiCount[n.e] || 0) + 1;
      (nounsByEmoji[n.e] = nounsByEmoji[n.e] || []).push(n);
    });
    allNouns.forEach(function (n) {
      if (emojiCount[n.e] !== 1) return;
      var resolved = picFor(C, pack.id, n, null, ctx.picVariants);
      if (resolved && resolved.indexOf('assets/') === 0) decoMap[n.e] = resolved;
    });
  }
  var cdm = customDecoMap(C, customPics);
  Object.keys(cdm).forEach(function (k) { decoMap[k] = cdm[k]; });
  if (Object.keys(decoMap).length || artworkPack) {
    sections.forEach(function (s) {
      s.items.forEach(function (it) {
        if (it.type !== 'seq') return;
        function swap(st) {
          if (decoMap[st.pic]) return { pic: decoMap[st.pic], s: st.s };
          var cands = nounsByEmoji[st.pic];
          if (artworkPack && cands && cands.length > 1) {
            var words = sentenceWords(st.s);
            var named = cands.filter(function (n) { return words.indexOf(n.w) > -1; });
            if (named.length === 1) {
              var r = picFor(C, pack.id, named[0], null, ctx.picVariants);
              if (r && r.indexOf('assets/') === 0) return { pic: r, s: st.s };
            }
          }
          return st;
        }
        it.printed = it.printed.map(swap);
        it.correctOrder = it.correctOrder.map(swap);
      });
    });
  }

  /* own sentences */
  if (cfg.customText && String(cfg.customText).trim()) {
    var custom = makeCustomItems(C, parseCustomSentences(C, cfg.customText), rng, customPics, ctx.pack, ctx.picVariants);
    if (custom.length) {
      var circleSection = null;
      sections.forEach(function (s) { if (s.activity.id === 'circle') circleSection = s; });
      var circleItems = custom.filter(function (it) { return it.type === 'circle'; });
      var drawItems = custom.filter(function (it) { return it.type === 'draw'; });
      if (circleSection && circleItems.length) {
        circleSection.items = circleSection.items.concat(circleItems);
        custom = drawItems;
      }
      if (custom.length) {
        sections.push({
          activity: { id: 'custom', name: 'My Own Sentences', answers: true, how: 'Read each sentence and circle the matching picture, or draw it.' },
          items: custom
        });
      }
    }
  }

  var answerKeys = deriveAnswerKeys(sections);
  var cum = C.phsCumulative(level.id);
  return {
    id: bookId, level: level.id, levelName: level.name, patterns: level.patterns,
    title: cfg.title || 'My Reading Book', childName: cfg.childName || '',
    pack: ctx.pack, themeCats: ctx.themeCats, deco: pack && pack.deco ? pack.deco : null,
    customPics: customPics, customWords: customWords, customDeco: decoMap,
    picVariants: ctx.picVariants,
    focusWords: cum.sight.slice(), sections: sections, answerKeys: answerKeys, seed: seed
  };
}

/*
 * finalizeBookData(C, data) — re-derive everything that
 * depends on the (possibly buyer-edited) items, right before
 * a book is built:
 *   - Read & Circle: if an edit left the correct word OUT of
 *     the printed sentence, and exactly one option word IS in
 *     the sentence, that word becomes the correct one — the
 *     answer key can then never name a word the sentence
 *     does not contain.
 *   - Sentence Builder: the answer must be a word in the
 *     printed sentence (if an edit stranded the old answer,
 *     the first bank noun in the sentence takes its place);
 *     the picture, the blanked sentence and the choices are
 *     rebuilt from the answer.
 *   - Story Sequencing: printed step sentences are synced
 *     from the (possibly edited) correct order.
 *   - Answer keys are re-derived from the finished items.
 * Pure with respect to its inputs' identity: it mutates and
 * returns `data`. Deterministic (seeded from the book id).
 */
function finalizeBookData(C, data) {
  if (!data || !data.sections) return data;
  var CW = contentWithCustomWords(C, data.customWords || []);
  var rng = makeRng(data.id + '|build');
  function findNoun(word) {
    for (var i = 0; i < (data.customWords || []).length; i++) {
      if (data.customWords[i].w === word) {
        return { w: word, e: data.customWords[i].img, c: data.customWords[i].c, custom: true };
      }
    }
    return nounByWord(CW, data.level, word);
  }
  function picOf(noun) {
    return picFor(C, data.pack, noun, data.customPics, data.picVariants);
  }
  data.sections.forEach(function (section) {
    section.items.forEach(function (item) {
      if (item.type === 'circle') {
        var words = {};
        sentenceWords(item.sentence).forEach(function (w) { words[w.toLowerCase()] = true; });
        if (item.correct && !words[String(item.correct.w).toLowerCase()]) {
          var inSent = (item.options || []).filter(function (o) { return words[String(o.w).toLowerCase()]; });
          if (inSent.length === 1) item.correct = { w: inSent[0].w, e: inSent[0].e };
        }
      } else if (item.type === 'builder') {
        var inSentence = new RegExp('\\b' + String(item.answer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')
          .test(item.sentence || '');
        if (!inSentence) {
          var candidates = nounsInSentence(CW, data.level, item.sentence);
          if (candidates.length) item.answer = candidates[0].w;
        }
        var noun = findNoun(item.answer);
        if (noun && new RegExp('\\b' + item.answer + '\\b', 'i').test(item.sentence || '')) {
          item.pic = { w: noun.w, e: picOf(noun) };
          item.blanked = item.sentence.replace(new RegExp('\\b' + item.answer + '\\b', 'i'), '______');
          var ds = distractorsFor(CW, data.level, item.sentence, noun, rng,
            { pack: data.pack, customPics: data.customPics, picVariants: data.picVariants });
          item.choices = shuffle([noun.w].concat(ds.map(function (x) { return x.w; })), rng);
        }
      } else if (item.type === 'seq') {
        item.printed = item.printed.map(function (p) {
          var match = item.correctOrder.filter(function (st) { return st.pic === p.pic; })[0];
          return match ? { pic: p.pic, s: match.s } : p;
        });
      }
    });
  });
  data.answerKeys = deriveAnswerKeys(data.sections);
  return data;
}

/* Answer keys from the printed rows themselves. */
function deriveAnswerKeys(sections) {
  var keys = [];
  sections.forEach(function (s) {
    var entries = [];
    s.items.forEach(function (it) {
      if (it.type === 'circle') entries.push(it.correct.w);
      else if (it.type === 'builder') entries.push(it.answer);
      else if (it.type === 'comp') {
        entries.push(it.questions.map(function (q) { return q.answer; }).join(' · '));
      } else if (it.type === 'seq') {
        entries.push(it.correctOrder.map(function (st) { return st.s; }).join(' → '));
      }
    });
    if (entries.length) keys.push({ activity: s.activity, entries: entries });
  });
  return keys;
}

/* Editor text formats (list-editor pattern): circle items as
   "Sentence | emoji" lines — the inverse pair used by the
   app's Content editor for the strip activities. */
function formatCircleForEditor(items) {
  return (items || []).filter(function (it) { return it.type === 'circle'; })
    .map(function (it) { return it.sentence + ' | ' + it.correct.e; }).join('\n');
}

var PhonicsEngine = {
  hashSeedString: hashSeedString, mulberry32: mulberry32, makeRng: makeRng,
  shuffle: shuffle, pick: pick,
  allowedWordSet: allowedWordSet, sentenceWords: sentenceWords,
  normalizeSentenceKey: normalizeSentenceKey, picFor: picFor, picCandidates: picCandidates,
  nextVariantSelection: nextVariantSelection,
  validateSentence: validateSentence,
  nounByWord: nounByWord, nounsInCategory: nounsInCategory, nounsInSentence: nounsInSentence,
  fillTemplate: fillTemplate, generateSentence: generateSentence,
  distractorsFor: distractorsFor, exactlyOneMatch: exactlyOneMatch,
  targetPoolExhausted: targetPoolExhausted,
  makeCircleItem: makeCircleItem, makeBuilderItem: makeBuilderItem,
  makeTextItem: makeTextItem, makeCompItem: makeCompItem, makeSeqItem: makeSeqItem,
  graphemeInventory: graphemeInventory, segmentWord: segmentWord,
  validateCustomWord: validateCustomWord,
  contentWithCustomWords: contentWithCustomWords, customDecoMap: customDecoMap,
  parseCustomSentences: parseCustomSentences, makeCustomItems: makeCustomItems,
  buildBookData: buildBookData, finalizeBookData: finalizeBookData, deriveAnswerKeys: deriveAnswerKeys,
  formatCircleForEditor: formatCircleForEditor
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PhonicsEngine;
}
