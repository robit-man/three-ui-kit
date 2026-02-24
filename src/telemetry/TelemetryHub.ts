import {
  type TelemetryDiagnosticsSnapshot,
  type TelemetryEmit,
  type TelemetryFieldSnapshot,
  type TelemetryListener,
  type TelemetryProvider,
  type TelemetryProviderDiagnostics,
  type TelemetryRegistry,
  type TelemetrySnapshot,
  type TelemetryStatus,
} from "./types.js";

interface MutableProviderDiagnostics extends TelemetryProviderDiagnostics {
  fieldIds: string[];
}

export class TelemetryHub implements TelemetryRegistry {
  private _providers = new Map<string, TelemetryProvider>();
  private _providerCleanups = new Map<string, () => void>();
  private _providerDiagnostics = new Map<string, MutableProviderDiagnostics>();
  private _providerIdsByFieldId = new Map<string, Set<string>>();
  private _fields = new Map<string, TelemetryFieldSnapshot>();
  private _listeners = new Set<TelemetryListener>();
  private _started = false;

  private _emitFromProvider: TelemetryEmit = (update) => {
    this._applyUpdates(update);
  };

  register(provider: TelemetryProvider): void {
    if (this._providers.has(provider.id)) {
      throw new Error(`[TelemetryHub] Provider "${provider.id}" already registered.`);
    }
    this._providers.set(provider.id, provider);
    this._indexProviderFields(provider);
    this._providerDiagnostics.set(
      provider.id,
      this._createProviderDiagnostics(provider)
    );
    this._setProviderState(provider.id, this._started ? "starting" : "idle");

    const placeholders = provider.placeholders?.();
    if (placeholders && placeholders.length > 0) {
      this._applyUpdates(placeholders);
    }

    if (this._started) {
      void this._startProvider(provider);
    }
  }

  unregister(providerId: string): void {
    const provider = this._providers.get(providerId);
    if (!provider) return;
    this._stopProvider(provider);
    this._providerDiagnostics.delete(providerId);
    this._unindexProviderFields(provider);
    this._providers.delete(providerId);
  }

  list(): TelemetryProvider[] {
    return Array.from(this._providers.values());
  }

  start(): void {
    if (this._started) return;
    this._started = true;
    for (const provider of this._providers.values()) {
      void this._startProvider(provider);
    }
  }

  stop(): void {
    if (!this._started) return;
    this._started = false;
    for (const provider of this._providers.values()) {
      this._stopProvider(provider);
    }
  }

  update(dt: number, elapsedSeconds: number): void {
    if (!this._started) return;
    for (const provider of this._providers.values()) {
      try {
        provider.update?.(dt, elapsedSeconds, this._emitFromProvider);
      } catch (err) {
        this._recordProviderError(provider.id, err, "update");
        console.error(`[TelemetryHub] Provider update failed "${provider.id}"`, err);
      }
    }
  }

  clear(): void {
    this._fields.clear();
  }

  subscribe(listener: TelemetryListener, emitCurrent = true): () => void {
    this._listeners.add(listener);
    if (emitCurrent) {
      listener(this.getSnapshot(), []);
    }
    return () => {
      this._listeners.delete(listener);
    };
  }

  getField(fieldId: string): TelemetryFieldSnapshot | null {
    return this._fields.get(fieldId) ?? null;
  }

  getSnapshot(): TelemetrySnapshot {
    const fields: Record<string, TelemetryFieldSnapshot> = {};
    const sorted = Array.from(this._fields.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [fieldId, snapshot] of sorted) {
      fields[fieldId] = snapshot;
    }
    return {
      updatedAt: Date.now(),
      fields,
    };
  }

  getDiagnostics(): TelemetryDiagnosticsSnapshot {
    const byStatus: Record<TelemetryStatus, number> = {
      loading: 0,
      live: 0,
      stale: 0,
      error: 0,
      unavailable: 0,
    };
    let lastUpdateAt: number | null = null;

    for (const field of this._fields.values()) {
      byStatus[field.status] += 1;
      if (Number.isFinite(field.updatedAt)) {
        lastUpdateAt =
          lastUpdateAt === null
            ? field.updatedAt
            : Math.max(lastUpdateAt, field.updatedAt);
      }
    }

    const providers = Array.from(this._providerDiagnostics.values())
      .map((diag) => ({
        providerId: diag.providerId,
        fieldIds: diag.fieldIds.slice(),
        state: diag.state,
        started: diag.started,
        hasCleanup: diag.hasCleanup,
        updates: diag.updates,
        lastStartAt: diag.lastStartAt,
        lastStopAt: diag.lastStopAt,
        lastUpdateAt: diag.lastUpdateAt,
        lastErrorAt: diag.lastErrorAt,
        lastError: diag.lastError,
      }))
      .sort((a, b) => a.providerId.localeCompare(b.providerId));

    return {
      updatedAt: Date.now(),
      providerCount: providers.length,
      providers,
      fields: {
        total: this._fields.size,
        liveCount: byStatus.live,
        loadingCount: byStatus.loading,
        staleCount: byStatus.stale,
        errorCount: byStatus.error,
        unavailableCount: byStatus.unavailable,
        byStatus,
        lastUpdateAt,
      },
    };
  }

