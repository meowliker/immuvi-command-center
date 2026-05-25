// /api/drive/list?folder=<id>[&recursive=true|false][&maxDepth=N][&maxFolders=N]
// Returns: { folder_id, folder_name, recursive, files: [{id, name, mimeType,
//           thumbnailLink, webViewLink, webContentLink, size, modifiedTime,
//           path, parentFolderName, parentFolderId}, …] }
//
// Auth: API key only (process.env.GOOGLE_DRIVE_API_KEY). Works because the
// listed folders are shared with "Anyone with link" — Google's Drive API
// accepts API-key auth for public content. No OAuth, no service account.
//
// 2026-05-25: switched to BFS over subfolders by default — a parent folder
// that contains only subfolders (e.g. "17 APRIL" → 13009/, 13010/, 13011/)
// no longer returns "no files" when the actual videos sit one or two levels
// deeper. Each file in the response gets a `path` field showing its full
// subfolder path from the root for display in the picker.
//
// Errors:
//   400 — missing folder param
//   404 — folder not found or not accessible to the key
//   500 — Drive API failed for some other reason
//   503 — GOOGLE_DRIVE_API_KEY env var not set

const DRIVE_BASE  = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function driveGet(path, params, apiKey) {
  const usp = new URLSearchParams(params);
  usp.set('key', apiKey);
  const url = `${DRIVE_BASE}${path}?${usp.toString()}`;
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

async function listFolder(folderId, apiKey) {
  const r = await driveGet('/files', {
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink,size,modifiedTime,createdTime)',
    pageSize: '100',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  }, apiKey);
  return r;
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

  // Recursive defaults on. Pass ?recursive=false to opt out (old single-level
  // behavior). maxDepth bounds tree depth (default 3 — handles e.g.
  // ROOT → 17 APRIL → 13009 → V1.mp4). maxFolders bounds total folders
  // visited so a runaway tree can't blow out our rate budget.
  const recursive  = (req.query.recursive || 'true').toLowerCase() !== 'false';
  const maxDepth   = Math.max(0, Math.min(10, parseInt(req.query.maxDepth   || '3',   10) || 3));
  const maxFolders = Math.max(1, Math.min(500, parseInt(req.query.maxFolders || '60',  10) || 60));

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
    if (meta.body.mimeType !== FOLDER_MIME) {
      return res.status(400).json({ error: 'id is not a folder', mimeType: meta.body.mimeType });
    }

    const rootName = meta.body.name || '';
    const allFiles = [];
    let foldersVisited = 0;

    // BFS queue. Each entry: { id, name, depth, pathParts }
    // pathParts is the accumulated subfolder path from root (excluding root).
    const queue = [{ id: meta.body.id, name: rootName, depth: 0, pathParts: [] }];

    while (queue.length > 0 && foldersVisited < maxFolders) {
      const cur = queue.shift();
      foldersVisited++;

      const listing = await listFolder(cur.id, apiKey);
      if (!listing.ok) {
        // Don't abort the whole tree on one subfolder error — log + continue.
        console.warn('[drive] subfolder list failed', cur.id, listing.status, listing.body && listing.body.error);
        continue;
      }
      const children = listing.body.files || [];

      for (const f of children) {
        if (f.mimeType === FOLDER_MIME) {
          // Subfolder — enqueue if we have depth budget + recursive on
          if (recursive && cur.depth < maxDepth) {
            queue.push({
              id: f.id,
              name: f.name || '',
              depth: cur.depth + 1,
              pathParts: cur.pathParts.concat([f.name || '']),
            });
          }
        } else {
          // File — annotate with subfolder context for display
          const parentName = cur.pathParts.length > 0
            ? cur.pathParts[cur.pathParts.length - 1]
            : '';
          allFiles.push(Object.assign({}, f, {
            path: cur.pathParts.length > 0
              ? cur.pathParts.join('/') + '/' + (f.name || '')
              : (f.name || ''),
            parentFolderName: parentName,
            parentFolderId: cur.id,
            parentDepth: cur.depth,
          }));
        }
      }
    }

    return res.status(200).json({
      folder_id: meta.body.id,
      folder_name: rootName,
      recursive,
      folders_visited: foldersVisited,
      folders_truncated: queue.length > 0,   // true if we hit maxFolders limit
      files: allFiles,
    });
  } catch (err) {
    console.error('[drive] handler error', err);
    return res.status(500).json({ error: String((err && err.message) || err) });
  }
}
