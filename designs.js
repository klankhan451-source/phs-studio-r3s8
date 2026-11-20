/*
 * ============================================================
 *  PhonicsStrip Studio Pro — design presets
 * ============================================================
 *  Six coordinated looks (chosen from the ChatGPT + Gemini
 *  cover consults). One preset restyles the whole book —
 *  covers, page headers, activity pages, certificate and
 *  the KDP wrap cover. Pictures (emoji) stay consistent.
 *  Field shape matches the Songlap design-system convention
 *  used across our tools, plus `motif` (cover emoji) and
 *  `tagline`. Book body text always uses the early-literacy
 *  letterform stack (single-story a/g) regardless of design.
 *
 *  Cover-art fields (used by the front/back covers and the
 *  KDP wrap cover):
 *    coverBg   — full background (layered gradients in the
 *                design's palette) so covers are rich and
 *                full, never empty cream space
 *    coverText — text colour that reads on coverBg
 *    bandBg    — patterned top/bottom bands on the covers
 *    cluster   — 4 decorative emojis around the hero motif
 *    tiles     — 5 emojis for the decorative tile row
 *  A picture pack's `deco` (content.js) can override
 *  cluster / tiles per book.
 * ============================================================
 */
'use strict';

var PHS_LETTER_FONT = '"Comic Sans MS", "Chalkboard SE", "Segoe Print", "Trebuchet MS", sans-serif';

