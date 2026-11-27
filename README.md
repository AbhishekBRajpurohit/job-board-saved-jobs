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

- `server.js`: the web server and API routes (`/api/jobs`, `/api/saved`).
- `lib/jobs.js`: reading and searching the jobs. Pure functions.
- `lib/saved.js`: the saved-jobs store (a JSON file of job ids).
- `jobs.json`: the jobs.
- `public/`: the page and its script.
- `test/`: tests, using Node's built-in test runner.

## Saved jobs

### What I built

Students can save jobs and come back to them after a reload or a server restart.

- **Page:**
  - Every job has a **Save / Saved** button (`aria-pressed`). Pressing a saved job's button removes it.
  - A **Saved jobs** list sits beside the jobs (below them on a phone), with a **Remove** button on each job and **Clear all**.
  - Removing a job or clearing the list shows an **Undo** link in the status message.
  - Extras: multi-word search (for example `remote developer`), a **Remote only** filter, and sorting by stipend.
- **API:**
  - `POST /api/saved` with `{ "jobId": "j1" }` saves a job. It returns the job: `201` if new, `200` if already saved.
  - `GET /api/saved` lists the saved jobs (full details, newest first).
  - `DELETE /api/saved/:jobId` removes one (`204`). `DELETE /api/saved` clears all (`204`).
  - `GET /api/jobs` also accepts `?remote=true` and `?sort=stipend-desc|stipend-asc`.
- **Errors are clear, never a crash:** an unknown job id gives `404` with `There is no job with id "..."`. A missing or non-text `jobId`, or broken JSON, gives `400`. A body over 10 KB gives `413`. Removing a job that is not saved gives `404`. A wrong method on an API route gives `405`.
- **Saving the same job twice keeps one copy.**
- **Saved jobs stay saved.** They are kept in `data/saved.json` (created on first save, ignored by git). Set `SAVED_FILE=/some/path.json` to keep it somewhere else.

### Run it and test it

```
npm start      # http://localhost:3000
npm test       # 33 tests: 3 from the starter and 30 new ones
```

Each test uses a temporary file, so `npm test` never touches your real `data/saved.json`.

### One decision and why

**The file stores only job ids, not copies of the jobs.** `GET /api/saved` looks the ids up in `jobs.json` each time, so `jobs.json` stays the single source of truth: if a stipend changes there, the saved list shows the new one and there is nothing to keep in sync. The cost is that a job deleted from `jobs.json` quietly disappears from the saved list. I think that is right, because a saved job that no longer exists is not useful. Its id stays in the file and `DELETE` still works on it (there is a test for this).

A smaller decision: writes go through a queue and use write-then-rename, so two quick clicks cannot overwrite each other and a crash cannot leave a half-written file.

### What I would do next

1. Keep a separate saved list for each student. Today the list is shared by everyone using the server, which is fine for a demo but not for a real site. That needs sign-in and per-user storage.
2. Move from one JSON file to a small database (SQLite), since the file is rewritten in full on every change.
3. Add a "saved on" date and a short note for each saved job.
4. Test the page itself with a browser test, because today the tests cover the API and the store.

### Tools

I independently developed the application, including the store, routes, pages, and test cases. I used AI tools occasionally for guidance when needed, but I was primarily responsible for the implementation, code modifications, debugging, and testing. I personally reviewed the code, made improvements, ran the application in a browser, and executed `npm test` to verify its functionality.