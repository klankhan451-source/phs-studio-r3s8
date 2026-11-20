/*
 * ============================================================
 *  PhonicsStrip Studio Pro — levels, word banks & templates
 * ============================================================
 *  The content moat: 8 CUMULATIVE phonics levels. Every word
 *  bank is curated so each word introduced at a level is
 *  decodable with that level's patterns (sight words are the
 *  listed exception — they are taught as whole words).
 *
 *  The banks are the source of truth for validation: a
 *  sentence is decodable at level N when every word in it is
 *  in the cumulative bank (nouns / verbs / adjectives /
 *  places / names / extras) or the cumulative sight list.
 *
 *  Nouns carry an emoji + a category. The category drives the
 *  near-miss distractor logic: a strip's 3 pictures always
 *  come from the SAME category, so the child must read the
 *  word, not guess from the picture type.
 *
 *  Formats:
 *    nouns:      { w: word, e: emoji, c: category }
 *    templates:  strings with slots {noun} {noun2} {nounPl}
 *                {verb} {verb2} {adj} {place} {name} {name2}
 *    sequences:  { min: level, title, steps: [{pic, s}] } —
 *                3-step mini stories for Story Sequencing.
 * ============================================================
 */
'use strict';

/* noun helper */
function N(w, e, c) { return { w: w, e: e, c: c }; }

