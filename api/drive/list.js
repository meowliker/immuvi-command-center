// /api/drive/list?folder=<id>
// Returns: { folder_id, folder_name, files: [{id, name, mimeType, thumbnailLink,
//           webViewLink, webContentLink, size, modifiedTime}, …] }
//
// Auth: API key only (process.env.GOOGLE_DRIVE_API_KEY). Works because the
// listed folders are shared with "Anyone with link" — Google's Drive API
// accepts API-key auth for public content. No OAuth, no service account.
//
// Errors:
//   400 — missing folder param
//   404 — folder not found or not accessible to the key
//   500 — Drive API failed for some other reason
//   503 — GOOGLE_DRIVE_API_KEY env var not set

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

async function driveGet(path, params, apiKey) {
  const usp = new URLSearchParams(params);
  usp.set('key', apiKey);
  const url = `${DRIVE_BASE}${path}?${usp.toString()}`;
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=600');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'GOOGLE_DRIVE_API_KEY not set' });
  }

  const folderId = (req.query && req.query.folder) || '';
  if (!folderId) {
    return res.status(400).json({ error: 'missing required query param: folder' });
  }

  try {
    // 1. Get folder metadata (validates folder exists + key has access)
    const meta = await driveGet(`/files/${encodeURIComponent(folderId)}`, {
      fields: 'id,name,mimeType',
      supportsAllDrives: 'true',
    }, apiKey);
    if (!meta.ok) {
      if (meta.status === 404) {
        return res.status(404).json({ error: 'folder not found', folder_id: folderId });
      }
      return res.status(meta.status || 500).json({ error: 'drive meta failed', detail: meta.body });
    }
    if (meta.body.mimeType !== 'application/vnd.google-apps.folder') {
      return res.status(400).json({ error: 'id is not a folder', mimeType: meta.body.mimeType });
    }

    // 2. List children
    const listing = await driveGet('/files', {
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink,size,modifiedTime,createdTime)',
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    }, apiKey);
    if (!listing.ok) {
      return res.status(listing.status || 500).json({ error: 'drive list failed', detail: listing.body });
    }

    return res.status(200).json({
      folder_id: meta.body.id,
      folder_name: meta.body.name,
      files: listing.body.files || [],
    });
  } catch (err) {
    console.error('[drive] handler error', err);
    return res.status(500).json({ error: String((err && err.message) || err) });
  }
}
