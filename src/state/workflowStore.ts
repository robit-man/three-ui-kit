/**
 * Workflow state store for the tabbed builder shell.
 * Keeps domain boundaries explicit and supports reducer-driven updates.
 */

export type WorkflowBoundary =
  | "components"
  | "assembly"
  | "hydration"
  | "scene"
  | "profiles";

export const WORKFLOW_BOUNDARY_ORDER: WorkflowBoundary[] = [
  "components",
  "assembly",
  "hydration",
  "scene",
  "profiles",
];

export interface UiShellState {
  activeBoundary: WorkflowBoundary;
  sidebarWidth: number;
  compact: boolean;
  wide: boolean;
}

export interface ComponentsState {
  selectedKey: string | null;
  draftStatus: string;
  catalogCount: number;
  customCount: number;
}

export interface AssemblyState {
  cols: number;
  rows: number;
  selectedCellIndex: number | null;
  filledCellCount: number;
  activeProfileId: string | null;
  lastActionType: string | null;
}

export interface HydrationSummaryState {
  version: number;
  draftCount: number;
  checkpointCount: number;
}

export interface SceneState {
  navMode: string;
  snapOrbitToGrid: boolean;
  placementMode: string;
  activeInstanceCount: number;
}

export interface ProfilesState {
  version: number;
  activeProfileId: string | null;
  profileCount: number;
}

export interface DiagnosticsState {
  runtimeActive: boolean;
  warningCount: number;
  errorCount: number;
  lastValidationMessage: string;
}

export interface WorkflowDomainSnapshots {
  profileStore: unknown | null;
  hydrationState: unknown | null;
  customCatalogEntries: unknown[];
}

export interface WorkflowState {
  version: number;
  lastActionAt: number;
  uiShell: UiShellState;
  components: ComponentsState;
  assembly: AssemblyState;
  hydration: HydrationSummaryState;
  scene: SceneState;
  profiles: ProfilesState;
  diagnostics: DiagnosticsState;
  domain: WorkflowDomainSnapshots;
}

export interface WorkflowSnapshotPatch {
  uiShell?: Partial<UiShellState>;
  components?: Partial<ComponentsState>;
  assembly?: Partial<AssemblyState>;
  hydration?: Partial<HydrationSummaryState>;
  scene?: Partial<SceneState>;
  profiles?: Partial<ProfilesState>;
  diagnostics?: Partial<DiagnosticsState>;
  domain?: Partial<WorkflowDomainSnapshots>;
}

export type WorkflowAction =
  | { type: "uiShell/setBoundary"; boundary: WorkflowBoundary }
  | {
      type: "uiShell/setSidebarWidth";
      sidebarWidth: number;
      compact?: boolean;
      wide?: boolean;
    }
  | { type: "snapshot/merge"; payload: WorkflowSnapshotPatch }
  | { type: "state/replace"; state: WorkflowState };

export type WorkflowListener = (state: WorkflowState, action: WorkflowAction) => void;

export interface WorkflowStore {
  getState(): WorkflowState;
  dispatch(action: WorkflowAction): WorkflowState;
  subscribe(listener: WorkflowListener): () => void;
}

const DEFAULT_SIDEBAR_WIDTH = 320;

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableInt(value: unknown): number | null {
  if (!Number.isInteger(value)) return null;
  return Number(value);
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice() : [];
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function normalizeWorkflowBoundaryValue(value: unknown): WorkflowBoundary | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() as WorkflowBoundary;
  return WORKFLOW_BOUNDARY_ORDER.includes(normalized) ? normalized : null;
}

