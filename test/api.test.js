import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.js";

/** Start the app on a free port. Returns its address and a way to stop it. */
async function start(savedPath) {
  const path = savedPath ?? join(await mkdtemp(join(tmpdir(), "api-")), "saved.json");
  const server = createApp({ savedPath: path });
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    path,
    base: `http://localhost:${server.address().port}`,
    stop: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }),
  };
}

const post = (base, body, raw = false) =>
  fetch(`${base}/api/saved`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? body : JSON.stringify(body),
  });

test("GET /api/saved starts empty", async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await fetch(`${app.base}/api/saved`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test("POST /api/saved saves a job and GET lists the whole job, newest first", async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await post(app.base, { jobId: "j2" });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).company, "Kite Learning");
  await post(app.base, { jobId: "j5" });
  const list = await (await fetch(`${app.base}/api/saved`)).json();
  assert.deepEqual(list.map((j) => j.id), ["j5", "j2"]);
  assert.equal(list[1].title, "Frontend Developer Intern");
});

test("saving the same job twice keeps one copy", async (t) => {
  const app = await start();
  t.after(app.stop);
  assert.equal((await post(app.base, { jobId: "j1" })).status, 201);
  assert.equal((await post(app.base, { jobId: "j1" })).status, 200);
  const list = await (await fetch(`${app.base}/api/saved`)).json();
  assert.equal(list.length, 1);
});

test("an unknown job id gets a clear 404 and saves nothing", async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await post(app.base, { jobId: "nope" });
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /no job with id "nope"/i);
  assert.deepEqual(await (await fetch(`${app.base}/api/saved`)).json(), []);
});

test("bad requests get a 400 with a message, not a crash", async (t) => {
  const app = await start();
  t.after(app.stop);
  for (const body of [{}, { jobId: 5 }, { jobId: "" }, { jobId: "  " }, null, []]) {
    const res = await post(app.base, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok((await res.json()).error);
  }
  const broken = await post(app.base, "{not json", true);
  assert.equal(broken.status, 400);
  assert.match((await broken.json()).error, /valid JSON/);
  const empty = await post(app.base, "", true);
  assert.equal(empty.status, 400);
});

test("a very large body is refused", async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await post(app.base, JSON.stringify({ jobId: "x".repeat(50_000) }), true);
  assert.equal(res.status, 413);
});

test("DELETE /api/saved/:jobId removes the job", async (t) => {
  const app = await start();
  t.after(app.stop);
  await post(app.base, { jobId: "j1" });
  await post(app.base, { jobId: "j2" });
  const res = await fetch(`${app.base}/api/saved/j1`, { method: "DELETE" });
  assert.equal(res.status, 204);
  const list = await (await fetch(`${app.base}/api/saved`)).json();
  assert.deepEqual(list.map((j) => j.id), ["j2"]);
});

test("DELETE for a job that is not saved gets a clear 404", async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await fetch(`${app.base}/api/saved/j7`, { method: "DELETE" });
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /not in your saved jobs/);
  const bad = await fetch(`${app.base}/api/saved/%E0%A4%A`, { method: "DELETE" });
  assert.equal(bad.status, 400);
});

test("saved jobs stay saved when the server restarts", async (t) => {
  const first = await start();
  await post(first.base, { jobId: "j4" });
  await first.stop();
  const second = await start(first.path);
  t.after(second.stop);
  const list = await (await fetch(`${second.base}/api/saved`)).json();
  assert.deepEqual(list.map((j) => j.id), ["j4"]);
});

test("the existing job list and page still work", async (t) => {
  const app = await start();
  t.after(app.stop);
  const jobs = await (await fetch(`${app.base}/api/jobs?q=kosha`)).json();
  assert.deepEqual(jobs.map((j) => j.id), ["j4"]);
  const page = await fetch(`${app.base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /saved-heading/);
  const script = await fetch(`${app.base}/app.js`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /text\/javascript/);
  const icon = await fetch(`${app.base}/favicon.ico`);
  assert.equal(icon.status, 204);
});

test("DELETE /api/saved clears all saved jobs and is idempotent", async (t) => {
  const app = await start();
  t.after(app.stop);
  await post(app.base, { jobId: "j1" });
  await post(app.base, { jobId: "j2" });
  const cleared = await fetch(`${app.base}/api/saved`, { method: "DELETE" });
  assert.equal(cleared.status, 204);
  assert.deepEqual(await (await fetch(`${app.base}/api/saved`)).json(), []);
  const again = await fetch(`${app.base}/api/saved`, { method: "DELETE" });
  assert.equal(again.status, 204);
});

test("GET /api/jobs supports multi-word q, remote filter, and stipend sort", async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await fetch(`${app.base}/api/jobs?q=intern&remote=true&sort=stipend-desc`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const jobs = await res.json();
  assert.deepEqual(jobs.map((j) => j.id), ["j6", "j1", "j8", "j3"]);
});

test("POST /api/saved trims whitespace and rejects primitive JSON bodies", async (t) => {
  const app = await start();
  t.after(app.stop);
  const trimmed = await post(app.base, { jobId: " j1 " });
  assert.equal(trimmed.status, 201);
  assert.equal((await trimmed.json()).id, "j1");
  for (const body of ["j1", 123, true]) {
    const res = await post(app.base, body);
    assert.equal(res.status, 400);
  }
});

test("unsupported HTTP methods return 405 with Allow header", async (t) => {
  const app = await start();
  t.after(app.stop);
  const res1 = await fetch(`${app.base}/api/saved`, { method: "PUT" });
  assert.equal(res1.status, 405);
  assert.equal(res1.headers.get("allow"), "GET, POST, DELETE");
  const res2 = await fetch(`${app.base}/api/jobs`, { method: "POST" });
  assert.equal(res2.status, 405);
  assert.equal(res2.headers.get("allow"), "GET");
  const res3 = await fetch(`${app.base}/api/saved/j1`, { method: "GET" });
  assert.equal(res3.status, 405);
  assert.equal(res3.headers.get("allow"), "DELETE");
});

test("concurrent POST /api/saved requests do not lose saves", async (t) => {
  const app = await start();
  t.after(app.stop);
  const ids = ["j1", "j2", "j3", "j4", "j5"];
  const responses = await Promise.all(ids.map((jobId) => post(app.base, { jobId })));
  assert.ok(responses.every((r) => r.status === 201));
  const list = await (await fetch(`${app.base}/api/saved`)).json();
  assert.deepEqual(list.map((j) => j.id).sort(), ids);
});
