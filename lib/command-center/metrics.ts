import type { CommandCenterState, Creative, Inspiration, ManualAction, TaxonomyEntity } from "./types";

export type CommandHqMetrics = {
  total: number;
  winners: number;
  testing: number;
  ready: number;
  notStarted: number;
  winRate: number;
  angles: number;
  personas: number;
};

export type CoverageItem = {
  name: string;
  count: number;
};

export type CoverageCard = {
  title: string;
  covered: number;
  total: number;
  percent: number;
  items: CoverageItem[];
};

export type StatusTone = "notstart" | "test" | "win" | "lose" | "inprog" | "ready";

export type AngleInsight = {
  id: string;
  index: number;
  name: string;
  notes: string;
  sourceLink: string;
  sourceLabel: string;
  status: string;
  tone: StatusTone;
  personas: number;
  creatives: number;
  winners: number;
  winRate: number;
};

export type AnglesSummary = {
  totalAngles: number;
  winners: number;
  testing: number;
  untested: number;
  totalCreatives: number;
  angles: AngleInsight[];
};

export type PersonaInsight = {
  id: string;
  index: number;
  name: string;
  notes: string;
  sourceLink: string;
  sourceLabel: string;
  status: string;
  tone: StatusTone;
  angles: number;
  creatives: number;
  winners: number;
  winRate: number;
};

export type PersonasSummary = {
  totalPersonas: number;
  winners: number;
  testing: number;
  untested: number;
  totalCreatives: number;
  personas: PersonaInsight[];
};

export type CreativeTrackerRow = {
  id: string;
  formatName: string;
  angle: string;
  persona: string;
  creativeStructure: string;
  hookType: string;
  productionStyle: string;
  creativeHypothesis: string;
  adLink: string;
  adLinkLabel: string;
  driveLink: string;
  adType: string;
  funnelStage: string;
  status: string;
  tone: StatusTone;
  dateCreated: string;
  variationCount: number;
  kind: "format" | "production" | "variation";
};

export type CreativeTrackerSummary = {
  total: number;
  formats: number;
  production: number;
  variations: number;
  winners: number;
  testing: number;
  rows: CreativeTrackerRow[];
};

export type MatrixCreativeChip = {
  id: string;
  name: string;
  status: string;
  tone: StatusTone;
  funnelStage: string;
  adType: string;
};

export type MatrixCellSummary = {
  angle: string;
  persona: string;
  creatives: MatrixCreativeChip[];
  isAssigned: boolean;
  isFilled: boolean;
  statusLabel: string;
  tone: StatusTone;
  total: number;
  winners: number;
  testing: number;
  ready: number;
  losers: number;
};

export type MatrixRowSummary = {
  angle: string;
  cells: MatrixCellSummary[];
  filled: number;
  total: number;
  statusLabel: string;
};

export type CreativeMatrixSummary = {
  activePersonas: string[];
  allPersonas: string[];
  rows: MatrixRowSummary[];
  totalCells: number;
  filledCells: number;
  coveragePercent: number;
  winningCells: number;
  replicateNext: number;
  testNext: number;
  killList: number;
};

export type ActionPlanRow = {
  id: string;
  title: string;
  angle: string;
  persona: string;
  funnelStage: string;
  adType: string;
  hookType: string;
  sourceLabel: string;
  sourceKind: "manual" | "matrix" | "tracker" | "variation" | "adopted";
  status: string;
  tone: StatusTone;
  dueDate: string;
  notes: string;
  clickupUrl: string;
  creativeId: string;
};

export type ActionPlanSummary = {
  total: number;
  active: number;
  complete: number;
  overdue: number;
  dueThisWeek: number;
  unlinked: number;
  rows: ActionPlanRow[];
};

export type ProductionColumn = {
  id: "queue" | "progress" | "done";
  title: string;
  subtitle: string;
  targetStatus: string;
  rows: ActionPlanRow[];
};

export type ProductionSummary = {
  total: number;
  queue: number;
  progress: number;
  done: number;
  overdue: number;
  columns: ProductionColumn[];
};

export type StrategistSignal = {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
};

export type StrategistWinner = {
  id: string;
  title: string;
  angle: string;
  persona: string;
  status: string;
  tone: StatusTone;
};

export type StrategistSummary = {
  totalCreatives: number;
  winners: number;
  testing: number;
  losers: number;
  activeInspirations: number;
  coverageGaps: string[];
  signals: StrategistSignal[];
  winnerRows: StrategistWinner[];
};

