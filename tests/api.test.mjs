import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "..");

async function waitForServer(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("API server did not start.");
}

test("forecast, preorder, inventory and purchase APIs work together", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "hawker-api-"));
  const port = 4399;
  const server = spawn(process.execPath, ["server/index.js"], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), DATA_FILE: path.join(temporaryDirectory, "state.json") },
    stdio: "pipe",
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/health`);

    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.storage, "local-json");

    const protectedResponse = await fetch(`http://127.0.0.1:${port}/api/bootstrap`);
    assert.equal(protectedResponse.status, 401);

    const loginResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "hawker@hawkerforecast.sg", password: "Hawker2026!" }),
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
    const hawkerHeaders = { "Content-Type": "application/json", Cookie: cookie };

    const bootstrap = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, { headers: hawkerHeaders }).then((response) => response.json());
    assert.equal(bootstrap.forecast.expectedPortions, 190);
    assert.equal(bootstrap.inventory.length, 7);

    const recalculated = await fetch(`http://127.0.0.1:${port}/api/forecast/recalculate`, {
      method: "POST",
      headers: hawkerHeaders,
      body: JSON.stringify({ weather: "rain", calendar: "normal", trend: 4 }),
    }).then((response) => response.json());
    assert.equal(recalculated.forecast.walkIns, 95);

    const preorder = await fetch(`http://127.0.0.1:${port}/api/preorders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: "API Test", sets: 2, time: "12:30 PM", marketSetId: 1 }),
    }).then((response) => response.json());
    assert.equal(preorder.order.sets, 2);
    assert.equal(preorder.forecast.preorders, 80);

    const inventory = await fetch(`http://127.0.0.1:${port}/api/inventory`, {
      method: "PUT",
      headers: hawkerHeaders,
      body: JSON.stringify({ items: [{ name: "Laksa noodles", stock: 6 }] }),
    }).then((response) => response.json());
    assert.equal(inventory.inventory.find((item) => item.name === "Laksa noodles").stock, 6);

    const confirmed = await fetch(`http://127.0.0.1:${port}/api/purchase-plan/confirm`, { method: "POST", headers: hawkerHeaders }).then((response) => response.json());
    assert.ok(confirmed.confirmedAt);

    const registration = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alex Tan", email: "alex@example.com", password: "Customer8" }),
    });
    assert.equal(registration.status, 201);

    const logout = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, { method: "POST", headers: hawkerHeaders });
    assert.equal(logout.status, 200);
  } finally {
    server.kill("SIGTERM");
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
