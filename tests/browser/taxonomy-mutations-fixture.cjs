const assert = require('node:assert/strict');
module.exports = async function taxonomyMutation(data, request, control) {
  const { taxonomyKey } = await import('../../lib/domain/taxonomy.js');
  const { p_product_id: product, p_kind: kind, p_operation: op, p_values: values, p_request_id: key } = request;
  const calls = control.taxonomyCalls ||= []; calls.push(structuredClone(request));
  const receipts = control.taxonomyReceipts ||= new Map();
  if (receipts.has(key)) { assert.deepEqual(receipts.get(key).request, request); return structuredClone(receipts.get(key).result); }
  const table = kind === 'angle' ? 'angles' : 'personas';
  const sources = values.sources.map((source) => data[table].find((row) => row.id === source.id && row.product_id === product && row.updated_at === source.version));
  const reject = (message) => ({ code: 'P0001', message });
  if (sources.some((row) => !row)) return reject('Taxonomy changed or was deleted. Refresh and review your draft.');
  let target = op === 'merge' ? data[table].find((row) => row.id === values.target.id && row.product_id === product && row.updated_at === values.target.version && !row.archived_at) : sources[0];
  if (op === 'merge' && !target) return reject('Merge target changed or is unavailable');
  if (op === 'merge' && control.taxonomyConflict) return reject('Matrix metadata conflicts. Resolve the conflicting cells before merging.');
  const name = op === 'merge' ? target.name : op === 'delete' ? '' : values.fields?.name;
  let preview;
  if (op === 'save' && name !== target.name && !control.previewing) {
    preview = await module.exports.preview(data, { p_product_id: product, p_kind: kind, p_source: values.sources[0], p_name: name });
    if (preview.revision !== values.renameRevision) return reject('Rename impact changed or was not confirmed. Review a fresh preview before saving.');
  }
  if (['create', 'save'].includes(op) && data[table].some((row) => row.product_id === product && row !== target && taxonomyKey(row.name) === taxonomyKey(name))) return reject('This taxonomy name already exists, possibly archived. Merge or restore it instead.');
  const stamp = new Date(Date.now() + (control.taxonomySequence = (control.taxonomySequence || 0) + 1)).toISOString();
  const counts = { ads: 0, inspirations: 0, actions: 0, cells: 0, links: 0 }; let remotePending = 0;
  if (op === 'merge' || op === 'delete' || op === 'save' && name !== target.name) {
    const keys = sources.map((row) => taxonomyKey(row.name));
    for (const ad of data.ads.filter((row) => row.product_id === product && !row.deleted_at && keys.includes(taxonomyKey(row[kind])))) {
      ad[kind] = name; ad.meta = { ...ad.meta, [kind]: name }; ad.updated_at = stamp; counts.ads++;
      if (ad.clickup_task_id) { ad.meta._trackerPending = { ...ad.meta._trackerPending, [kind]: name }; remotePending++; }
    }
    for (const [tableName, field, counter] of [['inspirations', 'data', 'inspirations'], ['manual_actions', 'payload', 'actions']]) {
      for (const row of data[tableName].filter((row) => row.product_id === product)) {
        let changed = false;
        for (const nameKey of [kind, `source${kind[0].toUpperCase()}${kind.slice(1)}`, `_source${kind[0].toUpperCase()}${kind.slice(1)}`, `selected${kind[0].toUpperCase()}${kind.slice(1)}`]) {
          if (keys.includes(taxonomyKey(row[field]?.[nameKey]))) { row[field][nameKey] = name; changed = true; }
        }
        if (changed) { row.updated_at = stamp; counts[counter]++; }
      }
    }
  }
  if (op === 'create') { target = { id: `${kind === 'angle' ? 'ang' : 'per'}-${key}`, product_id: product, ...values.fields, status: 'Untested', archived_at: null, created_at: stamp }; data[table].push(target); }
  if (op === 'save') Object.assign(target, values.fields);
  if (op === 'archive' || op === 'restore') target.archived_at = op === 'archive' ? stamp : null;
  if (op === 'merge') target.notes = [target.notes, ...sources.map((row) => row.notes)].filter(Boolean).join('\n\n');
  if (['merge', 'delete'].includes(op)) data[table] = data[table].filter((row) => !sources.includes(row));
  if (target) target.updated_at = stamp;
  const result = { requestId: key, productId: product, kind, operation: op, row: op === 'delete' ? null : structuredClone(target),
    removedIds: ['merge', 'delete'].includes(op) ? sources.map((row) => row.id) : [], counts, remotePending, dispatchEnabled: false };
  if (preview) {
    result.rename = { ...preview, requestId: key, afterVersion: target.updated_at, counts, remotePending };
    (control.taxonomyAudit ||= []).push(structuredClone(result.rename));
  }
  receipts.set(key, { request: structuredClone(request), result: structuredClone(result) });
  return result;
};

module.exports.preview = async function preview(data, input) {
  const { createHash, randomUUID } = require('node:crypto');
  const { p_product_id: productId, p_kind: kind, p_source: source, p_name: afterName } = input;
  const row = data[kind === 'angle' ? 'angles' : 'personas'].find((r) => r.product_id === productId && r.id === source.id && r.updated_at === source.version);
  if (!row) return { code: 'P0001', message: 'Taxonomy changed or was deleted. Refresh and review your draft.' };
  const copy = structuredClone(data);
  const result = await module.exports(copy, { p_product_id: productId, p_kind: kind, p_request_id: randomUUID(), p_operation: 'save',
    p_values: { sources: [source], fields: { name: afterName, source_link: row.source_link || '', notes: row.notes || '' } } }, { previewing: true });
  if (result.code) return result;
  const snapshot = ['ads', 'angle_personas', 'angles', 'deleted_ads', 'inspirations', 'manual_actions', 'matrix_cells', 'personas']
    .map((table) => (data[table] || []).filter((r) => r.product_id === productId));
  return { productId, kind, source, beforeName: row.name, afterName, dispatchEnabled: false,
    counts: { ads: result.counts.ads, inspirations: result.counts.inspirations, actions: result.counts.actions },
    revision: createHash('md5').update(JSON.stringify([input, snapshot])).digest('hex') };
};
