/*
 * ============================================================
 *  PhonicsStrip Studio Pro — print book renderer
 * ============================================================
 *  Pure string building (no DOM): renders book data (from
 *  engine.buildBookData) into print-ready pages —
 *    front cover → belongs-to → how-to → focus words →
 *    activity sections → progress tracker → certificate →
 *    answer keys → back cover
 *  Answer keys render from bookData.answerKeys, which the
 *  engine derived from the very items that print.
 *
 *  Pagination is deterministic: pages are assembled in JS
 *  with conservative per-activity capacities, and counted
 *  as they are built (pageCount === number of page divs).
 *  Pages are packed greedily (paginateItems) so that no
 *  picture emoji ever repeats on one printed page; item
 *  numbers follow the section order, keeping the answer
 *  keys aligned with the printed rows.
 *
 *  Also home to the KDP Wrap Cover Builder maths + renderer:
 *  spine = pages × paper factor (white 0.002252 in/page,
 *  cream 0.0025 in/page); total width = 0.125 bleed + back
 *  trim + spine + front trim + 0.125 bleed; height = trim
 *  height + 0.25.
 * ============================================================
 */
'use strict';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* A picture value is an emoji string, a bundled artwork
   path (assets/pics/… from the Illustrated library), or the
   buyer's own uploaded picture (a data:image URL produced
   by the app's downscaler — base64 only, so it is
   attribute-safe). Images render as a real <img> fitted
   inside the same box the emoji occupied; anything else
   renders as text. */
function isPicDataUrl(e) {
  return typeof e === 'string' && e.indexOf('data:image/') === 0;
}
function isPicAsset(e) {
  return typeof e === 'string' && e.indexOf('assets/') === 0;
}
function picHtml(e) {
  if (isPicDataUrl(e) || isPicAsset(e)) return '<img class="pic-img" src="' + e + '" alt="">';
  return esc(e);
}

var TRIMS = {
  letter: { w: '8.5in', h: '11in', label: 'US Letter 8.5×11', wmm: 215.9, hmm: 279.4, win: 8.5, hin: 11 },
  a4: { w: '210mm', h: '297mm', label: 'A4', wmm: 210, hmm: 297, win: 8.27, hin: 11.69 },
  '8.5x10': { w: '8.5in', h: '10in', label: '8.5×10', wmm: 215.9, hmm: 254, win: 8.5, hin: 10 }
};
var PAGE_MARGIN_MM = 10;

/* items per page by activity — conservative so a page never
   overflows its frame in print (checked for the shortest
   trim, 8.5×10, as well as Letter/A4). */
var CAPACITY = { circle: 4, builder: 4, draw: 2, trace: 3, comp: 1, seq: 1, custom: 4 };
function capacityFor(type) { return CAPACITY[type] || 4; }

/* ---------- CSS ---------- */

function effectiveDesign(design, opts) {
  if (!opts.inkSaver) return design;
  var d = {};
  Object.keys(design).forEach(function (k) { d[k] = design[k]; });
  d.pageBg = '#ffffff'; d.cardBg = '#ffffff'; d.headerBg = '#ffffff';
  d.headerText = '#111111'; d.cellBg = '#ffffff'; d.cellAlt = '#ffffff';
  d.cellText = '#111111'; d.cellBorder = '#555555'; d.accent = '#111111';
  d.freeBg = '#eeeeee'; d.borderStyle = 'solid';
  d.coverBg = '#ffffff'; d.coverText = '#111111'; d.bandBg = '#ffffff';
  return d;
}

/* The pictures an item prints, as emoji strings — the unit
   of the no-repeat-on-a-page rule. */
function itemPics(it) {
  switch (it.type) {
    case 'circle': return it.options.map(function (o) { return o.e; });
    case 'builder': return [it.pic.e];
    case 'comp': return String(it.scene || '').split(/\s+/).filter(function (s) { return s.length > 0; });
    case 'seq': return it.printed.map(function (st) { return st.pic; });
    default: return [];
  }
}

/* Greedy page packing: items keep their book order as far
   as possible, but an item is only placed on a page when
   NONE of its pictures already appears on that page (and
   the page has room); otherwise it starts or joins a later
   page. Returns pages of { it, n } where n is the item's
   number in its section — numbering follows the section
   order, so the answer keys (derived from the same order)
   always match the printed numbers. */
function paginateItems(items, capFor, kindOf) {
  var pages = [];
  (items || []).forEach(function (it, idx) {
    var kind = kindOf(it);
    var cap = capFor(it, kind);
    var pics = itemPics(it);
    var placed = null;
    for (var p = 0; p < pages.length; p++) {
      var pg = pages[p];
      if (pg.kind !== kind || pg.entries.length >= cap) continue;
      var clash = false;
      for (var i = 0; i < pics.length; i++) if (pg.pics[pics[i]]) { clash = true; break; }
      if (!clash) { placed = pg; break; }
    }
    if (!placed) { placed = { kind: kind, pics: {}, entries: [] }; pages.push(placed); }
    pics.forEach(function (e) { placed.pics[e] = true; });
    placed.entries.push({ it: it, n: idx + 1 });
  });
  return pages.map(function (pg) { return pg.entries; });
}

/* Decorative set for a book: the picture pack's deco when
   the book uses one, else the design's own. A decorative
   emoji that is one word's unambiguous bank emoji takes
   that word's own uploaded picture instead (the engine
   built data.customDeco for exactly this). */
function decoFor(data, opts, design) {
  var deco = (opts && opts.pack && opts.pack.deco) || (data && data.deco) || null;
  var map = (data && data.customDeco) || null;
  function apply(list) {
    return (list || []).map(function (e) { return (map && map[e]) || e; });
  }
  return {
    cluster: apply((deco && deco.cluster) || design.cluster),
    tiles: apply((deco && deco.tiles) || design.tiles),
    star: (deco && deco.star) || '☆'
  };
}

var ACT_ICONS = { circle: '🎯', draw: '✏️', comp: '🔍', trace: '✍️', seq: '🔢', builder: '🧩', custom: '⭐' };
var LEVELS_SHORT = ['Short A', 'Short I & O', 'Short E & U', 'Digraphs', 'Blends', 'Silent E', 'Vowel Teams', 'R-Controlled'];

