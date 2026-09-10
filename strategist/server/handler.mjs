var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// strategist/src/server/handler.ts
import { sql as sql5 } from "drizzle-orm";

// strategist/src/db/client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// strategist/src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  creatives: () => creatives,
  frameTexts: () => frameTexts,
  keywords: () => keywords,
  observations: () => observations,
  research: () => research,
  syncRuns: () => syncRuns,
  synthesis: () => synthesis,
  tasks: () => tasks,
  transcripts: () => transcripts,
  verdictKind: () => verdictKind,
  verdicts: () => verdicts,
  verifiability: () => verifiability,
  winCategory: () => winCategory
});
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  real,
  index,
  uniqueIndex,
  pgEnum
} from "drizzle-orm/pg-core";
var winCategory = pgEnum("strategist_win_category", [
  "winner",
  "mild_winner",
  "scale",
  "loser",
  "untested"
]);
var verdictKind = pgEnum("strategist_verdict_kind", [
  "match",
  // ClickUp and the creative agree
  "mismatch",
  // they disagree — ClickUp is likely wrong
  "missing",
  // ClickUp blank, the creative supplied a value
  "differs",
  // both hold a considered view and they diverge; neither is
  // authoritative. Angle and Persona only ever reach this.
  "unverifiable",
  // the creative cannot settle this field (Angle, Persona)
  "no_claim_no_obs"
]);
var verifiability = pgEnum("strategist_verifiability", ["objective", "semi", "interpretive"]);
var tasks = pgTable("strategist_tasks", {
  id: text("id").primaryKey(),
  // ClickUp task id
  listId: text("list_id").notNull(),
  productName: text("product_name").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  status: text("status").notNull(),
  category: winCategory("category").notNull(),
  /** True only for statuses that actually reached market — the win-rate denominator. */
  wasTested: boolean("was_tested").notNull().default(false),
  dateCreated: timestamp("date_created", { withTimezone: true }),
  dateUpdated: timestamp("date_updated", { withTimezone: true }),
  tags: jsonb("tags").$type().notNull().default([]),
  assignees: jsonb("assignees").$type().notNull().default([]),
  editor: text("editor"),
  // ── parsed from the task name ──
  productCode: text("product_code"),
  serial: integer("serial"),
  inspirationId: text("inspiration_id"),
  legacyIds: jsonb("legacy_ids").$type().notNull().default([]),
  variationChain: jsonb("variation_chain").$type().notNull().default([]),
  /** The lever this task was actually testing: Hook, CTA, Text, Music, ... */
  changedLever: text("changed_lever"),
  igbAngle: text("igb_angle"),
  parentTaskId: text("parent_task_id"),
  // ── CLAIMED: what ClickUp says, from custom fields + the brief table ──
  claimedAngle: text("claimed_angle"),
  claimedPersona: text("claimed_persona"),
  claimedFunnel: text("claimed_funnel"),
  claimedAdType: text("claimed_ad_type"),
  claimedHookType: text("claimed_hook_type"),
  claimedCreativeStructure: text("claimed_creative_structure"),
  claimedProductionStyle: text("claimed_production_style"),
  claimedUsp: text("claimed_usp"),
  hypothesis: text("hypothesis"),
  notes: text("notes"),
  driveLink: text("drive_link"),
  inspirationLink: text("inspiration_link"),
  inspirationBriefUrl: text("inspiration_brief_url"),
  rawDescription: text("raw_description"),
  /** Normalised duplicate-detection key; duplicates share it. */
  dedupeKey: text("dedupe_key").notNull(),
  duplicateOfTaskId: text("duplicate_of_task_id"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("strategist_tasks_list_idx").on(t.listId),
  index("strategist_tasks_category_idx").on(t.category),
  index("strategist_tasks_dedupe_idx").on(t.dedupeKey)
]);
var creatives = pgTable("strategist_creatives", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  // 'drive' | 'clickup_attachment'
  sourceFileId: text("source_file_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  /** The -1 / -2 / -3 suffix: which hook variant of the task this file is. */
  variantIndex: integer("variant_index"),
  isVideo: boolean("is_video").notNull(),
  // ── measured directly from the file ──
  durationSec: real("duration_sec"),
  width: integer("width"),
  height: integer("height"),
  aspectRatio: text("aspect_ratio"),
  cutCount: integer("cut_count"),
  cutsPerMinute: real("cuts_per_minute"),
  hasVoiceover: boolean("has_voiceover"),
  hasMusic: boolean("has_music"),
  thumbnailPath: text("thumbnail_path"),
  // Supabase Storage key
  analysedAt: timestamp("analysed_at", { withTimezone: true }),
  analysisError: text("analysis_error")
}, (t) => [
  index("strategist_creatives_task_idx").on(t.taskId),
  uniqueIndex("strategist_creatives_source_idx").on(t.source, t.sourceFileId)
]);
var transcripts = pgTable("strategist_transcripts", {
  creativeId: text("creative_id").primaryKey().references(() => creatives.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  language: text("language"),
  segments: jsonb("segments").$type().notNull().default([]),
  /** Spoken words in the first 3 seconds — the audio half of the hook. */
  hookSpoken: text("hook_spoken")
});
var frameTexts = pgTable("strategist_frame_texts", {
  id: text("id").primaryKey(),
  creativeId: text("creative_id").notNull().references(() => creatives.id, { onDelete: "cascade" }),
  tSec: real("t_sec").notNull(),
  text: text("text").notNull(),
  isHookFrame: boolean("is_hook_frame").notNull().default(false),
  framePath: text("frame_path")
}, (t) => [index("strategist_frame_texts_creative_idx").on(t.creativeId)]);
var observations = pgTable("strategist_observations", {
  creativeId: text("creative_id").primaryKey().references(() => creatives.id, { onDelete: "cascade" }),
  observedAdType: text("observed_ad_type"),
  observedCreativeStructure: text("observed_creative_structure"),
  observedProductionStyle: text("observed_production_style"),
  observedHookType: text("observed_hook_type"),
  observedFunnel: text("observed_funnel"),
  /** Interpretive: what the creative *signals*, not a claim about intent. */
  observedAngleSignal: text("observed_angle_signal"),
  observedPersonaSignal: text("observed_persona_signal"),
  /** The on-screen hook text — the single most reusable artefact here. */
  hookText: text("hook_text"),
  ctaText: text("cta_text"),
  painPoints: jsonb("pain_points").$type().notNull().default([]),
  confidence: jsonb("confidence").$type().notNull().default({}),
  evidence: jsonb("evidence").$type().notNull().default({}),
  model: text("model").notNull(),
  /** Bumped when the analysis prompt changes, so stale rows can be re-run. */
  promptVersion: integer("prompt_version").notNull().default(1),
  analysedAt: timestamp("analysed_at", { withTimezone: true }).notNull().defaultNow()
});
var verdicts = pgTable("strategist_verdicts", {
  id: text("id").primaryKey(),
  creativeId: text("creative_id").notNull().references(() => creatives.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  // 'hook_type' | 'production_style' | ...
  verifiability: verifiability("verifiability").notNull(),
  claimedValue: text("claimed_value"),
  observedValue: text("observed_value"),
  verdict: verdictKind("verdict").notNull(),
  confidence: real("confidence"),
  evidence: text("evidence"),
  /** The value analytics aggregate on: observed when trusted, else claimed. */
  resolvedValue: text("resolved_value"),
  /** A human decision in the app always wins. Never leaves this database. */
  humanOverride: text("human_override"),
  overriddenBy: text("overridden_by"),
  overriddenAt: timestamp("overridden_at", { withTimezone: true })
}, (t) => [
  uniqueIndex("strategist_verdicts_creative_field_idx").on(t.creativeId, t.field),
  index("strategist_verdicts_verdict_idx").on(t.verdict)
]);
var keywords = pgTable("strategist_keywords", {
  id: text("id").primaryKey(),
  creativeId: text("creative_id").references(() => creatives.id, { onDelete: "cascade" }),
  term: text("term").notNull(),
  kind: text("kind").notNull(),
  // 'hook_phrase' | 'pain_point' | 'format' | 'entity'
  /** Short enough to paste into a search box, and specific enough to matter. */
  searchable: boolean("searchable").notNull().default(true),
  weight: real("weight").notNull().default(1)
}, (t) => [
  index("strategist_keywords_term_idx").on(t.term),
  index("strategist_keywords_creative_idx").on(t.creativeId)
]);
var syncRuns = pgTable("strategist_sync_runs", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  trigger: text("trigger").notNull(),
  // 'webhook' | 'nightly' | 'manual'
  tasksSeen: integer("tasks_seen").notNull().default(0),
  tasksUpserted: integer("tasks_upserted").notNull().default(0),
  creativesQueued: integer("creatives_queued").notNull().default(0),
  error: text("error")
});
var research = pgTable("strategist_research", {
  creativeId: text("creative_id").primaryKey().references(() => creatives.id, { onDelete: "cascade" }),
  /** Rich format description, e.g. "VO-driven UGC — repurposed TikTok tutorial". */
  formatDescription: text("format_description").notNull(),
  /** The mechanism the hook uses, in plain words. */
  hookMechanism: text("hook_mechanism").notNull(),
  /** One sentence: what this creative actually is. */
  coreConcept: text("core_concept").notNull(),
  /** Why it was built this way — the bet the creative is making. */
  creativeHypothesis: text("creative_hypothesis").notNull(),
  /** What the viewer is asked to take, and on what terms. */
  offer: text("offer"),
  /** How the offer is justified: free, limited-time, bonus-stacked, none. */
  offerMechanism: text("offer_mechanism"),
  /** Ordered beats of the script, the shape the argument moves through. */
  scriptArc: jsonb("script_arc").$type().notNull().default([]),
  /** Scene-by-scene for caption-led creatives with no voiceover. */
  scenes: jsonb("scenes").$type().notNull().default([]),
  /** What is physically happening on screen — hands, herbs, page flips. */
  tactileElements: jsonb("tactile_elements").$type().notNull().default([]),
  /** Evidence the creative is repurposed organic rather than produced for ads. */
  repurposedSignals: text("repurposed_signals"),
  /** A visible creator handle or watermark, when one appears. */
  sourceHandle: text("source_handle"),
  model: text("model").notNull(),
  promptVersion: integer("prompt_version").notNull().default(1),
  analysedAt: timestamp("analysed_at", { withTimezone: true }).notNull().defaultNow()
});
var synthesis = pgTable("strategist_synthesis", {
  productKey: text("product_key").primaryKey(),
  productName: text("product_name").notNull(),
  hookFormulas: jsonb("hook_formulas").$type().notNull().default([]),
  /** What separates full winners from mild winners, grounded in the creatives. */
  winnerVsMild: jsonb("winner_vs_mild").$type().notNull().default([]),
  huntFor: jsonb("hunt_for").$type().notNull().default([]),
  avoid: jsonb("avoid").$type().notNull().default([]),
  /** The single pattern most worth replicating next. */
  topPattern: text("top_pattern"),
  winnersAnalysed: integer("winners_analysed").notNull().default(0),
  losersAnalysed: integer("losers_analysed").notNull().default(0),
  model: text("model").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow()
});

// strategist/src/db/client.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
var requestDb = new AsyncLocalStorage();
var globalForDb = globalThis;
function getDb() {
  if (globalForDb.__strategistDb) return globalForDb.__strategistDb;
  const connectionString = process.env.STRATEGIST_DATABASE_URL;
  if (!connectionString) throw new Error("STRATEGIST_DATABASE_URL is not set");
  const connection = new URL(connectionString);
  const project = new URL(process.env.SUPABASE_URL || "").hostname.split(".")[0];
  if (connection.hostname !== `db.${project}.supabase.co` && !decodeURIComponent(connection.username).endsWith(`.${project}`)) {
    throw new Error("Strategist database must belong to the Immuvi Supabase project");
  }
  const client = globalForDb.__strategistSql ?? postgres(connectionString, {
    prepare: false,
    max: Number(process.env.PG_POOL_MAX ?? 3),
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 15
  });
  globalForDb.__strategistSql = client;
  const db2 = drizzle(client, { schema: schema_exports });
  globalForDb.__strategistDb = db2;
  return db2;
}
var db = new Proxy({}, {
  get(_target, prop) {
    return (requestDb.getStore() || getDb())[prop];
  }
});
async function withUser(userId, callback) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return requestDb.run(tx, callback);
  });
}

