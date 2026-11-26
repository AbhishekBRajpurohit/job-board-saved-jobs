// A small job board: a JSON API and one page. Run with `npm start`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { findJob, loadJobs, searchJobs } from "./lib/jobs.js";
import { createSavedStore, savedJobs } from "./lib/saved.js";

const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY_BYTES = 10_000;

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function methodNotAllowed(res, allowed) {
  return sendJson(
    res,
    405,
    { error: `Method not allowed. Use ${allowed.join(", ")}.` },
    { allow: allowed.join(", ") },
  );
}

/** An error the person calling the API should see, with the status to send. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJsonBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

/**
 * Options let tests point the app at their own files:
 *   jobsPath  - the jobs file (default: jobs.json)
 *   savedPath - where saved jobs are kept (default: data/saved.json, or $SAVED_FILE)
 */
export function createApp({ jobsPath, savedPath = process.env.SAVED_FILE } = {}) {
  const saved = createSavedStore(savedPath);

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (url.pathname === "/api/jobs") {
        if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
        const jobs = await loadJobs(jobsPath);
        const remoteOnly = url.searchParams.get("remote") === "true";
        const sort = url.searchParams.get("sort") ?? "default";
        return sendJson(res, 200, searchJobs(jobs, url.searchParams.get("q"), { remoteOnly, sort }));
      }

      if (url.pathname === "/api/saved") {
        if (req.method === "GET") {
          const jobs = await loadJobs(jobsPath);
          return sendJson(res, 200, savedJobs(jobs, await saved.list()));
        }
        if (req.method === "POST") {
          const body = await readJsonBody(req);
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw new HttpError(400, 'Send a job id as text, like { "jobId": "j1" }');
          }
          const { jobId } = body;
          if (typeof jobId !== "string" || !jobId.trim()) {
            throw new HttpError(400, 'Send a job id as text, like { "jobId": "j1" }');
          }
          const cleanId = jobId.trim();
          const job = findJob(await loadJobs(jobsPath), cleanId);
          if (!job) throw new HttpError(404, `There is no job with id "${cleanId}"`);
          const { added } = await saved.add(job.id);
          // 201 for a new save, 200 when it was already saved. Either way there is one copy.
          return sendJson(res, added ? 201 : 200, job);
        }
        if (req.method === "DELETE") {
          await saved.clear();
          res.writeHead(204, { "cache-control": "no-store" });
          return res.end();
        }
        return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
      }

      const removeMatch = url.pathname.match(/^\/api\/saved\/([^/]+)$/);
      if (removeMatch) {
        if (req.method !== "DELETE") return methodNotAllowed(res, ["DELETE"]);
        let jobId;
        try {
          jobId = decodeURIComponent(removeMatch[1]);
        } catch {
          throw new HttpError(400, "That job id is not valid");
        }
        // Not checked against jobs.json, so a job that was later removed from the board can still be un-saved.
        const { removed } = await saved.remove(jobId);
        if (!removed) throw new HttpError(404, `Job "${jobId}" is not in your saved jobs`);
        res.writeHead(204, { "cache-control": "no-store" });
        return res.end();
      }

      if (req.method === "GET" && url.pathname === "/favicon.ico") {
        res.writeHead(204);
        return res.end();
      }

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/app.js")) {
        const file = url.pathname === "/" ? "index.html" : "app.js";
        const type = file.endsWith(".html") ? "text/html" : "text/javascript";
        const body = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
        return res.end(body);
      }
      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong" });
    }
  });
}

// Started directly (npm start), not imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(PORT, () => console.log(`Job board on http://localhost:${PORT}`));
}