function bookCss(design, opts) {
  var d = effectiveDesign(design, opts);
  var T = TRIMS[opts.trim] || TRIMS.letter;
  var coverH = (T.hmm - 2 * PAGE_MARGIN_MM - 1.5).toFixed(1) + 'mm';
  var bw = opts.bw ? '.bk-page .pic { filter: grayscale(1); }' : '';
  return '' +
  '@page { size: ' + T.w + ' ' + T.h + '; margin: ' + PAGE_MARGIN_MM + 'mm; }' +
  '.bk-page { page-break-after: always; break-after: page; font-family: ' + d.cellFont + '; color: ' + d.cellText + '; }' +
  '.bk-page:last-child { page-break-after: auto; break-after: auto; }' +
  bw +
  /* shared bits */
  '.pg-head { background: ' + d.headerBg + '; color: ' + d.headerText + '; font-family: ' + d.headerFont + '; border-radius: ' + (d.radius + 8) + 'px; padding: 3mm 5mm; margin-bottom: 4mm; }' +
  '.pg-head .ph-title { font-size: 17pt; font-weight: bold; }' +
  '.pg-head .ph-how { font-size: 10.5pt; opacity: .92; font-family: ' + d.cellFont + '; margin-top: 1mm; }' +
  '.pg-foot { display: flex; justify-content: space-between; font-size: 8pt; opacity: .7; margin-top: 4mm; }' +
  /* covers — full, rich, unique per design: layered
     designed background, patterned bands, hero cluster,
     framed title plate, badges, what's-inside card and a
     decorative tile row. No live strip preview. */
  '.bk-cover { position: relative; text-align: center; height: ' + coverH + '; box-sizing: border-box; overflow: hidden; padding: 0 7mm; background: ' + d.coverBg + '; color: ' + d.coverText + '; }' +
  /* master cover template (v2): series pill · corner level
     badge · big title · subtitle · belongs-to ribbon · ONE
     hero illustration stage · compact what's-inside · tiles
     · brand footband — same skeleton for every design */
  '.cov-level-badge { position: absolute; top: 11mm; right: 5mm; background: ' + d.headerBg + '; color: ' + d.headerText + '; border-radius: ' + d.radius + 'px; padding: 2.2mm 3.5mm; text-align: center; line-height: 1.3; }' +
  '.cov-level-badge .clb-name { display: block; font-family: ' + d.headerFont + '; font-size: 10pt; font-weight: bold; }' +
  '.cov-level-badge .clb-ages { display: block; font-size: 8pt; letter-spacing: 2px; }' +
  '.cov-series { margin-top: 1mm; }' +
  '.bk-cover h1.cov-title { font-family: ' + d.headerFont + '; font-size: 34pt; margin: 4mm 0 1.5mm; color: ' + d.headerBg + '; line-height: 1.12; }' +
  '.cov-patterns { font-size: 11pt; color: ' + d.cellText + '; }' +
  '.cov-subtitle { font-size: 13pt; letter-spacing: 1.5px; margin-top: 2mm; color: ' + d.cellText + '; }' +
  '.cov-badges { margin-top: 3.5mm; }' +
  '.cov-belongs { display: inline-block; margin-top: 5mm; background: ' + d.accent + '; color: #ffffff; font-size: 12.5pt; padding: 2.6mm 7mm; border-radius: 999px; }' +
  '.cov-belongs b { text-decoration: underline; }' +
  '.cov-hero-stage { margin-top: 6mm; border-radius: ' + (d.radius + 6) + 'px; background: ' + (d.heroBg || 'transparent') + '; padding: 7mm 4mm 5mm; display: flex; align-items: flex-end; justify-content: center; gap: 6mm; min-height: 58mm; box-sizing: border-box; }' +
  '.cov-hero-main { font-size: 64pt; line-height: 1.1; }' +
  '.cov-hero-side { font-size: 40pt; line-height: 1.1; }' +
  '.cov-prodline { font-size: 8.5pt; letter-spacing: 2px; opacity: .85; margin-top: 1.5mm; }' +
  /* back-cover staircase: the 8 levels as rising steps */
  '.back-stairs { display: flex; align-items: flex-end; justify-content: center; gap: 2mm; margin-top: 2mm; }' +
  '.lvl-pill.stair { border-radius: 2.5mm 2.5mm 0 0; width: 15.5mm; display: flex; align-items: flex-end; justify-content: center; padding: 0 0 1.2mm; font-size: 8.5pt; box-sizing: border-box; }' +
  '.back-cert-note { font-size: 11pt; margin-top: 5mm; color: ' + d.headerBg + '; font-weight: bold; }' +
  /* interior polish: page number in a decorative circle */
  '.pg-num { text-align: center; margin-top: 3mm; }' +
  '.pg-num span { display: inline-block; width: 8mm; height: 8mm; line-height: 8mm; text-align: center; border: 1.8px solid ' + d.accent + '; border-radius: 50%; background: ' + d.cardBg + '; color: ' + d.headerBg + '; font-size: 9.5pt; }' +
  '.ph-corner { float: right; font-size: 15pt; line-height: 1; margin-left: 3mm; }' +
  '.cov-band { height: 7mm; margin: 0 -7mm; background: ' + d.bandBg + '; }' +
  '.cov-band-top { margin-bottom: 6mm; }' +
  '.cov-band-bottom { margin-top: 6mm; }' +
  '.cov-pills { display: flex; flex-wrap: wrap; gap: 3mm; justify-content: center; }' +
  '.cov-pill { display: inline-block; background: ' + d.headerBg + '; color: ' + d.headerText + '; font-size: 9.5pt; font-weight: bold; letter-spacing: 2px; padding: 2mm 5mm; border-radius: 999px; }' +
  '.cov-pill.alt { background: ' + d.accent + '; color: #ffffff; }' +
  '.cov-pill.dec { background: ' + d.cardBg + '; color: ' + d.headerBg + '; border: 2.2px solid ' + d.headerBg + '; letter-spacing: 1.5px; }' +
  '.cov-hero { font-size: 58pt; line-height: 1.15; margin-top: 5mm; }' +
  '.cov-cluster { font-size: 23pt; letter-spacing: 7px; margin-top: 1mm; }' +
  '.cov-plate { background: ' + d.accent + '; border-radius: ' + (d.radius + 4) + 'px; padding: 2.2mm; margin-top: 6mm; }' +
  '.cov-plate-in { background: ' + d.cardBg + '; border-radius: ' + d.radius + 'px; padding: 7mm 6mm 6mm; }' +
  '.bk-cover h1 { font-family: ' + d.headerFont + '; font-size: 31pt; margin: 0 0 3mm; color: ' + d.headerBg + '; line-height: 1.15; }' +
  '.cov-level { font-family: ' + d.headerFont + '; font-size: 14pt; color: ' + d.cellText + '; }' +
  '.cov-for { font-size: 13.5pt; margin-top: 3.5mm; color: ' + d.cellText + '; }' +
  '.cov-dec-row { margin-top: 6mm; }' +
  '.cov-inside { background: ' + d.cardBg + '; border: 2.2px solid ' + d.cellBorder + '; border-radius: ' + d.radius + 'px; padding: 4mm 5mm 3mm; margin-top: 5mm; text-align: left; }' +
  '.cov-inside h3 { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 13pt; text-align: center; margin: 0 0 2.5mm; }' +
  '.cov-inside ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 8mm; }' +
  '.cov-inside li { font-size: 10.5pt; line-height: 1.4; margin-bottom: 1.6mm; break-inside: avoid; color: ' + d.cellText + '; }' +
  '.cov-tiles { display: flex; gap: 3mm; justify-content: center; margin-top: 4.5mm; }' +
  '.cov-tile { background: ' + d.cardBg + '; border: 2px solid ' + d.cellBorder + '; border-radius: ' + d.radius + 'px; width: 14.5mm; height: 14.5mm; font-size: 17pt; line-height: 14.5mm; text-align: center; }' +
  '.cov-footband { margin-top: 4.5mm; background: ' + d.headerBg + '; color: ' + d.headerText + '; font-size: 11pt; padding: 3.4mm 5mm; border-radius: ' + d.radius + 'px; line-height: 1.5; }' +
  '.cov-footband .cov-bizline { font-size: 9.5pt; letter-spacing: 2px; opacity: .9; }' +
  '.cov-frame { border: 3px ' + d.borderStyle + ' ' + d.accent + '; border-radius: ' + d.radius + 'px; padding: 10mm 8mm; background: ' + d.cardBg + '; }' +
  '.cov-motif { font-size: 44pt; margin-bottom: 3mm; }' +
  '.cov-biz { margin-top: 7mm; font-size: 10pt; letter-spacing: 1px; }' +
  /* front matter */
  '.bk-front { text-align: center; padding: 12mm 8mm; background: ' + d.pageBg + '; }' +
  '.bk-front .cov-frame { padding: 14mm 10mm; }' +
  '.bk-front h2 { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 22pt; margin: 0 0 5mm; }' +
  '.bk-front p { font-size: 12.5pt; line-height: 1.7; }' +
  '.belong-name { border-bottom: 2px solid ' + d.cellText + '; height: 13mm; margin: 6mm 14mm 2mm; font-size: 16pt; }' +
  '.front-small { font-size: 9pt; opacity: .65; margin-top: 10mm; line-height: 1.5; }' +
  '.bk-howto h2, .bk-focus h2 { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 19pt; margin: 0 0 4mm; }' +
  '.bk-howto p, .bk-howto li { font-size: 11.5pt; line-height: 1.6; }' +
  '.bk-howto ul { margin: 0 0 0 6mm; padding: 0; }' +
  '.bk-howto li { margin-bottom: 2.2mm; }' +
  '.focus-grid { display: flex; flex-wrap: wrap; gap: 3.5mm; margin-top: 4mm; }' +
  '.focus-word { border: 2px solid ' + d.cellBorder + '; background: ' + d.cellBg + '; border-radius: ' + d.radius + 'px; font-size: 17pt; padding: 2.5mm 6mm; min-width: 24mm; text-align: center; }' +
  '.focus-note { font-size: 11pt; line-height: 1.6; margin-top: 5mm; }' +
  /* strips: read & circle / builder */
  '.strip { border: 2.2px solid ' + d.cellBorder + '; border-radius: ' + d.radius + 'px; background: ' + d.cardBg + '; padding: 3.5mm 4mm; margin-bottom: 4.5mm; }' +
  '.st-top { display: flex; align-items: baseline; gap: 3mm; }' +
  '.st-n { font-weight: bold; color: ' + d.accent + '; font-size: 13pt; }' +
  '.st-sentence { font-size: 14.5pt; line-height: 1.35; }' +
  '.st-pics { display: flex; gap: 4mm; margin-top: 3mm; }' +
  '.pic-box { flex: 1; border: 1.8px solid ' + d.cellBorder + '; border-radius: ' + d.radius + 'px; background: ' + d.cellBg + '; text-align: center; padding: 2mm 1mm 1.5mm; }' +
  '.pic-box .pic { font-size: 27pt; line-height: 1.25; }' +
  /* the buyer's own uploaded pictures: same box as the
     emoji, fitted whole on white, never cropped */
  '.pic-img { object-fit: contain; background: #ffffff; vertical-align: middle; }' +
  '.pic img.pic-img { height: 14mm; max-width: 95%; }' +
  '.builder-pic .pic img.pic-img { height: 20mm; }' +
  '.seq-pic .pic img.pic-img { height: 20mm; }' +
  '.comp-scene img.pic-img { height: 15mm; }' +
  '.cov-tile img.pic-img { height: 9.5mm; }' +
  '.cov-cluster img.pic-img { height: 9mm; }' +
  '.st-choices { display: flex; gap: 4mm; margin-top: 3mm; }' +
  '.st-choice { flex: 1; border: 1.8px solid ' + d.cellBorder + '; border-radius: 999px; background: ' + d.cellAlt + '; text-align: center; font-size: 13pt; padding: 1.6mm 2mm; }' +
  '.st-write { border-bottom: 1.4px dotted ' + d.cellBorder + '; height: 8mm; margin-top: 3mm; }' +
  '.builder-flex { display: flex; gap: 4mm; align-items: center; }' +
  '.builder-pic { width: 30mm; flex: none; }' +
  '.builder-pic .pic-box { height: 30mm; }' +
  '.builder-pic .pic { font-size: 27pt; }' +
  '.builder-main { flex: 1; }' +
  /* read & draw */
  '.draw-frame { border: 2.2px solid ' + d.cellBorder + '; border-radius: ' + d.radius + 'px; background: #ffffff; height: 74mm; margin-top: 3mm; }' +
  '.draw-item { margin-bottom: 5mm; }' +
  /* trace */
  '.tr-item { margin-bottom: 6mm; }' +
  '.tr-ruled { position: relative; height: 15mm; border-top: 1.4px solid #8bb8d8; border-bottom: 1.4px solid #d88a8a; margin-top: 2.5mm; }' +
  '.tr-ruled::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; border-top: 1.4px dashed #b9c8d4; }' +
  '.tr-text { font-size: 20pt; line-height: 15mm; color: #c4c4c4; letter-spacing: .5px; padding-left: 2mm; white-space: nowrap; overflow: hidden; }' +
  '.tr-label { font-size: 10pt; opacity: .7; }' +
  /* comprehension */
  '.comp-scene { text-align: center; font-size: 40pt; letter-spacing: 6px; margin: 2mm 0 4mm; }' +
  '.comp-passage { font-size: 15pt; line-height: 1.65; border: 2.2px solid ' + d.cellBorder + '; border-radius: ' + d.radius + 'px; background: ' + d.cellAlt + '; padding: 4mm 5mm; }' +
  '.comp-q { margin-top: 5mm; }' +
  '.comp-q .q-text { font-size: 13.5pt; font-weight: bold; }' +
  '.comp-q .q-label { color: ' + d.accent + '; }' +
  /* sequencing */
  '.seq-pics { display: flex; gap: 4mm; margin-top: 3mm; }' +
  '.seq-pic { flex: 1; text-align: center; }' +
  '.seq-pic .pic-box { height: 34mm; }' +
  '.seq-pic .pic { font-size: 30pt; line-height: 1.6; }' +
  '.seq-num { width: 11mm; height: 11mm; border: 2px solid ' + d.cellText + '; border-radius: 50%; margin: 2.5mm auto 0; font-size: 13pt; line-height: 11mm; background: #ffffff; }' +
  '.seq-sent { display: flex; align-items: center; gap: 3mm; margin-top: 4mm; font-size: 13.5pt; }' +
  '.seq-sent .seq-num { margin: 0; flex: none; text-align: center; }' +
  /* tracker + certificate */
  '.bk-track h2 { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 19pt; margin: 0 0 3mm; }' +
  '.track-row { display: flex; align-items: center; gap: 4mm; border-bottom: 1.4px dotted ' + d.cellBorder + '; padding: 2.6mm 0; }' +
  '.track-name { width: 52mm; flex: none; font-size: 12pt; font-weight: bold; }' +
  '.track-stars { font-size: 15pt; letter-spacing: 2px; color: ' + d.accent + '; }' +
  '.bk-cert { background: ' + d.pageBg + '; padding: 8mm 4mm; }' +
  '.cert-frame { border: 4px ' + d.borderStyle + ' ' + d.accent + '; border-radius: ' + d.radius + 'px; background: ' + d.cardBg + '; text-align: center; padding: 16mm 10mm; }' +
  '.cert-badge { font-size: 10pt; letter-spacing: 3px; color: ' + d.accent + '; }' +
  '.cert-frame h2 { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 27pt; margin: 5mm 0 2mm; }' +
  '.cert-sub { font-size: 13pt; margin-bottom: 6mm; }' +
  '.cert-name { border-bottom: 1.8px solid ' + d.cellText + '; height: 13mm; margin: 0 16mm; font-size: 17pt; }' +
  '.cert-namelabel { font-size: 9.5pt; opacity: .7; margin-top: 1.5mm; }' +
  '.cert-cols { display: flex; gap: 14mm; margin: 10mm 10mm 0; }' +
  '.cert-col { flex: 1; border-top: 1.4px solid ' + d.cellText + '; padding-top: 1.5mm; font-size: 9.5pt; opacity: .8; }' +
  /* answer keys */
  '.bk-keys h2 { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 17pt; margin: 0 0 4mm; }' +
  '.bk-keys ol { margin: 0 0 0 6mm; padding: 0; columns: 2; column-gap: 10mm; }' +
  '.bk-keys li { font-size: 11pt; line-height: 1.5; margin-bottom: 1.8mm; break-inside: avoid; }' +
  /* back cover — same design language as the front */
  '.bk-back { text-align: center; height: ' + coverH + '; box-sizing: border-box; overflow: hidden; padding: 0 7mm; background: ' + d.coverBg + '; color: ' + d.coverText + '; }' +
  '.back-card { background: ' + d.cardBg + '; border: 3px solid ' + d.accent + '; border-radius: ' + d.radius + 'px; padding: 7mm 7mm 6mm; color: ' + d.cellText + '; }' +
  '.bk-back h2 { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 20pt; margin: 0 0 4mm; }' +
  '.bk-back h3 { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 13pt; margin: 4.5mm 0 2.5mm; }' +
  '.back-list { display: inline-block; text-align: left; font-size: 11.5pt; line-height: 1.5; margin: 0; padding: 0; list-style: none; }' +
  '.back-how { font-size: 11.5pt; line-height: 1.65; margin: 0; }' +
  '.back-series { display: flex; flex-wrap: wrap; gap: 2.2mm; justify-content: center; margin-top: 1mm; }' +
  '.lvl-pill { border: 2px solid ' + d.headerBg + '; color: ' + d.headerBg + '; background: ' + d.cellBg + '; border-radius: 999px; padding: 1.2mm 3.5mm; font-size: 9pt; }' +
  '.lvl-pill.cur { background: ' + d.headerBg + '; color: ' + d.headerText + '; font-weight: bold; }' +
  '.back-thanks { margin-top: 5mm; font-size: 14.5pt; font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; }' +
  '.back-biz { margin-top: 1.5mm; font-size: 10pt; letter-spacing: 1px; }' +
  '.back-copy { margin-top: 4.5mm; font-size: 8.5pt; line-height: 1.55; opacity: .75; }' +
  '.bk-barcode { margin-top: 4.5mm; }' +
  '.bk-barcode .bars { display: flex; justify-content: center; align-items: stretch; height: 12mm; }' +
  '.bk-barcode .bar { background: #1a1a1a; margin-right: 0.55mm; }' +
  '.bk-barcode .bc-label { font-size: 8.5pt; letter-spacing: 2.5px; margin-top: 1.6mm; }' +
  '';
}

