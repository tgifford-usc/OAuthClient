// ============================================================
//  YOUR SETTINGS — edit this file.
// ============================================================

// 1. Paste your OAuth Client ID from Google Cloud Console > Google Auth Platform > Clients.
//    (It is NOT a secret. It is fine to commit it to GitHub. Do NOT put your client SECRET anywhere.)
//const GOOGLE_CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
const GOOGLE_CLIENT_ID = "846844672339-scm8fbujd4g6lni57albv3sqcdh4g2ad.apps.googleusercontent.com";

// 2. The permissions ("scopes") your app asks for. Only ask for what you need.
//    Full list: https://developers.google.com/health/scopes
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly", // steps, exercise, distance, active minutes...
  // "https://www.googleapis.com/auth/googlehealth.sleep.readonly",                      // sleep
  // "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly", // heart rate, weight...
];
