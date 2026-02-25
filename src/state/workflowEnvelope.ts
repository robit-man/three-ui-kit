/**
 * Persistence envelope for workflow state.
 * Centralizes storage writes/reads behind one key with legacy migration support.
 */

import {
  coerceWorkflowState,
  createInitialWorkflowState,
  type WorkflowState,
} from "./workflowStore.js";

export const WORKFLOW_ENVELOPE_STORAGE_KEY = "workflowEnvelope.v1";
export const WORKFLOW_ENVELOPE_VERSION = 1;

export const LEGACY_STORAGE_KEYS = {
  sidebarWidth: "three-ui-kit-sidebar-width-v1",
  workflowBoundary: "three-ui-kit-workflow-boundary-v1",
  profileStore: "three-ui-kit-builder-profiles-v1",
  hydrationState: "three-ui-kit-hydration-state-v1",
  customElements: "three-ui-kit-custom-elements-v1",
} as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface WorkflowEnvelopeV1 {
  version: number;
  savedAt: number;
  state: WorkflowState;
  migration?: {
    source: "envelope" | "legacy";
    migratedAt: number;
  };
}

function parseJson(raw: string | null): unknown {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeEnvelope(
  raw: unknown,
  fallbackState: WorkflowState = createInitialWorkflowState()
): WorkflowEnvelopeV1 | null {
  if (!isObject(raw)) return null;
  const state = coerceWorkflowState(raw.state, fallbackState);
  const version = asFiniteNumber(raw.version, WORKFLOW_ENVELOPE_VERSION);
  const savedAt = asFiniteNumber(raw.savedAt, Date.now());
  const migration = isObject(raw.migration)
    ? (() => {
        const source: "envelope" | "legacy" =
          raw.migration.source === "legacy" ? "legacy" : "envelope";
        return {
          source,
          migratedAt: asFiniteNumber(raw.migration.migratedAt, savedAt),
        };
      })()
    : undefined;

  return {
    version,
    savedAt,
    state,
    migration,
  };
}

export function createWorkflowEnvelope(
  state: WorkflowState,
  migrationSource: "envelope" | "legacy" = "envelope"
): WorkflowEnvelopeV1 {
  const normalized = coerceWorkflowState(state, createInitialWorkflowState());
  return {
    version: WORKFLOW_ENVELOPE_VERSION,
    savedAt: Date.now(),
    state: normalized,
    migration: {
      source: migrationSource,
      migratedAt: Date.now(),
    },
  };
}

export function loadWorkflowEnvelopeFromStorage(
  storage: StorageLike
): WorkflowEnvelopeV1 | null {
  try {
    const parsed = parseJson(storage.getItem(WORKFLOW_ENVELOPE_STORAGE_KEY));
    return normalizeEnvelope(parsed);
  } catch {
    return null;
  }
}

export function persistWorkflowEnvelopeToStorage(
  storage: StorageLike,
  envelope: WorkflowEnvelopeV1
): boolean {
  try {
    storage.setItem(WORKFLOW_ENVELOPE_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function migrateLegacyStorageToWorkflowState(
  storage: StorageLike,
  fallbackState: WorkflowState = createInitialWorkflowState()
): WorkflowState {
  const next = coerceWorkflowState(fallbackState, createInitialWorkflowState());

  try {
    const sidebarRaw = storage.getItem(LEGACY_STORAGE_KEYS.sidebarWidth);
    if (typeof sidebarRaw === "string") {
      const width = Number(sidebarRaw);
      if (Number.isFinite(width)) {
        next.uiShell.sidebarWidth = Math.round(width);
      }
    }
  } catch {
    // Ignore read failures.
  }

  try {
    const boundaryRaw = storage.getItem(LEGACY_STORAGE_KEYS.workflowBoundary);
    if (typeof boundaryRaw === "string") {
      const boundary = boundaryRaw.trim().toLowerCase();
      if (
        boundary === "components" ||
        boundary === "assembly" ||
        boundary === "hydration" ||
        boundary === "scene" ||
        boundary === "profiles"
      ) {
        next.uiShell.activeBoundary = boundary;
      }
    }
  } catch {
    // Ignore read failures.
  }

  try {
    const parsed = parseJson(storage.getItem(LEGACY_STORAGE_KEYS.profileStore));
    if (isObject(parsed) && Array.isArray(parsed.profiles)) {
      next.domain.profileStore = parsed;
      next.profiles.profileCount = parsed.profiles.length;
      next.profiles.activeProfileId =
        typeof parsed.activeProfileId === "string" ? parsed.activeProfileId : null;
      next.profiles.version = asFiniteNumber(parsed.version, next.profiles.version);
      next.assembly.activeProfileId = next.profiles.activeProfileId;
    }
  } catch {
    // Ignore read failures.
  }

  try {
    const parsed = parseJson(storage.getItem(LEGACY_STORAGE_KEYS.hydrationState));
    if (isObject(parsed)) {
      next.domain.hydrationState = parsed;
      const drafts = isObject(parsed.draftsByProfileId) ? parsed.draftsByProfileId : {};
      const checkpoints = isObject(parsed.checkpointsByProfileId)
        ? parsed.checkpointsByProfileId
        : {};
      next.hydration.version = asFiniteNumber(parsed.version, next.hydration.version);
      next.hydration.draftCount = Object.keys(drafts).length;
      next.hydration.checkpointCount = Object.keys(checkpoints).length;
    }
  } catch {
    // Ignore read failures.
  }

  try {
    const parsed = parseJson(storage.getItem(LEGACY_STORAGE_KEYS.customElements));
    if (Array.isArray(parsed)) {
      next.domain.customCatalogEntries = parsed.slice();
      next.components.customCount = parsed.length;
    }
  } catch {
    // Ignore read failures.
  }

  return next;
}