/* ---------- item renderers ---------- */

function footHtml(data, opts) {
  return '<div class="pg-foot"><span>' + esc(opts.business || 'Songlap Deals') + '</span><span>' +
    esc(data.id) + ' · ' + esc(data.levelName) + '</span></div>';
}
function headHtml(section, data, opts) {
  var corner = (opts && opts.design && opts.design.corner)
    ? '<span class="ph-corner">' + esc(opts.design.corner) + '</span>' : '';
  return '<div class="pg-head">' + corner + '<div class="ph-title">' + esc(section.activity.name) + '</div>' +
    '<div class="ph-how">' + esc(section.activity.how || '') + '</div></div>';
}

function circleItemHtml(it, n) {
  var pics = it.options.map(function (o) {
    return '<div class="pic-box"><div class="pic">' + picHtml(o.e) + '</div></div>';
  }).join('');
  return '<div class="strip"><div class="st-top"><span class="st-n">' + n + '.</span>' +
    '<span class="st-sentence">' + esc(it.sentence) + '</span></div>' +
    '<div class="st-pics">' + pics + '</div></div>';
}

function builderItemHtml(it, n) {
  var choices = it.choices.map(function (c) {
    return '<span class="st-choice">' + esc(c) + '</span>';
  }).join('');
  return '<div class="strip"><div class="builder-flex">' +
    '<div class="builder-pic"><div class="pic-box"><div class="pic">' + picHtml(it.pic.e) + '</div></div></div>' +
    '<div class="builder-main"><div class="st-top"><span class="st-n">' + n + '.</span>' +
    '<span class="st-sentence">' + esc(it.blanked) + '</span></div>' +
    '<div class="st-choices">' + choices + '</div>' +
    '<div class="st-write"></div></div></div></div>';
}

