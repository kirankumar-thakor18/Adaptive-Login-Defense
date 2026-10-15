"use strict";

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { createServer } = require("../app");

const server = createServer();
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  const response = await post("/api/reset", {});
  assert.equal(response.status, 200);
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

async function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000)
  });
}

test("serves the local prototype with security headers", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(await response.text(), /Adaptive login defense/);
});

test("rejects invalid login input without counting it as an attempt", async () => {
  const invalidResponse = await post("/api/login", { username: " ", password: "" });
  assert.equal(invalidResponse.status, 400);
  await invalidResponse.arrayBuffer();

  const response = await post("/api/login", { username: "student", password: "fictional" });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).mode, "observe");
});

test("activates the decoy on the fifth failure and clears state on reset", async () => {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await post("/api/login", { username: "student", password: "fictional" });
    assert.equal(response.status, 401);
    await response.arrayBuffer();
  }

  const blockedResponse = await post("/api/login", { username: "student", password: "fictional" });
  assert.equal(blockedResponse.status, 429);
  assert.equal((await blockedResponse.json()).mode, "decoy");

  const decoyResponse = await fetch(`${baseUrl}/decoy`);
  assert.equal(decoyResponse.status, 200);
  assert.match(await decoyResponse.text(), /not a real sign-in page/);

  const blockedAgain = await post("/api/login", { username: "student", password: "fictional" });
  assert.equal(blockedAgain.status, 429);

  const resetResponse = await post("/api/reset", {});
  assert.equal(resetResponse.status, 200);

  const decoyAfterReset = await fetch(`${baseUrl}/decoy`, { redirect: "manual" });
  assert.equal(decoyAfterReset.status, 303);

  const loginAfterReset = await post("/api/login", { username: "student", password: "fictional" });
  assert.equal(loginAfterReset.status, 401);
});

test("rejects malformed JSON", async () => {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{"
  });
  assert.equal(response.status, 400);
});