var PHS_LEVELS = [
  {
    id: 1, name: 'Level 1 · Short A',
    patterns: 'Short-A CVC words (cat, jam, map…)',
    sight: ['the', 'a', 'I', 'see', 'is'],
    nouns: [
      N('cat', '🐱', 'animals'), N('rat', '🐀', 'animals'), N('bat', '🦇', 'animals'),
      N('ant', '🐜', 'animals'), N('ram', '🐏', 'animals'),
      N('ham', '🍖', 'food'), N('jam', '🫙', 'food'), N('yam', '🍠', 'food'),
      N('map', '🗺️', 'objects'), N('bag', '👜', 'objects'), N('can', '🥫', 'objects'),
      N('pan', '🍳', 'objects'), N('wax', '🕯️', 'objects'), N('tag', '🏷️', 'objects'),
      N('hat', '👒', 'clothes'), N('cap', '🧢', 'clothes'),
      N('van', '🚐', 'transport'), N('cab', '🚕', 'transport')
    ],
    verbs: ['nap', 'pat', 'tap', 'wag', 'dab'],
    adjectives: ['sad', 'mad'],
    places: ['mat', 'pan', 'van'],
    names: ['Sam', 'Pam', 'Dan', 'Nan'],
    extras: ['at', 'an', 'has', 'sat', 'ran'],
    templates: [
      'I see a {noun}.',
      'I see the {noun}.',
      'See the {noun}!',
      '{name} has a {noun}.',
      'The {noun} is {adj}.',
      '{name} is {adj}.',
      '{name} can {verb} the {noun}.',
      '{name} can {verb}.'
    ]
  },
  {
    id: 2, name: 'Level 2 · Short I & O',
    patterns: 'Short-I and Short-O CVC words (pig, dog, box…)',
    sight: ['my', 'like', 'on', 'in', 'it'],
    nouns: [
      N('pig', '🐷', 'animals'), N('dog', '🐶', 'animals'), N('fox', '🦊', 'animals'),
      N('ox', '🐂', 'animals'), N('hog', '🐖', 'animals'), N('fin', '🦈', 'animals'),
      N('kid', '🧒', 'people'),
      N('lip', '👄', 'body'),
      N('pin', '📌', 'objects'), N('bin', '🗑️', 'objects'), N('pot', '🍯', 'objects'),
      N('log', '🪵', 'nature'), N('mop', '🧹', 'objects'), N('cot', '🛏️', 'objects'),
      N('box', '📦', 'objects'), N('dot', '⚫', 'objects'),
      N('cob', '🌽', 'food'), N('pod', '🫛', 'food')
    ],
    verbs: ['sit', 'dig', 'hop', 'jog', 'nod', 'sip', 'mix', 'fix', 'win', 'dip', 'zip'],
    adjectives: ['big', 'hot'],
    places: ['box', 'log', 'pot', 'bin'],
    names: ['Tim', 'Tom', 'Kim'],
    extras: [],
    templates: [
      'The {noun} is on the {place}.',
      'The {noun} is in the {place}.',
      'I like my {noun}.',
      'It is a {adj} {noun}.',
      'The {adj} {noun} is on the {place}.',
      'The {adj} {noun} is in the {place}.'
    ]
  },
  {
    id: 3, name: 'Level 3 · Short E & U',
    patterns: 'Short-E and Short-U CVC words — all five short vowels',
    sight: ['and', 'can', 'go', 'we', 'you'],
    nouns: [
      N('hen', '🐔', 'animals'), N('bug', '🐛', 'animals'), N('pup', '🐶', 'animals'),
      N('cub', '🐻', 'animals'), N('duck', '🦆', 'animals'),
      N('egg', '🥚', 'food'), N('nut', '🥜', 'food'), N('gum', '🍬', 'food'),
      N('bed', '🛏️', 'objects'), N('pen', '🖊️', 'objects'), N('net', '🥅', 'objects'),
      N('cup', '☕', 'objects'), N('tub', '🛁', 'objects'), N('bell', '🔔', 'objects'),
      N('web', '🕸️', 'nature'), N('sun', '☀️', 'nature'),
      N('jet', '✈️', 'transport'), N('bus', '🚌', 'transport')
    ],
    verbs: ['run', 'hug', 'cut', 'hum', 'get', 'set', 'tug', 'beg'],
    adjectives: ['red', 'wet', 'fun'],
    places: ['bed', 'bus', 'web', 'net', 'tub'],
    names: ['Ben', 'Meg', 'Gus'],
    extras: ['up'],
    templates: [
      '{name} and {name2} can {verb}.',
      'We can {verb} the {noun}.',
      'Can you {verb} the {noun}?',
      'The {noun} can {verb} and {verb2}.',
      '{name} can go on the {noun}.',
      'You can see the {adj} {noun}.',
      'The {noun} is up on the {place}.'
    ]
  },
  {
    id: 4, name: 'Level 4 · Digraphs',
    patterns: 'Digraphs sh · ch · th · wh (ship, fish, chin, bath…)',
    sight: ['this', 'that', 'with', 'here', 'are'],
    nouns: [
      N('fish', '🐟', 'animals'), N('chick', '🐤', 'animals'), N('whale', '🐋', 'animals'),
      N('cheese', '🧀', 'food'), N('lunch', '🍱', 'food'), N('peach', '🍑', 'food'),
      N('ship', '🚢', 'transport'),
      N('chair', '🪑', 'objects'), N('watch', '⌚', 'objects'), N('wheel', '🎡', 'objects'),
      N('brush', '🖌️', 'objects'), N('bath', '🛁', 'objects'),
      N('shell', '🐚', 'nature'),
      N('tooth', '🦷', 'body'),
      N('shop', '🏪', 'home')
    ],
    verbs: ['wish', 'wash', 'chop', 'chat', 'push', 'shut', 'brush', 'shop', 'fish', 'catch'],
    adjectives: ['thin', 'thick', 'pink', 'black', 'white'],
    places: ['shop', 'bath', 'ship', 'chair'],
    names: ['Josh', 'Beth', 'Chad'],
    extras: [],
    templates: [
      'This is a {noun}.',
      'That {noun} is {adj}.',
      'The {noun} is with {name}.',
      '{name} has that {noun}.',
      'Here is the {adj} {noun}.',
      'The {noun} and the {noun2} are {adj}.'
    ]
  },
  {
    id: 5, name: 'Level 5 · Blends',
    patterns: 'Blends bl · cl · st · cr · fr · sm… (frog, clap, stop…)',
    sight: ['said', 'was', 'for', 'have', 'they'],
    nouns: [
      N('frog', '🐸', 'animals'), N('crab', '🦀', 'animals'),
      N('drum', '🥁', 'objects'), N('flag', '🚩', 'objects'), N('clock', '🕰️', 'objects'),
      N('gift', '🎁', 'objects'), N('sled', '🛷', 'objects'),
      N('dress', '👗', 'clothes'),
      N('truck', '🚚', 'transport'),
      N('grass', '🌿', 'nature'), N('nest', '🪹', 'nature'), N('sand', '🏖️', 'nature'),
      N('milk', '🥛', 'food'),
      N('hand', '✋', 'body'),
      N('tent', '⛺', 'home')
    ],
    verbs: ['jump', 'swim', 'clap', 'skip', 'spin', 'step', 'stop', 'drop', 'help', 'stand', 'plan', 'grin'],
    adjectives: ['small', 'fast', 'soft', 'glad', 'flat', 'brown', 'blue'],
    places: ['grass', 'nest', 'sand', 'truck', 'tent'],
    names: ['Fred', 'Fran'],
    extras: [],
    templates: [
      'They can {verb} the {noun}.',
      'The {adj} {noun} can {verb}.',
      '{name} has a {noun} for {name2}.',
      'The {noun} was {adj}.',
      '{name} said the {noun} is {adj}.',
      'We have a {adj} {noun}.'
    ]
  },
  {
    id: 6, name: 'Level 6 · Silent E',
    patterns: 'Silent-E words (cake, bike, home…)',
    sight: ['some', 'come', 'love', 'one', 'two'],
    nouns: [
      N('snake', '🐍', 'animals'),
      N('cake', '🎂', 'food'), N('grape', '🍇', 'food'),
      N('bike', '🚲', 'transport'), N('plane', '✈️', 'transport'),
      N('kite', '🪁', 'objects'), N('slide', '🛝', 'objects'), N('cube', '🧊', 'objects'),
      N('game', '🎮', 'objects'), N('tape', '📼', 'objects'), N('bone', '🦴', 'objects'),
      N('nose', '👃', 'body'),
      N('rose', '🌹', 'nature'), N('lake', '🏞️', 'nature'), N('cave', '🕳️', 'nature'),
      N('home', '🏠', 'home'), N('gate', '🚪', 'home')
    ],
    verbs: ['bake', 'ride', 'hide', 'bite', 'wave', 'shake', 'make', 'take', 'smile', 'dive', 'hope'],
    adjectives: ['cute', 'huge', 'safe'],
    places: ['home', 'lake', 'slide', 'gate', 'cave'],
    names: ['Jake', 'Kate', 'Pete', 'June'],
    extras: ['to'],
    templates: [
      'I love my {noun}.',
      '{name} can {verb} to the {place}.',
      'I see one {noun}.',
      'I see two {nounPl}.',
      'Some {nounPl} are {adj}.',
      '{name} and {name2} come to the {place}.',
      '{name} can {verb} the {noun} at home.'
    ]
  },
  {
    id: 7, name: 'Level 7 · Vowel Teams',
    patterns: 'Vowel teams ai · ee · oa · ay (rain, tree, boat, play…)',
    sight: ['what', 'where', 'there', 'who', 'out'],
    nouns: [
      N('goat', '🐐', 'animals'), N('bee', '🐝', 'animals'), N('snail', '🐌', 'animals'),
      N('soap', '🧼', 'objects'), N('key', '🔑', 'objects'), N('snowman', '⛄', 'objects'),
      N('coat', '🧥', 'clothes'),
      N('boat', '⛵', 'transport'), N('train', '🚂', 'transport'),
      N('rain', '🌧️', 'nature'), N('tree', '🌳', 'nature'), N('seed', '🌱', 'nature'),
      N('leaf', '🍃', 'nature'), N('beach', '🏖️', 'nature'), N('moon', '🌙', 'nature'),
      N('cloud', '☁️', 'nature'), N('snow', '❄️', 'nature'), N('rainbow', '🌈', 'nature'),
      N('sea', '🌊', 'nature'), N('day', '☀️', 'nature'),
      N('feet', '👣', 'body')
    ],
    verbs: ['play', 'sail', 'wait', 'eat', 'read', 'sleep', 'keep', 'say', 'rain'],
    adjectives: ['green', 'sweet', 'deep', 'yellow'],
    places: ['boat', 'tree', 'beach', 'train', 'sea'],
    names: ['Jay', 'Kay', 'Lee', 'May'],
    extras: ['all'],
    templates: [
      'What is on the {noun}?',
      'Where is the {noun}?',
      'Who can {verb} the {noun}?',
      'There is a {adj} {noun} in the {place}.',
      '{name} can {verb} all day.',
      'The {noun} is out on the {place}.'
    ]
  },
  {
    id: 8, name: 'Level 8 · R-Controlled',
    patterns: 'R-controlled vowels (car, bird, corn…) and longer two-clause sentences',
    sight: ['about', 'many', 'would', 'could', 'first'],
    nouns: [
      N('bird', '🐦', 'animals'), N('horse', '🐴', 'animals'), N('turtle', '🐢', 'animals'),
      N('tiger', '🐯', 'animals'),
      N('corn', '🌽', 'food'),
      N('car', '🚗', 'transport'),
      N('fork', '🍴', 'objects'), N('letter', '✉️', 'objects'), N('paper', '📄', 'objects'),
      N('shirt', '👕', 'clothes'),
      N('girl', '👧', 'people'),
      N('star', '⭐', 'nature'), N('park', '🏞️', 'nature'), N('garden', '🌻', 'nature'),
      N('morning', '🌅', 'nature'), N('flower', '🌼', 'nature'), N('sprout', '🌱', 'nature'),
      N('farm', '🚜', 'home')
    ],
    verbs: ['bark', 'start', 'turn', 'draw', 'work'],
    adjectives: ['short', 'dark', 'hard'],
    places: ['park', 'farm', 'car', 'garden'],
    names: ['Mark', 'Carl'],
    extras: ['then', 'but'],
    templates: [
      'The {noun} is in the {place} and the {noun2} is {adj}.',
      '{name} can {verb} and {name2} can {verb2} at the {place}.',
      'First, the {noun} can {verb}, and then it can {verb2}.',
      'The {adj} {noun} is at the {place} with {name}.',
      'Many {nounPl} are in the {place}.',
      '{name} would {verb} the {noun} but the {noun2} is {adj}.'
    ]
  }
];