function drawItemHtml(it, n) {
  return '<div class="draw-item"><div class="st-top"><span class="st-n">' + n + '.</span>' +
    '<span class="st-sentence">' + esc(it.sentence) + '</span></div>' +
    '<div class="draw-frame"></div></div>';
}

function traceItemHtml(it, n) {
  return '<div class="tr-item"><div class="st-top"><span class="st-n">' + n + '.</span>' +
    '<span class="tr-label">Trace it, then write it:</span></div>' +
    '<div class="tr-ruled"><div class="tr-text">' + esc(it.sentence) + '</div></div>' +
    '<div class="tr-ruled"></div></div>';
}

function compItemHtml(it) {
  var qs = it.questions.map(function (q) {
    var choices = q.choices.map(function (c) {
      return '<span class="st-choice">' + esc(c) + '</span>';
    }).join('');
    return '<div class="comp-q"><span class="q-label">' + esc(q.label) + ':</span> ' +
      '<span class="q-text">' + esc(q.q) + '</span><div class="st-choices">' + choices + '</div></div>';
  }).join('');
  return '<div class="comp-scene">' + String(it.scene || '').split(/\s+/)
    .filter(function (t) { return t.length > 0; }).map(picHtml).join(' ') + '</div>' +
    '<div class="comp-passage">' + esc(it.passage) + '</div>' + qs;
}

