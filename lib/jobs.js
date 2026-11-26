// Reading and filtering the jobs. Pure functions, so they are easy to test.
import { readFile } from "node:fs/promises";

export async function loadJobs(path = new URL("../jobs.json", import.meta.url)) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

/** Jobs matching every whitespace-separated term in title, company, or location. */
export function searchJobs(jobs, query, { remoteOnly = false, sort = "default" } = {}) {
  const tokens = String(query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  let result = jobs;

  if (tokens.length > 0) {
    result = result.filter((j) => {
      const fields = [j.title, j.company, j.location].map((f) => String(f).toLowerCase());
      return tokens.every((token) => fields.some((field) => field.includes(token)));
    });
  }

  if (remoteOnly) {
    result = result.filter((j) => String(j.location).toLowerCase() === "remote");
  }

  if (sort === "stipend-desc") {
    return [...result].sort((a, b) => b.stipend - a.stipend);
  }
  if (sort === "stipend-asc") {
    return [...result].sort((a, b) => a.stipend - b.stipend);
  }

  return result;
}

export function findJob(jobs, id) {
  return jobs.find((j) => j.id === id) ?? null;
}
