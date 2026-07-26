// Campus points of interest. Coordinates are real lat/lon read out of the OSM
// data the 3D scene was built from, so pins land exactly on their buildings.
// `lines` is the character's dialogue, advanced one at a time.
//
// `voice` is an ElevenLabs voice id. Narration is pre-rendered to
// public/audio/<id>-<n>.mp3 by scripts/gen-audio.mjs, so the running app never
// calls the API and never needs the key.

export const POIS = [
  {
    id: 'campanile',
    voice: 'pqHfZKP75CvOlQylNhV4', // Bill
    name: 'Sather Tower',
    subtitle: 'The Campanile',
    lat: 37.872060, lon: -122.257835,
    character: 'Carillonist',
    color: 0xd8b45a,
    lines: [
      "You found it — Sather Tower, though nobody calls it that. It's the Campanile.",
      "307 feet tall, finished in 1914. Third-tallest bell-and-clock tower in the world.",
      "I play the carillon up there. 61 bells. Three times a day, every day of term.",
      "Take the elevator up sometime. On a clear day you can see the Golden Gate.",
    ],
  },
  {
    id: 'sproul-plaza',
    voice: 'FGY2WhTYpPnrIDTdsKH5', // Laura
    name: 'Sproul Plaza',
    subtitle: 'Free Speech Movement',
    lat: 37.869510, lon: -122.259360,
    character: 'Student Organizer',
    color: 0xc0554d,
    lines: [
      "This is Sproul Plaza. If you only see one place at Berkeley, make it this one.",
      "1964 — Mario Savio climbed onto a police car right about here and started talking.",
      "That became the Free Speech Movement. It changed what students could do on campus.",
      "These days it's mostly club tabling. Come by on a weekday and you'll see.",
    ],
  },
  {
    id: 'sproul-hall',
    voice: 'XrExE9yKIg1WjnnlVkGX', // Matilda
    name: 'Sproul Hall',
    subtitle: 'Administration',
    lat: 37.869590, lon: -122.258820,
    character: 'Registrar',
    color: 0x6a8fb5,
    lines: [
      "Sproul Hall. Registration, financial aid, and every form you'll ever need.",
      "In December 1964 around 800 students were arrested on these steps.",
      "Now it's mostly queues. Bring your student ID and some patience.",
    ],
  },
  {
    id: 'memorial-glade',
    voice: 'bIHbv24MWmeRgasZH58o', // Will
    name: 'Memorial Glade',
    subtitle: 'The lawn',
    lat: 37.873200, lon: -122.259370,
    character: 'Student',
    color: 0x5fa87a,
    lines: [
      "Memorial Glade. Best lawn on campus, and I'm not taking questions.",
      "Dedicated to Californians who died in the Second World War.",
      "During finals this whole lawn is people asleep on their backpacks.",
    ],
  },
  {
    id: 'moffitt',
    voice: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    name: 'Moffitt Library',
    subtitle: 'Undergraduate library',
    lat: 37.872550, lon: -122.260860,
    character: 'Librarian',
    color: 0x8a7fb5,
    lines: [
      "Moffitt — the undergrad library. Floors 4 and 5 are open 24 hours in term.",
      "If you want silence, go down. If you want to talk, stay up here.",
      "Doe Library is next door and much prettier. Go look at the North Reading Room.",
    ],
  },
  {
    id: 'wheeler',
    voice: 'nPczCjzI2devNBz1zQrb', // Brian
    name: 'Wheeler Hall',
    subtitle: 'Lecture halls',
    lat: 37.871310, lon: -122.259170,
    character: 'Professor',
    color: 0xb5894f,
    lines: [
      "Wheeler Hall. The auditorium downstairs seats over seven hundred.",
      "Most undergraduates take at least one class in this building. Usually English.",
      "Sit near the front. I promise the acoustics are worse than they look.",
    ],
  },
  {
    id: 'california-hall',
    voice: 'iP95p4xoKVk53GoZ742B', // Chris
    name: 'California Hall',
    subtitle: "Chancellor's office",
    lat: 37.871890, lon: -122.260370,
    character: 'Staff Member',
    color: 0x7d9ea8,
    lines: [
      "California Hall — 1905, one of John Galen Howard's originals.",
      "The Chancellor works here. So the protests tend to end up on this lawn.",
      "Granite from the same quarry as the Campanile, if you like that sort of detail.",
    ],
  },
  {
    id: 'dwinelle',
    voice: 'TX3LPaxmHKxFdv7VOQHJ', // Liam
    name: 'Dwinelle Plaza',
    subtitle: 'Humanities',
    lat: 37.870620, lon: -122.259970,
    character: 'Tour Guide',
    color: 0xcf8f5a,
    lines: [
      "Dwinelle Hall. Famous for being impossible to navigate.",
      "It was built in stages and the wings don't line up. Floor 1 meets floor 2 sideways.",
      "Students swear there's a room nobody has ever found. There isn't. Probably.",
    ],
  },

  // ── Student Voices ───────────────────────────────────────────────

  {
    id: 'priya-campanile',
    role: 'student',
    name: 'The Campanile',
    subtitle: 'First-Gen Student',
    lat: 37.872120, lon: -122.257670,
    character: 'Priya',
    color: 0xe8a87c,
    lines: [
      "I'm first-gen and had no idea what college would be like. The Campanile was the first thing I saw on move-in day. Every time I hear the bells now, it reminds me I earned my place here.",
    ],
  },
  {
    id: 'aisha-sproul',
    role: 'student',
    name: 'Sproul Plaza',
    subtitle: 'International Student',
    lat: 37.869300, lon: -122.259500,
    character: 'Aisha',
    color: 0x5dade2,
    lines: [
      "As an international student, stepping onto Sproul the first time was overwhelming in the best way. The protests, the flyers, the energy — you feel like you're at the center of everything.",
    ],
  },
  {
    id: 'diego-doe',
    role: 'student',
    name: 'Doe Library',
    subtitle: 'Transfer Student',
    lat: 37.872340, lon: -122.259500,
    character: 'Diego',
    color: 0x52be80,
    lines: [
      "I transferred from a community college and thought I'd be lost here. Doe Library was where I figured out I belonged. Those reading rooms make you feel like you're part of history.",
    ],
  },
  {
    id: 'marcus-soda',
    role: 'student',
    name: 'Soda Hall',
    subtitle: 'CS Major',
    lat: 37.868970, lon: -122.259000,
    character: 'Marcus',
    color: 0xf7dc6f,
    lines: [
      "Berkeley CS is intense but the community makes it worth it. Soda Hall became my second home freshman year — there's always someone willing to debug your code at 2am.",
    ],
  },
  {
    id: 'jordan-glade',
    role: 'student',
    name: 'Memorial Glade',
    subtitle: 'Grad Student',
    lat: 37.873350, lon: -122.259500,
    character: 'Jordan',
    color: 0xaf7ac5,
    lines: [
      "Memorial Glade on a sunny day — there's nothing like it. People napping, clubs tabling, frisbees flying. It's the campus living room. You haven't experienced Cal until you've spent an afternoon here.",
    ],
  },
  {
    id: 'park-parents',
    role: 'student',
    name: 'Dwinelle Hall',
    subtitle: 'Parent Perspective',
    lat: 37.870450, lon: -122.260100,
    character: 'The Parks',
    color: 0xf1948a,
    lines: [
      "We toured 12 schools with our daughter. What stood out about Berkeley wasn't the rankings — it was the students. Every person we stopped to ask directions from gave us a passionate speech about why they love it here.",
    ],
  },
];