function seqItemHtml(it) {
  var pics = it.printed.map(function (st) {
    return '<div class="seq-pic"><div class="pic-box"><div class="pic">' + picHtml(st.pic) + '</div></div>' +
      '<div class="seq-num"></div></div>';
  }).join('');
  var sents = it.printed.map(function (st) {
    return '<div class="seq-sent"><span class="seq-num"></span><span>' + esc(st.s) + '</span></div>';
  }).join('');
  return '<h3 style="font-size:15pt;margin:0 0 1mm">' + esc(it.title) + '</h3>' +
    '<div class="seq-pics">' + pics + '</div>' + sents;
}

function itemHtml(it, n) {
  switch (it.type) {
    case 'circle': return circleItemHtml(it, n);
    case 'builder': return builderItemHtml(it, n);
    case 'draw': return drawItemHtml(it, n);
    case 'trace': return traceItemHtml(it, n);
    case 'comp': return compItemHtml(it);
    case 'seq': return seqItemHtml(it);
    default: return '';
  }
}

/* ---------- section pages ---------- */

function sectionPages(section, data, opts) {
  var isCustom = section.activity.id === 'custom';
  /* Own-sentences sections mix circle + draw items; each
     kind paginates with its own capacity. Every section
     paginates greedily (paginateItems): no picture ever
     repeats on a printed page, and item numbers follow
     the section order so answer keys always match. */
  var capFor = function (it) {
    return isCustom ? (it.type === 'draw' ? 2 : 4) : capacityFor(section.activity.id);
  };
  var kindOf = function (it) { return isCustom ? it.type : section.activity.id; };
  return paginateItems(section.items, capFor, kindOf).map(function (entries) {
    return '<div class="bk-page">' + headHtml(section, data, opts) +
      entries.map(function (x) { return itemHtml(x.it, x.n); }).join('') +
      footHtml(data, opts) + '</div>';
  });
}

/* ---------- front matter ---------- */

function insideListItems(data) {
  return data.sections.map(function (s) {
    var icon = ACT_ICONS[s.activity.id] || '•';
    return '<li>' + icon + ' <b>' + s.items.length + '</b> ' + esc(s.activity.name) + '</li>';
  }).join('');
}

/* The master cover template (v2) — ONE skeleton for all
   6 designs × 8 levels; only palette, pattern and hero art
   change: patterned band · corner LEVEL badge + AGES 4-7 ·
   series pill · big title (largest element) · patterns
   line · subtitle · decodable badges · belongs-to ribbon ·
   ONE hero illustration stage · what's-inside card ·
   decorative tiles · brand footband. */
function coverPage(data, opts, design) {
  var deco = decoFor(data, opts, design);
  var tiles = deco.tiles.map(function (e) {
    return '<span class="cov-tile">' + picHtml(e) + '</span>';
  }).join('');
  var hero = (design.hero && design.hero.length ? design.hero : [design.motif || '📚']);
  var heroHtml = hero.map(function (e, i) {
    return '<span class="' + (i === 0 ? 'cov-hero-main' : 'cov-hero-side') + '">' + esc(e) + '</span>';
  }).join('');
  return '<div class="bk-page bk-cover">' +
    '<div class="cov-band cov-band-top"></div>' +
    '<div class="cov-level-badge"><span class="clb-name">' + esc(data.levelName) + '</span>' +
    '<span class="clb-ages">AGES 4–7</span></div>' +
    '<div class="cov-series"><span class="cov-pill">EARLY READER SERIES</span></div>' +
    '<h1 class="cov-title">' + esc(data.title) + '</h1>' +
    '<div class="cov-patterns">' + esc(data.patterns) + '</div>' +
    '<div class="cov-subtitle">Phonics • Sounds • First Words</div>' +
    '<div class="cov-pills cov-badges"><span class="cov-pill dec">✓ 100% DECODABLE</span>' +
    '<span class="cov-pill dec">✓ ANSWER KEYS INSIDE</span></div>' +
    '<div><span class="cov-belongs">This book belongs to: <b>' +
    (data.childName ? esc(data.childName) : '____________') + '</b></span></div>' +
    '<div class="cov-hero-stage">' + heroHtml + '</div>' +
    '<div class="cov-inside"><h3>What’s inside</h3><ul>' + insideListItems(data) + '</ul></div>' +
    (tiles ? '<div class="cov-tiles">' + tiles + '</div>' : '') +
    '<div class="cov-footband">' + esc(design.tagline || 'Read · Circle · Grow') +
    ' — every sentence uses only this level’s sounds and focus words' +
    '<div class="cov-bizline">' + esc(opts.business || 'Songlap Deals') + '</div>' +
    '<div class="cov-prodline">★ PHONICSSTRIP STUDIO PRO ★</div></div>' +
    '<div class="cov-band cov-band-bottom"></div>' +
    '</div>';
}

