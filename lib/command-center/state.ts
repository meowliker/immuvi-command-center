import type { CommandCenterState, Product, TrackerFilters } from "./types";

export const defaultTrackerFilters: TrackerFilters = {
  angle: "",
  persona: "",
  format: "",
  adType: "",
  funnelStage: "",
  status: "",
  structure: "",
  hookType: "",
  productionStyle: "",
  taskType: "",
  dateRange: ""
};

export function createEmptyCommandCenterState(): CommandCenterState {
  return {
    products: [],
    activeProductId: null,
    angles: [],
    personas: [],
    creatives: [],
    production: [],
    actions: [],
    inspirations: [],
    winners: [],
    anglePersonas: {},
    matrixCellMeta: {},
    cellCreativeAssignments: {},
    fieldOptions: {
      creativeStructure: [],
      hookType: [],
      productionStyle: []
    },
    trackerFilters: { ...defaultTrackerFilters }
  };
}

export function normalizeProduct(raw: Partial<Product> & { id?: string; name?: string }): Product {
  return {
    ...raw,
    id: raw.id || "",
    name: raw.name || "Untitled Product",
    color: raw.color || "#4F46E5",
    clickupListId: raw.clickupListId ?? raw.clickup_list_id ?? null
  };
}

export function getActiveProduct(products: Product[], activeProductId: string | null) {
  if (!activeProductId) return null;
  return products.find((product) => product.id === activeProductId) || null;
}

export function chooseFallbackProductId(products: Product[], preferredProductId: string | null) {
  if (preferredProductId && products.some((product) => product.id === preferredProductId)) {
    return preferredProductId;
  }

  return products[0]?.id || null;
}

export function mergeTrackerFilters(saved: Partial<TrackerFilters> | null | undefined): TrackerFilters {
  return {
    ...defaultTrackerFilters,
    ...(saved || {})
  };
}
