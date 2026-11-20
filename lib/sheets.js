// The two sources the app reads from. In demo mode both live inside data/db.json (db.sheets).
//
//  1. Central leads sheet: every OD's followers we may reach out to, with a Fit / Not fit qualification
//     and follower count. Rows marked Fit appear on that OD's dashboard, highest followers first.
//     Row shape: { od: '@od.handle', handle: '@creator', name: 'Creator Name', followers: 12400, fit: 'Fit' }
//
//  2. BD Creators Tracker: column C = creator IG handle, columns U / AB / AI / AP = the OD handle used for
//     outreach 1 to 4, column AV = status ("AM Allocation" or "Handed-over" means signed).
//     Row shape: { C: '@creator', U: '@od.handle', AB: '', AI: '', AP: '', AV: 'Replied' }

const cfg = require('./config');

function readLeadsSheet(db) {
  if (cfg.SHEETS_MODE === 'mock') return db.sheets.leads;
  throw new Error('Google Sheets reader not connected yet. Add a service account and implement readLeadsSheet.');
}

function readTracker(db) {
  if (cfg.SHEETS_MODE === 'mock') return db.sheets.tracker;
  throw new Error('Google Sheets reader not connected yet. Add a service account and implement readTracker.');
}

module.exports = { readLeadsSheet, readTracker };