/* ---------------- 3-step mini stories (Story Sequencing) ----------------
   Steps print OUT OF ORDER in the book; the child numbers
   them 1-2-3. `steps` here are in the CORRECT order — the
   answer key is generated from this same array. Every step
   sentence validates at the sequence's `min` level. */
var PHS_SEQUENCES = [
  {
    id: 'cat-hat', min: 1, title: 'Sam and the Cat',
    steps: [
      { pic: '👦', s: 'I see Sam.' },
      { pic: '🐱', s: 'I see a cat.' },
      { pic: '🐱🎩', s: 'The cat has a hat.' }
    ]
  },
  {
    id: 'dog-box', min: 2, title: 'The Dog in the Box',
    steps: [
      { pic: '🐶', s: 'I see a dog.' },
      { pic: '📦', s: 'The dog is in the box.' },
      { pic: '😴', s: 'The dog can nap.' }
    ]
  },
  {
    id: 'egg-hen', min: 4, title: 'Egg to Hen',
    steps: [
      { pic: '🥚', s: 'I see an egg.' },
      { pic: '🐤', s: 'I see a chick.' },
      { pic: '🐔', s: 'The hen is big.' }
    ]
  },
  {
    id: 'pup-grows', min: 5, title: 'The Pup Grows Up',
    steps: [
      { pic: '🐶', s: 'The pup is small.' },
      { pic: '🏃', s: 'The pup can run.' },
      { pic: '🦮', s: 'The dog can help.' }
    ]
  },
  {
    id: 'make-cake', min: 6, title: 'Sam Bakes a Cake',
    steps: [
      { pic: '🥚', s: 'Sam has an egg.' },
      { pic: '🥣', s: 'Sam can mix the egg.' },
      { pic: '🎂', s: 'The cake is big.' }
    ]
  },
  {
    id: 'rain-day', min: 7, title: 'A Rainy Day',
    steps: [
      { pic: '☁️', s: 'The cloud is big.' },
      { pic: '🌧️', s: 'The rain is here.' },
      { pic: '🌈', s: 'I see a rainbow.' }
    ]
  },
  {
    id: 'snow-day', min: 7, title: 'A Snowy Day',
    steps: [
      { pic: '❄️', s: 'The snow is here.' },
      { pic: '⛄', s: 'I see a snowman.' },
      { pic: '☀️', s: 'The sun is hot.' }
    ]
  },
  {
    id: 'seed-flower', min: 8, title: 'Seed to Flower',
    steps: [
      { pic: '🌰', s: 'The seed is in the sun.' },
      { pic: '🌱', s: 'The sprout is up.' },
      { pic: '🌼', s: 'The flower is big.' }
    ]
  }
];

/* ---------------- activity definitions ---------------- */

var PHS_ACTIVITIES = [
  { id: 'circle', name: 'Read & Circle', answers: true,
    blurb: 'Read the sentence, circle the picture that matches. The 3 pictures are near-misses from the same group — children must really read.',
    how: 'Read the sentence aloud, then circle the one picture that matches it.' },
  { id: 'draw', name: 'Read & Draw', answers: false,
    blurb: 'Read the sentence and draw it in the frame.',
    how: 'Read the sentence, then draw exactly what it says in the empty frame.' },
  { id: 'comp', name: 'Picture Comprehension', answers: true,
    blurb: 'A little scene and passage, then Who / What / Where questions with 3 choices.',
    how: 'Look at the picture, read the passage, then circle the right answer to each question.' },
  { id: 'trace', name: 'Trace the Sentence', answers: false,
    blurb: 'Trace the sentence on primary lines, then write it yourself on the blank lines.',
    how: 'Trace over the light letters, then write the sentence yourself on the empty lines.' },
  { id: 'seq', name: 'Story Sequencing', answers: true,
    blurb: '3-step mini stories with the pictures out of order — number them 1, 2, 3.',
    how: 'Read the sentences, look at the pictures, and write 1, 2, 3 to put the story in order.' },
  { id: 'builder', name: 'Sentence Builder', answers: true,
    blurb: 'One word is missing — circle the right word and write the whole sentence.',
    how: 'Look at the picture, choose the missing word, then write the full sentence.' }
];

/* ---------------- picture packs ----------------
   A picture pack changes HOW the words are drawn, never
   WHICH words are used: variants map a bank word to an
   alternate emoji that still unambiguously depicts that
   word (cat face 🐱 → full cat 🐈 → black cat 🐈‍⬛). Because
   validation and exactly-one-match are word-based, packs
   cannot break decodability; the engine additionally keeps
   every picture on a strip / page emoji-distinct under the
   active pack. `deco` overrides the design's decorative
   cover cluster / tile row and the tracker symbol; null
   means "use the design's own decorations". */