export function createInitialWorkflowState(): WorkflowState {
  return {
    version: 1,
    lastActionAt: Date.now(),
    uiShell: {
      activeBoundary: "components",
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      compact: false,
      wide: false,
    },
    components: {
      selectedKey: null,
      draftStatus: "empty",
      catalogCount: 0,
      customCount: 0,
    },
    assembly: {
      cols: 6,
      rows: 8,
      selectedCellIndex: null,
      filledCellCount: 0,
      activeProfileId: null,
      lastActionType: null,
    },
    hydration: {
      version: 1,
      draftCount: 0,
      checkpointCount: 0,
    },
    scene: {
      navMode: "orbit",
      snapOrbitToGrid: false,
      placementMode: "idle",
      activeInstanceCount: 0,
    },
    profiles: {
      version: 2,
      activeProfileId: null,
      profileCount: 0,
    },
    diagnostics: {
      runtimeActive: false,
      warningCount: 0,
      errorCount: 0,
      lastValidationMessage: "",
    },
    domain: {
      profileStore: null,
      hydrationState: null,
      customCatalogEntries: [],
    },
  };
}

export function coerceWorkflowState(
  input: unknown,
  fallback: WorkflowState = createInitialWorkflowState()
): WorkflowState {
  const raw = toObject(input);
  if (!raw) return fallback;

  const shellRaw = toObject(raw.uiShell);
  const componentsRaw = toObject(raw.components);
  const assemblyRaw = toObject(raw.assembly);
  const hydrationRaw = toObject(raw.hydration);
  const sceneRaw = toObject(raw.scene);
  const profilesRaw = toObject(raw.profiles);
  const diagnosticsRaw = toObject(raw.diagnostics);
  const domainRaw = toObject(raw.domain);

  const activeBoundary =
    normalizeWorkflowBoundaryValue(shellRaw?.activeBoundary) ??
    fallback.uiShell.activeBoundary;

  return {
    version: toFiniteNumber(raw.version, fallback.version),
    lastActionAt: toFiniteNumber(raw.lastActionAt, fallback.lastActionAt),
    uiShell: {
      activeBoundary,
      sidebarWidth: toFiniteNumber(shellRaw?.sidebarWidth, fallback.uiShell.sidebarWidth),
      compact: toBoolean(shellRaw?.compact, fallback.uiShell.compact),
      wide: toBoolean(shellRaw?.wide, fallback.uiShell.wide),
    },
    components: {
      selectedKey: toNullableString(componentsRaw?.selectedKey),
      draftStatus:
        typeof componentsRaw?.draftStatus === "string"
          ? componentsRaw.draftStatus
          : fallback.components.draftStatus,
      catalogCount: toFiniteNumber(componentsRaw?.catalogCount, fallback.components.catalogCount),
      customCount: toFiniteNumber(componentsRaw?.customCount, fallback.components.customCount),
    },
    assembly: {
      cols: toFiniteNumber(assemblyRaw?.cols, fallback.assembly.cols),
      rows: toFiniteNumber(assemblyRaw?.rows, fallback.assembly.rows),
      selectedCellIndex: toNullableInt(assemblyRaw?.selectedCellIndex),
      filledCellCount: toFiniteNumber(
        assemblyRaw?.filledCellCount,
        fallback.assembly.filledCellCount
      ),
      activeProfileId: toNullableString(assemblyRaw?.activeProfileId),
      lastActionType: toNullableString(assemblyRaw?.lastActionType),
    },
    hydration: {
      version: toFiniteNumber(hydrationRaw?.version, fallback.hydration.version),
      draftCount: toFiniteNumber(hydrationRaw?.draftCount, fallback.hydration.draftCount),
      checkpointCount: toFiniteNumber(
        hydrationRaw?.checkpointCount,
        fallback.hydration.checkpointCount
      ),
    },
    scene: {
      navMode:
        typeof sceneRaw?.navMode === "string"
          ? sceneRaw.navMode
          : fallback.scene.navMode,
      snapOrbitToGrid: toBoolean(sceneRaw?.snapOrbitToGrid, fallback.scene.snapOrbitToGrid),
      placementMode:
        typeof sceneRaw?.placementMode === "string"
          ? sceneRaw.placementMode
          : fallback.scene.placementMode,
      activeInstanceCount: toFiniteNumber(
        sceneRaw?.activeInstanceCount,
        fallback.scene.activeInstanceCount
      ),
    },
    profiles: {
      version: toFiniteNumber(profilesRaw?.version, fallback.profiles.version),
      activeProfileId: toNullableString(profilesRaw?.activeProfileId),
      profileCount: toFiniteNumber(profilesRaw?.profileCount, fallback.profiles.profileCount),
    },
    diagnostics: {
      runtimeActive: toBoolean(diagnosticsRaw?.runtimeActive, fallback.diagnostics.runtimeActive),
      warningCount: toFiniteNumber(diagnosticsRaw?.warningCount, fallback.diagnostics.warningCount),
      errorCount: toFiniteNumber(diagnosticsRaw?.errorCount, fallback.diagnostics.errorCount),
      lastValidationMessage:
        typeof diagnosticsRaw?.lastValidationMessage === "string"
          ? diagnosticsRaw.lastValidationMessage
          : fallback.diagnostics.lastValidationMessage,
    },
    domain: {
      profileStore: domainRaw?.profileStore ?? null,
      hydrationState: domainRaw?.hydrationState ?? null,
      customCatalogEntries: toArray(domainRaw?.customCatalogEntries),
    },
  };
}

