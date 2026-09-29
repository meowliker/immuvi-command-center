import type { normalizeManualActionRow, resolveActionDisplay } from '../../lib/domain/action-plan.js';
import type { normalizeCreativeRow } from '../../lib/domain/creative-tracker.js';
import type { normalizeTaxonomyRow } from '../../lib/domain/taxonomy.js';
import type { normalizeQueueJob, normalizeWorker } from '../../lib/domain/worker-queue.js';
import type { Session, User } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: 'admin' | 'member';
  is_active: boolean;
  must_change_password: boolean;
};

export type Product = {
  id: string;
  name: string;
  updated_at?: string;
  config?: Record<string, unknown>;
  clickupListId?: string;
  clickupListName?: string;
};

export type ActiveTab =
  | 'overview'
  | 'angles'
  | 'personas'
  | 'competitors'
  | 'creative-tracker'
  | 'creative-matrix'
  | 'action-plan'
  | 'production'
  | 'strategist'
  | 'inspiration'
  | 'admin';

type ActionDisplay = NonNullable<ReturnType<typeof resolveActionDisplay>>;

export type ManualAction = ReturnType<typeof normalizeManualActionRow>;

export type ActionRecord = {
  display: ActionDisplay;
  payload: Record<string, unknown>;
  linkedAdMeta: Record<string, unknown>;
  actionVersion?: string;
  adVersion?: string;
};

export type ActionFilter = 'all' | 'backlog' | 'production' | 'testing' | 'winners' | 'losers' | 'overdue';

export type QueueJob = ReturnType<typeof normalizeQueueJob>;

export type WorkerRow = ReturnType<typeof normalizeWorker>;

export type QueueFilter = 'all' | 'pending' | 'active' | 'classified' | 'failed' | 'blocked';

export type Creative = ReturnType<typeof normalizeCreativeRow>;

export type TaxonomyKind = 'angle' | 'persona';

export type TaxonomyRow = ReturnType<typeof normalizeTaxonomyRow>;

export type TaxonomyView = 'active' | 'archived' | 'all';

export type TrackerSortColumn = 'id' | 'formatName' | 'status' | 'dateCreated';

export type TrackerSort = { col: TrackerSortColumn; dir: 1 | -1 };

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
  taskType: '' | 'format' | 'production';
  dateRange: '' | 'today' | 'week' | 'month';
};

export type MatrixCell = {
  id: string;
  angle_id: string;
  persona_id: string;
  creative_assignments: string[];
};

export type MatrixSelection = {
  angleId: string;
  personaId: string;
};

export type MatrixInspectorTab = 'creatives' | 'add' | 'insights';

export type ActivityEvent = {
  id: string;
  event_type: string;
  action_id: string | null;
  clickup_task_id: string | null;
  field_name: string | null;
  new_value: string | null;
  actor: string | null;
  source: string;
  created_at: string;
};

export type AdminUser = {
  accessRevision: string;
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: 'admin' | 'member';
  isActive: boolean;
  mustChangePassword: boolean;
  productIds: string[];
  createdAt: string;
  lastLoginAt: string;
};

export type CompetitorBrand = {
  id: string;
  productId: string;
  name: string;
  category: 'direct' | 'indirect' | 'similar_niche' | string;
  metaPageId: string;
  metaAdLibraryUrl: string;
  homepageUrl: string;
  activeAdCount: number | null;
  lastSeenAt: string;
  approved: boolean;
  approvedAt: string;
  approvedBy: string;
  notes: string;
  createdAt: string;
};

export type CompetitorJob = {
  id: string;
  brandId: string;
  jobType: string;
  status: string;
  errorMessage: string;
  createdAt: string;
  startedAt: string;
  finishedAt: string;
  resultSummary: Record<string, unknown>;
};

export type CompetitorCreative = {
  id: string;
  brandId: string;
  hook: string;
  angle: string;
  persona: string;
  adUrl: string;
  visualPattern: string;
  whyItWorks: string;
  statusLabel: string;
  rankInBrand: number | null;
};

export type StrategistRun = {
  id: string;
  status: string;
  trigger: string;
  runDate: string;
  startedAt: string;
  finishedAt: string;
  error: string;
  workerId: string;
  createdAt: string;
  tasksProcessed: number;
  tasksSkipped: number;
};

export type StrategistMemory = {
  productId: string;
  json: Record<string, unknown>;
  markdown: string;
  updatedAt: string;
};

export type StrategistRecommendation = {
  id: string;
  status: string;
  recommendationType: string;
  confidenceBand: string;
  recommendedHook: string;
  recommendedAngle: string;
  recommendedPersona: string;
  recommendedFormat: string;
  reasoning: string;
  taskId: string;
  manualActionId: string;
  inspirationId: string;
  adId: string;
  taskCreatedAt: string;
  generatedAt: string;
  sourceCreative?: CompetitorCreative;
};

export type StrategistApprovalResult = {
  recommendationId: string;
  inspirationId: string;
  adId: string;
  manualActionDbId: string;
  manualActionId: string;
  taskId: string;
  alreadyTasked: boolean;
};

export type CreateUserForm = {
  email: string;
  username: string;
  fullName: string;
  role: 'admin' | 'member';
  tempPassword: string;
  productIds: string[];
};

export type CompetitorForm = {
  name: string;
  category: 'direct' | 'indirect' | 'similar_niche';
  metaPageId: string;
  homepageUrl: string;
  notes: string;
};

export type AppState =
  | { view: 'checking'; message?: string }
  | { view: 'login'; error?: string }
  | { view: 'password'; session: Session; user: User; profile: Profile; error?: string }
  | {
      view: 'dashboard';
      session: Session;
      user: User;
      profile: Profile;
      products: Product[];
      activeProductId: string;
      activeTab: ActiveTab;
      error?: string;
    };

export type QaNextClientProps = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};
