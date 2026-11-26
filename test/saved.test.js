import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadJobs } from "../lib/jobs.js";
import { createSavedStore, savedJobs } from "../lib/saved.js";

async function tempFile() {
  return join(await mkdtemp(join(tmpdir(), "saved-")), "saved.json");
}

test("a new store has nothing saved, and the missing file is fine", async () => {
  const store = createSavedStore(await tempFile());
  assert.deepEqual(await store.list(), []);
});

test("add saves an id, newest first", async () => {
  const store = createSavedStore(await tempFile());
  assert.deepEqual(await store.add("j1"), { added: true });
  assert.deepEqual(await store.add("j2"), { added: true });
  assert.deepEqual(await store.list(), ["j2", "j1"]);
});

test("saving the same id twice keeps one copy", async () => {
  const store = createSavedStore(await tempFile());
  await store.add("j1");
  assert.deepEqual(await store.add("j1"), { added: false });
  assert.deepEqual(await store.list(), ["j1"]);
});

test("remove deletes an id, and says so when it was not saved", async () => {
  const store = createSavedStore(await tempFile());
  await store.add("j1");
  await store.add("j2");
  assert.deepEqual(await store.remove("j1"), { removed: true });
  assert.deepEqual(await store.list(), ["j2"]);
  assert.deepEqual(await store.remove("j1"), { removed: false });
});

test("saved ids are still there for a new store reading the same file", async () => {
  const file = await tempFile();
  await createSavedStore(file).add("j3");
  assert.deepEqual(await createSavedStore(file).list(), ["j3"]);
});

test("many saves at once all land, with no duplicates", async () => {
  const store = createSavedStore(await tempFile());
  await Promise.all(["j1", "j2", "j3", "j1", "j2", "j3"].map((id) => store.add(id)));
  assert.deepEqual((await store.list()).sort(), ["j1", "j2", "j3"]);
});

test("the file on disk is plain JSON: a list of ids", async () => {
  const file = await tempFile();
  await createSavedStore(file).add("j1");
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["j1"]);
});

test("a file that is not a list of ids gives an error, and is not overwritten", async () => {
  const file = await tempFile();
  await writeFile(file, '{"oops": true}');
  const store = createSavedStore(file);
  await assert.rejects(() => store.list(), /JSON array of job ids/);
  await assert.rejects(() => store.add("j1"), /JSON array of job ids/);
  assert.equal(await readFile(file, "utf8"), '{"oops": true}');
});

test("one failed call does not block the next", async () => {
  const file = await tempFile();
  await writeFile(file, "not json");
  const store = createSavedStore(file);
  await assert.rejects(() => store.list());
  await writeFile(file, "[]");
  assert.deepEqual(await store.add("j1"), { added: true });
});

test("savedJobs returns jobs in the saved order and skips ids that no longer exist", async () => {
  const jobs = await loadJobs();
  const result = savedJobs(jobs, ["j3", "gone", "j1"]);
  assert.deepEqual(result.map((j) => j.id), ["j3", "j1"]);
  assert.equal(result[0].company, "Tarang Media");
  assert.deepEqual(savedJobs(jobs, []), []);
});

test("clear removes all saved ids and is idempotent when empty", async () => {
  const store = createSavedStore(await tempFile());
  assert.deepEqual(await store.clear(), { cleared: 0 });
  await store.add("j1");
  await store.add("j2");
  assert.deepEqual(await store.clear(), { cleared: 2 });
  assert.deepEqual(await store.list(), []);
  assert.deepEqual(await store.clear(), { cleared: 0 });
});

test("concurrent mixed add and remove operations stay consistent", async () => {
  const store = createSavedStore(await tempFile());
  await Promise.all([
    store.add("j1"),
    store.add("j2"),
    store.remove("j1"),
    store.add("j3"),
  ]);
  assert.deepEqual(await store.list(), ["j3", "j2"]);
});