export type InspirationRow = {
  id: string;
  formatName: string;
  brand: string;
  angle: string;
  persona: string;
  creativeStructure: string;
  hookType: string;
  productionStyle: string;
  funnelStage: string;
  adType: string;
  platform: string;
  status: string;
  tone: StatusTone;
  sourceUrl: string;
  sourceLabel: string;
  briefUrl: string;
  hypothesis: string;
  notes: string;
  createdAt: string;
  usageCount: number;
  usageLabel: string;
};

export type InspirationSummary = {
  total: number;
  queued: number;
  classified: number;
  briefed: number;
  live: number;
  winners: number;
  placed: number;
  unused: number;
  rows: InspirationRow[];
};

const funnelStages = ["TOF", "MOF", "BOF"];
const statusPriority = [
  "Winner",
  "Scale",
  "Mild Winner",
  "Testing",
  "Ready to Launch",
  "In Production",
  "Approved",
  "Complete",
  "Loser",
  "Untested"
];

function normalizeStatus(status: Creative["status"]) {
  return String(status || "").trim().toLowerCase();
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return count === 1 ? singular : pluralLabel;
}

export function classifyStatus(status: string | null | undefined): { tone: StatusTone; label: string } {
  const normalized = String(status || "")
    .toLowerCase()
    .replace(/ /g, "-");
  const map: Record<string, { tone: StatusTone; label: string }> = {
    untested: { tone: "notstart", label: "Untested" },
    approved: { tone: "inprog", label: "Approved" },
    "in-production": { tone: "ready", label: "In Production" },
    "ready-to-launch": { tone: "test", label: "Ready to Launch" },
    testing: { tone: "test", label: "Testing" },
    "mild-winner": { tone: "win", label: "Mild Winner" },
    winner: { tone: "win", label: "Winner" },
    loser: { tone: "lose", label: "Loser" },
    scale: { tone: "win", label: "Scale" },
    complete: { tone: "win", label: "Complete" }
  };

  return map[normalized] || { tone: "notstart", label: status || "Untested" };
}

function getPrimaryCreativesForAngle(creatives: Creative[], angleName: string) {
  return creatives.filter((creative) => creative.angle === angleName && !creative.parentAdId);
}

function getPrimaryCreativesForPersona(creatives: Creative[], personaName: string) {
  return creatives.filter((creative) => creative.persona === personaName && !creative.parentAdId);
}

function deriveAngleStatus(angleName: string, creatives: Creative[]) {
  const statuses = getPrimaryCreativesForAngle(creatives, angleName).map((creative) => creative.status || "Untested");
  if (statuses.length === 0) return "Untested";
  return statusPriority.find((status) => statuses.includes(status)) || "Untested";
}

function derivePersonaStatus(personaName: string, creatives: Creative[]) {
  const statuses = getPrimaryCreativesForPersona(creatives, personaName).map((creative) => creative.status || "Untested");
  if (statuses.length === 0) return "Untested";
  return statusPriority.find((status) => statuses.includes(status)) || "Untested";
}

function buildSourceLabel(sourceLink: string) {
  if (!sourceLink) return "";
  const withoutProtocol = sourceLink.replace(/^https?:\/\/(www\.)?/, "");
  return withoutProtocol.length > 30 ? `${withoutProtocol.slice(0, 30)}...` : withoutProtocol;
}

function getObjectString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function formatDate(value: Creative["dateCreated"]) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(typeof value === "number" ? value : String(value));
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export function getCommandHqMetrics(state: CommandCenterState): CommandHqMetrics {
  const creatives = state.creatives || [];
  const winners = creatives.filter((creative) => {
    const status = normalizeStatus(creative.status);
    return status === "winner" || status === "mild winner" || status === "scale";
  }).length;

  return {
    total: creatives.length,
    winners,
    testing: creatives.filter((creative) => normalizeStatus(creative.status) === "testing").length,
    ready: creatives.filter((creative) => normalizeStatus(creative.status) === "ready to launch").length,
    notStarted: creatives.filter((creative) => normalizeStatus(creative.status) === "untested").length,
    winRate: creatives.length > 0 ? (winners / creatives.length) * 100 : 0,
    angles: state.angles.length,
    personas: state.personas.length
  };
}

function getFieldOptionNames(state: CommandCenterState, key: keyof CommandCenterState["fieldOptions"]) {
  return (state.fieldOptions[key] || [])
    .map((option) => option.name)
    .filter((name): name is string => Boolean(name));
}

