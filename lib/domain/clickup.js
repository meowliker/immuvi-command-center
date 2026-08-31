export function parseClickUpListId(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^\d{6,}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);
    const segments = url.pathname.split('/').filter(Boolean);
    const markerIndex = segments.findIndex((segment) => segment === 'li' || segment === 'list');
    if (markerIndex >= 0 && /^\d{6,}$/.test(segments[markerIndex + 1] || '')) {
      return segments[markerIndex + 1];
    }

    const numericSegments = segments.filter((segment) => /^\d{6,}$/.test(segment));
    if (numericSegments.length) return numericSegments[numericSegments.length - 1];

    for (const value of url.searchParams.values()) {
      if (/^\d{6,}$/.test(value)) return value;
    }
  } catch {
    const listMatch = raw.match(/(?:\/|^)(?:li|list)\/(\d{6,})(?:\D|$)/i);
    if (listMatch) return listMatch[1];
  }

  const trailingNumber = raw.match(/(\d{6,})(?!.*\d)/);
  return trailingNumber ? trailingNumber[1] : '';
}

export function clickUpListScopedKey(listId, namespace) {
  const normalizedListId = String(listId || '').trim();
  const normalizedNamespace = String(namespace || '').trim();
  if (!normalizedListId || !normalizedNamespace) return '';
  return `${normalizedNamespace}:${normalizedListId}`;
}

export function hasListScopedValue(cache, listId, namespace) {
  const key = clickUpListScopedKey(listId, namespace);
  return Boolean(key && cache && Object.prototype.hasOwnProperty.call(cache, key));
}
