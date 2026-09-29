export async function readProductRows(db, table, productId, signal, columns = '*') {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const result = await db.from(table).select(columns).eq('product_id', productId).order('id').range(from, from + 499).abortSignal(signal);
    if (result.error) throw new Error(`Could not read ${table}.`);
    if (!Array.isArray(result.data)) throw new Error(`Incomplete ${table} response.`);
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
}