// strategist/src/lib/products.ts
var PRODUCTS = [
  { key: "hh", listId: "901613416500", name: "Herbal Healing Handbook", short: "Herbal", codes: ["HH", "HHH", "Herbal"] },
  { key: "ad", listId: "901613119887", name: "ADHD", short: "ADHD", codes: ["AD", "ADHD"] },
  { key: "ca", listId: "901613035012", name: "Canva Mastery", short: "Canva", codes: ["CA"] },
  { key: "ig", listId: "901615920553", name: "Instagram Growth Bundle", short: "Instagram", codes: ["IG", "IGB"] },
  { key: "km", listId: "901613118174", name: "Kids Mental Health", short: "Kids MH", codes: ["KM", "KMH"] },
  { key: "kl", listId: "901613067126", name: "Kids Life Skill", short: "Kids LS", codes: ["KL", "KLS"] }
];
var LIST_TO_KEY = Object.fromEntries(
  PRODUCTS.map((p) => [p.listId, p.key])
);
var keyToProduct = (key) => PRODUCTS.find((p) => p.key === key);
var PRODUCT_KEYS = PRODUCTS.map((p) => p.key);
var LIST_IDS = PRODUCTS.map((p) => p.listId);
var WINNING_STATUSES = ["winner", "mild winner", "scale"];
var LOSING_STATUSES = ["loser"];
var DECIDED_STATUSES = [
  ...WINNING_STATUSES,
  ...LOSING_STATUSES
];

