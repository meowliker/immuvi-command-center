const text = (value) => typeof value === 'string' ? value.trim() : '';
const clean = (value) => text(value).replace(/<br\s*\/?>/gi, ' ').replace(/^[`*_~\s]+|[`*_~\s]+$/g, '').replace(/\s+/g, ' ').trim();
const labels = { angle: ['angle tag', 'angle', 'ad angle'], persona: ['persona tag', 'persona', 'target persona', 'audience'] };

export function descriptionFields(description) {
  const fields = new Map();
  const add = (label, value) => {
    const key = clean(label).toLowerCase(), result = clean(value);
    if (result && !/^[-\u2014]+$/.test(result) && !fields.has(key)) fields.set(key, result);
  };
  // ClickUp's serialized table cells are sparse coordinates, not an HTML table.
  const plain = text(description).replace(/\[table-embed:([\s\S]*?)\]/g, (_, body) => {
    const rows = new Map();
    for (const match of body.matchAll(/(\d+):(\d+)\s+([\s\S]*?)(?=\s+\|\s+\d+:\d+\s+|\s+\|\s*$|$)/g)) {
      const row = rows.get(match[1]) || new Map();
      row.set(match[2], match[3]); rows.set(match[1], row);
    }
    for (const row of rows.values()) add(row.get('1'), row.get('2'));
    return '';
  });
  for (const line of plain.split(/\r?\n/)) {
    const cells = line.trim().split(/(?<!\\)\|/);
    if (cells.length >= 3) add(cells[0] ? cells[0] : cells[1], cells[0] ? cells[1] : cells[2]);
    else {
      const match = line.match(/^\s*(?:[-*]\s+)?([^:]+):\s*(.+)$/);
      if (match) add(match[1], match[2]);
    }
  }
  return fields;
}

export function resolvePlanCellIdentity(action, ad) {
  const custom = { ...(action._customFields || {}), ...(ad?._customFields || {}) };
  const fields = new Map(Object.entries(custom).map(([key, value]) => [key.trim().toLowerCase(), text(value)]));
  const description = descriptionFields(text(action.description) || text(ad?.description) || text(ad?._clickupDescription));
  const fallback = (key) => labels[key].map((label) => fields.get(label)).find(Boolean)
    || labels[key].map((label) => description.get(label)).find(Boolean) || '';
  const coordinate = (key, snapshot) => {
    if (Object.hasOwn(ad?._trackerPending || {}, key)) return text(ad._trackerPending[key]);
    // A linked list's explicit field values (including clears) outrank an old
    // Action Plan snapshot. Legacy records without these fields keep recovery.
    if (ad?._clickupListId && labels[key].some(label => Object.hasOwn(ad._customFields || {}, label))) return text(ad[key]);
    return text(action[snapshot]) || text(action[key]) || text(ad?.[key]) || fallback(key);
  };
  return { angle: coordinate('angle', 'sourceAngle'), persona: coordinate('persona', 'sourcePersona') };
}
