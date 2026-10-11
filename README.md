# Google Sign-In Starter (OAuth for your web app)

This starter lets people **sign in with Google** on your web app, so your app can read their data from a Google API such as the **Google Health API**.


- One JavaScript file to add to your project: `google-auth.js`
- No server and no client secret needed
- Deploys to Vercel as a normal static site

```
google-auth.js   ← the sign-in library (don't edit)
config.js        ← YOUR client ID and scopes (edit this)
app.js           ← example: sign in + load exercise/steps data
index.html       ← example page
```
---

## Step 0 - Setting up an OAuth client
This README assumes that you are already familiar with setting up an OAuth Client using the Google Cloud Console.  If you are not, then follow this tutorial first:
[Make your first Google Health API call](https://developers.google.com/health/codelabs/make-your-first-api-call)

---

## Step 1 — Set up Google Cloud Console (once)
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **Google Auth Platform** → **Clients**, and click your **Web application** client.
2. Under **Authorized JavaScript origins**, click **Add URI** and add each place your app will run:
   | Where | Origin to add |
   |---|---|
   | VS Code Live Server | `http://127.0.0.1:5500` **and** `http://localhost:5500` |
   | `npx serve` | `http://localhost:3000` |
   | Vercel | `https://your-project-name.vercel.app` |

   An origin has **no path and no trailing slash**. Write `https://my-app.vercel.app`, not `https://my-app.vercel.app/`.
3. Click **Save**. It can take **5 minutes or more** for Google to start using the change.
4. Go to **Google Auth Platform** → **Audience**. Under **Test users**, add the Google account(s) you'll sign in with. While the app is in "Testing" mode, **only test users can sign in**.
5. Make sure the **Google Health API** is enabled: **APIs & Services** → **Library**.
6. Copy your **Client ID**. It looks like `1234-abcd.apps.googleusercontent.com`.

> 🔒 You do **not** need the client secret for this starter. Never put a client secret in front-end code or on GitHub.

## Step 2 — Try the example

1. Open `config.js` and paste your Client ID into `GOOGLE_CLIENT_ID`.
2. Run the folder with a local web server. Opening `index.html` directly (`file://`) **won't work**. Use either:
   - VS Code: right-click `index.html` → **Open with Live Server**, or
   - Terminal: `npx serve` and open `http://localhost:3000`
3. Click **Sign in with Google**, choose your test account, and tick all the permission boxes.
4. Click **Load data**.

## Step 3 — Put it on Vercel

1. Push the folder to GitHub.
2. In Vercel: **Add New → Project**, then import the repo. Use Framework Preset **Other**, and leave the build settings empty.
3. Deploy, then copy your URL (e.g. `https://my-app.vercel.app`).
4. Add that URL to **Authorized JavaScript origins** (Step 1.2) and wait a few minutes.

> Vercel "preview" URLs (the long ones with random letters) change on every deploy. Sign in using your main **production** URL.

---

## Adding sign-in to your OWN web app

**1. Copy two files** into your project: `google-auth.js` and `config.js`. Edit `config.js`.

**2. Add the scripts** to your HTML, *before* your own script:

```html
<button id="sign-in">Sign in with Google</button>

<script src="google-auth.js"></script>
<script src="config.js"></script>
<script src="script.js"></script>   <!-- your code -->
```

**3. In your own JavaScript:**

```js
// Set up (once, when the page loads)
GoogleAuth.init({
  clientId: GOOGLE_CLIENT_ID,
  scopes: GOOGLE_SCOPES,
  onChange: (signedIn) => {
    console.log(signedIn ? "Signed in!" : "Signed out");
    // show/hide parts of your page here
  },
});

// Sign in — this MUST run inside a click handler
document.getElementById("sign-in").addEventListener("click", () => {
  GoogleAuth.signIn();
});

// Call the API (after signing in)
async function getExercise() {
  const url = "https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints";
  const data = await GoogleAuth.fetchJSON(url);
  console.log(data.dataPoints);
}
```

### What `GoogleAuth` can do

| Function | What it does |
|---|---|
| `GoogleAuth.init({ clientId, scopes, onChange })` | Set up. Call once. |
| `GoogleAuth.signIn()` | Opens the Google pop-up. **Must be called from a click.** |
| `GoogleAuth.signOut()` | Signs out. |
| `GoogleAuth.isSignedIn()` | `true` / `false` |
| `GoogleAuth.fetchJSON(url, options)` | Like `fetch()`, but it adds your token and returns the JSON. Throws a helpful error if something goes wrong. |
| `GoogleAuth.getAccessToken()` | The raw token, if you want to use `fetch()` yourself: `headers: { Authorization: "Bearer " + token }` |

### Filtering by date

Use `URLSearchParams`, which encodes the spaces and quotes for you:

```js
const params = new URLSearchParams({
  filter: 'exercise.interval.civil_start_time >= "2026-09-01"',
});
const url = `https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints?${params}`;
const data = await GoogleAuth.fetchJSON(url);
```

Each data type uses a slightly different filter. See the [dataPoints.list reference](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list):

| Data type | Example filter |
|---|---|
| `exercise` | `exercise.interval.civil_start_time >= "2026-09-01"` |
| `steps` | `steps.interval.start_time >= "2026-09-01T00:00:00Z"` |
| `sleep` | `sleep.interval.civil_end_time >= "2026-09-01"` (needs the `sleep.readonly` scope) |

### Using other data

To read other data, add its scope in `config.js`, then **sign out and sign in again** so Google asks for the new permission. The [scopes list](https://developers.google.com/health/scopes) and the [data types list](https://developers.google.com/health/data-types) show what's available.

---

## Troubleshooting

| You see | Fix |
|---|---|
| `Error 400: origin_mismatch` in the pop-up | Add the exact address in your browser bar (e.g. `http://127.0.0.1:5500`) to **Authorized JavaScript origins**, then wait 5+ minutes. |
| `Error 403: access_denied` in the pop-up | Add your Google account as a **Test user** (Google Auth Platform → Audience). |
| Pop-up doesn't appear | Allow pop-ups for the site, and call `signIn()` from a button click. |
| "You opened this page as a file" in the console | Use Live Server or `npx serve`, not a double-click. |
| `API error 403 … has not been used` | Enable the Google Health API in the Library. |
| `API error 403` (other) | The scope is missing from `config.js`, or you didn't tick every box when you signed in. Sign out and sign in again. |
| `API error 401` / "sign-in expired" | Tokens last 1 hour. Click Sign in again. |
| `API error 400` | Your `filter` text is probably wrong. Check the field name and the quotes. |

## Good to know

- **Sign-in lasts about 1 hour.** Your sign-in is remembered if you reload the page, but it ends when you close the tab. After that, clicking Sign in again is quick, and Google won't ask for permission a second time.
- Your app can only read data **while the user has it open**. If you need to read data in the background (e.g. a daily job on a server), you need a different setup that uses refresh tokens and a server. Ask your teacher.
- The **client ID is public**, so it's fine to put it on GitHub. The **client secret is not public**, and this starter doesn't use it.
