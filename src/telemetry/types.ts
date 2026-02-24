export type TelemetryFieldId = string;

export type TelemetryStatus =
  | "loading"
  | "live"
  | "stale"
  | "error"
  | "unavailable";

export interface TelemetryFieldSnapshot<T = unknown> {
  fieldId: TelemetryFieldId;
  value: T;
  status: TelemetryStatus;
  source: string;
  updatedAt: number;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface TelemetrySnapshot {
  updatedAt: number;
  fields: Record<string, TelemetryFieldSnapshot>;
}

export type TelemetryProviderState =
  | "registered"
  | "idle"
  | "starting"
  | "live"
  | "error"
  | "stopped";

export interface TelemetryProviderDiagnostics {
  providerId: string;
  fieldIds: ReadonlyArray<TelemetryFieldId>;
  state: TelemetryProviderState;
  started: boolean;
  hasCleanup: boolean;
  updates: number;
  lastStartAt: number | null;
  lastStopAt: number | null;
  lastUpdateAt: number | null;
  lastErrorAt: number | null;
  lastError?: string;
}

export interface TelemetryDiagnosticsFieldSummary {
  total: number;
  liveCount: number;
  loadingCount: number;
  staleCount: number;
  errorCount: number;
  unavailableCount: number;
  byStatus: Record<TelemetryStatus, number>;
  lastUpdateAt: number | null;
}

export interface TelemetryDiagnosticsSnapshot {
  updatedAt: number;
  providerCount: number;
  providers: ReadonlyArray<TelemetryProviderDiagnostics>;
  fields: TelemetryDiagnosticsFieldSummary;
}

export type TelemetryEmit = (
  update: TelemetryFieldSnapshot | ReadonlyArray<TelemetryFieldSnapshot>
) => void;

export interface TelemetryProvider {
  id: string;
  fieldIds: ReadonlyArray<TelemetryFieldId>;
  placeholders?(): ReadonlyArray<TelemetryFieldSnapshot>;
  start?(
    emit: TelemetryEmit
  ):
    | void
    | (() => void)
    | Promise<void | (() => void)>;
  update?(
    dt: number,
    elapsedSeconds: number,
    emit: TelemetryEmit
  ): void;
  stop?(): void | Promise<void>;
}

export interface TelemetryRegistry {
  register(provider: TelemetryProvider): void;
  unregister(providerId: string): void;
  list(): TelemetryProvider[];
}

export type TelemetryListener = (
  snapshot: TelemetrySnapshot,
  changed: ReadonlyArray<TelemetryFieldSnapshot>
) => void;
