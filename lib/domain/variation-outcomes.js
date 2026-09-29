// Preserve Variation Lab's legacy buckets, which differ from Action Plan's lanes.
export function variationOutcomes(rows) {
  const counts = { winners: 0, testing: 0, losers: 0, pending: 0, other: 0 };
  for (const row of rows) {
    const status = String(row.status || '').trim().toLowerCase();
    if (['winner', 'scale'].includes(status)) counts.winners++;
    else if (['loser', 'complete'].includes(status)) counts.losers++;
    else if (['testing', 'in production', 'ready to launch'].includes(status)) counts.testing++;
    else if (!status || status === 'untested') counts.pending++;
    else counts.other++;
  }
  return counts;
}
