import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { assertQaClickUpList, inferClickUpMappings, validateClickUpMappings, clickUpFieldValue } from '../domain/clickup-sync.js';
import { normalizeProductConfig, productClickUpListId } from '../domain/product-config.js';
import { validateCustomFieldValue } from '../domain/tracker-editing.js';

export async function syncInspirationSourceType({ db, clickup, product, listId, input, signal }) {
  if (db.supabaseUrl?.replace(/\/$/,'') !== QA_SUPABASE_URL) throw new Error('Source-task changes are restricted to QA.');
  assertQaClickUpList(listId);
  if (productClickUpListId(product) !== listId) throw new Error('The product test list changed. Refresh first.');
  if (typeof input.inspirationId !== 'string' || !input.expectedUpdatedAt) throw new Error('Select a saved inspiration version.');
  async function readSource() {
    const result = await db.from('inspirations').select('*').eq('product_id',product.id).eq('id',input.inspirationId).maybeSingle();
    const row = result.data;
    if (result.error || !row || row.product_id !== product.id || row.id !== input.inspirationId || row.deleted_at) throw new Error('Inspiration is unavailable.');
    if (row.updated_at !== input.expectedUpdatedAt) throw new Error('Inspiration changed. Reopen it before syncing.');
    if (row.data?._sourceProductId && row.data._sourceProductId !== product.id) throw new Error('A source task from another product cannot be changed here.');
    if (!/^[a-zA-Z0-9_-]+$/.test(row.data?._sourceClickupId || '') || typeof row.data?.adType !== 'string') throw new Error('No saved source task and ad type are available.');
    return row;
  }
  const row = await readSource(), taskId = row.data._sourceClickupId, value = row.data.adType;
  const schema = await clickup.inspect(listId);
  const config = normalizeProductConfig(product.config).clickup_sync;
  const mappings = validateClickUpMappings(config?.list_id === listId ? config.mappings : inferClickUpMappings(schema.fields),schema.fields);
  const field = schema.fields.find((item) => item.id === mappings.ad_type);
  if (!field || !['drop_down','text','short_text'].includes(field.type)) throw new Error('Configure an ad-type dropdown or text field in the QA list first.');
  let mapped = value;
  if (field.type === 'drop_down' && value !== '') {
    const options = (field.type_config?.options || []).filter((item) => item.name?.toLowerCase() === value.toLowerCase());
    if (options.length !== 1) throw new Error('The QA ad-type dropdown needs one matching option.');
    mapped = options[0].id;
  }
  const remoteValue = validateCustomFieldValue(field,mapped);
  await clickup.getTask(listId,taskId);
  const current = await readSource();
  if (current.data._sourceClickupId !== taskId || current.data.adType !== value) throw new Error('Source task changed. Reopen before syncing.');
  signal?.throwIfAborted();
  await clickup.setField(listId,taskId,field,remoteValue);
  const verified = await clickup.getTask(listId,taskId);
  const actual = verified.custom_fields?.find((item) => item.id === field.id);
  if (!actual || clickUpFieldValue({...field,value:actual.value}).toLowerCase() !== value.toLowerCase()) throw new Error('ClickUp write could not be verified. Refresh and retry the source ad-type sync.');
  await readSource();
  return { productId:product.id, inspirationId:row.id, version:row.updated_at, taskId, adType:value, synced:true };
}
