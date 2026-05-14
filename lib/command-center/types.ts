export type EntityStatus = "active" | "paused" | "archived" | string;

export type Product = {
  id: string;
  name: string;
  color?: string;
  clickupListId?: string | null;
  clickup_list_id?: string | null;
  clickupSpaceId?: string | null;
  clickupFolderId?: string | null;
  [key: string]: unknown;
};

export type TaxonomyEntity = {
  id: string;
  name: string;
  status?: EntityStatus;
  sourceLink?: string;
  notes?: string;
  createdAt?: number | null;
  [key: string]: unknown;
};

export type CreativeStatus =
  | "Not Started"
  | "In Progress"
  | "Ready"
  | "Testing"
  | "Winner"
  | "Loser"
  | "Scaling"
  | "Complete"
  | string;

export type Creative = {
  id: string;
  formatName?: string;
  name?: string;
  angle?: string;
  persona?: string;
  status?: CreativeStatus;
  funnelStage?: string;
  adType?: string;
  creativeStructure?: string;
  structure?: string;
  hookType?: string;
  productionStyle?: string;
  creativeHypothesis?: string;
  adLink?: string;
  driveLink?: string;
  notes?: string;
  parentAdId?: string | null;
  trackerRefId?: string | null;
  adOrigin?: string;
  taskType?: string;
  dateCreated?: number | string | null;
  sourceFormatId?: string | null;
  parentTaskName?: string | null;
  lastStatusChangeAt?: number | string | null;
  clickupTaskId?: string | null;
  _clickupId?: string | null;
  _clickupUrl?: string;
  [key: string]: unknown;
};

export type CreativeFormValues = {
  adLink: string;
  adType: string;
  angle: string;
  creativeHypothesis: string;
  creativeStructure: string;
  driveLink: string;
  formatName: string;
  funnelStage: string;
  hookType: string;
  persona: string;
  productionStyle: string;
  status: string;
};

export type ProductionItem = {
  id: string;
  name?: string;
  status?: string;
  angle?: string;
  persona?: string;
  format?: string;
  dueDate?: string;
  [key: string]: unknown;
};

export type ManualAction = {
  id: string;
  adId?: string | null;
  sourceAdId?: string | null;
  sourceAngle?: string;
  sourcePersona?: string;
  angle?: string;
  persona?: string;
  format?: string;
  funnelStage?: string;
  dueDate?: string;
  description?: string;
  title?: string;
  status?: string;
  liveStatus?: string;
  payload?: Record<string, unknown>;
  _dbId?: string;
  _clickupId?: string | null;
  _clickupUrl?: string;
  [key: string]: unknown;
};

export type Inspiration = {
  id: string;
  sourceUrl?: string;
  platform?: string;
  brand?: string;
  formatName?: string;
  creativeUSP?: string;
  hookType?: string;
  creativeStructure?: string;
  productionStyle?: string;
  angle?: string;
  persona?: string;
  funnelStage?: string;
  adType?: string;
  status?: string;
  creativeHypothesis?: string;
  notes?: string;
  bodyCopy?: string;
  headline?: string;
  ctaText?: string;
  landingUrl?: string;
  duration_seconds?: number | string | null;
  importTags?: string[];
  reusedIn?: string[];
  addedAt?: number | string | null;
  queuedAt?: number | string | null;
  classifiedAt?: number | string | null;
  created_at?: string | null;
  _clickupDocPageUrl?: string;
  _clickupDocId?: string;
  [key: string]: unknown;
};

export type MatrixCellMeta = {
  description?: string;
  status?: string;
  actionStatus?: string;
  uniqueName?: string;
  dueDate?: string;
  [key: string]: unknown;
};

export type AnglePersonas = Record<string, string[]>;
export type MatrixCellMetaMap = Record<string, MatrixCellMeta>;
export type CellCreativeAssignments = Record<string, string[]>;

export type FieldOption = {
  name: string;
  desc?: string;
  [key: string]: unknown;
};

export type FieldOptions = {
  creativeStructure: FieldOption[];
  hookType: FieldOption[];
  productionStyle: FieldOption[];
};

export type TrackerFilters = {
  angle: string;
  persona: string;
  format: string;
  adType: string;
  funnelStage: string;
  status: string;
  structure: string;
  hookType: string;
  productionStyle: string;
  taskType: string;
  dateRange: string;
};

export type CommandCenterState = {
  products: Product[];
  activeProductId: string | null;
  angles: TaxonomyEntity[];
  personas: TaxonomyEntity[];
  creatives: Creative[];
  production: ProductionItem[];
  actions: ManualAction[];
  inspirations: Inspiration[];
  winners: Creative[];
  anglePersonas: AnglePersonas;
  matrixCellMeta: MatrixCellMetaMap;
  cellCreativeAssignments: CellCreativeAssignments;
  fieldOptions: FieldOptions;
  trackerFilters: TrackerFilters;
};
