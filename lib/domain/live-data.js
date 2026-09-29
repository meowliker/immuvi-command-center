export function sameData(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && sameData(left[key], right[key]));
}

/** Preserve unchanged row identities while respecting authoritative ordering/deletes. */
export function reconcileRows(previous, incoming, key = (row) => row.id) {
  const byId = new Map(previous.map((row) => [key(row), row]));
  const next = incoming.map((row) => {
    const before = byId.get(key(row));
    return before && sameData(before, row) ? before : row;
  });
  return next.length === previous.length && next.every((row, index) => row === previous[index]) ? previous : next;
}

/** Rebase untouched fields; retain only fields the user actually edited. */
export function reconcileDrafts(drafts, previousRows, nextRows, fields) {
  const previous = new Map(previousRows.map((row) => [row.id, row]));
  const next = Object.fromEntries(nextRows.map((row) => {
    const before = previous.get(row.id);
    const draft = drafts[row.id];
    if (!before || !draft) return [row.id, row];
    const rebased = { ...row };
    for (const field of fields) {
      if (!sameData(draft[field], before[field])) rebased[field] = draft[field];
    }
    return [row.id, sameData(draft, rebased) ? draft : rebased];
  }));
  return sameData(drafts, next) ? drafts : next;
}
