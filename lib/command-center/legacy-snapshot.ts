import { createEmptyCommandCenterState, normalizeProduct } from "./state";
import type {
  AnglePersonas,
  CellCreativeAssignments,
  CommandCenterState,
  Creative,
  FieldOptions,
  Inspiration,
  ManualAction,
  MatrixCellMetaMap,
  Product,
  ProductionItem,
  TaxonomyEntity
} from "./types";

export type LegacyRuntimeWindow = Window & {
  eval?: (code: string) => unknown;
};

type LegacyStatePayload = {
  PRODUCTS?: Product[];
  activeProductId?: string | null;
  ANGLES?: TaxonomyEntity[];
  PERSONAS?: TaxonomyEntity[];
  ADS?: Creative[];
  PROD?: ProductionItem[];
  ACTIONS?: ManualAction[];
  INSPIRATIONS?: Inspiration[];
  WINNERS?: Creative[];
  ANGLE_PERSONAS?: AnglePersonas;
  MATRIX_CELL_META?: MatrixCellMetaMap;
  CELL_CREATIVE_ASSIGNMENTS?: CellCreativeAssignments;
  FIELD_OPTIONS?: FieldOptions;
};

export type LegacyProductSnapshot = {
  activeProductId: string | null;
  products: Product[];
};

function readLegacyPayload(legacyWindow: LegacyRuntimeWindow | null): LegacyStatePayload | null {
  if (!legacyWindow?.eval) return null;

  try {
    return legacyWindow.eval(`({
      PRODUCTS: Array.isArray(PRODUCTS) ? PRODUCTS : [],
      activeProductId: typeof activeProductId !== 'undefined' ? activeProductId : null,
      ANGLES: Array.isArray(ANGLES) ? ANGLES : [],
      PERSONAS: Array.isArray(PERSONAS) ? PERSONAS : [],
      ADS: Array.isArray(ADS) ? ADS : [],
      PROD: Array.isArray(PROD) ? PROD : [],
      ACTIONS: typeof MANUAL_ACTIONS !== 'undefined' && Array.isArray(MANUAL_ACTIONS)
        ? MANUAL_ACTIONS
        : (Array.isArray(ACTIONS) ? ACTIONS : []),
      INSPIRATIONS: typeof INSPIRATIONS !== 'undefined' && Array.isArray(INSPIRATIONS) ? INSPIRATIONS : [],
      WINNERS: Array.isArray(WINNERS) ? WINNERS : [],
      ANGLE_PERSONAS: ANGLE_PERSONAS && typeof ANGLE_PERSONAS === 'object' ? ANGLE_PERSONAS : {},
      MATRIX_CELL_META: MATRIX_CELL_META && typeof MATRIX_CELL_META === 'object' ? MATRIX_CELL_META : {},
      CELL_CREATIVE_ASSIGNMENTS: CELL_CREATIVE_ASSIGNMENTS && typeof CELL_CREATIVE_ASSIGNMENTS === 'object' ? CELL_CREATIVE_ASSIGNMENTS : {},
      FIELD_OPTIONS: FIELD_OPTIONS && typeof FIELD_OPTIONS === 'object' ? FIELD_OPTIONS : {}
    })`) as LegacyStatePayload;
  } catch {
    return null;
  }
}

export function readLegacyProductSnapshot(legacyWindow: LegacyRuntimeWindow | null): LegacyProductSnapshot {
  const payload = readLegacyPayload(legacyWindow);

  return {
    activeProductId: payload?.activeProductId || null,
    products: (payload?.PRODUCTS || []).map(normalizeProduct)
  };
}

export function readLegacyCommandCenterState(legacyWindow: LegacyRuntimeWindow | null): CommandCenterState {
  const payload = readLegacyPayload(legacyWindow);
  const empty = createEmptyCommandCenterState();
  if (!payload) return empty;

  return {
    ...empty,
    products: (payload.PRODUCTS || []).map(normalizeProduct),
    activeProductId: payload.activeProductId || null,
    angles: payload.ANGLES || [],
    personas: payload.PERSONAS || [],
    creatives: payload.ADS || [],
    production: payload.PROD || [],
    actions: payload.ACTIONS || [],
    inspirations: payload.INSPIRATIONS || [],
    winners: payload.WINNERS || [],
    anglePersonas: payload.ANGLE_PERSONAS || {},
    matrixCellMeta: payload.MATRIX_CELL_META || {},
    cellCreativeAssignments: payload.CELL_CREATIVE_ASSIGNMENTS || {},
    fieldOptions: {
      creativeStructure: payload.FIELD_OPTIONS?.creativeStructure || [],
      hookType: payload.FIELD_OPTIONS?.hookType || [],
      productionStyle: payload.FIELD_OPTIONS?.productionStyle || []
    }
  };
}
