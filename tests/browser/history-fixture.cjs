function parts(value) {
  const result = []; let depth = 0, quoted = false, escaped = false, start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (escaped) { escaped = false; continue; }
    if (quoted && char === '\\') { escaped = true; continue; }
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) { result.push(value.slice(start, i)); start = i + 1; }
  }
  result.push(value.slice(start)); return result;
}
function match(row, expression) {
  for (const op of ['and', 'or']) if (expression.startsWith(`${op}(`) && expression.endsWith(')')) {
    const values = parts(expression.slice(op.length + 1, -1)).map((part) => match(row, part));
    return op === 'and' ? values.every(Boolean) : values.some(Boolean);
  }
  const found = expression.match(/^(.+?)\.(eq|lt)\.(.*)$/);
  if (!found) throw new Error(`Unsupported history predicate: ${expression}`);
  const [, key, op, raw] = found, value = raw.startsWith('"') ? JSON.parse(raw) : raw;
  const actual = key === 'metadata->>ad_id' ? row.metadata?.ad_id : row[key];
  return op === 'eq' ? actual === value : actual < value;
}
module.exports = function historyRows(rows, url) {
  const expression = url.searchParams.get('or');
  let filtered = expression ? rows.filter((row) => match(row, `or${expression}`)) : rows;
  filtered = [...filtered].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id.localeCompare(a.id));
  return filtered.slice(0, Number(url.searchParams.get('limit')) || 40);
};