function belongsToPage(data, opts, design) {
  return '<div class="bk-page bk-front"><div class="cov-frame">' +
    '<div class="cov-motif">' + esc(design.motif || '📚') + '</div>' +
    '<h2>This book belongs to</h2>' +
    '<div class="belong-name">' + esc(data.childName || '') + '</div>' +
    '<p>My reading level: <b>' + esc(data.levelName) + '</b></p>' +
    '<p style="margin-top:4mm">When I finish this book, I can read every word in it — because every sentence uses only the sounds I have learned!</p>' +
    '<div class="front-small">Created with PhonicsStrip Studio Pro · © ' + esc(opts.business || 'Songlap Deals') + '. ' +
    'The finished books made with this tool may be sold; the tool itself must never be shared or resold.</div>' +
    '</div></div>';
}

function howToPage(data, opts) {
  var lis = data.sections.map(function (s) {
    return '<li><b>' + esc(s.activity.name) + '.</b> ' + esc(s.activity.how || '') + '</li>';
  }).join('');
  return '<div class="bk-page bk-howto"><h2>How to use this book</h2>' +
    '<p><b>For parents and teachers:</b> this is a decodable reader. Every sentence in the activity pages uses <b>only</b> the phonics patterns for ' +
    esc(data.levelName) + ' (' + esc(data.patterns) + ') plus the Focus Words on the next page. If a child can sound out the patterns, they can read every sentence — no guessing from the pictures: the three pictures on each strip are near-misses from the same group, so the words must be read.</p>' +
    '<h3 style="margin:4mm 0 2mm">The activities</h3><ul>' + lis + '</ul>' +
    '<p style="margin-top:4mm">Colour a star on the Progress Tracker for every page finished. The Super Reader Certificate at the back celebrates finishing the whole book. Answer keys for every activity are at the back, in the same order as the pages.</p>' +
    '</div>';
}

function focusWordsPage(data, opts) {
  var words = data.focusWords.map(function (w) {
    return '<span class="focus-word">' + esc(w) + '</span>';
  }).join('');
  return '<div class="bk-page bk-focus"><h2>Focus Words</h2>' +
    '<p class="focus-note">These little words appear again and again in this book. Some of them cannot be sounded out yet — learn them by heart, then spot them in the sentences!</p>' +
    '<div class="focus-grid">' + words + '</div>' +
    '<p class="focus-note"><b>Sounds in this book:</b> ' + esc(data.patterns) + ' — plus every sound from the levels before.</p>' +
    '</div>';
}

/* ---------- tracker / certificate / keys / back ---------- */

function trackerPage(data, sectionPageCounts, opts) {
  var star = (data.deco && data.deco.star) || '☆';
  var rows = sectionPageCounts.map(function (sp) {
    var stars = '';
    for (var i = 0; i < sp.count; i++) stars += star + ' ';
    return '<div class="track-row"><span class="track-name">' + esc(sp.name) + '</span>' +
      '<span class="track-stars">' + stars + '</span></div>';
  }).join('');
  return '<div class="bk-page bk-track"><h2>My Progress Tracker</h2>' +
    '<p style="font-size:11.5pt;margin-bottom:3mm">Colour one star every time you finish a page. Fill them all to earn your Super Reader Certificate!</p>' +
    rows + '</div>';
}

function certificatePage(data, opts, design) {
  return '<div class="bk-page bk-cert"><div class="cert-frame">' +
    '<div class="cert-badge">★ SUPER READER CERTIFICATE ★</div>' +
    '<div class="cov-motif" style="font-size:34pt;margin-top:4mm">' + esc(design.motif || '📚') + '</div>' +
    '<h2>Super Reader!</h2>' +
    '<div class="cert-sub">This certificate is proudly presented to</div>' +
    '<div class="cert-name">' + esc(data.childName || '') + '</div>' +
    '<div class="cert-namelabel">READER’S NAME</div>' +
    '<p style="font-size:12pt;margin-top:6mm">for finishing <b>' + esc(data.title) + '</b><br>(' + esc(data.levelName) + ') and reading every word!</p>' +
    '<div class="cert-cols"><div class="cert-col">Teacher / Parent</div><div class="cert-col">Date</div></div>' +
    '<div class="cov-biz" style="margin-top:8mm">' + esc(opts.business || 'Songlap Deals') + '</div>' +
    '</div></div>';
}

function answerKeyPages(data, opts) {
  var pages = [];
  data.answerKeys.forEach(function (k) {
    for (var i = 0; i < k.entries.length; i += 36) {
      var part = k.entries.slice(i, i + 36).map(function (e, j) {
        return '<li>' + esc(e) + '</li>';
      }).join('');
      pages.push('<div class="bk-page bk-keys"><h2>Answer Key — ' + esc(k.activity.name) + '</h2>' +
        '<ol start="' + (i + 1) + '">' + part + '</ol></div>');
    }
  });
  return pages;
}

function barcodeHtml(data) {
  var seedStr = String(data.id || 'PHONICS');
  var widths = [0.5, 0.9, 1.4];
  var bars = '';
  for (var i = 0; i < 34; i++) {
    var code = seedStr.charCodeAt(i % seedStr.length) + i * 7;
    bars += '<span class="bar" style="width:' + widths[code % 3] + 'mm"></span>';
  }
  return '<div class="bk-barcode"><div class="bars">' + bars + '</div>' +
    '<div class="bc-label">' + esc(data.id) + '</div></div>';
}

