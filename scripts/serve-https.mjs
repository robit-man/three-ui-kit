/**
 * serve-https.mjs — Zero-dependency HTTPS dev server for three-ui-kit.
 *
 * Serves the project root over HTTPS on 0.0.0.0:PORT so LAN devices
 * (phones, VR headsets) can connect.  WebXR requires a secure context,
 * so this is needed for VR testing.
 *
 * Usage:
 *   node scripts/serve-https.mjs [port]
 *
 * Default port: 8443
 */

import { createServer } from "node:https";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PORT = parseInt(process.argv[2] || "8443", 10);

/* ------------------------------------------------------------------ */
/*  Load certs                                                         */
/* ------------------------------------------------------------------ */

const KEY_PATH = join(ROOT, ".certs", "server.key");
const CERT_PATH = join(ROOT, ".certs", "server.cert");

if (!existsSync(KEY_PATH) || !existsSync(CERT_PATH)) {
  console.error("[serve] Certs not found. Run  npm run gen-cert  first.");
  process.exit(1);
}

const key = readFileSync(KEY_PATH);
const cert = readFileSync(CERT_PATH);

/* ------------------------------------------------------------------ */
/*  MIME types                                                         */
/* ------------------------------------------------------------------ */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".ts":   "application/javascript; charset=utf-8",   // raw TS won't run in browser, but useful for source viewing
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".glb":  "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".map":  "application/json",
};

/* ------------------------------------------------------------------ */
/*  Request handler                                                    */
/* ------------------------------------------------------------------ */

function handler(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);

  // Default to index.html
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = join(ROOT, urlPath);

  // Security: don't escape project root
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  // Try to serve the file
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end(`Not found: ${urlPath}`);
    return;
  }

  const stat = statSync(filePath);
  if (stat.isDirectory()) {
    // Try index.html inside directory
    const indexPath = join(filePath, "index.html");
    if (existsSync(indexPath)) {
      serveFile(indexPath, res);
    } else {
      res.writeHead(404);
      res.end(`No index.html in ${urlPath}`);
    }
    return;
  }

  serveFile(filePath, res);
}

function serveFile(filePath, res) {
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  try {
    const data = readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(500);
    res.end("Internal server error");
  }
}

/* ------------------------------------------------------------------ */
/*  Start server                                                       */
/* ------------------------------------------------------------------ */

const server = createServer({ key, cert }, handler);

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  ┌──────────────────────────────────────────────┐");
  console.log("  │  three-ui-kit · HTTPS dev server running     │");
  console.log("  └──────────────────────────────────────────────┘");
  console.log("");
  console.log(`  Local:    https://localhost:${PORT}`);

  // Print LAN addresses
  const ifaces = networkInterfaces();
  for (const [name, list] of Object.entries(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if ((iface.family === "IPv4" || iface.family === 4) && !iface.internal) {
        console.log(`  Network:  https://${iface.address}:${PORT}  (${name})`);
      }
    }
  }

  console.log("");
  console.log("  Self-signed cert → accept the browser warning to proceed.");
  console.log("  WebXR requires HTTPS — this server enables VR/AR testing on LAN.");
  console.log("");
  console.log("  Press Ctrl+C to stop.");
  console.log("");
});