var PHS_DESIGNS = [
  {
    id: 'bohorainbow', name: 'Boho Rainbow',
    blurb: 'Terracotta, sage, mustard & blush — the Etsy/TpT bestseller look',
    motif: '🌈', tagline: 'Read · Circle · Grow',
    pageBg: '#f7efe4', cardBg: '#fffaf1', headerBg: '#b4622d', headerText: '#fdf3e3',
    cellBg: '#ffffff', cellAlt: '#f5ead8', cellText: '#5a4030', cellBorder: '#d3ab84',
    accent: '#7d8b5e', freeBg: '#f0dfc2', borderStyle: 'double', radius: 14,
    headerFont: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
    cellFont: PHS_LETTER_FONT,
    coverBg: 'radial-gradient(circle at 12% 16%, rgba(180,98,45,.22) 0, rgba(180,98,45,.22) 7mm, transparent 8mm), ' +
      'radial-gradient(circle at 88% 80%, rgba(125,139,94,.25) 0, rgba(125,139,94,.25) 9mm, transparent 10mm), ' +
      'radial-gradient(circle at 84% 10%, rgba(211,171,132,.4) 0, rgba(211,171,132,.4) 4.5mm, transparent 5.5mm), ' +
      'radial-gradient(circle at 8% 88%, rgba(180,98,45,.16) 0, rgba(180,98,45,.16) 5mm, transparent 6mm), ' +
      'linear-gradient(165deg, #f9efdd 0%, #f3ddba 55%, #eecfa5 100%)',
    coverText: '#5a4030',
    bandBg: 'repeating-linear-gradient(45deg, #b4622d 0, #b4622d 6mm, #c97a41 6mm, #c97a41 12mm)',
    cluster: ['🌸', '🦋', '🌵', '🍄'],
    tiles: ['☀️', '🌷', '⭐', '🍓', '🌼']
  },
  {
    id: 'woodland', name: 'Woodland Friends',
    blurb: 'Sage & cream with gentle forest animals — calm classrooms',
    motif: '🦊', tagline: 'Little steps, big reading',
    pageBg: '#f2f0e6', cardBg: '#fffef8', headerBg: '#5d7052', headerText: '#f7efdc',
    cellBg: '#ffffff', cellAlt: '#eef0e2', cellText: '#44503e', cellBorder: '#b3bfa5',
    accent: '#c08552', freeBg: '#efe6cd', borderStyle: 'double', radius: 12,
    headerFont: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
    cellFont: PHS_LETTER_FONT,
    coverBg: 'radial-gradient(circle at 10% 12%, rgba(93,112,82,.22) 0, rgba(93,112,82,.22) 6mm, transparent 7mm), ' +
      'radial-gradient(circle at 90% 22%, rgba(192,133,82,.25) 0, rgba(192,133,82,.25) 5mm, transparent 6mm), ' +
      'radial-gradient(circle at 82% 86%, rgba(93,112,82,.2) 0, rgba(93,112,82,.2) 8mm, transparent 9mm), ' +
      'radial-gradient(circle at 16% 82%, rgba(192,133,82,.18) 0, rgba(192,133,82,.18) 4.5mm, transparent 5.5mm), ' +
      'linear-gradient(160deg, #f4f1e4 0%, #e3e8d2 60%, #d3ddbf 100%)',
    coverText: '#44503e',
    bandBg: 'repeating-linear-gradient(45deg, #5d7052 0, #5d7052 6mm, #6d8261 6mm, #6d8261 12mm)',
    cluster: ['🦉', '🍄', '🌲', '🐿️'],
    tiles: ['🍂', '🌰', '🐰', '🍁', '🦔']
  },
  {
    id: 'dino', name: 'Dino Adventure',
    blurb: 'Mint, lime & sky with friendly dinosaurs — boy-magnet covers',
    motif: '🦕', tagline: 'Stomp into reading',
    pageBg: '#e8f6ee', cardBg: '#fbfffc', headerBg: '#2e8b6e', headerText: '#eafff3',
    cellBg: '#ffffff', cellAlt: '#e2f4e6', cellText: '#1f4d3a', cellBorder: '#9fd3ae',
    accent: '#f2a03d', freeBg: '#ffedb8', borderStyle: 'solid', radius: 14,
    headerFont: '"Trebuchet MS", "Segoe UI", sans-serif',
    cellFont: PHS_LETTER_FONT,
    coverBg: 'radial-gradient(circle at 88% 14%, rgba(242,160,61,.3) 0, rgba(242,160,61,.3) 6mm, transparent 7mm), ' +
      'radial-gradient(circle at 10% 80%, rgba(46,139,110,.2) 0, rgba(46,139,110,.2) 8mm, transparent 9mm), ' +
      'radial-gradient(circle at 14% 14%, rgba(46,139,110,.16) 0, rgba(46,139,110,.16) 4.5mm, transparent 5.5mm), ' +
      'linear-gradient(160deg, #eafaf0 0%, #d2f0dc 55%, #b9e4cb 100%)',
    coverText: '#1f4d3a',
    bandBg: 'repeating-linear-gradient(45deg, #2e8b6e 0, #2e8b6e 6mm, #3aa37f 6mm, #3aa37f 12mm)',
    cluster: ['🦖', '🌋', '🌴', '🥚'],
    tiles: ['🦕', '🦴', '☀️', '🌿', '🍃']
  },
  {
    id: 'space', name: 'Space Explorers',
    blurb: 'Navy, lavender & coral — blast off into books',
    motif: '🚀', tagline: 'Blast off into reading',
    pageBg: '#e9ebf7', cardBg: '#ffffff', headerBg: '#232a4a', headerText: '#ffe9a8',
    cellBg: '#ffffff', cellAlt: '#eceefb', cellText: '#232a4a', cellBorder: '#9aa5d9',
    accent: '#ff7a59', freeBg: '#ffe3d9', borderStyle: 'solid', radius: 12,
    headerFont: '"Trebuchet MS", "Segoe UI", sans-serif',
    cellFont: PHS_LETTER_FONT,
    coverBg: 'radial-gradient(circle at 18% 12%, rgba(255,255,255,.95) 0, rgba(255,255,255,.95) 1.2mm, transparent 2.2mm), ' +
      'radial-gradient(circle at 78% 26%, rgba(255,233,168,.95) 0, rgba(255,233,168,.95) 1.7mm, transparent 2.7mm), ' +
      'radial-gradient(circle at 62% 72%, rgba(255,255,255,.75) 0, rgba(255,255,255,.75) 1.1mm, transparent 2.1mm), ' +
      'radial-gradient(circle at 30% 86%, rgba(255,255,255,.85) 0, rgba(255,255,255,.85) 1.4mm, transparent 2.4mm), ' +
      'radial-gradient(circle at 90% 62%, rgba(154,165,217,.5) 0, rgba(154,165,217,.5) 5mm, transparent 6mm), ' +
      'radial-gradient(circle at 6% 55%, rgba(255,122,89,.35) 0, rgba(255,122,89,.35) 4mm, transparent 5mm), ' +
      'linear-gradient(165deg, #2b3358 0%, #232a4a 55%, #1a2040 100%)',
    coverText: '#ffe9a8',
    bandBg: 'repeating-linear-gradient(45deg, #ff7a59 0, #ff7a59 6mm, #ff8f73 6mm, #ff8f73 12mm)',
    cluster: ['🪐', '⭐', '🌙', '👽'],
    tiles: ['🚀', '🛸', '☄️', '🔭', '🌟']
  },
  {
    id: 'ocean', name: 'Ocean Discovery',
    blurb: 'Aqua, seafoam & coral — dive into reading',
    motif: '🐠', tagline: 'Dive into reading',
    pageBg: '#e6f7f7', cardBg: '#ffffff', headerBg: '#0e7a8a', headerText: '#eafffb',
    cellBg: '#ffffff', cellAlt: '#e2f4f2', cellText: '#14424a', cellBorder: '#8fd0d0',
    accent: '#ff8a5c', freeBg: '#ffe3d3', borderStyle: 'double', radius: 14,
    headerFont: '"Trebuchet MS", "Segoe UI", sans-serif',
    cellFont: PHS_LETTER_FONT,
    coverBg: 'radial-gradient(circle at 14% 18%, rgba(255,255,255,.55) 0, rgba(255,255,255,.55) 2mm, transparent 3mm), ' +
      'radial-gradient(circle at 84% 12%, rgba(255,255,255,.5) 0, rgba(255,255,255,.5) 3mm, transparent 4mm), ' +
      'radial-gradient(circle at 76% 82%, rgba(255,255,255,.45) 0, rgba(255,255,255,.45) 2.4mm, transparent 3.4mm), ' +
      'radial-gradient(circle at 24% 78%, rgba(14,122,138,.18) 0, rgba(14,122,138,.18) 6mm, transparent 7mm), ' +
      'linear-gradient(165deg, #e8fafa 0%, #cdeef2 55%, #aedfec 100%)',
    coverText: '#14424a',
    bandBg: 'repeating-linear-gradient(45deg, #0e7a8a 0, #0e7a8a 6mm, #1299ab 6mm, #1299ab 12mm)',
    cluster: ['🐙', '🐢', '🐚', '🌊'],
    tiles: ['🐠', '🦀', '🐳', '🦑', '🐡']
  },
  {
    id: 'retrogroovy', name: 'Retro Groovy',
    blurb: 'Composition-notebook checks & smileys — TeacherTok favourite',
    motif: '😊', tagline: 'Groovy little readers',
    pageBg: '#f6f1e7', cardBg: '#fffdf6', headerBg: '#222222', headerText: '#ffe98a',
    cellBg: '#ffffff', cellAlt: '#f3ecd9', cellText: '#2b2b2b', cellBorder: '#8a8a8a',
    accent: '#e4572e', freeBg: '#ffe98a', borderStyle: 'double', radius: 10,
    headerFont: 'Georgia, "Times New Roman", serif',
    cellFont: PHS_LETTER_FONT,
    coverBg: 'radial-gradient(circle at 12% 14%, rgba(228,87,46,.18) 0, rgba(228,87,46,.18) 5mm, transparent 6mm), ' +
      'radial-gradient(circle at 88% 84%, rgba(34,34,34,.14) 0, rgba(34,34,34,.14) 6mm, transparent 7mm), ' +
      'radial-gradient(circle at 86% 12%, rgba(255,233,138,.55) 0, rgba(255,233,138,.55) 5mm, transparent 6mm), ' +
      'linear-gradient(160deg, #faf5e9 0%, #f3ecd9 60%, #eadfc2 100%)',
    coverText: '#2b2b2b',
    bandBg: 'repeating-linear-gradient(45deg, #222222 0, #222222 4mm, #f6f1e7 4mm, #f6f1e7 8mm)',
    cluster: ['🌼', '✌️', '🎵', '🕶️'],
    tiles: ['😊', '🌈', '🎶', '🍒', '⭐']
  }
];

function phsDesignById(id) {
  for (var i = 0; i < PHS_DESIGNS.length; i++) {
    if (PHS_DESIGNS[i].id === id) return PHS_DESIGNS[i];
  }
  return PHS_DESIGNS[0];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PHS_DESIGNS: PHS_DESIGNS, phsDesignById: phsDesignById, PHS_LETTER_FONT: PHS_LETTER_FONT };
}