function backCoverPage(data, opts) {
  var list = data.sections.map(function (s) {
    var icon = ACT_ICONS[s.activity.id] || '✓';
    return '<li>✓ ' + icon + ' ' + esc(s.activity.name) + ' — ' + s.items.length + (s.items.length === 1 ? ' activity' : ' activities') + '</li>';
  }).join('');
  /* the 8 levels as a rising staircase, current step lit */
  var stairs = LEVELS_SHORT.map(function (label, i) {
    var cur = (i + 1) === data.level;
    var h = (5 + i * 0.95).toFixed(1);
    return '<span class="lvl-pill' + (cur ? ' cur' : '') + ' stair" style="height:' + h + 'mm" ' +
      'title="Level ' + (i + 1) + ' · ' + esc(label) + '">L' + (i + 1) + '</span>';
  }).join('');
  return '<div class="bk-page bk-back">' +
    '<div class="cov-band cov-band-top"></div>' +
    '<div class="back-card">' +
    '<h2>A gentle first step into reading</h2>' +
    '<p class="back-how"><b>For parents and teachers:</b> this book was written to be read <b>by</b> your child. ' +
    'Every sentence uses only the sounds taught up to ' + esc(data.levelName) + ', so a beginner can sound out every word — ' +
    'no guessing, no memorised word lists, just real reading from the very first page.</p>' +
    '<h3>What’s inside this book</h3>' +
    '<ul class="back-list">' + list + '</ul>' +
    '<h3>Why it works</h3>' +
    '<p class="back-how">Every sentence is 100% decodable at ' + esc(data.levelName) + ': only this level’s sounds plus the Focus Words. ' +
    'The three pictures on each strip come from the same group, so young readers must read the words — not guess. ' +
    'Includes a progress tracker, a Super Reader certificate and full answer keys.</p>' +
    '<h3>Collect all 8 levels</h3>' +
    '<div class="back-stairs">' + stairs + '</div>' +
    '<div class="back-cert-note">★ Finish this book to earn the Super Reader Certificate inside!</div>' +
    '<div class="back-thanks">Happy reading!</div>' +
    '<div class="back-biz">' + esc(opts.business || 'Songlap Deals') + '</div>' +
    barcodeHtml(data) +
    '<div class="back-copy">Created with PhonicsStrip Studio Pro · © ' + esc(opts.business || 'Songlap Deals') + '. ' +
    'The finished books made with this tool may be sold by the buyer; the tool itself must never be shared or resold. This credit line must stay on the book.' +
    (data.pack === 'illustrated'
      ? ' Picture artwork: Noto Emoji (Apache License 2.0, Google) · Twemoji (CC BY 4.0, Twitter) · Fluent Emoji (MIT, Microsoft).'
      : '') +
    (data.pack === 'storybook'
      ? ' Storybook pictures are original illustrations created for PhonicsStrip Studio Pro; any fallback artwork: Noto Emoji (Apache License 2.0, Google) · Twemoji (CC BY 4.0, Twitter) · Fluent Emoji (MIT, Microsoft).'
      : '') + '</div>' +
    '</div>' +
    '<div class="cov-band cov-band-bottom"></div>' +
    '</div>';
}

/* ---------- whole book ---------- */

/*
 * buildBook(bookData, opts) -> { html, pageCount }
 * opts: { trim ('letter'|'a4'|'8.5x10'), design (object),
 *   cover (default on), backCover (default on), inkSaver,
 *   bw, business }
 */
function buildBook(data, opts) {
  opts = opts || {};
  opts.trim = opts.trim || 'letter';
  var design = opts.design || {};
  var pages = [];
  var numbered = [];
  function push(html, num) { pages.push(html); numbered.push(!!num); }
  if (opts.cover !== false) push(coverPage(data, opts, design), false);
  push(belongsToPage(data, opts, design), true);
  push(howToPage(data, opts), true);
  push(focusWordsPage(data, opts), true);
  var sectionPageCounts = [];
  data.sections.forEach(function (s) {
    var sp = sectionPages(s, data, opts);
    sectionPageCounts.push({ name: s.activity.name, count: sp.length });
    sp.forEach(function (p) { push(p, true); });
  });
  push(trackerPage(data, sectionPageCounts, opts), true);
  push(certificatePage(data, opts, design), true);
  answerKeyPages(data, opts).forEach(function (p) { push(p, true); });
  if (opts.backCover !== false) push(backCoverPage(data, opts), false);
  /* page numbers in a small decorative circle on every
     interior page (covers stay clean). Every page string
     ends with the page div's closing tag, so the badge is
     inserted just inside it. */
  var n = 0;
  var out = pages.map(function (html, i) {
    if (!numbered[i]) return html;
    n++;
    var badge = '<div class="pg-num"><span>' + n + '</span></div>';
    return html.slice(0, html.length - '</div>'.length) + badge + '</div>';
  });
  return { html: out.join('\n'), pageCount: pages.length };
}

/* ---------- KDP wrap cover ---------- */

var WRAP_PAPER_FACTORS = { white: 0.002252, cream: 0.0025 };
var WRAP_BLEED_IN = 0.125;

/* wrapCoverDims(pageCount, paper, trimId) — pure maths.
   trimId: '8.5x11' (default) or '8.5x10'. */
function wrapCoverDims(pageCount, paper, trimId) {
  var factor = WRAP_PAPER_FACTORS[paper] || WRAP_PAPER_FACTORS.white;
  var trimW = 8.5;
  var trimH = trimId === '8.5x10' ? 10 : 11;
  var spine = Math.round(pageCount * factor * 1000) / 1000;
  var totalWidth = Math.round((WRAP_BLEED_IN + trimW + spine + trimW + WRAP_BLEED_IN) * 1000) / 1000;
  var totalHeight = Math.round((trimH + 2 * WRAP_BLEED_IN) * 1000) / 1000;
  return {
    pageCount: pageCount, paper: paper || 'white', factor: factor,
    trimW: trimW, trimH: trimH, bleed: WRAP_BLEED_IN,
    spineIn: spine, totalWidthIn: totalWidth, totalHeightIn: totalHeight
  };
}

