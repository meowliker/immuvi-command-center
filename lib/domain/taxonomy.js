const LEADING_MARKER_RE =
  /^\s*(?:(?:[-*]+|[\u2022\u2023\u25E6])\s+|(?:\(?\d+\)?[.)]|[A-Za-z][.)])\s+|\[[ xX]\]\s+)/;

export function normalizeTaxonomyName(value) {
  let text = String(value || '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  while (LEADING_MARKER_RE.test(text)) {
    text = text.replace(LEADING_MARKER_RE, '').trim();
  }

  return text.replace(/\s*-\s*/g, ' - ').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim();
}

export function taxonomyKey(value) {
  return normalizeTaxonomyName(value).toLocaleLowerCase();
}

export function sameTaxonomyName(left, right) {
  const leftKey = taxonomyKey(left);
  const rightKey = taxonomyKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}