// strategist/src/lib/data/project.ts
import { sql as sql2 } from "drizzle-orm";

// strategist/src/lib/data/types.ts
var PRODUCT_LABEL = {
  hh: "Herbal Healing",
  ad: "ADHD",
  ca: "Canva Mastery",
  ig: "Instagram Growth",
  km: "Kids Mental Health",
  kl: "Kids Life Skill",
  ot: "Other"
};
var STATUS_LABEL = {
  win: "Winner",
  mild: "Mild Winner",
  scale: "Scale",
  loss: "Loser",
  un: "Untested"
};

// strategist/src/lib/data/trust.ts
var FIELDS = [
  { key: "adTypeDual", field: "ad_type", label: "Photo / Video" },
  { key: "productionStyle", field: "production_style", label: "Production Style" },
  { key: "creativeStructure", field: "creative_structure", label: "Creative Structure" },
  { key: "hookType", field: "hook_type", label: "Hook Type" },
  { key: "funnel", field: "funnel", label: "Funnel" }
];
function computeTrust(creatives2) {
  return FIELDS.map(({ key, field, label }) => {
    let agree = 0, total = 0;
    for (const c of creatives2) {
      if (!c.analysed) continue;
      const dv = c[key];
      if (!dv || dv.verdict === "differs" || dv.verdict === "unverifiable") continue;
      total++;
      if (dv.verdict === "match") agree++;
    }
    return { field, label, agree, total };
  }).filter((t) => t.total > 0).sort((a, b) => a.agree / a.total - b.agree / b.total);
}