export function reduceWorkflowState(
  state: WorkflowState,
  action: WorkflowAction
): WorkflowState {
  switch (action.type) {
    case "uiShell/setBoundary": {
      if (action.boundary === state.uiShell.activeBoundary) return state;
      return {
        ...state,
        lastActionAt: Date.now(),
        uiShell: {
          ...state.uiShell,
          activeBoundary: action.boundary,
        },
      };
    }
    case "uiShell/setSidebarWidth": {
      const nextWidth = toFiniteNumber(action.sidebarWidth, state.uiShell.sidebarWidth);
      const nextCompact =
        typeof action.compact === "boolean" ? action.compact : state.uiShell.compact;
      const nextWide = typeof action.wide === "boolean" ? action.wide : state.uiShell.wide;
      if (
        nextWidth === state.uiShell.sidebarWidth &&
        nextCompact === state.uiShell.compact &&
        nextWide === state.uiShell.wide
      ) {
        return state;
      }
      return {
        ...state,
        lastActionAt: Date.now(),
        uiShell: {
          ...state.uiShell,
          sidebarWidth: nextWidth,
          compact: nextCompact,
          wide: nextWide,
        },
      };
    }
    case "snapshot/merge": {
      const patch = action.payload;
      return {
        ...state,
        lastActionAt: Date.now(),
        uiShell: {
          ...state.uiShell,
          ...(patch.uiShell ?? {}),
        },
        components: {
          ...state.components,
          ...(patch.components ?? {}),
        },
        assembly: {
          ...state.assembly,
          ...(patch.assembly ?? {}),
        },
        hydration: {
          ...state.hydration,
          ...(patch.hydration ?? {}),
        },
        scene: {
          ...state.scene,
          ...(patch.scene ?? {}),
        },
        profiles: {
          ...state.profiles,
          ...(patch.profiles ?? {}),
        },
        diagnostics: {
          ...state.diagnostics,
          ...(patch.diagnostics ?? {}),
        },
        domain: {
          ...state.domain,
          ...(patch.domain ?? {}),
        },
      };
    }
    case "state/replace":
      return coerceWorkflowState(action.state, state);
    default:
      return state;
  }
}

export function createWorkflowStore(
  initialState: WorkflowState = createInitialWorkflowState()
): WorkflowStore {
  let state = coerceWorkflowState(initialState);
  const listeners = new Set<WorkflowListener>();

  return {
    getState() {
      return state;
    },
    dispatch(action: WorkflowAction) {
      const next = reduceWorkflowState(state, action);
      if (next === state) return state;
      state = next;
      for (const listener of listeners) {
        listener(state, action);
      }
      return state;
    },
    subscribe(listener: WorkflowListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

