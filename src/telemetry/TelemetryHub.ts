import {
  type TelemetryEmit,
  type TelemetryFieldSnapshot,
  type TelemetryListener,
  type TelemetryProvider,
  type TelemetryRegistry,
  type TelemetrySnapshot,
} from "./types.js";

export class TelemetryHub implements TelemetryRegistry {
  private _providers = new Map<string, TelemetryProvider>();
  private _providerCleanups = new Map<string, () => void>();
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
      provider.update?.(dt, elapsedSeconds, this._emitFromProvider);
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
    try {
      const cleanup = await provider.start?.(this._emitFromProvider);
      if (typeof cleanup === "function") {
        this._providerCleanups.set(provider.id, cleanup);
      }
    } catch (err) {
      console.error(`[TelemetryHub] Failed to start provider "${provider.id}"`, err);
    }
  }

  private _stopProvider(provider: TelemetryProvider): void {
    const cleanup = this._providerCleanups.get(provider.id);
    if (cleanup) {
      try {
        cleanup();
      } catch (err) {
        console.error(
          `[TelemetryHub] Provider cleanup failed "${provider.id}"`,
          err
        );
      } finally {
        this._providerCleanups.delete(provider.id);
      }
    }

    try {
      void provider.stop?.();
    } catch (err) {
      console.error(`[TelemetryHub] Failed to stop provider "${provider.id}"`, err);
    }
  }
}