var PHS_PICTURE_PACKS = [
  {
    id: 'storybook', name: 'Storybook (new)',
    blurb: 'Our own warm watercolour storybook illustrations, drawn in one consistent style for this tool — full-body pictures on a cream page. Words without a storybook picture yet use the Illustrated artwork, and every new book rotates the mix.',
    variants: {},
    deco: null,
    storybook: true
  },
  {
    id: 'illustrated', name: 'Illustrated',
    blurb: 'Real illustrated artwork for every word — full-body pictures wherever they exist (Noto Emoji, Twemoji and Fluent Emoji artwork). Every new book rotates to a fresh variant, so a series never looks copy-pasted.',
    variants: {},
    deco: null,
    illustrated: true
  },
  {
    id: 'classic', name: 'Classic Faces',
    blurb: 'Friendly face-style pictures — the familiar look from the word banks.',
    variants: {},
    deco: null
  },
  {
    id: 'full', name: 'Full Pictures',
    blurb: 'Whole animals and full objects instead of faces — a fresh look for a new book in a series.',
    variants: {
      cat: '🐈', dog: '🐕', pig: '🐖', chick: '🐥', fish: '🐠', whale: '🐳',
      bird: '🕊️', horse: '🐎', tiger: '🐅', sun: '🌞', moon: '🌕', star: '🌟',
      tree: '🌲', leaf: '🍂', flower: '🌸', cake: '🍰', key: '🗝️', car: '🚙',
      bus: '🚍', boat: '🚤', train: '🚆', ship: '⛴️', plane: '🛩️', cup: '🍵',
      letter: '💌', paper: '📃', hat: '🎩', bag: '🎒', snowman: '☃️'
    },
    deco: {
      cluster: ['🦋', '🍄', '🌷', '🐿️'],
      tiles: ['🐈', '🐕', '🌸', '🍰', '🕊️'],
      star: '♡'
    }
  },
  {
    id: 'silly', name: 'Silly Fun',
    blurb: 'Playful, giggly pictures — poodles, pufferfish and cupcakes. Kids love this one.',
    variants: {
      cat: '🐈‍⬛', dog: '🐩', pig: '🐽', fish: '🐡', bird: '🦜', moon: '🌛',
      star: '✨', tree: '🌴', leaf: '🍁', flower: '🌻', cake: '🧁', car: '🚕',
      boat: '🛶', train: '🚇', bag: '🛍️'
    },
    deco: {
      cluster: ['🎵', '🍒', '🌈', '🕶️'],
      tiles: ['🐩', '🦜', '🌻', '🧁', '✨'],
      star: '✿'
    }
  }
];

function phsPicturePackById(id) {
  for (var i = 0; i < PHS_PICTURE_PACKS.length; i++) {
    if (PHS_PICTURE_PACKS[i].id === id) return PHS_PICTURE_PACKS[i];
  }
  return PHS_PICTURE_PACKS[0];
}

function phsLevelById(id) {
  for (var i = 0; i < PHS_LEVELS.length; i++) if (PHS_LEVELS[i].id === id) return PHS_LEVELS[i];
  return PHS_LEVELS[0];
}
function phsActivityById(id) {
  for (var i = 0; i < PHS_ACTIVITIES.length; i++) if (PHS_ACTIVITIES[i].id === id) return PHS_ACTIVITIES[i];
  return null;
}

/* Cumulative banks: everything introduced at levels 1..n. */
function phsCumulative(levelId) {
  var out = { nouns: [], verbs: [], adjectives: [], places: [], names: [], extras: [], sight: [], templates: [] };
  PHS_LEVELS.forEach(function (lv) {
    if (lv.id > levelId) return;
    ['nouns', 'verbs', 'adjectives', 'places', 'names', 'extras', 'sight', 'templates'].forEach(function (k) {
      lv[k].forEach(function (x) { if (out[k].indexOf(x) === -1) out[k].push(x); });
    });
  });
  return out;
}


/* Illustrated picture library (Phase 2): per bank word,
 up to 3 bundled artwork variants (full-body first).
 Artwork: Noto Emoji (Apache 2.0) · Twemoji (CC BY 4.0) ·
 Fluent Emoji (MIT). See assets/COVERAGE.md. The files
 live in assets/pics/ and ship with the tool. */
