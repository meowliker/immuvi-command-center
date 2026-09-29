/** Merge against a fresh row and reject changes made between the read and write. */
export async function patchProductRow(client, table, productId, id, createPatch) {
  const read = await client.from(table).select('*').eq('product_id', productId).eq('id', id).maybeSingle();
  if (read.error) throw new Error(read.error.message);
  if (!read.data || read.data.deleted_at) throw new Error('This record is no longer available. Refresh and try again.');
  const patch = { ...createPatch(read.data), updated_at: new Date().toISOString() };
  let update = client.from(table).update(patch).eq('product_id', productId).eq('id', id);
  update = read.data.updated_at ? update.eq('updated_at', read.data.updated_at) : update.is('updated_at', null);
  const result = await update.select('*').maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error('This record changed while you were saving. Refresh and try again.');
  return result.data;
}