function wrapCoverCss(design, dims) {
  var d = design;
  return '' +
  '@page { size: ' + dims.totalWidthIn + 'in ' + dims.totalHeightIn + 'in; margin: 0; }' +
  'body { margin: 0; font-family: ' + d.cellFont + '; }' +
  '.wrap { display: flex; width: ' + dims.totalWidthIn + 'in; height: ' + dims.totalHeightIn + 'in; background: ' + d.coverBg + '; color: ' + d.coverText + '; }' +
  '.wrap-back, .wrap-front { width: ' + (dims.trimW + dims.bleed) + 'in; box-sizing: border-box; padding: 0.45in 0.4in; text-align: center; }' +
  '.wrap-back { padding-left: ' + (dims.bleed + 0.3) + 'in; }' +
  '.wrap-front { padding-right: ' + (dims.bleed + 0.3) + 'in; }' +
  '.wrap-spine { width: ' + dims.spineIn + 'in; background: ' + d.headerBg + '; color: ' + d.headerText + '; display: flex; align-items: center; justify-content: center; }' +
  '.wrap-spine span { writing-mode: vertical-rl; font-family: ' + d.headerFont + '; font-size: 10pt; letter-spacing: 1px; white-space: nowrap; }' +
  '.wrap .card { background: ' + d.cardBg + '; color: ' + d.cellText + '; border: 3px solid ' + d.accent + '; border-radius: 14px; padding: 0.3in 0.3in 0.25in; }' +
  '.wrap h1 { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 30pt; line-height: 1.15; margin: 0.1in 0; }' +
  '.wrap h2 { font-family: ' + d.headerFont + '; font-size: 14pt; font-weight: normal; margin: 0 0 0.12in; }' +
  '.wrap .motif { font-size: 46pt; line-height: 1.2; }' +
  '.wrap .cluster { font-size: 19pt; letter-spacing: 6px; margin-top: 0.05in; }' +
  '.wrap .badge { display: inline-block; background: ' + d.headerBg + '; color: ' + d.headerText + '; font-size: 9pt; font-weight: bold; letter-spacing: 2.5px; padding: 0.07in 0.25in; border-radius: 999px; }' +
  '.wrap .badge.alt { background: ' + d.accent + '; color: #ffffff; }' +
  '.wrap .badge.dec { background: ' + d.cardBg + '; color: ' + d.headerBg + '; border: 2px solid ' + d.headerBg + '; }' +
  '.wrap .plate { background: ' + d.accent + '; border-radius: 16px; padding: 0.07in; margin-top: 0.18in; }' +
  '.wrap .plate-in { background: ' + d.cardBg + '; border-radius: 12px; padding: 0.22in 0.2in 0.18in; }' +
  '.wrap .tiles { margin-top: 0.22in; }' +
  '.wrap .tile { display: inline-block; background: ' + d.cardBg + '; border: 2px solid ' + d.cellBorder + '; border-radius: 10px; width: 0.62in; height: 0.62in; line-height: 0.62in; font-size: 20pt; margin: 0 0.04in; }' +
  '.wrap .inside { text-align: left; font-size: 11.5pt; line-height: 1.9; list-style: none; margin: 0.1in 0; padding: 0; }' +
  '.wrap .blurb { font-size: 11.5pt; line-height: 1.6; text-align: left; }' +
  '.wrap .thanks { font-family: ' + d.headerFont + '; color: ' + d.headerBg + '; font-size: 14pt; margin-top: 0.22in; }' +
  '.wrap .barcode-box { background: #ffffff; width: 2in; height: 1.2in; margin: 0.3in auto 0; border: 1px solid #cccccc; display: flex; align-items: center; justify-content: center; font-size: 8.5pt; color: #666666; }' +
  '.wrap .biz { font-size: 10pt; letter-spacing: 1px; margin-top: 0.22in; }' +
  '.wrap .hero { margin-top: 0.16in; }' +
  '.wrap .stairs { display: flex; align-items: flex-end; justify-content: center; gap: 0.045in; margin-top: 0.16in; }' +
  '.wrap .wstair { flex: 0 0 0.52in; display: flex; align-items: flex-end; justify-content: center; border: 2px solid ' + d.headerBg + '; color: ' + d.headerBg + '; background: ' + d.cellBg + '; border-radius: 4px 4px 0 0; font-size: 8pt; padding-bottom: 0.03in; box-sizing: border-box; }' +
  '.wrap .wstair.cur { background: ' + d.headerBg + '; color: ' + d.headerText + '; font-weight: bold; }' +
  '.wrap .stairs-cap { font-size: 9.5pt; margin-top: 0.08in; }' +
  '';
}

/* meta: { title, subtitle, author, levelLine, level (1-8,
   optional — draws the back-cover staircase), insideList:
   [strings], blurb }
   pack (optional): a picture-pack object — its deco set
   replaces the design's cover decorations, as in the book.
   The wrap follows the same master template as the book
   covers: series badge · level badge · motif + cluster ·
   title plate · hero row · badges · tiles · brand. */
function wrapCoverHtml(meta, design, dims, pack) {
  var deco = {
    cluster: (pack && pack.deco && pack.deco.cluster) || design.cluster || [],
    tiles: (pack && pack.deco && pack.deco.tiles) || design.tiles || []
  };
  var inside = (meta.insideList || []).map(function (s) { return '<li>✓ ' + esc(s) + '</li>'; }).join('');
  var cluster = deco.cluster.map(function (e) { return esc(e); }).join(' ');
  var tiles = deco.tiles.map(function (e) { return '<span class="tile">' + esc(e) + '</span>'; }).join('');
  var hero = (design.hero && design.hero.length ? design.hero : []);
  var heroHtml = hero.map(function (e, i) {
    return '<span style="font-size:' + (i === 0 ? '40pt' : '27pt') + '">' + esc(e) + '</span>';
  }).join(' ');
  var stairs = '';
  if (meta.level >= 1 && meta.level <= 8) {
    stairs = '<div class="stairs">' + LEVELS_SHORT.map(function (label, i) {
      var h = (0.2 + i * 0.05).toFixed(2);
      return '<span class="wstair' + ((i + 1) === meta.level ? ' cur' : '') + '" style="height:' + h + 'in">L' + (i + 1) + '</span>';
    }).join('') + '</div><div class="stairs-cap">Collect all 8 levels — this is Level ' + meta.level + '</div>';
  }
  return '<div class="wrap">' +
    '<div class="wrap-back"><div class="card"><h2 style="font-size:17pt">What’s inside this book</h2>' +
    '<ul class="inside">' + inside + '</ul>' +
    '<p class="blurb">' + esc(meta.blurb || '') + '</p>' +
    stairs +
    '<div class="thanks">Happy reading!</div></div>' +
    '<div class="barcode-box">ISBN barcode area</div>' +
    '<div class="biz">' + esc(meta.author || '') + '</div></div>' +
    '<div class="wrap-spine"><span>' + esc(meta.title) + ' · ' + esc(meta.author || '') + '</span></div>' +
    '<div class="wrap-front"><span class="badge">EARLY READER SERIES</span>' +
    '<span class="badge alt">' + esc(meta.levelLine || '') + '</span>' +
    '<div class="motif">' + esc(design.motif || '📚') + '</div>' +
    (cluster ? '<div class="cluster">' + cluster + '</div>' : '') +
    '<div class="plate"><div class="plate-in">' +
    '<h1>' + esc(meta.title) + '</h1>' +
    '<h2>' + esc(meta.subtitle || 'Phonics • Sounds • First Words') + '</h2>' +
    '</div></div>' +
    (heroHtml ? '<div class="hero">' + heroHtml + '</div>' : '') +
    '<div style="margin-top:0.18in"><span class="badge dec">✓ 100% DECODABLE</span> ' +
    '<span class="badge dec">✓ ANSWER KEYS INSIDE</span></div>' +
    (tiles ? '<div class="tiles">' + tiles + '</div>' : '') +
    '<div class="biz">' + esc(meta.author || '') + '</div></div>' +
    '</div>';
}

var PhonicsBook = {
  esc: esc, TRIMS: TRIMS, bookCss: bookCss, buildBook: buildBook,
  capacityFor: capacityFor, sectionPages: sectionPages,
  itemPics: itemPics, paginateItems: paginateItems, decoFor: decoFor,
  isPicDataUrl: isPicDataUrl, isPicAsset: isPicAsset, picHtml: picHtml,
  WRAP_PAPER_FACTORS: WRAP_PAPER_FACTORS, WRAP_BLEED_IN: WRAP_BLEED_IN,
  wrapCoverDims: wrapCoverDims, wrapCoverCss: wrapCoverCss, wrapCoverHtml: wrapCoverHtml
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PhonicsBook;
}
