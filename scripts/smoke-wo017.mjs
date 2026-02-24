import assert from "node:assert/strict";
import { TelemetryHub } from "../dist/telemetry/TelemetryHub.js";

const PROFILE_VERSION = 2;
const PROFILE_BINDING_VERSION = 2;

function waitTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function countSchemaBindings(schema) {
  if (!schema || typeof schema !== "object") return 0;
  let total = 0;
  const stack = [schema];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node.bindings)) {
      total += node.bindings.length;
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }
  return total;
}

function hasBindingMetadata(profile) {
  if (!profile || typeof profile !== "object") return false;
  const tuneableCount = Array.isArray(profile.tuneables?.dataBindings)
    ? profile.tuneables.dataBindings.length
    : 0;
  return tuneableCount > 0 || countSchemaBindings(profile.sceneSchema) > 0;
}

function applyImportCompatibilityGate(profile) {
  const rawVersion = Number(profile?.version);
  let version = Number.isFinite(rawVersion) ? Math.floor(rawVersion) : 1;
  const errors = [];
  const warnings = [];

  if (version > PROFILE_VERSION && hasBindingMetadata(profile)) {
    errors.push(
      `Profile v${version} is newer than supported v${PROFILE_VERSION} and includes binding metadata.`
    );
    return { errors, warnings, version };
  }

  if (version > PROFILE_VERSION) {
    warnings.push(`Profile v${version} downgraded to v${PROFILE_VERSION}.`);
    version = PROFILE_VERSION;
  }

  if (version < PROFILE_BINDING_VERSION && hasBindingMetadata(profile)) {
    warnings.push(`Profile v${version} migrated to v${PROFILE_BINDING_VERSION}.`);
    version = PROFILE_BINDING_VERSION;
  }

  return { errors, warnings, version };
}

async function testPlaceholderToLiveTransition() {
  const hub = new TelemetryHub();
  hub.register({
    id: "placeholder-live-provider",
    fieldIds: ["smoke.field.placeholder"],
    placeholders() {
      return [
        {
          fieldId: "smoke.field.placeholder",
          value: "loading",
          status: "loading",
          source: "placeholder-live-provider",
          updatedAt: Date.now(),
        },
      ];
    },
    start(emit) {
      emit({
        fieldId: "smoke.field.placeholder",
        value: "live",
        status: "live",
        source: "placeholder-live-provider",
        updatedAt: Date.now(),
      });
    },
  });

  const beforeStart = hub.getField("smoke.field.placeholder");
  assert.equal(beforeStart?.status, "loading");

  hub.start();
  await waitTick();

  const afterStart = hub.getField("smoke.field.placeholder");
  assert.equal(afterStart?.status, "live");
  assert.equal(afterStart?.value, "live");

  const diagnostics = hub.getDiagnostics();
  assert.equal(diagnostics.fields.liveCount >= 1, true);
  assert.equal(
    diagnostics.providers.some((provider) => provider.providerId === "placeholder-live-provider"),
    true
  );
}

async function testProviderFailoverRecovery() {
  const hub = new TelemetryHub();
  let updateCount = 0;

  hub.register({
    id: "failover-provider",
    fieldIds: ["smoke.field.failover"],
    update(_dt, _t, emit) {
      updateCount += 1;
      if (updateCount === 1) {
        throw new Error("simulated provider failure");
      }
      emit({
        fieldId: "smoke.field.failover",
        value: updateCount,
        status: "live",
        source: "failover-provider",
        updatedAt: Date.now(),
      });
    },
  });

  hub.start();
  const originalError = console.error;
  const capturedErrors = [];
  console.error = (...args) => {
    capturedErrors.push(args.map((item) => String(item)).join(" "));
  };
  hub.update(0.016, 0.016);
  console.error = originalError;

  assert.equal(
    capturedErrors.some((line) =>
      line.includes('Provider update failed "failover-provider"')
    ),
    true
  );
  let diagnostics = hub.getDiagnostics();
  const errorProvider = diagnostics.providers.find((provider) => provider.providerId === "failover-provider");
  assert.equal(errorProvider?.state, "error");

  hub.update(0.016, 0.032);
  diagnostics = hub.getDiagnostics();
  const recoveredProvider = diagnostics.providers.find(
    (provider) => provider.providerId === "failover-provider"
  );
  assert.equal(recoveredProvider?.state, "live");
  assert.equal(typeof recoveredProvider?.lastError === "string", true);
}

function testProfileVersionImportGate() {
  const oldProfile = {
    version: 1,
    tuneables: { dataBindings: [] },
    sceneSchema: null,
  };
  const oldGate = applyImportCompatibilityGate(oldProfile);
  assert.equal(oldGate.errors.length, 0);
  assert.equal(oldGate.version, 1);

  const futureBindingProfile = {
    version: 9,
    tuneables: {
      dataBindings: [{ elementId: "a", target: "text", field: "x" }],
    },
    sceneSchema: null,
  };
  const futureBindingGate = applyImportCompatibilityGate(futureBindingProfile);
  assert.equal(futureBindingGate.errors.length > 0, true);

  const futureStaticProfile = {
    version: 9,
    tuneables: { dataBindings: [] },
    sceneSchema: {
      type: "root",
      children: [],
    },
  };
  const futureStaticGate = applyImportCompatibilityGate(futureStaticProfile);
  assert.equal(futureStaticGate.errors.length, 0);
  assert.equal(futureStaticGate.version, PROFILE_VERSION);
}

async function main() {
  await testPlaceholderToLiveTransition();
  await testProviderFailoverRecovery();
  testProfileVersionImportGate();
  console.log("WO-017 smoke checks passed.");
}

main().catch((err) => {
  console.error("WO-017 smoke checks failed.", err);
  process.exitCode = 1;
});