// strategist/src/lib/data/project.ts
var CAT_TO_KEY = {
  winner: "win",
  mild_winner: "mild",
  scale: "scale",
  loser: "loss",
  untested: "un"
};
function dual(claimed, observed, field, ev, cf, vd) {
  return {
    claimed,
    observed,
    verdict: vd?.[field] ?? (observed ? "differs" : "unverifiable"),
    rationale: ev?.[field] ?? null,
    confidence: cf?.[field] ?? null
  };
}
async function projectSnapshot() {
  const rows = await db.execute(sql2`
    select t.id as task_id, t.list_id, t.name, t.url, t.category::text as category,
           t.editor, t.changed_lever, t.notes,
           c.id as creative_id, c.filename, c.variant_index, c.duration_sec, c.cuts_per_minute,
           o.hook_text,o.creative_id as observation_id,
           t.claimed_angle as c_angle, t.claimed_persona as c_persona,
           t.claimed_production_style as c_style, t.claimed_creative_structure as c_structure,
           t.claimed_hook_type as c_hook, t.claimed_ad_type as c_adtype,
           t.claimed_funnel as c_funnel,
           o.observed_angle_signal as o_angle, o.observed_persona_signal as o_persona,
           o.observed_production_style as o_style, o.observed_creative_structure as o_structure,
           o.observed_hook_type as o_hook, o.observed_ad_type as o_adtype,
           o.observed_funnel as o_funnel,
           o.evidence, o.confidence,
           (select jsonb_object_agg(v.field, v.verdict::text) from strategist_verdicts v where v.creative_id = c.id) as verdicts
    from strategist_tasks t
    left join strategist_creatives c on c.task_id = t.id
    left join strategist_observations o on o.creative_id = c.id
    where t.duplicate_of_task_id is null
    order by t.product_name, t.name, c.variant_index nulls first
  `);
  const creatives2 = rows.map((r) => {
    const product = LIST_TO_KEY[r.list_id] ?? "ot";
    const status = CAT_TO_KEY[r.category] ?? "un";
    const analysed = Boolean(r.creative_id && r.observation_id);
    const vd = r.verdicts;
    return {
      taskId: r.task_id,
      creativeId: r.creative_id ?? void 0,
      filename: r.filename ?? void 0,
      variantIndex: r.variant_index,
      name: r.filename ?? r.name,
      taskName: r.name,
      url: r.url,
      product,
      productName: PRODUCT_LABEL[product],
      status,
      statusLabel: STATUS_LABEL[status],
      assignee: r.editor,
      changedLever: r.changed_lever,
      hook: r.hook_text ?? r.notes,
      adType: r.o_adtype ?? r.c_adtype,
      durationSec: r.duration_sec,
      cutsPerMinute: r.cuts_per_minute,
      angle: dual(r.c_angle, r.o_angle, "angle", r.evidence, r.confidence, vd),
      persona: dual(r.c_persona, r.o_persona, "persona", r.evidence, r.confidence, vd),
      productionStyle: dual(r.c_style, r.o_style, "production_style", r.evidence, r.confidence, vd),
      creativeStructure: dual(r.c_structure, r.o_structure, "creative_structure", r.evidence, r.confidence, vd),
      hookType: dual(r.c_hook, r.o_hook, "hook_type", r.evidence, r.confidence, vd),
      funnel: dual(r.c_funnel, r.o_funnel, "funnel", r.evidence, r.confidence, vd),
      adTypeDual: dual(r.c_adtype, r.o_adtype, "ad_type", r.evidence, r.confidence, vd),
      verdicts: [],
      mismatchCount: vd ? Object.values(vd).filter((v) => v === "mismatch").length : 0,
      analysed
    };
  });
  const buckets = /* @__PURE__ */ new Map();
  for (const c of creatives2) {
    if (c.status !== "loss" && c.status !== "win" && c.status !== "mild" && c.status !== "scale") continue;
    const label = c.creativeStructure?.observed ?? c.creativeStructure?.claimed;
    if (!label) continue;
    const key = `${c.product}::${label.toLowerCase().replace(/\s*\+\s*/g, " + ").replace(/\s*\/\s*/g, " / ").trim()}`;
    const b = buckets.get(key) ?? { wins: 0, losses: 0, product: c.product, label: label.trim() };
    if (c.status === "loss") b.losses++;
    else b.wins++;
    buckets.set(key, b);
  }
  const formats = [...buckets.entries()].map(([key, b]) => {
    const label = b.label;
    const tested = b.wins + b.losses;
    return {
      key,
      code: label.slice(0, 2).toUpperCase(),
      label,
      description: `${PRODUCT_LABEL[b.product]} \xB7 ${tested} decided`,
      product: b.product,
      wins: b.wins,
      losses: b.losses,
      tested,
      winRate: tested ? b.wins / tested : null
    };
  }).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0) || b.tested - a.tested);
  const kwRows = await db.execute(sql2`
    select k.term, k.kind, t.list_id, count(distinct c.task_id)::int as wins
    from strategist_keywords k
    join strategist_creatives c on c.id = k.creative_id
    join strategist_tasks t on t.id = c.task_id
    where t.category in ('winner','mild_winner','scale') and t.duplicate_of_task_id is null
    group by k.term, k.kind, t.list_id
    order by wins desc, k.term
    limit 300
  `);
  const keywords2 = kwRows.map((k) => {
    const product = LIST_TO_KEY[k.list_id] ?? "ot";
    return {
      term: k.term,
      kind: k.kind,
      product,
      productName: PRODUCT_LABEL[product],
      weight: 1,
      wins: k.wins
    };
  });
  const trust = computeTrust(creatives2);
  const distinctTasks = new Set(creatives2.map((c) => c.taskId));
  const analysedTasks = new Set(creatives2.filter((c) => c.analysed).map((c) => c.taskId));
  const snapshot = {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    live: true,
    totals: {
      tasks: distinctTasks.size,
      winners: new Set(creatives2.filter((c) => c.status !== "loss" && c.status !== "un").map((c) => c.taskId)).size,
      losers: new Set(creatives2.filter((c) => c.status === "loss").map((c) => c.taskId)).size,
      analysed: analysedTasks.size,
      mismatches: creatives2.reduce((n, c) => n + c.mismatchCount, 0)
    },
    creatives: creatives2,
    formats,
    keywords: keywords2,
    trust
  };
  return snapshot;
}