  private _applyUpdates(
    update: TelemetryFieldSnapshot | ReadonlyArray<TelemetryFieldSnapshot>
  ): void {
    const updates = Array.isArray(update) ? update : [update];
    if (updates.length === 0) return;

    const changed: TelemetryFieldSnapshot[] = [];
    for (const next of updates) {
      const current = this._fields.get(next.fieldId);
      const normalized: TelemetryFieldSnapshot = {
        ...next,
        updatedAt: Number.isFinite(next.updatedAt) ? next.updatedAt : Date.now(),
      };

      if (current && this._isSameSnapshot(current, normalized)) {
        continue;
      }

      this._fields.set(normalized.fieldId, normalized);
      this._recordProviderFieldUpdate(normalized);
      changed.push(normalized);
    }

    if (changed.length === 0) return;
    const snapshot = this.getSnapshot();
    for (const listener of this._listeners) {
      listener(snapshot, changed);
    }
  }

  private _isSameSnapshot(
    a: TelemetryFieldSnapshot,
    b: TelemetryFieldSnapshot
  ): boolean {
    return (
      a.fieldId === b.fieldId &&
      a.status === b.status &&
      a.source === b.source &&
      a.value === b.value &&
      a.error === b.error &&
      JSON.stringify(a.meta ?? null) === JSON.stringify(b.meta ?? null)
    );
  }

  private async _startProvider(provider: TelemetryProvider): Promise<void> {
    const diag = this._providerDiagnostics.get(provider.id);
    const now = Date.now();
    if (diag) {
      diag.started = true;
      diag.state = "starting";
      diag.lastStartAt = now;
      diag.lastErrorAt = null;
      delete diag.lastError;
    }

    try {
      const cleanup = await provider.start?.(this._emitFromProvider);
      if (typeof cleanup === "function") {
        this._providerCleanups.set(provider.id, cleanup);
        if (diag) {
          diag.hasCleanup = true;
        }
      } else if (diag) {
        diag.hasCleanup = false;
      }
      if (diag && diag.state !== "error") {
        diag.state = diag.lastUpdateAt !== null ? "live" : "idle";
      }
    } catch (err) {
      this._recordProviderError(provider.id, err, "start");
      console.error(`[TelemetryHub] Failed to start provider "${provider.id}"`, err);
    }
  }

  private _stopProvider(provider: TelemetryProvider): void {
    const diag = this._providerDiagnostics.get(provider.id);
    const cleanup = this._providerCleanups.get(provider.id);
    if (cleanup) {
      try {
        cleanup();
      } catch (err) {
        this._recordProviderError(provider.id, err, "cleanup");
        console.error(
          `[TelemetryHub] Provider cleanup failed "${provider.id}"`,
          err
        );
      } finally {
        this._providerCleanups.delete(provider.id);
        if (diag) {
          diag.hasCleanup = false;
        }
      }
    }

    try {
      void provider.stop?.();
    } catch (err) {
      this._recordProviderError(provider.id, err, "stop");
      console.error(`[TelemetryHub] Failed to stop provider "${provider.id}"`, err);
    } finally {
      if (diag) {
        diag.started = false;
        diag.state = "stopped";
        diag.lastStopAt = Date.now();
      }
    }
  }

  private _createProviderDiagnostics(
    provider: TelemetryProvider
  ): MutableProviderDiagnostics {
    return {
      providerId: provider.id,
      fieldIds: Array.isArray(provider.fieldIds)
        ? provider.fieldIds.slice()
        : [],
      state: "registered",
      started: false,
      hasCleanup: false,
      updates: 0,
      lastStartAt: null,
      lastStopAt: null,
      lastUpdateAt: null,
      lastErrorAt: null,
    };
  }

  private _indexProviderFields(provider: TelemetryProvider): void {
    for (const fieldId of provider.fieldIds) {
      if (!this._providerIdsByFieldId.has(fieldId)) {
        this._providerIdsByFieldId.set(fieldId, new Set());
      }
      this._providerIdsByFieldId.get(fieldId)!.add(provider.id);
    }
  }

  private _unindexProviderFields(provider: TelemetryProvider): void {
    for (const fieldId of provider.fieldIds) {
      const providers = this._providerIdsByFieldId.get(fieldId);
      if (!providers) continue;
      providers.delete(provider.id);
      if (providers.size === 0) {
        this._providerIdsByFieldId.delete(fieldId);
      }
    }
  }

  private _setProviderState(
    providerId: string,
    nextState: MutableProviderDiagnostics["state"]
  ): void {
    const diag = this._providerDiagnostics.get(providerId);
    if (!diag) return;
    diag.state = nextState;
  }

  private _recordProviderFieldUpdate(snapshot: TelemetryFieldSnapshot): void {
    const ts = Number.isFinite(snapshot.updatedAt)
      ? snapshot.updatedAt
      : Date.now();
    const ownerIds = this._providerIdsByFieldId.get(snapshot.fieldId);

    if (ownerIds && ownerIds.size > 0) {
      for (const providerId of ownerIds) {
        this._recordProviderFieldUpdateById(providerId, ts);
      }
      return;
    }

    if (
      typeof snapshot.source === "string" &&
      this._providerDiagnostics.has(snapshot.source)
    ) {
      this._recordProviderFieldUpdateById(snapshot.source, ts);
    }
  }

  private _recordProviderFieldUpdateById(
    providerId: string,
    updatedAt: number
  ): void {
    const diag = this._providerDiagnostics.get(providerId);
    if (!diag) return;
    diag.updates += 1;
    diag.lastUpdateAt =
      diag.lastUpdateAt === null
        ? updatedAt
        : Math.max(diag.lastUpdateAt, updatedAt);
    if (diag.started) {
      diag.state = "live";
    }
  }

  private _recordProviderError(
    providerId: string,
    error: unknown,
    phase: "start" | "update" | "stop" | "cleanup"
  ): void {
    const diag = this._providerDiagnostics.get(providerId);
    if (diag) {
      diag.state = "error";
      diag.lastErrorAt = Date.now();
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : JSON.stringify(error);
      diag.lastError = `[${phase}] ${detail}`;
    }
  }
}
