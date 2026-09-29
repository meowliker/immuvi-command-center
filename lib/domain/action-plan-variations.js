import { explicitPlanSource } from './action-plan-editing.js';
import { planPeopleLabel } from './action-plan-fields.js';

// Legacy Variation Lab counts direct children, with wins divided by all children.
export function planVariationGroups(ads, actions, productId, hiddenIds = new Set()) {
  const eligible = ads.filter((ad) => ad.id && ad.productId === productId && !ad.deletedAt && !ad._productBoundaryQuarantined && !ad.productBoundaryQuarantined);
  const byId = new Map(eligible.map((ad) => [ad.id, ad]));
  const byParent = new Map();
  const links = new Map();
  for (const action of actions) {
    const d = action.display, source = explicitPlanSource(action);
    if (!source || d.productId !== productId || d.linkedAdId !== source) continue;
    const matches = links.get(source) || [];
    matches.push(action); links.set(source, matches);
  }
  for (const ad of eligible) {
    if (!ad.parentAdId || ad.parentAdId === ad.id || !byId.has(ad.parentAdId)) continue;
    const children = byParent.get(ad.parentAdId) || [];
    children.push(ad); byParent.set(ad.parentAdId, children);
  }
  return [...byParent].map(([parentId, children]) => {
    const parent = byId.get(parentId), axes = new Map();
    let winners = 0;
    const rows = children.slice().sort((a, b) => (Number(a.variationNumber) || 0) - (Number(b.variationNumber) || 0) || a.id.localeCompare(b.id))
      .map((ad) => {
        const won = ['winner', 'scale'].includes(String(ad.status || '').trim().toLowerCase());
        if (won) winners++;
        const changes = [...new Set((Array.isArray(ad.variationChanges) ? ad.variationChanges : []).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
        for (const name of changes.length ? changes : ['Other']) {
          const axis = axes.get(name) || { name, total: 0, wins: 0 };
          axis.total++; if (won) axis.wins++; axes.set(name, axis);
        }
        const matches = links.get(ad.id) || [];
        // Ambiguous or personally hidden tasks stay read-only, never a guessed edit target.
        const action = matches.length === 1 ? matches[0] : null;
        const taskId = ad.clickupTaskId || action?.display.clickupTaskId;
        return { id: String(ad.id), title: String(ad.formatName || ad.id), axes: changes.join(' + ') || '-',
          status: String(ad.status || 'Untested'), editor: planPeopleLabel(ad, 'editor'), dueDate: String(ad.dueDate || ''),
          clickupUrl: taskId ? `https://app.clickup.com/t/${encodeURIComponent(taskId)}` : '',
          actionId: !hiddenIds.has(ad.id) && action ? String(action.display.dbId) : '', hidden: hiddenIds.has(ad.id) };
      });
    return { id: String(parentId), title: String(parent.formatName || parentId), winner: String(parent.status).toLowerCase() === 'winner',
      total: rows.length, winners, winRate: Math.round(winners / rows.length * 100), rows,
      axes: [...axes.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)) };
  }).sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
}