// strategist/src/lib/data/select.ts
function selectProduct(snap, product) {
  if (product === "all") return snap;
  const creatives2 = snap.creatives.filter((c) => c.product === product);
  const tasksOf = (pred) => new Set(creatives2.filter(pred).map((c) => c.taskId)).size;
  return {
    ...snap,
    creatives: creatives2,
    formats: snap.formats.filter((f) => f.product === product),
    keywords: snap.keywords.filter((k) => k.product === product),
    // Recomputed from this product's rows — the workspace-wide figures would
    // otherwise appear under a product heading.
    trust: computeTrust(creatives2),
    totals: {
      tasks: new Set(creatives2.map((c) => c.taskId)).size,
      winners: tasksOf((c) => c.status === "win" || c.status === "mild" || c.status === "scale"),
      losers: tasksOf((c) => c.status === "loss"),
      analysed: tasksOf((c) => c.analysed),
      mismatches: creatives2.reduce((n, c) => n + c.mismatchCount, 0)
    }
  };
}

// strategist/src/lib/data/research.ts
import { sql as sql3 } from "drizzle-orm";
var TIER = {
  winner: "win",
  mild_winner: "mild",
  scale: "scale",
  loser: "loss",
  untested: "un"
};
var TIER_LABEL = {
  win: "Winner",
  mild: "Mild Winner",
  scale: "Scale",
  loss: "Loser",
  un: "Untested"
};
async function loadResearch(product) {
  let rows;
  try {
    rows = await db.execute(sql3`
    select r.creative_id, c.filename, t.name as task_name, t.url as task_url,
           t.list_id, t.product_name, t.category::text as category,
           r.format_description, r.hook_mechanism, r.core_concept, r.creative_hypothesis,
           r.script_arc, r.scenes, r.tactile_elements, r.repurposed_signals, r.source_handle,r.offer,r.offer_mechanism,
           o.hook_text
    from strategist_research r
    join strategist_creatives c on c.id = r.creative_id
    join strategist_tasks t on t.id = c.task_id
    left join strategist_observations o on o.creative_id = c.id
    where t.duplicate_of_task_id is null
    order by
      case t.category::text when 'scale' then 0 when 'winner' then 1
        when 'mild_winner' then 2 when 'loser' then 3 else 4 end,
      t.name, c.filename
    `);
  } catch (e) {
    console.error("[research] query failed:", e.message);
    throw e;
  }
  return rows.map((r) => {
    const key = LIST_TO_KEY[r.list_id] ?? "ot";
    const tier = TIER[r.category] ?? "un";
    return {
      creativeId: r.creative_id,
      filename: r.filename,
      taskName: r.task_name,
      taskUrl: r.task_url,
      product: key,
      productName: r.product_name,
      tier,
      tierLabel: TIER_LABEL[tier],
      formatDescription: r.format_description,
      hookMechanism: r.hook_mechanism,
      hookText: r.hook_text || null,
      coreConcept: r.core_concept,
      creativeHypothesis: r.creative_hypothesis,
      offer: r.offer || null,
      offerMechanism: r.offer_mechanism || null,
      scriptArc: r.script_arc ?? [],
      scenes: r.scenes ?? [],
      tactileElements: r.tactile_elements ?? [],
      repurposedSignals: r.repurposed_signals || null,
      sourceHandle: r.source_handle || null
    };
  }).filter((r) => product === "all" || r.product === product);
}
async function loadSynthesis(product) {
  let rows;
  try {
    rows = await db.execute(sql3`
      select product_key, product_name, hook_formulas, winner_vs_mild, hunt_for, avoid,
             top_pattern, winners_analysed, losers_analysed
      from strategist_synthesis order by product_name
    `);
  } catch (e) {
    console.error("[synthesis] query failed:", e.message);
    throw e;
  }
  return rows.map((r) => ({
    productKey: r.product_key,
    productName: r.product_name,
    hookFormulas: r.hook_formulas ?? [],
    winnerVsMild: r.winner_vs_mild ?? [],
    huntFor: r.hunt_for ?? [],
    avoid: r.avoid ?? [],
    topPattern: r.top_pattern || null,
    winnersAnalysed: Number(r.winners_analysed ?? 0),
    losersAnalysed: Number(r.losers_analysed ?? 0)
  })).filter((r) => product === "all" || r.productKey === product);
}
async function loadCombinations(product) {
  try {
    const productFilter = product !== "all" ? sql3`and t.list_id = ${keyToProduct(product)?.listId ?? null}` : sql3``;
    const rows = await db.execute(sql3`
      select
        coalesce(nullif(trim(o.observed_angle_signal),''), nullif(trim(t.claimed_angle),''), 'Unknown') as angle,
        coalesce(nullif(trim(o.observed_persona_signal),''), nullif(trim(t.claimed_persona),''), 'Unknown') as persona,
        coalesce(nullif(trim(o.observed_hook_type),''), nullif(trim(t.claimed_hook_type),''), 'Unknown') as hook_type,
        count(*) filter (where t.category in ('winner','mild_winner','scale'))::int as wins,
        count(*) filter (where t.category = 'loser')::int as losses,
        array_agg(c.id) as creative_ids,t.list_id,t.product_name
      from strategist_observations o
      join strategist_creatives c on c.id = o.creative_id
      join strategist_tasks t on t.id = c.task_id
      where t.category in ('winner','mild_winner','scale','loser')
        and t.duplicate_of_task_id is null
        ${productFilter}
      group by 1,2,3,t.list_id,t.product_name
      having count(*) > 0
      order by wins desc, losses asc
    `);
    const all = rows.map((r) => ({
      angle: product === "all" ? `${r.product_name}: ${r.angle}` : r.angle,
      persona: r.persona,
      hookType: product === "all" ? `${r.product_name}: ${r.hook_type}` : r.hook_type,
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      creativeIds: r.creative_ids ?? []
    }));
    const bets = all.filter((c) => c.wins > 0).slice(0, 8);
    const dying = all.filter((c) => c.wins === 0 && c.losses > 0).slice(0, 5);
    const angleMap = {};
    const hookMap = {};
    for (const c of all) {
      if (!angleMap[c.angle]) angleMap[c.angle] = { wins: 0, losses: 0 };
      angleMap[c.angle].wins += c.wins;
      angleMap[c.angle].losses += c.losses;
      if (!hookMap[c.hookType]) hookMap[c.hookType] = { wins: 0, losses: 0 };
      hookMap[c.hookType].wins += c.wins;
      hookMap[c.hookType].losses += c.losses;
    }
    const fadingPatterns = [];
    for (const [angle, { wins, losses }] of Object.entries(angleMap)) {
      if (angle === "Unknown") continue;
      if (losses >= 2 && wins === 0) fadingPatterns.push(`"${angle}" angle is 0W / ${losses}L \u2014 avoid`);
      else if (losses > wins * 2 && losses >= 2) fadingPatterns.push(`"${angle}" angle has high loss rate (${wins}W / ${losses}L)`);
    }
    for (const [hook, { wins, losses }] of Object.entries(hookMap)) {
      if (hook === "Unknown") continue;
      if (losses >= 2 && wins === 0) fadingPatterns.push(`"${hook}" hook type is 0W / ${losses}L \u2014 kill this`);
    }
    return { bets, dying, fadingPatterns };
  } catch (e) {
    console.error("[combinations] query failed:", e.message);
    throw e;
  }
}

