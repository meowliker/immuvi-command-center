import { descriptionFields } from './action-plan-cell.js';
import { safeCreativeUrl } from './tracker-editing.js';

const text = value => typeof value === 'string' ? value : '';
const cell = value => text(value).replace(/\r?\n/g, '<br>').replace(/(?<!\\)\|/g, '\\|').trim();

export function normalizeClickUpDescription(value) {
  const source = text(value);
  let result = '', cursor = 0;
  // Balance brackets so a Markdown link inside a table cell cannot end the embed.
  for (let start = source.indexOf('[table-embed:', cursor); start !== -1; start = source.indexOf('[table-embed:', cursor)) {
    result += source.slice(cursor, start);
    let end = start + 1, depth = 1;
    for (; end < source.length && depth; end++) {
      if (source[end] === '[') depth++;
      if (source[end] === ']') depth--;
    }
    if (depth) return result + source.slice(start);
    const rows = new Map();
    for (const match of source.slice(start + 13, end - 1).matchAll(/(\d+):(\d+)\s+([\s\S]*?)(?=\s+\|\s+\d+:\d+\s+|\s+\|\s*$|$)/g)) {
      const row = rows.get(Number(match[1])) || new Map();
      row.set(Number(match[2]), cell(match[3])); rows.set(Number(match[1]), row);
    }
    if (!rows.size) result += source.slice(start, end);
    else {
      const width = Math.max(...[...rows.values()].flatMap(row => [...row.keys()]));
      if (width > 50 || rows.size > 1000) throw new Error('ClickUp description table is too large.');
      const lines = [...rows].sort(([a], [b]) => a - b).map(([, row]) => `| ${Array.from({ length: width }, (_, i) => row.get(i + 1) || '').join(' | ')} |`);
      lines.splice(1, 0, `| ${Array(width).fill('---').join(' | ')} |`);
      result += `\n${lines.join('\n')}\n`;
    }
    cursor = end;
  }
  return result + source.slice(cursor);
}

export function clickUpHypothesis(value, { standalone = false } = {}) {
  const normalized = normalizeClickUpDescription(value);
  const labeled = descriptionFields(normalized).get('creative hypothesis');
  if (labeled) return labeled;
  const section = normalized.match(/(?:^|\n)\s*#{1,6}\s+Creative Hypothesis\s*\n([\s\S]*?)(?=\n\s*#|$)/i)?.[1]?.trim();
  if (section) return section;
  // Old rows sometimes cached the entire brief as the hypothesis.
  return standalone && !/table-embed:|^\s*\|/m.test(normalized) ? normalized.trim() : '';
}

export function clickUpSourceUrl(ad, description) {
  const meta = ad.meta || {};
  const labels = descriptionFields(normalizeClickUpDescription(description));
  const values = [ad.ad_link, meta._sourceInspoAdUrl, meta._sourceAdUrl, meta.sourceUrl, meta._sourceFormatAdLink,
    ...['source ad', 'inspiration link', 'inspo link', 'ad link', 'reference link', 'reference creative', 'inspiration'].map(key => labels.get(key))];
  for (const value of values) {
    const url = safeCreativeUrl(text(value).match(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/)?.[1] || text(value));
    if (url) return url;
  }
  return '';
}

export function creationCellDescription(description, identity) {
  return normalizeClickUpDescription(description).split(/\r?\n/).map(line => {
    const row = line.match(/^(\s*\|\s*(?:Angle(?: Tag)?|Persona(?: Tag)?)\s*\|)\s*.*?((?<!\\)\|\s*)$/i);
    const labeled = line.match(/^(\s*(?:Angle(?: Tag)?|Persona(?: Tag)?):)\s*.*$/i);
    const match = row || labeled;
    if (!match) return line;
    const value = identity[/angle/i.test(match[1]) ? 'angle' : 'persona'];
    return value ? `${match[1]} ${row ? cell(value) : value}${row ? ` ${match[2]}` : ''}` : line;
  }).join('\n');
}
