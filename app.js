// ============================================================
//  Example app: sign in, then read data from the Google Health API.
//  Copy the parts you need into your own project.
// ============================================================

const HEALTH_API = "https://health.googleapis.com/v4";

const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const outputEl = document.getElementById("output");
const signInBtn = document.getElementById("sign-in");
const signOutBtn = document.getElementById("sign-out");
const appEl = document.getElementById("app");

// ---- 1. Set up sign-in -------------------------------------------------

GoogleAuth.init({
  clientId: GOOGLE_CLIENT_ID,
  scopes: GOOGLE_SCOPES,
  onChange: showSignInState, // called whenever the user signs in or out
}).catch(showError);

function showSignInState(signedIn) {
  statusEl.textContent = signedIn ? "✅ Signed in" : "Not signed in";
  signInBtn.hidden = signedIn;
  signOutBtn.hidden = !signedIn;
  appEl.hidden = !signedIn;
}

// Sign-in MUST happen inside a click handler, or the browser blocks the pop-up.
signInBtn.addEventListener("click", async () => {
  errorEl.textContent = "";
  try {
    await GoogleAuth.signIn();
  } catch (err) {
    showError(err);
  }
});

signOutBtn.addEventListener("click", () => {
  GoogleAuth.signOut();
  outputEl.hidden = true;
});

// ---- 2. Call the API ---------------------------------------------------

// Each data type is filtered by time slightly differently.
// See: https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list
function buildFilter(dataType, sinceDate) {
  const day = sinceDate.toISOString().slice(0, 10); // "2026-09-23"
  if (dataType === "exercise") return `exercise.interval.civil_start_time >= "${day}"`;
  if (dataType === "sleep") return `sleep.interval.civil_end_time >= "${day}"`;
  return `${dataType.replace(/-/g, "_")}.interval.start_time >= "${day}T00:00:00Z"`;
}

async function listDataPoints(dataType, daysBack) {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({ filter: buildFilter(dataType, since) });
  const url = `${HEALTH_API}/users/me/dataTypes/${dataType}/dataPoints?${params}`;

  // GoogleAuth.fetchJSON adds "Authorization: Bearer <token>" for you.
  return GoogleAuth.fetchJSON(url);
}

document.getElementById("load").addEventListener("click", async () => {
  errorEl.textContent = "";
  outputEl.hidden = false;
  outputEl.textContent = "Loading…";
  try {
    const dataType = document.getElementById("data-type").value;
    const days = Number(document.getElementById("days").value) || 7;
    const data = await listDataPoints(dataType, days);

    const points = data.dataPoints || [];
    outputEl.textContent =
      `${points.length} data points` + (data.nextPageToken ? " (more pages available)" : "") +
      "\n\n" + JSON.stringify(data, null, 2);
  } catch (err) {
    outputEl.hidden = true;
    showError(err);
  }
});

function showError(err) {
  console.error(err);
  errorEl.textContent = err.message;
}
