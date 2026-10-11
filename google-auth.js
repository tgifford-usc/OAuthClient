/*
 * google-auth.js — drop-in Google sign-in (OAuth 2.0) for browser web apps.
 *
 * Add it to your page with ONE script tag (before your own script):
 *     <script src="google-auth.js"></script>
 *
 * Then in your own JavaScript:
 *     GoogleAuth.init({
 *       clientId: "YOUR_CLIENT_ID.apps.googleusercontent.com",
 *       scopes: ["https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly"],
 *       onChange: (signedIn) => { ... update your page ... },
 *     });
 *
 *     signInButton.onclick = () => GoogleAuth.signIn();   // must be a click!
 *     const data = await GoogleAuth.fetchJSON("https://health.googleapis.com/v4/...");
 *
 * How it works: it uses Google Identity Services (the official Google library)
 * to open a Google pop-up, where the user logs in and agrees to share data.
 * Google gives back an ACCESS TOKEN that lasts about 1 hour. We attach that
 * token to every API request as "Authorization: Bearer <token>".
 *
 * No client secret is needed and no server is needed — this is safe to put
 * in a public GitHub repo and on Vercel. (The client ID is not a secret.)
 *
 * You should not need to edit this file.
 */
(function () {
  const GIS_SRC = "https://accounts.google.com/gsi/client";
  const STORAGE_KEY = "google-auth-token";

  let config = null;
  let tokenClient = null;
  let token = null; // { access_token, expires_at, scope }
  let pendingSignIn = null; // { resolve, reject } while the pop-up is open
  let gisReady = null;

  // ---------- helpers ----------

  function loadGoogleLibrary() {
    if (gisReady) return gisReady;
    gisReady = new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Could not load Google's sign-in library. Are you online? Is an ad-blocker blocking accounts.google.com?"));
      document.head.appendChild(script);
    });
    return gisReady;
  }

  function saveToken(t) {
    token = t;
    try {
      if (t) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(t));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* storage blocked — token just won't survive a page reload */ }
  }

  function loadSavedToken() {
    try {
      const t = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      if (t && t.expires_at > Date.now()) return t;
    } catch (e) { /* ignore */ }
    return null;
  }

  function tokenIsValid() {
    // Treat the token as expired 1 minute early, to be safe.
    return !!token && token.expires_at - 60 * 1000 > Date.now();
  }

  function notify() {
    if (config && typeof config.onChange === "function") {
      try { config.onChange(tokenIsValid()); } catch (e) { console.error(e); }
    }
  }

  function checkLocation() {
    if (location.protocol === "file:") {
      console.error(
        "[GoogleAuth] You opened this page as a file (file://). Google sign-in only works from a web server.\n" +
        "Use VS Code 'Live Server', or run `npx serve` in this folder, then open http://localhost:..."
      );
    }
  }

  // ---------- public API ----------

  /**
   * Set up sign-in. Call once when your page loads.
   * options.clientId  — your OAuth Client ID from Google Cloud Console
   * options.scopes    — array of scope URLs (what data you want to access)
   * options.onChange  — optional function(signedIn) called whenever sign-in state changes
   */
  async function init(options) {
    if (!options || !options.clientId || options.clientId.includes("YOUR_CLIENT_ID")) {
      throw new Error("GoogleAuth.init: you need to set clientId (copy it from Google Cloud Console > Clients).");
    }
    if (!Array.isArray(options.scopes) || options.scopes.length === 0) {
      throw new Error("GoogleAuth.init: you need to give at least one scope, e.g. scopes: ['https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly']");
    }
    config = options;
    checkLocation();

    // If the user already signed in earlier in this tab, reuse that token.
    const saved = loadSavedToken();
    if (saved) token = saved;
    notify();

    await loadGoogleLibrary();
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: config.scopes.join(" "),
      callback: handleTokenResponse,
      error_callback: handlePopupError,
    });
  }

  function handleTokenResponse(response) {
    const p = pendingSignIn;
    pendingSignIn = null;

    if (response.error) {
      const err = new Error(explainGoogleError(response.error, response.error_description));
      if (p) p.reject(err); else console.error(err);
      return;
    }
    // The user can un-tick scopes on the consent screen, so check they gave us everything.
    const allGranted = google.accounts.oauth2.hasGrantedAllScopes(response, ...config.scopes);
    saveToken({
      access_token: response.access_token,
      expires_at: Date.now() + Number(response.expires_in) * 1000,
      scope: response.scope,
    });
    notify();
    if (!allGranted) {
      console.warn("[GoogleAuth] The user did not tick every permission box. Some API calls may fail with 403.");
    }
    if (p) p.resolve(token.access_token);
  }

  function handlePopupError(error) {
    const p = pendingSignIn;
    pendingSignIn = null;
    const messages = {
      popup_closed: "The Google sign-in window was closed before finishing.",
      popup_failed_to_open: "The browser blocked the Google sign-in pop-up. Allow pop-ups for this site, and make sure signIn() is called from a button click.",
    };
    const err = new Error(messages[error.type] || "Google sign-in failed: " + (error.message || error.type));
    if (p) p.reject(err); else console.error(err);
  }

  function explainGoogleError(code, description) {
    const hints = {
      access_denied: "You (or Google) refused access. If the app is in 'Testing' mode, make sure your Google account is added as a Test user in Google Cloud Console > Audience.",
      invalid_client: "The clientId is wrong. Copy it again from Google Cloud Console > Clients.",
    };
    return hints[code] || "Google sign-in error: " + code + (description ? " — " + description : "");
  }

  /**
   * Open the Google sign-in pop-up. Call this from a button click
   * (browsers block pop-ups that aren't caused by a click).
   * Returns a Promise that resolves with the access token.
   */
  function signIn() {
    if (!tokenClient) {
      return Promise.reject(new Error("GoogleAuth is not ready yet. Did you call GoogleAuth.init() first (and did it finish)?"));
    }
    return new Promise((resolve, reject) => {
      pendingSignIn = { resolve, reject };
      // prompt: "" = only show the consent screen the first time.
      tokenClient.requestAccessToken({ prompt: "" });
    });
  }

  /** Forget the token and tell Google to revoke it. */
  function signOut() {
    if (token && window.google && google.accounts && google.accounts.oauth2) {
      google.accounts.oauth2.revoke(token.access_token, () => {});
    }
    saveToken(null);
    notify();
  }

  /** true if we have a token that hasn't expired. */
  function isSignedIn() {
    return tokenIsValid();
  }

  /** The raw access token string (or null). Use this if you want to call fetch() yourself. */
  function getAccessToken() {
    return tokenIsValid() ? token.access_token : null;
  }

  /**
   * Call a Google REST API and get the JSON back.
   * Works just like fetch(), but adds the Authorization header for you
   * and turns error responses into helpful error messages.
   *
   *   const data = await GoogleAuth.fetchJSON(url);
   *   const data = await GoogleAuth.fetchJSON(url, { method: "POST", body: { ... } });
   */
  async function fetchJSON(url, options = {}) {
    if (!tokenIsValid()) {
      if (token) { saveToken(null); notify(); }
      throw new Error("Not signed in (or your 1-hour sign-in expired). Click Sign in again.");
    }

    const headers = Object.assign(
      { Authorization: "Bearer " + token.access_token, Accept: "application/json" },
      options.headers || {}
    );
    let body = options.body;
    if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
      body = JSON.stringify(body);
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    const response = await fetch(url, Object.assign({}, options, { headers, body }));
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

    if (!response.ok) {
      if (response.status === 401) {
        saveToken(null);
        notify();
      }
      throw new Error(explainApiError(response.status, data));
    }
    return data;
  }

  function explainApiError(status, data) {
    const apiMessage = (data && data.error && data.error.message) || (typeof data === "string" ? data : "");
    let hint = "";
    if (status === 401) hint = "Your sign-in has expired or is invalid. Click Sign in again.";
    else if (status === 403 && /has not been used|is disabled/i.test(apiMessage)) hint = "Enable this API in Google Cloud Console > APIs & Services > Library.";
    else if (status === 403) hint = "Permission denied. Is the right scope in your scopes list? Did you tick every box when signing in?";
    else if (status === 404) hint = "Not found. Check the URL (and the data type name) is spelled correctly.";
    else if (status === 400) hint = "Bad request. Check your query parameters (e.g. the filter) are formatted correctly.";
    return "API error " + status + (hint ? ": " + hint : "") + (apiMessage ? "\nGoogle said: " + apiMessage : "");
  }

  window.GoogleAuth = { init, signIn, signOut, isSignedIn, getAccessToken, fetchJSON };
})();
