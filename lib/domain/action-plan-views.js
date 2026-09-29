export const PLAN_COLUMNS = [
  { key: 'cb', label: 'Selection', width: 44, min: 44, required: true },
  { key: 'source', label: 'Source', width: 48, min: 48, required: true },
  { key: 'title', label: 'Task name', width: 240, min: 180, required: true, sort: 'title' },
  { key: 'angle', label: 'Angle', width: 180, min: 120, sort: 'angle' },
  { key: 'persona', label: 'Persona', width: 180, min: 120, sort: 'persona' },
  { key: 'origin', label: 'Origin', width: 180, min: 100 },
  { key: 'brief', label: 'Brief', width: 90, min: 80 },
  { key: 'adSource', label: 'Ad source', width: 110, min: 100 },
  { key: 'driveLink', label: 'Drive Link', width: 110, min: 100 },
  { key: 'funnel', label: 'Funnel', width: 70, min: 60, sort: 'funnelStage' },
  { key: 'type', label: 'Type', width: 70, min: 60, sort: 'adType' },
  { key: 'hook', label: 'Hook', width: 110, min: 80 },
  { key: 'status', label: 'Status', width: 130, min: 130, sort: 'status' },
  { key: 'age', label: 'Age in status', width: 80, min: 80, sort: 'age' },
  { key: 'editor', label: 'Editor', width: 140, min: 100, sort: 'editor' },
  { key: 'reviewer', label: 'Reviewer', width: 140, min: 100, sort: 'reviewer' },
  { key: 'created', label: 'Created', width: 80, min: 80, sort: 'createdAt' },
  { key: 'due', label: 'Due', width: 120, min: 120, sort: 'dueDate' },
  { key: 'clickup', label: 'ClickUp', width: 100, min: 100 },
  { key: 'producer', label: 'Producer', width: 90, min: 70 },
  { key: 'del', label: 'Actions', width: 96, min: 96 },
  { key: 'cell', label: 'Angle / Persona', width: 150, min: 120, sort: 'angle', hidden: true },
];

// Upgrade only the untouched first QA preset; keep customized/saved layouts intact.
const previousPreset = [['cb',44,false],['title',240,false],['status',140,false],['age',144,false],['due',144,false],['editor',120,false],['reviewer',120,false],['cell',150,false],['origin',110,false],['clickup',180,false],['funnel',90,true],['type',100,true],['hook',140,true],['created',140,true]];
function isPreviousPreset(input) {
  return Array.isArray(input) && input.length === previousPreset.length && input.every((item, index) => {
    const [key, width, hidden] = previousPreset[index];
    return item?.key === key && item.width === width && item.hidden === hidden;
  });
}

export function planColumn(key) {
  return PLAN_COLUMNS.find((column) => column.key === key) || (typeof key === 'string' && key.startsWith('cf:') && key.length > 3 && key.length <= 160
    ? { key, label: key.slice(3), width: 160, min: 100, hidden: true, required: false, sort: key } : null);
}
export function normalizePlanColumns(input) {
  if (isPreviousPreset(input)) input = [];
  const seen = new Set(), columns = [];
  for (const item of Array.isArray(input) ? input.slice(0, 120) : []) {
    const definition = planColumn(item?.key);
    if (!definition || seen.has(item.key)) continue;
    if (item.key.startsWith('cf:') && columns.filter((column) => column.key.startsWith('cf:')).length >= 120 - PLAN_COLUMNS.length) continue;
    seen.add(item.key);
    columns.push({ key: item.key, width: Math.round(Math.min(600, Math.max(definition.min, Number(item.width) || definition.width))), hidden: definition.required ? false : item.hidden === true });
  }
  for (const column of PLAN_COLUMNS) if (!seen.has(column.key)) {
    const next = { key: column.key, width: column.width, hidden: column.hidden === true };
    const anchor = { angle: 'title', persona: 'angle', brief: 'origin', adSource: 'brief', driveLink: 'adSource' }[column.key];
    if (anchor) {
      columns.splice(columns.findIndex(item => item.key === anchor) + 1, 0, next);
    } else columns.push(next);
  }
  return columns;
}

export function normalizePlanViews(input) {
  const seen = new Set(), views = [];
  for (const view of Array.isArray(input?.views) ? input.views.slice(0, 30) : []) {
    if (typeof view?.id !== 'string' || !view.id || view.id.length > 80 || seen.has(view.id)) continue;
    seen.add(view.id);
    views.push({ id: view.id, name: view.id === 'default' ? 'Default' : String(view.name || 'Untitled view').slice(0, 80), columns: normalizePlanColumns(view.columns) });
  }
  if (!seen.has('default')) views.unshift({ id: 'default', name: 'Default', columns: normalizePlanColumns([]) });
  const limited = views.slice(0, 30);
  return { version: 1, activeViewId: limited.some((view) => view.id === input?.activeViewId) ? input.activeViewId : 'default', views: limited };
}

const visibleCustomFields = new Set(['creative structure', 'production style', 'creative usp', 'funnel type', 'photo/video', 'product']);
export function planViewColumns(view, actions, fields = []) {
  const columns = normalizePlanColumns(view?.columns);
  const keys = new Set(columns.map((column) => column.key));
  const names = new Set([...fields.filter(field => field.id !== '__task_assignees').map(field => field.name.trim().toLowerCase()),
    ...actions.flatMap(action => Object.keys(action.linkedAdMeta?._customFields || {}).map(name => name.toLowerCase()))]);
  for (const name of names) {
    if (name === 'editor' || name === 'reviewer') continue;
    const key = `cf:${name}`;
    if (!keys.has(key) && planColumn(key) && columns.length < 120) { keys.add(key); columns.push({ key, width: 160, hidden: !visibleCustomFields.has(name) }); }
  }
  return columns;
}

export function namedPlanView(state, columns, name, id) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new Error('Enter a view name of 1 to 80 characters.');
  if (state.views.some((view) => view.id !== id && view.name.trim().toLowerCase() === trimmed.toLowerCase())) throw new Error('A view with that name already exists.');
  if (!state.views.some((view) => view.id === id) && state.views.length >= 30) throw new Error('Maximum 30 saved views.');
  const next = { id, name: id === 'default' ? 'Default' : trimmed, columns: normalizePlanColumns(columns) };
  return { ...state, activeViewId: id, views: state.views.some((view) => view.id === id) ? state.views.map((view) => view.id === id ? next : view) : [...state.views, next] };
}