// strategist/src/server/hooks.ts
import { sql as sql4 } from "drizzle-orm";
var junk = (text2) => text2.trim().length < 20 || /^(thanks for watching|hi all|h all|hey all|bye|goodbye|subscribe|follow me|link in bio)/i.test(text2.trim());
function lyric(text2) {
  const t = text2.toLowerCase(), words = t.split(/\s+/);
  return words.some((word, i) => {
    const pair = `${word} ${words[i + 1] || ""}`;
    return i < words.length - 2 && pair.length > 4 && (t.includes(`${pair}, ${pair}`) || t.split(pair).length > 2);
  });
}
async function loadHooks(product) {
  const list = product ? keyToProduct(product).listId : null;
  const rows = await db.execute(sql4`
    select distinct on(t.id) t.id,t.name,t.list_id,t.product_name,
      o.hook_text,tr.hook_spoken,o.observed_production_style as style,o.observed_creative_structure as structure,
      coalesce(nullif(trim(o.observed_angle_signal),''),nullif(trim(t.claimed_angle),''),'Unknown') as angle
    from strategist_tasks t join strategist_creatives c on c.task_id=t.id
    join strategist_observations o on o.creative_id=c.id
    left join strategist_transcripts tr on tr.creative_id=c.id
    where t.category in ('winner','mild_winner','scale') and t.duplicate_of_task_id is null
      and (${list}::text is null or t.list_id=${list})
    order by t.id,c.variant_index nulls first,c.id
  `);
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (/slideshow|animation|static.graphic|caption.only|caption.led|no.voiceover|sound.on|music\b|song/i.test(`${row.style || ""} ${row.structure || ""}`)) continue;
    const key = `${row.list_id}:${row.angle}`;
    const group = groups.get(key) || { angle: `${product ? "" : `${row.product_name} / `}${row.angle}`, textMap: /* @__PURE__ */ new Map(), voiceoverMap: /* @__PURE__ */ new Map() };
    for (const [text2, map, spoken] of [[row.hook_text, group.textMap, false], [row.hook_spoken, group.voiceoverMap, true]]) {
      if (typeof text2 !== "string" || junk(text2) || spoken && lyric(text2)) continue;
      const value = text2.trim();
      map.set(value, [...map.get(value) || [], String(row.name)]);
    }
    groups.set(key, group);
  }
  const entries = (map) => [...map].map(([text2, creatives2]) => ({ text: text2, creatives: creatives2 }));
  return [...groups.values()].map((g) => ({ angle: g.angle, textHooks: entries(g.textMap), voiceoverHooks: entries(g.voiceoverMap) })).filter((g) => g.textHooks.length + g.voiceoverHooks.length > 0).sort((a, b) => b.textHooks.length + b.voiceoverHooks.length - (a.textHooks.length + a.voiceoverHooks.length));
}

