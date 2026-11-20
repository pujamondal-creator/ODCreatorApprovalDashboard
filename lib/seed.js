// Dummy data for the demo. Everything here is made up.
const sync = require('./sync');

function rng(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 864e5;
const FIRST = ['maya', 'josh', 'amelia', 'meera', 'omar', 'nadia', 'carlos', 'leila', 'ravi', 'kim', 'wes', 'priya', 'tomas', 'zara', 'elif', 'noah', 'aiko', 'sofia', 'liam', 'hana', 'dev', 'ines', 'yusuf', 'ella', 'arjun', 'chloe', 'ben', 'mina', 'otis', 'luca'];
const SUFFIX = ['travels', 'fits', 'bakes', 'films', 'cooks', 'studies', 'styles', 'writes', 'builds', 'runs', 'codes', 'paints', 'daily', 'eats', 'notes'];
const LAST = ['R.', 'T.', 'K.', 'S.', 'H.', 'P.', 'M.', 'A.', 'B.', 'D.', 'W.', 'L.'];

const ODS = [
  { name: 'Sara Lindqvist', handle: '@sara.creates', token: 'sara-7f3a91' },
  { name: 'Daniel Wu', handle: '@daniel.wanders', token: 'daniel-2b8c40' },
  { name: 'Priya Nair', handle: '@priyanotes', token: 'priya-9d51e7' },
  { name: 'Kofi Asante', handle: '@kofiafterhours', token: 'kofi-41ac6d' },
  { name: 'Leila Boutros', handle: '@leilabakes', token: 'leila-c3e208' },
  { name: 'Marcus Tan', handle: '@marcus.trains', token: 'marcus-58f1b2' },
];

function build() {
  const rand = rng(20261118);
  const now = Date.now();
  const ods = ODS.map((o, i) => ({ id: 'od' + (i + 1), name: o.name, handle: o.handle, token: o.token, owner: 'AES', confirmedAt: null, leadsSyncedAt: null, signed: [] }));

  // Central leads sheet: every OD's followers with a Fit / Not fit qualification.
  const leadsSheet = [];
  for (const od of ods) {
    const used = new Set();
    for (let i = 0; i < 140; i++) {
      let h;
      do {
        const f = FIRST[Math.floor(rand() * FIRST.length)];
        const s = SUFFIX[Math.floor(rand() * SUFFIX.length)];
        h = f + (rand() < 0.5 ? '.' : '_') + s + (used.size > 60 ? Math.floor(rand() * 90 + 10) : '');
      } while (used.has(h));
      used.add(h);
      const first = h[0].toUpperCase() + h.slice(1).split(/[._]/)[0];
      leadsSheet.push({
        od: od.handle, handle: '@' + h, name: first + ' ' + LAST[Math.floor(rand() * LAST.length)],
        followers: Math.round(2000 * Math.pow(200, rand())), fit: rand() < 0.85 ? 'Fit' : 'Not fit',
      });
    }
  }

  // BD Creators Tracker: outreach 1 to 4 through ODs, status in AV, with deliberately messy handles.
  const tracker = [];
  const seen = new Set();
  const variants = [(h) => h, (h) => '@' + h, (h) => 'https://instagram.com/' + h + '/', (h) => ' ' + h.toUpperCase() + ' '];
  const odVariant = (o) => (rand() < 0.3 ? o.handle.slice(1) : o.handle);
  for (const od of ods) {
    const mine = leadsSheet.filter((r) => r.od === od.handle && r.fit === 'Fit');
    for (let k = 0; k < 26; k++) {
      const lead = mine[Math.floor(rand() * mine.length)];
      const key = lead.handle.slice(1);
      if (seen.has(key)) continue;
      seen.add(key);
      let av, ageDays;
      const r = rand();
      if (k < 2) { av = k % 2 ? 'Handed-over' : 'AM Allocation'; ageDays = rand() * 5; }
      else if (r < 0.22) { av = rand() < 0.5 ? 'AM Allocation' : 'Handed-over'; ageDays = rand() * 365; }
      else if (r < 0.42) { av = rand() < 0.5 ? 'Replied' : 'Call booked'; ageDays = rand() * 40; }
      else if (r < 0.55) { av = 'Not interested'; ageDays = rand() * 60; }
      else { av = ''; ageDays = rand() * 40; }
      const row = { C: variants[Math.floor(rand() * variants.length)](key), U: odVariant(od), AB: '', AI: '', AP: '', AV: av, date: new Date(now - ageDays * DAY).toISOString() };
      if (rand() < 0.3) row.AB = odVariant(ods[Math.floor(rand() * ods.length)]);
      if (rand() < 0.1) row.AI = odVariant(ods[Math.floor(rand() * ods.length)]);
      tracker.push(row);
    }
  }

  return { ods, leads: [], log: [], trackerView: [], sheets: { leads: leadsSheet, tracker } };
}

// First load: ODs 1 to 5 already synced, Marcus not yet (so Run sync has something to show).
function initialSync(db) {
  sync.run(db, { silent: true, odIds: ['od1', 'od2', 'od3', 'od4', 'od5'] });
}

// Puts the demo in a lively state: different ODs at different stages.
function applyDemoState(db) {
  const byId = (id) => db.ods.find((o) => o.id === id);
  const leadsOf = (id) => db.leads.filter((l) => l.odId === id && l.fit).sort((a, b) => a.rank - b.rank);
  const decide = (i) => (i % 10 === 3 ? 'no' : i % 10 === 7 ? 'friend' : 'yes');

  leadsOf('od1').forEach((l, i) => (l.decision = decide(i)));
  byId('od1').confirmedAt = new Date(Date.now() - DAY).toISOString();
  const sara = byId('od1').signed;
  if (sara.length) sara.slice().sort((a, b) => new Date(b.at) - new Date(a.at))[0].seen = false;

  leadsOf('od2').slice(0, 52).forEach((l, i) => (l.decision = decide(i)));
  leadsOf('od4').slice(0, 14).forEach((l) => (l.decision = 'yes'));
  leadsOf('od5').forEach((l, i) => (l.decision = decide(i + 2)));
  byId('od5').confirmedAt = new Date(Date.now() - 3 * DAY).toISOString();
  db.log.unshift({ at: new Date().toISOString(), text: 'Demo data loaded' });
}

module.exports = { build, initialSync, applyDemoState };
