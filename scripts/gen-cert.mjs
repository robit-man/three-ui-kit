/**
 * gen-cert.mjs — Generate a self-signed TLS certificate for local HTTPS dev.
 *
 * Outputs:
 *   .certs/server.key   (RSA 2048 private key, PEM)
 *   .certs/server.cert  (self-signed X.509 cert, PEM)
 *
 * Validity: 365 days.  SAN includes localhost + every local IPv4 address
 * so the cert works when accessed from phones / headsets on the same LAN.
 *
 * Uses Node ≥ 15.6 crypto.generateKeyPairSync + crypto.X509Certificate
 * via the child_process openssl fallback when the high-level API is missing.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { networkInterfaces } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CERT_DIR = join(__dirname, "..", ".certs");
const KEY_PATH = join(CERT_DIR, "server.key");
const CERT_PATH = join(CERT_DIR, "server.cert");

/* ------------------------------------------------------------------ */
/*  Skip if certs already exist                                        */
/* ------------------------------------------------------------------ */

if (existsSync(KEY_PATH) && existsSync(CERT_PATH)) {
  console.log("[gen-cert] Certs already exist at .certs/ — skipping.");
  console.log(`  key:  ${KEY_PATH}`);
  console.log(`  cert: ${CERT_PATH}`);
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/*  Collect local IPs for SAN                                          */
/* ------------------------------------------------------------------ */

function getLocalIPs() {
  const ips = new Set(["127.0.0.1", "::1"]);
  const ifaces = networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === "IPv4" || iface.family === 4) {
        ips.add(iface.address);
      }
    }
  }
  return [...ips];
}

const localIPs = getLocalIPs();

console.log("[gen-cert] Generating self-signed TLS certificate…");
console.log(`  SANs: localhost, ${localIPs.join(", ")}`);

/* ------------------------------------------------------------------ */
/*  Generate via openssl CLI (most portable across Node versions)      */
/* ------------------------------------------------------------------ */

mkdirSync(CERT_DIR, { recursive: true });

// Build SAN string
const sanEntries = [
  "DNS:localhost",
  ...localIPs.map((ip) => `IP:${ip}`),
];
const sanString = sanEntries.join(",");

// OpenSSL one-liner: key + self-signed cert
const opensslCmd = [
  "openssl", "req",
  "-x509",
  "-newkey", "rsa:2048",
  "-keyout", KEY_PATH,
  "-out", CERT_PATH,
  "-days", "365",
  "-nodes",                           // no passphrase
  "-subj", `"/CN=three-ui-kit-dev"`,
  "-addext", `"subjectAltName=${sanString}"`,
].join(" ");

try {
  execSync(opensslCmd, { stdio: "pipe" });
} catch {
  // Fallback: some Windows Git-bash ships openssl in a different spot,
  // or it may need winpty. Try without -addext (older openssl).
  console.log("[gen-cert] Retrying without -addext (older openssl)…");
  const fallbackCmd = [
    "openssl", "req",
    "-x509",
    "-newkey", "rsa:2048",
    "-keyout", KEY_PATH,
    "-out", CERT_PATH,
    "-days", "365",
    "-nodes",
    "-subj", `"/CN=three-ui-kit-dev"`,
  ].join(" ");
  try {
    execSync(fallbackCmd, { stdio: "pipe" });
  } catch (e) {
    console.error("[gen-cert] openssl not found. Install OpenSSL or Git-for-Windows and retry.");
    process.exit(1);
  }
}

console.log("[gen-cert] Done.");
console.log(`  key:  ${KEY_PATH}`);
console.log(`  cert: ${CERT_PATH}`);
console.log("  (Self-signed — browsers will show a warning; accept it to proceed.)");
