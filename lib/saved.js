// Saved jobs: a small file-backed store of job ids, plus a helper that turns ids into jobs.
// Only ids are stored, so job details always come from jobs.json (one source of truth).
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findJob } from "./jobs.js";

export const DEFAULT_SAVED_PATH = new URL("../data/saved.json", import.meta.url);

/**
 * A store that keeps saved job ids (newest first) in a JSON file.
 * Every call waits for the one before it, so two requests arriving together
 * cannot overwrite each other's change.
 */
export function createSavedStore(path = DEFAULT_SAVED_PATH) {
  const file = path instanceof URL ? fileURLToPath(path) : path;
  let queue = Promise.resolve();

  function inTurn(task) {
    const result = queue.then(task);
    queue = result.catch(() => {}); // a failed call must not block the next one
    return result;
  }

  async function read() {
    let raw;
    try {
      raw = await readFile(file, "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return []; // nothing saved yet
      throw err;
    }
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
      throw new Error(`${file} should hold a JSON array of job ids`);
    }
    return ids;
  }

  async function write(ids) {
    await mkdir(dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    try {
      await writeFile(temp, `${JSON.stringify(ids, null, 2)}\n`);
      await rename(temp, file); // replace in one step, so a crash never leaves half a file
    } catch (err) {
      await unlink(temp).catch(() => {});
      throw err;
    }
  }

  return {
    /** Saved job ids, newest first. */
    list: () => inTurn(read),

    /** Save an id. Resolves to { added: false } if it was already saved. */
    add: (id) =>
      inTurn(async () => {
        const ids = await read();
        if (ids.includes(id)) return { added: false };
        await write([id, ...ids]);
        return { added: true };
      }),

    /** Remove an id. Resolves to { removed: false } if it was not saved. */
    remove: (id) =>
      inTurn(async () => {
        const ids = await read();
        if (!ids.includes(id)) return { removed: false };
        await write(ids.filter((saved) => saved !== id));
        return { removed: true };
      }),

    /** Remove all saved ids. Resolves to { cleared: count }. */
    clear: () =>
      inTurn(async () => {
        const ids = await read();
        if (ids.length === 0) return { cleared: 0 };
        await write([]);
        return { cleared: ids.length };
      }),
  };
}

/** The jobs for these ids, in the same order. Ids with no matching job are left out. */
export function savedJobs(jobs, ids) {
  return ids.map((id) => findJob(jobs, id)).filter(Boolean);
}
