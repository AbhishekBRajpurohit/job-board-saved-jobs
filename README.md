# Job board starter

A small job board for an insiderOne work sample. It is made up: the jobs and
companies are not real.

## Run it

You need Node 20 or newer. There are no packages to install.

```
npm start      # then open http://localhost:3000
npm test       # runs the tests in test/
```

## What is here

- `server.js`: the web server. `GET /api/jobs?q=` lists jobs, `GET /` serves the page.
- `lib/jobs.js`: reading and searching the jobs. Pure functions.
- `jobs.json`: the jobs.
- `public/`: the page and its script.
- `test/`: tests, using Node's built-in test runner.

## Saved jobs

### What I built

Students can save jobs, manage their shortlist, and come back to it after a reload or server restart.

- **Page:**
  - Every job card has an accessible **Save / Saved** toggle button (`aria-pressed`) so you can save or unsave directly from the job list or from the **Saved jobs** panel (sticky beside the list on desktop, below on mobile).
  - Removing a job or clicking **Clear all** shows an inline **Undo** action in the status bar so accidental removals can be reversed immediately.
  - Multi-word search (e.g. `remote developer`), a **Remote only** filter, and **Stipend** sorting (`GET /api/jobs?q=&remote=true&sort=stipend-desc`) make it easy to narrow down roles.
  - Keyboard focus is preserved when toggling Save/Unsave in the main list and moves cleanly to the next item (or heading) when removing from Saved jobs.
- **API:**
  - `GET /api/jobs` supports `?q=` (multi-word match across title, company, and location), `?remote=true`, and `?sort=stipend-desc|stipend-asc`.
  - `POST /api/saved` with `{ "jobId": "j1" }` saves a job (trims surrounding whitespace). Returns the job: `201` if new, `200` if already saved.
  - `GET /api/saved` lists saved jobs with full details, newest first.
  - `DELETE /api/saved/:jobId` removes one saved job (`204`).
  - `DELETE /api/saved` clears all saved jobs (`204`, idempotent when already empty).
  - All `/api/*` responses include `Cache-Control: no-store` so the browser never shows stale saved state.
- **Clear error handling:** unknown job ids return `404` (`There is no job with id "..."`), invalid JSON or missing/non-string `jobId` returns `400`, payloads over 10 KB return `413`, removing an unsaved id returns `404`, and unsupported HTTP methods on known API routes return `405` with an `Allow` header.
- **Persistence & concurrency:** saving the same job twice keeps one copy. Saved ids are persisted in `data/saved.json` (created on first save, ignored by git; override with `SAVED_FILE=/some/path.json`). Writes go through an in-process promise queue and atomic temp-file-then-rename so concurrent requests cannot clobber each other or leave a partial file.

New and updated code: `lib/saved.js` (the store), `lib/jobs.js` (multi-token search, remote filter, stipend sort), routes in `server.js`, `public/index.html` and `public/app.js` (the UI), and `test/jobs.test.js`, `test/saved.test.js`, and `test/api.test.js`.

### Run it and test it

```
npm start      # http://localhost:3000
npm test       # 32 tests: 3 from the starter and 29 covering search, store, API, and concurrency
```

Each test uses an isolated temporary file via `mkdtemp`, so running `npm test` never touches your real `data/saved.json`.

### One decision and why

**Store only job ids in `data/saved.json`, not duplicated job objects.**  
`GET /api/saved` joins saved ids against `jobs.json` on read. `jobs.json` stays the single source of truth: if a stipend or title is updated, the saved list reflects it automatically. The trade-off is that a job removed from `jobs.json` disappears from the saved list while its id stays deletable via `DELETE /api/saved/:jobId`.

A smaller supporting choice: store mutations run through a serialized promise queue (`inTurn`) and write to a `.tmp` file before renaming, so concurrent requests never overwrite one another or leave a half-written file.

### What I would do next

1. **Per-user saved lists:** today `data/saved.json` is shared across the server instance; adding authentication and per-user storage would support multiple students concurrently.
2. **Database backing (SQLite/Postgres):** move from rewriting a JSON file per mutation to indexed database rows once traffic and user count grow.
3. **`savedAt` timestamps & notes:** record when each role was saved and let students attach short application notes or deadlines.
4. **End-to-end browser tests:** add Playwright tests to assert full DOM rendering, keyboard focus restoration, and Undo interactions in a real browser.

### Tools

I independently developed the application, including the store, routes, pages, and test cases. I used AI tools occasionally for guidance when needed, but I was primarily responsible for the implementation, code modifications, debugging, and testing. I personally reviewed the code, made improvements, ran the application in a browser, and executed `npm test` to verify its functionality.

