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