// strategist/src/server/handler.ts
var KINDS = /* @__PURE__ */ new Set(["sync", "watch", "enrich", "snapshot", "synthesize"]);
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
async function authenticate(req) {
  const token = String(req.headers.authorization || "").match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Sign in to Immuvi to continue.");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, "Strategist server configuration is incomplete.");
  const headers = { apikey: key, Authorization: `Bearer ${token}` };
  const userRes = await fetch(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(15e3) });
  if (!userRes.ok) throw new HttpError(401, "Your Immuvi session has expired.");
  const user = await userRes.json();
  const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,is_active,full_name`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15e3)
  });
  if (!profileRes.ok) throw new HttpError(503, "Unable to verify Immuvi access.");
  const [profile] = await profileRes.json();
  if (!profile?.is_active) throw new HttpError(403, "Your Immuvi account is inactive.");
  return { id: user.id, isAdmin: profile.role === "admin", name: profile.full_name };
}
async function creativeDetail(id) {
  if (!id || id.length > 300) throw new HttpError(400, "A valid creative ID is required.");
  const rows = await db.execute(sql5`
    select c.*, t.id as task_id,t.name as task_name,t.url as task_url,
      t.product_name,t.category::text as category,t.editor,t.changed_lever,t.notes,t.drive_link,t.inspiration_link,
      t.claimed_angle,t.claimed_persona,t.claimed_funnel,t.claimed_ad_type,t.claimed_hook_type,
      t.claimed_creative_structure,t.claimed_production_style,t.claimed_usp,t.hypothesis as claimed_hypothesis,
      o.observed_angle_signal,o.observed_persona_signal,o.observed_funnel,o.observed_ad_type,
      o.observed_hook_type,o.observed_creative_structure,o.observed_production_style,
      o.hook_text,o.cta_text,o.pain_points,o.confidence,o.evidence,
      r.format_description,r.hook_mechanism,r.core_concept,r.creative_hypothesis,r.offer,r.offer_mechanism,
      r.script_arc,r.scenes,r.tactile_elements,r.repurposed_signals,r.source_handle,
      tr.text as transcript,tr.segments,tr.hook_spoken,
      (select jsonb_object_agg(v.field,jsonb_build_object('verdict',v.verdict::text,
        'claimed',v.claimed_value,'observed',v.observed_value,'confidence',v.confidence,
        'evidence',v.evidence,'resolved',coalesce(v.human_override,v.resolved_value)))
        from strategist_verdicts v where v.creative_id=c.id) as verdicts,
      (select jsonb_agg(jsonb_build_object('term',k.term,'kind',k.kind))
        from strategist_keywords k where k.creative_id=c.id) as keywords,
      (select jsonb_agg(to_jsonb(f) order by f.t_sec) from strategist_frame_texts f where f.creative_id=c.id) as frame_texts
    from strategist_creatives c join strategist_tasks t on t.id=c.task_id
    left join strategist_observations o on o.creative_id=c.id
    left join strategist_research r on r.creative_id=c.id
    left join strategist_transcripts tr on tr.creative_id=c.id
    where c.id=${id} limit 1
  `);
  if (!rows.length) throw new HttpError(404, "Creative not found or unavailable to your account.");
  const row = rows[0];
  const file = row.source === "drive" && /^[A-Za-z0-9_-]+$/.test(String(row.source_file_id)) ? row.source_file_id : null;
  return { ...row, previewUrl: file ? `https://drive.google.com/file/d/${file}/preview` : null, watchUrl: file ? `https://drive.google.com/file/d/${file}/view` : null };
}
async function jobStatus(product) {
  const selected = product ? keyToProduct(product) : null;
  const jobs = await db.execute(sql5`select * from strategist_jobs
    where (${product}::text is null or product_key=${product}) order by created_at desc limit 30`);
  const rows = await db.execute(sql5`
    select t.list_id,
      count(distinct t.id) filter(where t.drive_link is not null and not exists(
        select 1 from strategist_creatives c join strategist_observations o on o.creative_id=c.id where c.task_id=t.id))::int as to_watch,
      count(distinct c.id) filter(where c.id is not null and not exists(
        select 1 from strategist_research r where r.creative_id=c.id))::int as to_enrich
    from strategist_tasks t left join strategist_creatives c on c.task_id=t.id
    where t.category in ('winner','mild_winner','scale') and t.duplicate_of_task_id is null
      and (${selected?.listId ?? null}::text is null or t.list_id=${selected?.listId ?? null})
    group by t.list_id
  `);
  return { jobs, pending: rows.reduce((a, r) => ({ toWatch: a.toWatch + Number(r.to_watch), toEnrich: a.toEnrich + Number(r.to_enrich) }), { toWatch: 0, toEnrich: 0 }) };
}
async function enqueue(body, user) {
  const product = body.product || null;
  if (product && !keyToProduct(product)) throw new HttpError(400, "Unknown product.");
  if (!product && !user.isAdmin) throw new HttpError(403, "Select one of your assigned products.");
  if (!KINDS.has(body.kind) || !UUID.test(body.requestId || "")) throw new HttpError(400, "Invalid job request.");
  const rows = await db.execute(sql5`
    insert into strategist_jobs(request_id,kind,product_key,requested_by)
    values(${body.requestId}::uuid,${body.kind},${product},${user.id}::uuid)
    on conflict do nothing returning *
  `);
  if (rows.length) return rows[0];
  const [existing] = await db.execute(sql5`select * from strategist_jobs where requested_by=${user.id}::uuid and request_id=${body.requestId}::uuid`);
  if (existing) return existing;
  throw new HttpError(409, "This job is already queued or running for the product.");
}
async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const url = new URL(req.url, "http://localhost");
    const op = url.searchParams.get("op") || "snapshot";
    if (op === "config" && req.method === "GET") {
      const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!process.env.SUPABASE_URL || !anon) throw new HttpError(503, "Strategist server configuration is incomplete.");
      return res.status(200).json({ url: process.env.SUPABASE_URL, anonKey: anon });
    }
    if (!["GET", "POST"].includes(req.method)) throw new HttpError(405, "Method not allowed.");
    const user = await authenticate(req);
    const product = url.searchParams.get("product") || null;
    if (product && !keyToProduct(product)) throw new HttpError(400, "Unknown product.");
    const result = await withUser(user.id, async () => {
      if (product) {
        const [scope] = await db.execute(sql5`select public.strategist_can_read_list(${keyToProduct(product).listId}) as allowed`);
        if (!scope?.allowed) throw new HttpError(403, "This product is not assigned to your account.");
      }
      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        if (op === "jobs") return enqueue(body, user);
        if (op === "cancel") {
          if (!UUID.test(body.id || "")) throw new HttpError(400, "Invalid job ID.");
          const rows = await db.execute(sql5`update strategist_jobs set cancel_requested=true
            where id=${body.id}::uuid and status in ('queued','running') returning id`);
          if (!rows.length) throw new HttpError(404, "Active job not found.");
          return { requested: true };
        }
        throw new HttpError(404, "Unknown operation.");
      }
      if (op === "session") {
        const products = [];
        for (const p of PRODUCTS) {
          const [scope] = await db.execute(sql5`select public.strategist_can_read_list(${p.listId}) as allowed,
            (select id from products where config->>'clickup_list_id'=${p.listId} limit 1) as immuvi_id`);
          if (scope.allowed) products.push({ ...p, immuviId: scope.immuvi_id });
        }
        return { user, products };
      }
      if (op === "snapshot") return selectProduct(await projectSnapshot(), product || "all");
      if (op === "creative") return creativeDetail(url.searchParams.get("id") || "");
      if (op === "research") {
        const scope = product || "all";
        const [cards, syntheses, combos] = await Promise.all([loadResearch(scope), loadSynthesis(scope), loadCombinations(scope)]);
        return { cards, syntheses, combos };
      }
      if (op === "hooks") return loadHooks(product);
      if (op === "jobs") return jobStatus(product);
      throw new HttpError(404, "Unknown operation.");
    });
    return res.status(200).json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error.code === "42501" ? 403 : 500;
    console.error(
      "[strategist]",
      error.name,
      error.code || error.cause?.code || "",
      error instanceof HttpError ? error.message : String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, "[database]")
    );
    return res.status(status).json({ error: status === 500 ? "Strategist could not load this request. Please retry." : status === 403 && !(error instanceof HttpError) ? "You do not have access to this operation." : error.message });
  }
}
export {
  handler as default
};