function countByValue(creatives: Creative[], key: keyof Creative) {
  return creatives.reduce<Record<string, number>>((counts, creative) => {
    const value = String(creative[key] || "Unknown");
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function buildCoverageCard(title: string, names: string[], counts: Record<string, number>): CoverageCard {
  const items = names.map((name) => ({ name, count: counts[name] || 0 }));
  const covered = items.filter((item) => item.count > 0).length;

  return {
    title,
    covered,
    total: names.length,
    percent: names.length > 0 ? Math.round((covered / names.length) * 100) : 0,
    items
  };
}

export function getCommandHqCoverageCards(state: CommandCenterState): CoverageCard[] {
  const creatives = state.creatives || [];

  return [
    buildCoverageCard(
      "Angles",
      state.angles.map((angle) => angle.name),
      countByValue(creatives, "angle")
    ),
    buildCoverageCard(
      "Personas",
      state.personas.map((persona) => persona.name),
      countByValue(creatives, "persona")
    ),
    buildCoverageCard(
      "Creative Structure",
      getFieldOptionNames(state, "creativeStructure"),
      countByValue(creatives, "creativeStructure")
    ),
    buildCoverageCard("Hook Type", getFieldOptionNames(state, "hookType"), countByValue(creatives, "hookType")),
    buildCoverageCard(
      "Production Style",
      getFieldOptionNames(state, "productionStyle"),
      countByValue(creatives, "productionStyle")
    )
  ];
}

export function getCommandHqGaps(state: CommandCenterState): string[] {
  const creatives = state.creatives || [];
  const gaps: string[] = [];
  const angleNotStarted = state.angles.filter((angle) => normalizeStatus(angle.status) === "untested").length;

  if (angleNotStarted > 0) {
    gaps.push(`${angleNotStarted} ${plural(angleNotStarted, "angle")} not started.`);
  }

  const personaCounts = countByValue(creatives, "persona");
  const personasUntested = state.personas.filter((persona) => !personaCounts[persona.name]).length;
  if (personasUntested > 0) {
    gaps.push(`${personasUntested} ${plural(personasUntested, "persona")} untested.`);
  }

  const winnerParents = creatives.filter(
    (creative) => normalizeStatus(creative.status) === "winner" && !creative.parentAdId
  );
  const winnerCombos = Array.from(new Set(winnerParents.map((creative) => `${creative.angle || "Unknown"}||${creative.persona || "Unknown"}`)));
  const missingFunnel = winnerCombos.reduce((total, combo) => {
    const [angle, persona] = combo.split("||");
    const stages = new Set(
      creatives
        .filter((creative) => (creative.angle || "Unknown") === angle && (creative.persona || "Unknown") === persona)
        .map((creative) => creative.funnelStage)
        .filter(Boolean)
    );

    return total + funnelStages.filter((stage) => !stages.has(stage)).length;
  }, 0);

  if (missingFunnel > 0) {
    gaps.push(
      `${winnerCombos.length} winner ${plural(winnerCombos.length, "combo", "combos")} missing ${missingFunnel} funnel ${plural(
        missingFunnel,
        "stage"
      )}.`
    );
  }

  winnerParents.forEach((winner) => {
    const variationCount = creatives.filter((creative) => creative.parentAdId === winner.id).length;
    const needed = 5 - variationCount;
    if (needed > 0) {
      gaps.push(`${winner.id} needs ${needed} more ${plural(needed, "variation")}.`);
    }
  });

  const structureCounts = countByValue(creatives, "creativeStructure");
  const untestedStructures = getFieldOptionNames(state, "creativeStructure").filter((name) => !structureCounts[name]).length;
  if (untestedStructures > 0) {
    gaps.push(`${untestedStructures} creative ${plural(untestedStructures, "structure")} untested.`);
  }

  const hookCounts = countByValue(creatives, "hookType");
  const untestedHooks = getFieldOptionNames(state, "hookType").filter((name) => !hookCounts[name]).length;
  if (untestedHooks > 0) {
    gaps.push(`${untestedHooks} hook ${plural(untestedHooks, "type")} untested.`);
  }

  return gaps;
}

export function getAnglesSummary(state: CommandCenterState): AnglesSummary {
  const creatives = state.creatives || [];
  let winners = 0;
  let testing = 0;
  let untested = 0;
  let totalCreatives = 0;

  const angles = state.angles.map((angle: TaxonomyEntity, index) => {
    const primaryCreatives = getPrimaryCreativesForAngle(creatives, angle.name);
    const status = deriveAngleStatus(angle.name, creatives);
    const statusClass = classifyStatus(status);
    const winnerCount = primaryCreatives.filter((creative) => {
      const creativeStatus = normalizeStatus(creative.status);
      return creativeStatus === "winner" || creativeStatus === "mild winner";
    }).length;
    const personaCount = new Set(primaryCreatives.map((creative) => creative.persona).filter(Boolean)).size;
    const winRate = primaryCreatives.length > 0 ? Math.round((winnerCount / primaryCreatives.length) * 100) : 0;

    if (status === "Winner" || status === "Mild Winner" || status === "Scale") winners += 1;
    else if (status === "Testing") testing += 1;
    else if (status === "Untested") untested += 1;

    totalCreatives += primaryCreatives.length;

    return {
      id: angle.id || angle.name,
      index,
      name: angle.name,
      notes: angle.notes || "",
      sourceLink: angle.sourceLink || "",
      sourceLabel: buildSourceLabel(angle.sourceLink || ""),
      status,
      tone: statusClass.tone,
      personas: personaCount,
      creatives: primaryCreatives.length,
      winners: winnerCount,
      winRate
    };
  });

  return {
    totalAngles: state.angles.length,
    winners,
    testing,
    untested,
    totalCreatives,
    angles
  };
}

export function getPersonasSummary(state: CommandCenterState): PersonasSummary {
  const creatives = state.creatives || [];
  let winners = 0;
  let testing = 0;
  let untested = 0;
  let totalCreatives = 0;

  const personas = state.personas.map((persona: TaxonomyEntity, index) => {
    const primaryCreatives = getPrimaryCreativesForPersona(creatives, persona.name);
    const status = derivePersonaStatus(persona.name, creatives);
    const statusClass = classifyStatus(status);
    const winnerCount = primaryCreatives.filter((creative) => {
      const creativeStatus = normalizeStatus(creative.status);
      return creativeStatus === "winner" || creativeStatus === "mild winner";
    }).length;
    const angleCount = new Set(primaryCreatives.map((creative) => creative.angle).filter(Boolean)).size;
    const winRate = primaryCreatives.length > 0 ? Math.round((winnerCount / primaryCreatives.length) * 100) : 0;

    if (status === "Winner" || status === "Mild Winner" || status === "Scale") winners += 1;
    else if (status === "Testing") testing += 1;
    else if (status === "Untested") untested += 1;

    totalCreatives += primaryCreatives.length;

    return {
      id: persona.id || persona.name,
      index,
      name: persona.name,
      notes: persona.notes || "",
      sourceLink: persona.sourceLink || "",
      sourceLabel: buildSourceLabel(persona.sourceLink || ""),
      status,
      tone: statusClass.tone,
      angles: angleCount,
      creatives: primaryCreatives.length,
      winners: winnerCount,
      winRate
    };
  });

  return {
    totalPersonas: state.personas.length,
    winners,
    testing,
    untested,
    totalCreatives,
    personas
  };
}

export function getCreativeTrackerSummary(state: CommandCenterState): CreativeTrackerSummary {
  const creatives = state.creatives || [];
  const rows = creatives
    .filter((creative) => {
      if (creative.trackerRefId) return false;
      if (creative.parentAdId && creative.adOrigin !== "Winner Variation") return false;
      return true;
    })
    .map((creative) => {
      const statusClass = classifyStatus(creative.status);
      const kind: CreativeTrackerRow["kind"] =
        creative.adOrigin === "Winner Variation" && creative.parentAdId
          ? "variation"
          : creative.taskType === "production"
            ? "production"
            : "format";

      return {
        id: creative.id,
        formatName: creative.formatName || creative.name || creative.id,
        angle: creative.angle || "",
        persona: creative.persona || "",
        creativeStructure: creative.creativeStructure || "",
        hookType: creative.hookType || "",
        productionStyle: creative.productionStyle || "",
        creativeHypothesis: creative.creativeHypothesis || "",
        adLink: creative.adLink || "",
        adLinkLabel: buildSourceLabel(creative.adLink || ""),
        driveLink: creative.driveLink || "",
        adType: creative.adType || "",
        funnelStage: creative.funnelStage || "",
        status: creative.status || "Untested",
        tone: statusClass.tone,
        dateCreated: formatDate(creative.dateCreated),
        variationCount: creatives.filter((variation) => variation.parentAdId === creative.id).length,
        kind
      };
    });

  return {
    total: rows.length,
    formats: rows.filter((row) => row.kind === "format").length,
    production: rows.filter((row) => row.kind === "production").length,
    variations: rows.filter((row) => row.kind === "variation").length,
    winners: rows.filter((row) => {
      const status = normalizeStatus(row.status);
      return status === "winner" || status === "mild winner" || status === "scale";
    }).length,
    testing: rows.filter((row) => normalizeStatus(row.status) === "testing").length,
    rows
  };
}

function isWinnerStatus(status: Creative["status"]) {
  const normalized = normalizeStatus(status);
  return normalized === "winner" || normalized === "mild winner" || normalized === "scale";
}

function isTestingStatus(status: Creative["status"]) {
  const normalized = normalizeStatus(status);
  return normalized === "testing";
}

function isReadyStatus(status: Creative["status"]) {
  const normalized = normalizeStatus(status);
  return normalized === "ready to launch" || normalized === "in production" || normalized === "approved";
}

function getMatrixCellKey(angle: string, persona: string) {
  return `${angle}||${persona}`;
}

function buildMatrixCell(state: CommandCenterState, angle: string, persona: string): MatrixCellSummary {
  const assignedIds = state.cellCreativeAssignments[getMatrixCellKey(angle, persona)] || [];
  const creativesById = new Map((state.creatives || []).map((creative) => [creative.id, creative]));
  const directCreatives = (state.creatives || []).filter((creative) => creative.angle === angle && creative.persona === persona);
  const creativeMap = new Map<string, Creative>();

  assignedIds.forEach((id) => {
    const creative = creativesById.get(id);
    if (creative) creativeMap.set(creative.id, creative);
  });
  directCreatives.forEach((creative) => {
    if (!creative.trackerRefId) creativeMap.set(creative.id, creative);
  });

  const creatives = Array.from(creativeMap.values());
  const chips = creatives.map((creative) => {
    const status = creative.status || "Untested";
    const statusClass = classifyStatus(status);
    return {
      id: creative.id,
      name: creative.formatName || creative.name || creative.id,
      status,
      tone: statusClass.tone,
      funnelStage: creative.funnelStage || "",
      adType: creative.adType || ""
    };
  });
  const winners = creatives.filter((creative) => isWinnerStatus(creative.status)).length;
  const testing = creatives.filter((creative) => isTestingStatus(creative.status)).length;
  const ready = creatives.filter((creative) => isReadyStatus(creative.status)).length;
  const losers = creatives.filter((creative) => normalizeStatus(creative.status) === "loser").length;
  const tone: StatusTone = winners > 0 ? "win" : ready > 0 ? "ready" : testing > 0 ? "test" : losers > 0 ? "lose" : "notstart";
  const statusLabel =
    winners > 0 ? "Winner" : ready > 0 ? "Ready" : testing > 0 ? "Testing" : losers > 0 ? "Loser" : "Untested";

  return {
    angle,
    persona,
    creatives: chips,
    isAssigned: assignedIds.length > 0 || Boolean(state.anglePersonas[angle]?.includes(persona)),
    isFilled: creatives.length > 0,
    statusLabel,
    tone,
    total: creatives.length,
    winners,
    testing,
    ready,
    losers
  };
}

export function getCreativeMatrixSummary(state: CommandCenterState): CreativeMatrixSummary {
  const allPersonas = Array.from(
    new Set([
      ...state.personas.map((persona) => persona.name).filter(Boolean),
      ...Object.values(state.anglePersonas).flat().filter(Boolean)
    ])
  );
  const activePersonas = allPersonas.filter((persona) => {
    if (state.creatives.some((creative) => creative.persona === persona)) return true;
    return Object.values(state.anglePersonas).some((personas) => personas.includes(persona));
  });
  const visiblePersonas = activePersonas.length > 0 ? activePersonas : allPersonas;
  const rows = state.angles.map((angle) => {
    const cells = visiblePersonas.map((persona) => buildMatrixCell(state, angle.name, persona));
    const filled = cells.filter((cell) => cell.isFilled).length;
    const bestStatus = cells.some((cell) => cell.winners > 0)
      ? "Winner"
      : cells.some((cell) => cell.testing > 0 || cell.ready > 0)
        ? "Testing"
        : "Untested";

    return {
      angle: angle.name,
      cells,
      filled,
      total: cells.length,
      statusLabel: bestStatus
    };
  });
  const cells = rows.flatMap((row) => row.cells);
  const filledCells = cells.filter((cell) => cell.isFilled).length;
  const winningAngles = new Set(cells.filter((cell) => cell.winners > 0).map((cell) => cell.angle));
  const winningPersonas = new Set(cells.filter((cell) => cell.winners > 0).map((cell) => cell.persona));
  const testNext = cells.filter(
    (cell) => !cell.isFilled && (winningAngles.has(cell.angle) || winningPersonas.has(cell.persona))
  ).length;

  return {
    activePersonas,
    allPersonas,
    rows,
    totalCells: cells.length,
    filledCells,
    coveragePercent: cells.length > 0 ? Math.round((filledCells / cells.length) * 100) : 0,
    winningCells: cells.filter((cell) => cell.winners > 0).length,
    replicateNext: cells.filter((cell) => cell.winners > 0 && cell.total < 3).length,
    testNext,
    killList: cells.filter((cell) => cell.losers >= 2 && cell.winners === 0).length
  };
}

function findCreativeForAction(state: CommandCenterState, action: ManualAction) {
  const lookupId = action.sourceAdId || action.adId;
  if (lookupId) {
    const byId = state.creatives.find((creative) => creative.id === lookupId);
    if (byId) return byId;
  }

  if (action._clickupId) {
    const byClickup = state.creatives.find(
      (creative) => creative._clickupId === action._clickupId || creative.clickupTaskId === action._clickupId
    );
    if (byClickup) return byClickup;
  }

  const title = String(action.title || "").trim().toLowerCase();
  if (!title) return null;
  return (
    state.creatives.find((creative) => String(creative.formatName || creative.name || "").trim().toLowerCase() === title) || null
  );
}

function actionSourceKind(action: ManualAction, creative: Creative | null): ActionPlanRow["sourceKind"] {
  if (String(action.id || "").startsWith("va:") || action._origin === "auto-adopted") return "adopted";
  if (creative?.parentAdId) return "variation";
  if (creative?.sourceFormatId) return "tracker";
  if (action.sourceAngle || action.sourcePersona) return "matrix";
  return "manual";
}

function sourceLabel(kind: ActionPlanRow["sourceKind"], action: ManualAction, creative: Creative | null) {
  if (kind === "adopted") return "From ClickUp";
  if (kind === "variation") return creative?.parentTaskName || creative?.parentAdId || "Variation";
  if (kind === "tracker") return creative?.sourceFormatId || "Creative Tracker";
  if (kind === "matrix") return `${action.sourceAngle || creative?.angle || "Matrix"} x ${action.sourcePersona || creative?.persona || "Persona"}`;
  return "Manual";
}

function formatIsoDate(value: unknown) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isOverdue(dueDate: string, status: string) {
  if (!dueDate || normalizeStatus(status) === "complete") return false;
  const due = Date.parse(`${dueDate}T23:59:59`);
  return Number.isFinite(due) && due < Date.now();
}

function isDueThisWeek(dueDate: string) {
  if (!dueDate) return false;
  const due = Date.parse(`${dueDate}T23:59:59`);
  if (!Number.isFinite(due)) return false;
  const now = new Date();
  const day = now.getDay() || 7;
  const start = new Date(now);
  start.setDate(now.getDate() - (day - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return due >= start.getTime() && due <= end.getTime();
}

export function getActionPlanSummary(state: CommandCenterState): ActionPlanSummary {
  const rows = (state.actions || []).map((action) => {
    const creative = findCreativeForAction(state, action);
    const status = creative?.status || action.liveStatus || action.status || "Untested";
    const statusClass = classifyStatus(status);
    const sourceKind = actionSourceKind(action, creative);
    const clickupId = action._clickupId || creative?._clickupId || creative?.clickupTaskId || "";

    return {
      id: action.id,
      title: creative?.formatName || creative?.name || action.title || action.id,
      angle: creative?.angle || action.angle || action.sourceAngle || "",
      persona: creative?.persona || action.persona || action.sourcePersona || "",
      funnelStage: creative?.funnelStage || action.funnelStage || "",
      adType: creative?.adType || action.format || "",
      hookType: creative?.hookType || "",
      sourceLabel: sourceLabel(sourceKind, action, creative),
      sourceKind,
      status,
      tone: statusClass.tone,
      dueDate: formatIsoDate(action.dueDate || creative?.dueDate),
      notes: creative?.creativeHypothesis || creative?.notes || action.description || "",
      clickupUrl: action._clickupUrl || creative?._clickupUrl || (clickupId ? `https://app.clickup.com/t/${clickupId}` : ""),
      creativeId: creative?.id || action.sourceAdId || action.adId || ""
    };
  });

  return {
    total: rows.length,
    active: rows.filter((row) => normalizeStatus(row.status) !== "complete").length,
    complete: rows.filter((row) => normalizeStatus(row.status) === "complete").length,
    overdue: rows.filter((row) => isOverdue(row.dueDate, row.status)).length,
    dueThisWeek: rows.filter((row) => isDueThisWeek(row.dueDate)).length,
    unlinked: rows.filter((row) => !row.clickupUrl).length,
    rows
  };
}

function productionColumnForStatus(status: string): ProductionColumn["id"] {
  const normalized = normalizeStatus(status);
  if (normalized === "winner" || normalized === "scale" || normalized === "complete" || normalized === "loser") {
    return "done";
  }
  if (normalized === "in production" || normalized === "ready to launch" || normalized === "testing") {
    return "progress";
  }
  return "queue";
}

export function getProductionSummary(state: CommandCenterState): ProductionSummary {
  const actionSummary = getActionPlanSummary(state);
  const queue = actionSummary.rows.filter((row) => productionColumnForStatus(row.status) === "queue");
  const progress = actionSummary.rows.filter((row) => productionColumnForStatus(row.status) === "progress");
  const done = actionSummary.rows.filter((row) => productionColumnForStatus(row.status) === "done");
  const columns: ProductionColumn[] = [
    {
      id: "queue",
      title: "In Queue",
      subtitle: "Untested / Approved",
      targetStatus: "Untested",
      rows: queue
    },
    {
      id: "progress",
      title: "In Production",
      subtitle: "In Production / Ready to Launch / Testing",
      targetStatus: "In Production",
      rows: progress
    },
    {
      id: "done",
      title: "Done",
      subtitle: "Winner / Scale / Complete / Loser",
      targetStatus: "Complete",
      rows: done
    }
  ];

  return {
    total: actionSummary.rows.length,
    queue: queue.length,
    progress: progress.length,
    done: done.length,
    overdue: actionSummary.overdue,
    columns
  };
}

function getInspirationTitle(inspiration: Inspiration) {
  const fromUsp = String(inspiration.creativeUSP || "").split(" — ")[0]?.trim();
  return inspiration.formatName || fromUsp || inspiration.brand || inspiration.id;
}

function inspirationTone(status: string): StatusTone {
  const normalized = normalizeStatus(status);
  if (normalized === "winner" || normalized === "live") return "win";
  if (normalized === "loser") return "lose";
  if (normalized === "briefed" || normalized === "classified") return "ready";
  if (normalized === "queued" || normalized === "saved") return "inprog";
  return "notstart";
}

function getCreativesForInspiration(state: CommandCenterState, inspirationId: string) {
  return (state.creatives || []).filter((creative) => {
    const record = creative as Record<string, unknown>;
    return record._fromInspoId === inspirationId || record._sourceInsId === inspirationId;
  });
}

function getUsageLabel(creatives: Creative[]) {
  if (creatives.length === 0) return "Unused";
  const winners = creatives.filter((creative) => isWinnerStatus(creative.status)).length;
  const losers = creatives.filter((creative) => normalizeStatus(creative.status) === "loser").length;
  const testing = creatives.filter((creative) => isTestingStatus(creative.status) || isReadyStatus(creative.status)).length;
  if (winners > 0 && losers > 0) return "Mixed";
  if (winners > 0) return "Has winner";
  if (losers > 0) return "Has loser";
  if (testing > 0) return "Testing";
  return "Placed";
}

export function getInspirationSummary(state: CommandCenterState): InspirationSummary {
  const rows = (state.inspirations || []).map((inspiration) => {
    const status = inspiration.status || "Saved";
    const sourceUrl = inspiration.sourceUrl || "";
    const usageCreatives = getCreativesForInspiration(state, inspiration.id);
    const record = inspiration as Record<string, unknown>;
    const briefUrl = getObjectString(record, ["_clickupDocPageUrl", "briefUrl", "driveLink"]);
    const createdAt = inspiration.classifiedAt || inspiration.created_at || inspiration.queuedAt || inspiration.addedAt;

    return {
      id: inspiration.id,
      formatName: getInspirationTitle(inspiration),
      brand: inspiration.brand || "",
      angle: inspiration.angle || "",
      persona: inspiration.persona || "",
      creativeStructure: inspiration.creativeStructure || "",
      hookType: inspiration.hookType || "",
      productionStyle: inspiration.productionStyle || "",
      funnelStage: inspiration.funnelStage || "",
      adType: inspiration.adType || "",
      platform: inspiration.platform || "Other",
      status,
      tone: inspirationTone(status),
      sourceUrl,
      sourceLabel: buildSourceLabel(sourceUrl),
      briefUrl,
      hypothesis: inspiration.creativeHypothesis || "",
      notes: inspiration.notes || inspiration.bodyCopy || "",
      createdAt: formatDateTime(createdAt),
      usageCount: usageCreatives.length,
      usageLabel: getUsageLabel(usageCreatives)
    };
  });

  return {
    total: rows.length,
    queued: rows.filter((row) => normalizeStatus(row.status) === "queued").length,
    classified: rows.filter((row) => normalizeStatus(row.status) === "classified").length,
    briefed: rows.filter((row) => normalizeStatus(row.status) === "briefed").length,
    live: rows.filter((row) => normalizeStatus(row.status) === "live").length,
    winners: rows.filter((row) => normalizeStatus(row.status) === "winner").length,
    placed: rows.filter((row) => row.usageCount > 0).length,
    unused: rows.filter((row) => row.usageCount === 0).length,
    rows
  };
}

function countWinnerValues(creatives: Creative[], key: keyof Creative) {
  const counts = countByValue(
    creatives.filter((creative) => isWinnerStatus(creative.status)),
    key
  );
  return Object.entries(counts)
    .filter(([name]) => name !== "Unknown")
    .sort((a, b) => b[1] - a[1]);
}

export function getStrategistSummary(state: CommandCenterState): StrategistSummary {
  const creatives = state.creatives || [];
  const winners = creatives.filter((creative) => isWinnerStatus(creative.status));
  const testing = creatives.filter((creative) => isTestingStatus(creative.status));
  const losers = creatives.filter((creative) => normalizeStatus(creative.status) === "loser");
  const inspirationSummary = getInspirationSummary(state);
  const topAngles = countWinnerValues(creatives, "angle");
  const topProductionStyles = countWinnerValues(creatives, "productionStyle");
  const coverageGaps = getCommandHqGaps(state).slice(0, 8);

  const signals: StrategistSignal[] = [
    {
      label: "Winning Angles",
      value: topAngles.length ? topAngles[0][0] : "No winner yet",
      detail: topAngles.length ? `${topAngles[0][1]} winning creative${topAngles[0][1] === 1 ? "" : "s"}` : "Waiting for winner data",
      tone: topAngles.length ? "win" : "notstart"
    },
    {
      label: "Production Playbook",
      value: topProductionStyles.length ? topProductionStyles[0][0] : "No pattern yet",
      detail: topProductionStyles.length
        ? `${topProductionStyles[0][1]} winner${topProductionStyles[0][1] === 1 ? "" : "s"} use this style`
        : "Launch more tests to identify a style",
      tone: topProductionStyles.length ? "ready" : "notstart"
    },
    {
      label: "Testing Pressure",
      value: String(testing.length),
      detail: `${losers.length} loser${losers.length === 1 ? "" : "s"} and ${coverageGaps.length} open gap${coverageGaps.length === 1 ? "" : "s"}`,
      tone: testing.length > 0 ? "test" : "notstart"
    },
    {
      label: "Inspiration Fuel",
      value: String(inspirationSummary.unused),
      detail: `${inspirationSummary.placed} placed from ${inspirationSummary.total} inspiration${inspirationSummary.total === 1 ? "" : "s"}`,
      tone: inspirationSummary.unused > 0 ? "inprog" : "win"
    }
  ];

  return {
    totalCreatives: creatives.length,
    winners: winners.length,
    testing: testing.length,
    losers: losers.length,
    activeInspirations: inspirationSummary.total,
    coverageGaps,
    signals,
    winnerRows: winners.slice(0, 8).map((creative) => {
      const status = creative.status || "Winner";
      const statusClass = classifyStatus(status);
      return {
        id: creative.id,
        title: creative.formatName || creative.name || creative.id,
        angle: creative.angle || "",
        persona: creative.persona || "",
        status,
        tone: statusClass.tone
      };
    })
  };
}