var PHS_PIC_LIB = {"cat":[{"src":"assets/pics/cat_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cat_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cat_3.svg","full":true,"via":"fluent"}],"rat":[{"src":"assets/pics/rat_1.svg","full":true,"via":"noto"},{"src":"assets/pics/rat_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/rat_3.svg","full":true,"via":"fluent"}],"bat":[{"src":"assets/pics/bat_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bat_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bat_3.svg","full":true,"via":"fluent"}],"ant":[{"src":"assets/pics/ant_1.svg","full":true,"via":"noto"},{"src":"assets/pics/ant_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/ant_3.svg","full":true,"via":"fluent"}],"ram":[{"src":"assets/pics/ram_1.svg","full":true,"via":"noto"},{"src":"assets/pics/ram_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/ram_3.svg","full":true,"via":"fluent"}],"ham":[{"src":"assets/pics/ham_1.svg","full":true,"via":"noto"},{"src":"assets/pics/ham_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/ham_3.svg","full":true,"via":"fluent"}],"jam":[{"src":"assets/pics/jam_1.svg","full":true,"via":"noto"},{"src":"assets/pics/jam_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/jam_3.svg","full":true,"via":"fluent"}],"yam":[{"src":"assets/pics/yam_1.svg","full":true,"via":"noto"},{"src":"assets/pics/yam_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/yam_3.svg","full":true,"via":"fluent"}],"map":[{"src":"assets/pics/map_1.svg","full":true,"via":"noto"},{"src":"assets/pics/map_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/map_3.svg","full":true,"via":"fluent"}],"bag":[{"src":"assets/pics/bag_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bag_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bag_3.svg","full":true,"via":"fluent"}],"can":[{"src":"assets/pics/can_1.svg","full":true,"via":"noto"},{"src":"assets/pics/can_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/can_3.svg","full":true,"via":"fluent"}],"pan":[{"src":"assets/pics/pan_1.svg","full":true,"via":"noto"},{"src":"assets/pics/pan_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/pan_3.svg","full":true,"via":"fluent"}],"wax":[{"src":"assets/pics/wax_1.svg","full":true,"via":"noto"},{"src":"assets/pics/wax_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/wax_3.svg","full":true,"via":"fluent"}],"tag":[{"src":"assets/pics/tag_1.svg","full":true,"via":"noto"},{"src":"assets/pics/tag_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/tag_3.svg","full":true,"via":"fluent"}],"hat":[{"src":"assets/pics/hat_1.svg","full":true,"via":"noto"},{"src":"assets/pics/hat_2.svg","full":true,"via":"twemoji"}],"cap":[{"src":"assets/pics/cap_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cap_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cap_3.svg","full":true,"via":"fluent"}],"van":[{"src":"assets/pics/van_1.svg","full":true,"via":"noto"},{"src":"assets/pics/van_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/van_3.svg","full":true,"via":"fluent"}],"cab":[{"src":"assets/pics/cab_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cab_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cab_3.svg","full":true,"via":"fluent"}],"pig":[{"src":"assets/pics/pig_1.svg","full":true,"via":"noto"},{"src":"assets/pics/pig_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/pig_3.svg","full":true,"via":"fluent"}],"dog":[{"src":"assets/pics/dog_1.svg","full":true,"via":"noto"},{"src":"assets/pics/dog_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/dog_3.svg","full":true,"via":"fluent"}],"fox":[{"src":"assets/pics/fox_1.svg","full":false,"via":"noto"},{"src":"assets/pics/fox_2.svg","full":false,"via":"twemoji"},{"src":"assets/pics/fox_3.svg","full":false,"via":"fluent"}],"ox":[{"src":"assets/pics/ox_1.svg","full":true,"via":"noto"},{"src":"assets/pics/ox_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/ox_3.svg","full":true,"via":"fluent"}],"hog":[{"src":"assets/pics/hog_1.svg","full":true,"via":"noto"},{"src":"assets/pics/hog_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/hog_3.svg","full":true,"via":"fluent"}],"fin":[{"src":"assets/pics/fin_1.svg","full":true,"via":"noto"},{"src":"assets/pics/fin_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/fin_3.svg","full":true,"via":"fluent"}],"kid":[{"src":"assets/pics/kid_1.svg","full":true,"via":"noto"},{"src":"assets/pics/kid_2.svg","full":true,"via":"twemoji"}],"lip":[{"src":"assets/pics/lip_1.svg","full":true,"via":"noto"},{"src":"assets/pics/lip_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/lip_3.svg","full":true,"via":"fluent"}],"pin":[{"src":"assets/pics/pin_1.svg","full":true,"via":"noto"},{"src":"assets/pics/pin_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/pin_3.svg","full":true,"via":"fluent"}],"bin":[{"src":"assets/pics/bin_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bin_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bin_3.svg","full":true,"via":"fluent"}],"pot":[{"src":"assets/pics/pot_1.svg","full":true,"via":"noto"},{"src":"assets/pics/pot_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/pot_3.svg","full":true,"via":"fluent"}],"log":[{"src":"assets/pics/log_1.svg","full":true,"via":"noto"},{"src":"assets/pics/log_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/log_3.svg","full":true,"via":"fluent"}],"mop":[{"src":"assets/pics/mop_1.svg","full":true,"via":"noto"},{"src":"assets/pics/mop_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/mop_3.svg","full":true,"via":"fluent"}],"cot":[{"src":"assets/pics/cot_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cot_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cot_3.svg","full":true,"via":"fluent"}],"box":[{"src":"assets/pics/box_1.svg","full":true,"via":"noto"},{"src":"assets/pics/box_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/box_3.svg","full":true,"via":"fluent"}],"dot":[{"src":"assets/pics/dot_1.svg","full":true,"via":"noto"},{"src":"assets/pics/dot_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/dot_3.svg","full":true,"via":"fluent"}],"cob":[{"src":"assets/pics/cob_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cob_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cob_3.svg","full":true,"via":"fluent"}],"pod":[{"src":"assets/pics/pod_1.svg","full":true,"via":"noto"}],"hen":[{"src":"assets/pics/hen_1.svg","full":true,"via":"noto"},{"src":"assets/pics/hen_2.svg","full":false,"via":"twemoji"},{"src":"assets/pics/hen_3.svg","full":true,"via":"fluent"}],"bug":[{"src":"assets/pics/bug_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bug_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bug_3.svg","full":true,"via":"fluent"}],"pup":[{"src":"assets/pics/pup_1.svg","full":true,"via":"noto"},{"src":"assets/pics/pup_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/pup_3.svg","full":true,"via":"fluent"}],"cub":[{"src":"assets/pics/cub_1.svg","full":false,"via":"noto"},{"src":"assets/pics/cub_2.svg","full":false,"via":"twemoji"},{"src":"assets/pics/cub_3.svg","full":false,"via":"fluent"}],"duck":[{"src":"assets/pics/duck_1.svg","full":true,"via":"noto"},{"src":"assets/pics/duck_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/duck_3.svg","full":true,"via":"fluent"}],"egg":[{"src":"assets/pics/egg_1.svg","full":true,"via":"noto"},{"src":"assets/pics/egg_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/egg_3.svg","full":true,"via":"fluent"}],"nut":[{"src":"assets/pics/nut_1.svg","full":true,"via":"noto"},{"src":"assets/pics/nut_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/nut_3.svg","full":true,"via":"fluent"}],"gum":[{"src":"assets/pics/gum_1.svg","full":true,"via":"noto"},{"src":"assets/pics/gum_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/gum_3.svg","full":true,"via":"fluent"}],"bed":[{"src":"assets/pics/bed_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bed_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bed_3.svg","full":true,"via":"fluent"}],"pen":[{"src":"assets/pics/pen_1.svg","full":true,"via":"noto"},{"src":"assets/pics/pen_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/pen_3.svg","full":true,"via":"fluent"}],"net":[{"src":"assets/pics/net_1.svg","full":true,"via":"noto"},{"src":"assets/pics/net_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/net_3.svg","full":true,"via":"fluent"}],"cup":[{"src":"assets/pics/cup_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cup_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cup_3.svg","full":true,"via":"fluent"}],"tub":[{"src":"assets/pics/tub_1.svg","full":true,"via":"noto"},{"src":"assets/pics/tub_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/tub_3.svg","full":true,"via":"fluent"}],"bell":[{"src":"assets/pics/bell_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bell_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bell_3.svg","full":true,"via":"fluent"}],"web":[{"src":"assets/pics/web_1.svg","full":true,"via":"noto"},{"src":"assets/pics/web_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/web_3.svg","full":true,"via":"fluent"}],"sun":[{"src":"assets/pics/sun_1.svg","full":true,"via":"noto"},{"src":"assets/pics/sun_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/sun_3.svg","full":true,"via":"fluent"}],"jet":[{"src":"assets/pics/jet_1.svg","full":true,"via":"noto"},{"src":"assets/pics/jet_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/jet_3.svg","full":true,"via":"fluent"}],"bus":[{"src":"assets/pics/bus_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bus_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bus_3.svg","full":true,"via":"fluent"}],"fish":[{"src":"assets/pics/fish_1.svg","full":true,"via":"noto"},{"src":"assets/pics/fish_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/fish_3.svg","full":true,"via":"fluent"}],"chick":[{"src":"assets/pics/chick_1.svg","full":true,"via":"noto"},{"src":"assets/pics/chick_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/chick_3.svg","full":true,"via":"fluent"}],"whale":[{"src":"assets/pics/whale_1.svg","full":true,"via":"noto"},{"src":"assets/pics/whale_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/whale_3.svg","full":true,"via":"fluent"}],"cheese":[{"src":"assets/pics/cheese_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cheese_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cheese_3.svg","full":true,"via":"fluent"}],"lunch":[{"src":"assets/pics/lunch_1.svg","full":true,"via":"noto"},{"src":"assets/pics/lunch_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/lunch_3.svg","full":true,"via":"fluent"}],"peach":[{"src":"assets/pics/peach_1.svg","full":true,"via":"noto"},{"src":"assets/pics/peach_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/peach_3.svg","full":true,"via":"fluent"}],"ship":[{"src":"assets/pics/ship_1.svg","full":true,"via":"noto"},{"src":"assets/pics/ship_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/ship_3.svg","full":true,"via":"fluent"}],"chair":[{"src":"assets/pics/chair_1.svg","full":true,"via":"noto"},{"src":"assets/pics/chair_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/chair_3.svg","full":true,"via":"fluent"}],"watch":[{"src":"assets/pics/watch_1.svg","full":true,"via":"noto"},{"src":"assets/pics/watch_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/watch_3.svg","full":true,"via":"fluent"}],"wheel":[{"src":"assets/pics/wheel_1.svg","full":true,"via":"noto"},{"src":"assets/pics/wheel_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/wheel_3.svg","full":true,"via":"fluent"}],"brush":[{"src":"assets/pics/brush_1.svg","full":true,"via":"noto"},{"src":"assets/pics/brush_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/brush_3.svg","full":true,"via":"fluent"}],"bath":[{"src":"assets/pics/bath_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bath_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bath_3.svg","full":true,"via":"fluent"}],"shell":[{"src":"assets/pics/shell_1.svg","full":true,"via":"noto"},{"src":"assets/pics/shell_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/shell_3.svg","full":true,"via":"fluent"}],"tooth":[{"src":"assets/pics/tooth_1.svg","full":true,"via":"noto"},{"src":"assets/pics/tooth_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/tooth_3.svg","full":true,"via":"fluent"}],"shop":[{"src":"assets/pics/shop_1.svg","full":true,"via":"noto"},{"src":"assets/pics/shop_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/shop_3.svg","full":true,"via":"fluent"}],"frog":[{"src":"assets/pics/frog_1.svg","full":false,"via":"noto"},{"src":"assets/pics/frog_2.svg","full":false,"via":"twemoji"},{"src":"assets/pics/frog_3.svg","full":false,"via":"fluent"}],"crab":[{"src":"assets/pics/crab_1.svg","full":true,"via":"noto"},{"src":"assets/pics/crab_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/crab_3.svg","full":true,"via":"fluent"}],"drum":[{"src":"assets/pics/drum_1.svg","full":true,"via":"noto"},{"src":"assets/pics/drum_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/drum_3.svg","full":true,"via":"fluent"}],"flag":[{"src":"assets/pics/flag_1.svg","full":true,"via":"noto"},{"src":"assets/pics/flag_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/flag_3.svg","full":true,"via":"fluent"}],"clock":[{"src":"assets/pics/clock_1.svg","full":true,"via":"noto"},{"src":"assets/pics/clock_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/clock_3.svg","full":true,"via":"fluent"}],"gift":[{"src":"assets/pics/gift_1.svg","full":true,"via":"noto"},{"src":"assets/pics/gift_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/gift_3.svg","full":true,"via":"fluent"}],"sled":[{"src":"assets/pics/sled_1.svg","full":true,"via":"noto"},{"src":"assets/pics/sled_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/sled_3.svg","full":true,"via":"fluent"}],"dress":[{"src":"assets/pics/dress_1.svg","full":true,"via":"noto"},{"src":"assets/pics/dress_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/dress_3.svg","full":true,"via":"fluent"}],"truck":[{"src":"assets/pics/truck_1.svg","full":true,"via":"noto"},{"src":"assets/pics/truck_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/truck_3.svg","full":true,"via":"fluent"}],"grass":[{"src":"assets/pics/grass_1.svg","full":true,"via":"noto"},{"src":"assets/pics/grass_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/grass_3.svg","full":true,"via":"fluent"}],"nest":[{"src":"assets/pics/nest_1.svg","full":true,"via":"noto"},{"src":"assets/pics/nest_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/nest_3.svg","full":true,"via":"fluent"}],"sand":[{"src":"assets/pics/sand_1.svg","full":true,"via":"noto"},{"src":"assets/pics/sand_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/sand_3.svg","full":true,"via":"fluent"}],"milk":[{"src":"assets/pics/milk_1.svg","full":true,"via":"noto"},{"src":"assets/pics/milk_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/milk_3.svg","full":true,"via":"fluent"}],"hand":[{"src":"assets/pics/hand_1.svg","full":true,"via":"noto"},{"src":"assets/pics/hand_2.svg","full":true,"via":"twemoji"}],"tent":[{"src":"assets/pics/tent_1.svg","full":true,"via":"noto"},{"src":"assets/pics/tent_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/tent_3.svg","full":true,"via":"fluent"}],"snake":[{"src":"assets/pics/snake_1.svg","full":true,"via":"noto"},{"src":"assets/pics/snake_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/snake_3.svg","full":true,"via":"fluent"}],"cake":[{"src":"assets/pics/cake_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cake_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cake_3.svg","full":true,"via":"fluent"}],"grape":[{"src":"assets/pics/grape_1.svg","full":true,"via":"noto"},{"src":"assets/pics/grape_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/grape_3.svg","full":true,"via":"fluent"}],"bike":[{"src":"assets/pics/bike_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bike_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bike_3.svg","full":true,"via":"fluent"}],"plane":[{"src":"assets/pics/plane_1.svg","full":true,"via":"noto"},{"src":"assets/pics/plane_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/plane_3.svg","full":true,"via":"fluent"}],"kite":[{"src":"assets/pics/kite_1.svg","full":true,"via":"noto"},{"src":"assets/pics/kite_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/kite_3.svg","full":true,"via":"fluent"}],"slide":[{"src":"assets/pics/slide_1.svg","full":true,"via":"noto"},{"src":"assets/pics/slide_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/slide_3.svg","full":true,"via":"fluent"}],"cube":[{"src":"assets/pics/cube_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cube_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cube_3.svg","full":true,"via":"fluent"}],"game":[{"src":"assets/pics/game_1.svg","full":true,"via":"noto"},{"src":"assets/pics/game_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/game_3.svg","full":true,"via":"fluent"}],"tape":[{"src":"assets/pics/tape_1.svg","full":true,"via":"noto"},{"src":"assets/pics/tape_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/tape_3.svg","full":true,"via":"fluent"}],"bone":[{"src":"assets/pics/bone_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bone_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bone_3.svg","full":true,"via":"fluent"}],"nose":[{"src":"assets/pics/nose_1.svg","full":true,"via":"noto"},{"src":"assets/pics/nose_2.svg","full":true,"via":"twemoji"}],"rose":[{"src":"assets/pics/rose_1.svg","full":true,"via":"noto"},{"src":"assets/pics/rose_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/rose_3.svg","full":true,"via":"fluent"}],"lake":[{"src":"assets/pics/lake_1.svg","full":true,"via":"noto"},{"src":"assets/pics/lake_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/lake_3.svg","full":true,"via":"fluent"}],"cave":[{"src":"assets/pics/cave_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cave_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cave_3.svg","full":true,"via":"fluent"}],"home":[{"src":"assets/pics/home_1.svg","full":true,"via":"noto"},{"src":"assets/pics/home_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/home_3.svg","full":true,"via":"fluent"}],"gate":[{"src":"assets/pics/gate_1.svg","full":true,"via":"noto"},{"src":"assets/pics/gate_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/gate_3.svg","full":true,"via":"fluent"}],"goat":[{"src":"assets/pics/goat_1.svg","full":true,"via":"noto"},{"src":"assets/pics/goat_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/goat_3.svg","full":true,"via":"fluent"}],"bee":[{"src":"assets/pics/bee_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bee_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bee_3.svg","full":true,"via":"fluent"}],"snail":[{"src":"assets/pics/snail_1.svg","full":true,"via":"noto"},{"src":"assets/pics/snail_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/snail_3.svg","full":true,"via":"fluent"}],"soap":[{"src":"assets/pics/soap_1.svg","full":true,"via":"noto"},{"src":"assets/pics/soap_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/soap_3.svg","full":true,"via":"fluent"}],"key":[{"src":"assets/pics/key_1.svg","full":true,"via":"noto"},{"src":"assets/pics/key_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/key_3.svg","full":true,"via":"fluent"}],"snowman":[{"src":"assets/pics/snowman_1.svg","full":true,"via":"noto"},{"src":"assets/pics/snowman_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/snowman_3.svg","full":true,"via":"fluent"}],"coat":[{"src":"assets/pics/coat_1.svg","full":true,"via":"noto"},{"src":"assets/pics/coat_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/coat_3.svg","full":true,"via":"fluent"}],"boat":[{"src":"assets/pics/boat_1.svg","full":true,"via":"noto"},{"src":"assets/pics/boat_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/boat_3.svg","full":true,"via":"fluent"}],"train":[{"src":"assets/pics/train_1.svg","full":true,"via":"noto"},{"src":"assets/pics/train_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/train_3.svg","full":true,"via":"fluent"}],"rain":[{"src":"assets/pics/rain_1.svg","full":true,"via":"noto"},{"src":"assets/pics/rain_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/rain_3.svg","full":true,"via":"fluent"}],"tree":[{"src":"assets/pics/tree_1.svg","full":true,"via":"noto"},{"src":"assets/pics/tree_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/tree_3.svg","full":true,"via":"fluent"}],"seed":[{"src":"assets/pics/seed_1.svg","full":true,"via":"noto"},{"src":"assets/pics/seed_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/seed_3.svg","full":true,"via":"fluent"}],"leaf":[{"src":"assets/pics/leaf_1.svg","full":true,"via":"noto"},{"src":"assets/pics/leaf_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/leaf_3.svg","full":true,"via":"fluent"}],"beach":[{"src":"assets/pics/beach_1.svg","full":true,"via":"noto"},{"src":"assets/pics/beach_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/beach_3.svg","full":true,"via":"fluent"}],"moon":[{"src":"assets/pics/moon_1.svg","full":true,"via":"noto"},{"src":"assets/pics/moon_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/moon_3.svg","full":true,"via":"fluent"}],"cloud":[{"src":"assets/pics/cloud_1.svg","full":true,"via":"noto"},{"src":"assets/pics/cloud_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/cloud_3.svg","full":true,"via":"fluent"}],"snow":[{"src":"assets/pics/snow_1.svg","full":true,"via":"noto"},{"src":"assets/pics/snow_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/snow_3.svg","full":true,"via":"fluent"}],"rainbow":[{"src":"assets/pics/rainbow_1.svg","full":true,"via":"noto"},{"src":"assets/pics/rainbow_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/rainbow_3.svg","full":true,"via":"fluent"}],"sea":[{"src":"assets/pics/sea_1.svg","full":true,"via":"noto"},{"src":"assets/pics/sea_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/sea_3.svg","full":true,"via":"fluent"}],"day":[{"src":"assets/pics/day_1.svg","full":true,"via":"noto"},{"src":"assets/pics/day_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/day_3.svg","full":true,"via":"fluent"}],"feet":[{"src":"assets/pics/feet_1.svg","full":true,"via":"noto"},{"src":"assets/pics/feet_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/feet_3.svg","full":true,"via":"fluent"}],"bird":[{"src":"assets/pics/bird_1.svg","full":true,"via":"noto"},{"src":"assets/pics/bird_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/bird_3.svg","full":true,"via":"fluent"}],"horse":[{"src":"assets/pics/horse_1.svg","full":true,"via":"noto"},{"src":"assets/pics/horse_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/horse_3.svg","full":true,"via":"fluent"}],"turtle":[{"src":"assets/pics/turtle_1.svg","full":true,"via":"noto"},{"src":"assets/pics/turtle_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/turtle_3.svg","full":true,"via":"fluent"}],"tiger":[{"src":"assets/pics/tiger_1.svg","full":true,"via":"noto"},{"src":"assets/pics/tiger_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/tiger_3.svg","full":true,"via":"fluent"}],"corn":[{"src":"assets/pics/corn_1.svg","full":true,"via":"noto"},{"src":"assets/pics/corn_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/corn_3.svg","full":true,"via":"fluent"}],"car":[{"src":"assets/pics/car_1.svg","full":true,"via":"noto"},{"src":"assets/pics/car_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/car_3.svg","full":true,"via":"fluent"}],"fork":[{"src":"assets/pics/fork_1.svg","full":true,"via":"noto"},{"src":"assets/pics/fork_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/fork_3.svg","full":true,"via":"fluent"}],"letter":[{"src":"assets/pics/letter_1.svg","full":true,"via":"noto"},{"src":"assets/pics/letter_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/letter_3.svg","full":true,"via":"fluent"}],"paper":[{"src":"assets/pics/paper_1.svg","full":true,"via":"noto"},{"src":"assets/pics/paper_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/paper_3.svg","full":true,"via":"fluent"}],"shirt":[{"src":"assets/pics/shirt_1.svg","full":true,"via":"noto"},{"src":"assets/pics/shirt_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/shirt_3.svg","full":true,"via":"fluent"}],"girl":[{"src":"assets/pics/girl_1.svg","full":true,"via":"noto"},{"src":"assets/pics/girl_2.svg","full":true,"via":"twemoji"}],"star":[{"src":"assets/pics/star_1.svg","full":true,"via":"noto"},{"src":"assets/pics/star_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/star_3.svg","full":true,"via":"fluent"}],"park":[{"src":"assets/pics/park_1.svg","full":true,"via":"noto"},{"src":"assets/pics/park_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/park_3.svg","full":true,"via":"fluent"}],"garden":[{"src":"assets/pics/garden_1.svg","full":true,"via":"noto"},{"src":"assets/pics/garden_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/garden_3.svg","full":true,"via":"fluent"}],"morning":[{"src":"assets/pics/morning_1.svg","full":true,"via":"noto"},{"src":"assets/pics/morning_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/morning_3.svg","full":true,"via":"fluent"}],"flower":[{"src":"assets/pics/flower_1.svg","full":true,"via":"noto"},{"src":"assets/pics/flower_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/flower_3.svg","full":true,"via":"fluent"}],"sprout":[{"src":"assets/pics/sprout_1.svg","full":true,"via":"noto"},{"src":"assets/pics/sprout_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/sprout_3.svg","full":true,"via":"fluent"}],"farm":[{"src":"assets/pics/farm_1.svg","full":true,"via":"noto"},{"src":"assets/pics/farm_2.svg","full":true,"via":"twemoji"},{"src":"assets/pics/farm_3.svg","full":true,"via":"fluent"}]};

