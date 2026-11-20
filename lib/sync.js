const cfg = require('./config');
const sheets = require('./sheets');

// Normalise IG handles so "@Maya", "maya ", and "https://instagram.com/maya/" all match.
function norm(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '')
    .replace(/\s+/g, '');
}

// Tracker status (column AV) -> yes (signed) / progress / no
function trackerStatus(av) {
  const s = String(av || '').trim().toLowerCase();
  if (cfg.TRACKER.signedStatuses.includes(s)) return 'yes';
  if (cfg.TRACKER.inProgressStatuses.includes(s)) return 'progress';
  return 'no';
}

function titleFromHandle(key) {
  return key.split(/[._]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// Imports the Fit leads from the central leads sheet for the given ODs (all ODs when none given).
// Decisions made by ODs are never overwritten.
function importLeads(db, odIds) {
  const scope = odIds ? new Set(odIds) : null;
  const odByHandle = {};
  db.ods.forEach((o) => (odByHandle[norm(o.handle)] = o));
  const index = new Map(db.leads.map((l) => [l.id, l]));
  let added = 0;
  const touched = new Set();
  for (const row of sheets.readLeadsSheet(db)) {
    const od = odByHandle[norm(row.od)];
    if (!od || (scope && !scope.has(od.id))) continue;
    const key = norm(row.handle);
    if (!key) continue;
    touched.add(od.id);
    const fit = String(row.fit).trim().toLowerCase() === 'fit';
    const id = od.id + '|' + key;
    const existing = index.get(id);
    if (existing) {
      existing.fit = fit;
      existing.followers = Number(row.followers) || 0;
      existing.name = row.name || existing.name;
    } else if (fit) {
      const lead = { id, odId: od.id, key, handle: '@' + key, name: row.name || titleFromHandle(key), followers: Number(row.followers) || 0, fit: true, rank: 0, decision: null };
      db.leads.push(lead);
      index.set(id, lead);
      added++;
    }
  }
  for (const od of db.ods) {
    if (scope && !scope.has(od.id)) continue;
    od.leadsSyncedAt = new Date().toISOString();
    db.leads.filter((l) => l.odId === od.id && l.fit).sort((a, b) => b.followers - a.followers).forEach((l, i) => (l.rank = i + 1));
  }
  return added;
}

// Reads the BD Creators Tracker: who outreached whom (columns U, AB, AI, AP) and the status (column AV).
function syncTracker(db, silent) {
  const T = cfg.TRACKER;
  const odByHandle = {};
  db.ods.forEach((o) => (odByHandle[norm(o.handle)] = o));
  const nameByKey = {};
  db.leads.forEach((l) => { if (!nameByKey[l.key]) nameByKey[l.key] = l.name; });
  const pairs = [];
  const seen = new Set();
  let newSigned = 0;
  for (const row of sheets.readTracker(db)) {
    const creator = norm(row[T.creatorHandleColumn]);
    if (!creator) continue;
    const status = trackerStatus(row[T.statusColumn]);
    const date = row.date || new Date().toISOString();
    for (const col of T.outreachColumns) {
      const od = odByHandle[norm(row[col])];
      if (!od || seen.has(creator + '|' + od.id)) continue;
      seen.add(creator + '|' + od.id);
      pairs.push({ key: creator, handle: '@' + creator, name: nameByKey[creator] || titleFromHandle(creator), odId: od.id, odName: od.name, odHandle: od.handle, status, date });
      if (status === 'yes') {
        od.signed = od.signed || [];
        if (!od.signed.some((s) => s.key === creator)) {
          od.signed.push({ key: creator, handle: '@' + creator, at: date, seen: silent });
          newSigned++;
          if (!silent) db.log.unshift({ at: new Date().toISOString(), text: 'Signed through ' + od.name + ': @' + creator });
        }
      }
    }
  }
  pairs.sort((a, b) => new Date(b.date) - new Date(a.date));
  db.trackerView = pairs;
  db.lastTrackerSyncAt = new Date().toISOString();
  return newSigned;
}

// odIds: import leads for these ODs (omit for all). tracker: also refresh the tracker view.
function run(db, { silent = false, odIds, tracker = true } = {}) {
  const result = { leadsAdded: 0, newSigned: 0 };
  if (odIds !== null) result.leadsAdded = importLeads(db, odIds);
  if (tracker) result.newSigned = syncTracker(db, silent);
  return result;
}

module.exports = { run, norm, trackerStatus };
