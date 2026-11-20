module.exports = {
  // Internal ops login: work email domains allowed in.
  ALLOWED_DOMAINS: (process.env.ALLOWED_DOMAINS || 'welearncreators.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // BD Creators Tracker mapping (confirmed by the team).
  TRACKER: {
    creatorHandleColumn: 'C',
    outreachColumns: ['U', 'AB', 'AI', 'AP'], // outreach 1 to 4: holds the OD's IG handle
    statusColumn: 'AV',
    signedStatuses: ['am allocation', 'handed-over', 'handed over'],
    inProgressStatuses: ['replied', 'call booked', 'in progress', 'interested'],
  },

  // 'mock' reads the dummy sheets stored in data/db.json.
  // 'google' is where the real Google Sheets reader plugs in (see lib/sheets.js).
  SHEETS_MODE: process.env.SHEETS_MODE || 'mock',
};
