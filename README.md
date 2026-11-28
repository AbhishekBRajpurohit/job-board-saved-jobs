Job board starter

A small job board for an insiderOne work sample. It is made up: the jobs and
companies are not real.

Run it

You need Node 20 or newer. There are no packages to install.

npm start      # then open http://localhost:3000
npm test       # runs the tests in test/


What is here

server.js: the web server and API routes (/api/jobs, /api/saved).

lib/jobs.js: reading and searching the jobs. Pure functions.

lib/saved.js: the saved-jobs store (a JSON file of job ids).

jobs.json: the jobs.

public/: the page and its script.

test/: tests, using Node's built-in test runner.

Saved jobs

What I built

Students can save jobs and come back to them after a reload or a server restart.

Page:

Every job has a Save / Saved button (aria-pressed). Clicking a saved job's button removes it.

A Saved jobs list sits beside the jobs (below them on a phone), with a Remove button on each job and Clear all.

Removing a job or clearing the list shows an Undo link in the status message.

Extras: multi-word search (like remote developer), a Remote only filter, and sorting by stipend.

API:

POST /api/saved with { "jobId": "j1" } saves a job and returns it (201 if new, 200 if already saved).

GET /api/saved lists the saved jobs with full details, newest first.

DELETE /api/saved/:jobId removes one (204). DELETE /api/saved clears all (204).

GET /api/jobs also accepts ?remote=true and ?sort=stipend-desc|stipend-asc.

Errors: an unknown job id returns 404 with There is no job with id "...". A missing or non-text jobId, or broken JSON, returns 400. A body over 10 KB returns 413. Removing a job that is not saved returns 404. A wrong method on an API route returns 405.

Persistence: saving the same job twice keeps one copy. Saved jobs are stored in data/saved.json (created on first save, ignored by git). You can set SAVED_FILE=/some/path.json to keep it somewhere else.

Tests

npm test runs 33 tests in total: 3 from the starter and 30 new ones covering the store, API routes, and search/filter logic. Each test uses a temporary directory, so running the tests never touches data/saved.json.

One decision and why

The file stores only job ids, not copies of the jobs. GET /api/saved looks the ids up in jobs.json each time, so jobs.json stays the single source of truth: if a stipend changes there, the saved list shows the new one and there is nothing to keep in sync. The cost is that a job deleted from jobs.json quietly disappears from the saved list. I think that is right, because a saved job that no longer exists is not useful. Its id stays in the file and DELETE still works on it (there is a test for this).

A smaller decision: writes go through a queue and use write-then-rename, so two quick clicks cannot overwrite each other and a crash cannot leave a half-written file.

What I would do next

Keep a separate saved list for each student. Today the list is shared by everyone using the server, which is fine for a demo but not for a real site. That needs sign-in and per-user storage.

Move from one JSON file to SQLite, since the file is rewritten in full on every change.

Add a "saved on" date and a short note for each saved job.

Add a browser test for the page itself, since today the tests only cover the API and the store.

Tools

I wrote the store, routes, frontend script, and tests myself. I used an AI coding assistant occasionally while debugging and to double-check edge cases (like invalid JSON bodies and method handling), then reviewed and tested all the changes locally in the browser and with npm test.
