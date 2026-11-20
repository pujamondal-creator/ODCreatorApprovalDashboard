// A lead is cleared for outreach when the OD has confirmed their list and marked that creator Yes.
function isCleared(od, lead) {
  return !!od.confirmedAt && lead.fit && lead.decision === 'yes';
}

function odStats(db, od) {
  const mine = db.leads.filter((l) => l.odId === od.id && l.fit);
  const count = (d) => mine.filter((l) => l.decision === d).length;
  const yes = count('yes'), no = count('no'), friend = count('friend');
  const total = mine.length;
  const pending = total - yes - no - friend;
  return {
    id: od.id, name: od.name, handle: od.handle, owner: od.owner, token: od.token,
    synced: !!od.leadsSyncedAt, total, yes, no, friend, pending,
    pctReviewed: total ? Math.round(((total - pending) / total) * 100) : 0,
    confirmed: !!od.confirmedAt, confirmedAt: od.confirmedAt || null,
    cleared: od.confirmedAt ? yes : 0,
    signed: (od.signed || []).length,
  };
}

module.exports = { isCleared, odStats };
