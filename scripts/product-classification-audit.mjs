import {createHash} from 'node:crypto';
import {normalizedName} from '../tools/taxonomy-review-core.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const asText = value => typeof value === 'string' ? value : '';

export function buildClassificationAudit(tables, productId) {
  if (!productId) throw new Error('Product ID is required');
  for (const [table, rows] of Object.entries(tables)) {
    for (const row of rows) {
      if ((table === 'products' ? row.id : row.product_id) !== productId) {
        throw new Error('Foreign product record in ' + table);
      }
    }
  }
  const activeAds = tables.ads.filter(row => !row.deleted_at);
  const categories = kind => tables[kind].filter(row => !row.archived_at);
  const angles = categories('angles'), personas = categories('personas');
  const duplicateNames = rows => {
    const groups = new Map();
    for (const row of rows) {
      const key = normalizedName(row.name);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) || []), {id:row.id, name:row.name}]);
    }
    return [...groups.values()].filter(group => group.length > 1);
  };
  const records = activeAds.map(ad => {
    const meta = ad.meta || {};
    const linkedInspirations = (tables.inspirations || []).filter(ins =>
      [meta._fromInspoId, meta._sourceInsId].includes(ins.id) ||
      (ins.url && [ad.ad_link, meta._sourceInspoAdUrl].includes(ins.url)) ||
      (ins.data?._clickupDocPageUrl && [meta._sourceInspoUrl, meta._sourceInspirationBriefUrl].includes(ins.data._clickupDocPageUrl))
    );
    const flags = [];
    if (!ad.angle) flags.push('missing_angle');
    else if (!angles.some(row => normalizedName(row.name) === normalizedName(ad.angle))) flags.push('angle_not_in_active_taxonomy');
    if (!ad.persona) flags.push('missing_persona');
    else if (!personas.some(row => normalizedName(row.name) === normalizedName(ad.persona))) flags.push('persona_not_in_active_taxonomy');
    if (!ad.drive_link) flags.push('no_final_drive_link');
    if (!asText(meta.description).trim()) flags.push('no_task_description');
    if (ad.parent_ad_id) flags.push('variation_requires_independent_review');
    // These are evidence pointers, not proof of the finished ad's classification.
    return {
      id:ad.id, productId, name:ad.format_name, status:ad.status,
      angle:ad.angle, persona:ad.persona, parentId:ad.parent_ad_id,
      clickupTaskId:ad.clickup_task_id, finalDriveLink:ad.drive_link,
      taskDescription:asText(meta.description), variationNotes:asText(meta.variationNotes),
      variationChanges:meta.variationChanges || [],
      inspirationIds:linkedInspirations.map(row => row.id),
      flags, reviewStatus:'awaiting_evidence_review',
      snapshotHash:digest({...ad, updated_at:null})
    };
  });
  return {
    productId,
    summary:{
      creativeRecords:records.length, preservedDeletedRecords:tables.ads.length - records.length,
      variations:records.filter(row => row.parentId).length,
      finalDriveLinks:records.filter(row => row.finalDriveLink).length,
      taskDescriptions:records.filter(row => row.taskDescription.trim()).length,
      linkedSourceInspirations:records.filter(row => row.inspirationIds.length).length,
      activeAngles:angles.length, activePersonas:personas.length,
      flagCounts:Object.fromEntries([...new Set(records.flatMap(row => row.flags))].map(flag => [flag, records.filter(row => row.flags.includes(flag)).length]))
    },
    duplicateNames:{angles:duplicateNames(angles), personas:duplicateNames(personas)},
    taxonomy:{angles, personas},
    records
  };
}