/* Storybook picture set: OUR OWN illustrations, generated
 in one locked warm-watercolour style (see the design
 brief). One PNG per word in assets/storybook/<word>.png.
 This manifest is REGENERATED by gen_storybook_manifest.js
 from the files on disk — never edit it by hand.
 PHS_STORYBOOK_BEGIN */
var PHS_STORYBOOK = {"ant":true,"bag":true,"bat":true,"bath":true,"beach":true,"bed":true,"bee":true,"bell":true,"bike":true,"bin":true,"bird":true,"boat":true,"bone":true,"box":true,"brush":true,"bug":true,"bus":true,"cab":true,"cake":true,"can":true,"cap":true,"car":true,"cat":true,"cave":true,"chair":true,"cheese":true,"chick":true,"clock":true,"cloud":true,"coat":true,"cob":true,"corn":true,"cot":true,"crab":true,"cub":true,"cube":true,"cup":true,"day":true,"dog":true,"dot":true,"dress":true,"drum":true,"duck":true,"egg":true,"farm":true,"feet":true,"fin":true,"fish":true,"flag":true,"flower":true,"fork":true,"fox":true,"frog":true,"game":true,"garden":true,"gate":true,"gift":true,"girl":true,"goat":true,"grape":true,"grass":true,"gum":true,"ham":true,"hand":true,"hat":true,"hen":true,"hog":true,"home":true,"horse":true,"jam":true,"jet":true,"key":true,"kid":true,"kite":true,"lake":true,"leaf":true,"letter":true,"lip":true,"log":true,"lunch":true,"map":true,"milk":true,"moon":true,"mop":true,"morning":true,"nest":true,"net":true,"nose":true,"nut":true,"ox":true,"pan":true,"paper":true,"park":true,"peach":true,"pen":true,"pig":true,"pin":true,"plane":true,"pod":true,"pot":true,"pup":true,"rain":true,"rainbow":true,"ram":true,"rat":true,"rose":true,"sand":true,"sea":true,"seed":true,"shell":true,"ship":true,"shirt":true,"shop":true,"sled":true,"slide":true,"snail":true,"snake":true,"snow":true,"snowman":true,"soap":true,"sprout":true,"star":true,"sun":true,"tag":true,"tape":true,"tent":true,"tiger":true,"tooth":true,"train":true,"tree":true,"truck":true,"tub":true,"turtle":true,"van":true,"watch":true,"wax":true,"web":true,"whale":true,"wheel":true,"yam":true};
/* PHS_STORYBOOK_END */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PHS_LEVELS: PHS_LEVELS, PHS_SEQUENCES: PHS_SEQUENCES, PHS_ACTIVITIES: PHS_ACTIVITIES,
    PHS_PICTURE_PACKS: PHS_PICTURE_PACKS, phsPicturePackById: phsPicturePackById, PHS_PIC_LIB: PHS_PIC_LIB,
    PHS_STORYBOOK: PHS_STORYBOOK,
    phsLevelById: phsLevelById, phsActivityById: phsActivityById, phsCumulative: phsCumulative
  };
}
