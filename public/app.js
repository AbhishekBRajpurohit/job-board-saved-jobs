const jobsList = document.getElementById("jobs");
const jobsEmpty = document.getElementById("jobs-empty");
const jobsCount = document.getElementById("jobs-count");
const savedList = document.getElementById("saved");
const savedEmpty = document.getElementById("saved-empty");
const savedCount = document.getElementById("saved-count");
const savedHeading = document.getElementById("saved-heading");
const clearSavedBtn = document.getElementById("clear-saved");
const status = document.getElementById("status");
const search = document.getElementById("search");
const remoteOnly = document.getElementById("remote-only");
const sortBy = document.getElementById("sort-by");

let jobs = []; // the jobs matching the current filters
let saved = []; // the saved jobs, newest first
let latestSearch = 0; // so a slow, older search cannot overwrite a newer one

function setStatus(message, { isError = false, onUndo = null } = {}) {
  status.classList.toggle("error", isError);
  status.replaceChildren(document.createTextNode(message));
  if (onUndo) {
    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "link-btn";
    undoBtn.textContent = "Undo";
    undoBtn.addEventListener("click", () => {
      undoBtn.disabled = true;
      onUndo();
    });
    status.append(undoBtn);
  }
}

/** Call the API. Throws an Error whose message is safe to show the person. */
async function api(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error("Could not reach the server. Check that it is running.");
  }
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Something went wrong. Try again.");
  return body;
}

function jobDetails(job) {
  const box = document.createElement("div");
  const title = document.createElement("div");
  title.className = "job-title";
  title.textContent = job.title;

  const meta = document.createElement("div");
  meta.className = "job-meta";
  meta.textContent = `${job.company} · Rs ${job.stipend.toLocaleString("en-IN")}/month`;

  const badges = document.createElement("div");
  badges.className = "badges";
  const locationBadge = document.createElement("span");
  locationBadge.className = `badge${job.location.toLowerCase() === "remote" ? " remote" : ""}`;
  locationBadge.textContent = job.location;
  badges.append(locationBadge);

  box.append(title, meta, badges);
  return box;
}

function renderJobs(focusJobId = null) {
  const activeJobId =
    focusJobId ??
    (jobsList.contains(document.activeElement) ? document.activeElement?.dataset?.jobId : null);
  const savedIds = new Set(saved.map((job) => job.id));

  jobsList.replaceChildren();
  for (const job of jobs) {
    const isSaved = savedIds.has(job.id);
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.jobId = job.id;
    button.classList.toggle("saved", isSaved);
    button.setAttribute("aria-pressed", String(isSaved));
    button.textContent = isSaved ? "Saved" : "Save";
    button.title = isSaved ? "Click to remove from saved" : "Save this role";
    button.setAttribute(
      "aria-label",
      isSaved
        ? `Remove ${job.title} at ${job.company} from saved jobs`
        : `Save ${job.title} at ${job.company}`,
    );
    button.addEventListener("click", () => toggleJob(job, button));
    li.append(jobDetails(job), button);
    jobsList.append(li);
  }

  jobsCount.textContent = `${jobs.length} ${jobs.length === 1 ? "role" : "roles"}`;
  jobsEmpty.hidden = jobs.length > 0;

  if (activeJobId) {
    jobsList.querySelector(`button[data-job-id="${CSS.escape(activeJobId)}"]`)?.focus();
  }
}

function renderSaved() {
  savedList.replaceChildren();
  for (const [index, job] of saved.entries()) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "remove";
    button.dataset.index = String(index);
    button.textContent = "Remove";
    button.setAttribute("aria-label", `Remove ${job.title} at ${job.company}`);
    button.addEventListener("click", () => removeJob(job, button, index));
    li.append(jobDetails(job), button);
    savedList.append(li);
  }
  savedCount.textContent = saved.length;
  savedEmpty.hidden = saved.length > 0;
  clearSavedBtn.hidden = saved.length === 0;
}

async function loadJobs() {
  const thisSearch = ++latestSearch;
  const params = new URLSearchParams();
  if (search.value.trim()) params.set("q", search.value);
  if (remoteOnly.checked) params.set("remote", "true");
  if (sortBy.value !== "default") params.set("sort", sortBy.value);

  const query = params.toString();
  const found = await api(`/api/jobs${query ? `?${query}` : ""}`);
  if (thisSearch !== latestSearch) return;
  jobs = found;
  renderJobs();
}

async function loadSaved(focusJobId = null) {
  saved = await api("/api/saved");
  renderSaved();
  renderJobs(focusJobId);
}

async function postSave(jobId) {
  return api("/api/saved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

async function restoreJobs(jobsToRestore) {
  try {
    // Re-save oldest to newest so newest-first order matches the previous state.
    for (const job of [...jobsToRestore].reverse()) {
      await postSave(job.id);
    }
    await loadSaved();
    setStatus(
      jobsToRestore.length === 1
        ? `Restored ${jobsToRestore[0].title} at ${jobsToRestore[0].company}.`
        : `Restored ${jobsToRestore.length} saved jobs.`,
    );
  } catch (err) {
    setStatus(err.message, { isError: true });
  }
}

async function toggleJob(job, button) {
  const wasSaved = button.getAttribute("aria-pressed") === "true";
  const wasFocused = document.activeElement === button;
  button.disabled = true;
  try {
    if (wasSaved) {
      await api(`/api/saved/${encodeURIComponent(job.id)}`, { method: "DELETE" });
      await loadSaved(wasFocused ? job.id : null);
      setStatus(`Removed ${job.title} at ${job.company}.`, {
        onUndo: () => restoreJobs([job]),
      });
    } else {
      await postSave(job.id);
      await loadSaved(wasFocused ? job.id : null);
      setStatus(`Saved ${job.title} at ${job.company}.`);
    }
  } catch (err) {
    button.disabled = false;
    if (wasFocused) button.focus();
    setStatus(err.message, { isError: true });
  }
}

async function removeJob(job, button, index) {
  button.disabled = true;
  try {
    await api(`/api/saved/${encodeURIComponent(job.id)}`, { method: "DELETE" });
    await loadSaved();
    setStatus(`Removed ${job.title} at ${job.company}.`, {
      onUndo: () => restoreJobs([job]),
    });
  } catch (err) {
    setStatus(err.message, { isError: true });
    await loadSaved().catch((reloadErr) => setStatus(reloadErr.message, { isError: true }));
  }

  const nextBtn =
    savedList.querySelector(`button[data-index="${index}"]`) ??
    savedList.querySelector(`button[data-index="${Math.max(0, index - 1)}"]`);
  (nextBtn ?? savedHeading).focus();
}

async function clearAllSaved() {
  if (saved.length === 0) return;
  const previous = [...saved];
  clearSavedBtn.disabled = true;
  try {
    await api("/api/saved", { method: "DELETE" });
    await loadSaved();
    setStatus(`Cleared ${previous.length} saved ${previous.length === 1 ? "job" : "jobs"}.`, {
      onUndo: () => restoreJobs(previous),
    });
  } catch (err) {
    setStatus(err.message, { isError: true });
  } finally {
    clearSavedBtn.disabled = false;
  }
  savedHeading.focus();
}

const handleFilterChange = () => loadJobs().catch((err) => setStatus(err.message, { isError: true }));
search.addEventListener("input", handleFilterChange);
remoteOnly.addEventListener("change", handleFilterChange);
sortBy.addEventListener("change", handleFilterChange);
clearSavedBtn.addEventListener("click", clearAllSaved);

Promise.all([loadJobs(), loadSaved()])
  .catch((err) => setStatus(err.message, { isError: true }));
