import { defaultTrackerFilters, mergeTrackerFilters } from "./state";
import type { TrackerFilters } from "./types";

export const storageKeys = {
  apiKey: "immuvi_api_key",
  activeProduct: "immuvi_active_product",
  activeTab: "immuvi_active_tab",
  fieldMaps: "immuvi_field_maps_v1",
  fieldOptions: "immuvi_field_options_v1",
  linkedDoneCache: "mxv4.linkedDoneCache.v1",
  trackerFilters(productId: string | null | undefined) {
    return `immuvi_tracker_filters_${productId || "default"}`;
  },
  taxonomyTombstone(kind: "angle" | "persona", productId: string | null | undefined) {
    return `_deletedTaxonomy_${kind}_${productId || "x"}`;
  },
  deletedClickUpIds(productId: string | null | undefined) {
    return `_deletedCuIds_${productId || "x"}`;
  },
  inspirations(productId: string) {
    return `immuvi_inspirations_${productId}`;
  }
};

export function readJsonStorage<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable or full; callers should keep in-memory state.
  }
}

export function readTrackerFilters(storage: Storage, productId: string | null | undefined): TrackerFilters {
  return mergeTrackerFilters(readJsonStorage<Partial<TrackerFilters>>(storage, storageKeys.trackerFilters(productId), defaultTrackerFilters));
}

export function writeTrackerFilters(
  storage: Storage,
  productId: string | null | undefined,
  filters: TrackerFilters
) {
  writeJsonStorage(storage, storageKeys.trackerFilters(productId), filters);
}
