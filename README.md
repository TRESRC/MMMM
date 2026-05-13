# LO Intelligence — ModelMatch Tool

A password-protected GitHub Pages app that pulls loan officer data from the ModelMatch API by NMLS ID and exports to Excel.

---

## Setup Guide

### 1. Create the GitHub Repo

Create a new **private** or public repo and push these files.

---

### 2. Generate your AUTH_HASH

The password is stored as a SHA-256 hash of `username:password` — never in plain text.

Run this in your terminal (replace the values):

```bash
echo -n "yourusername:yourpassword" | sha256sum
```

**On Mac:**
```bash
echo -n "yourusername:yourpassword" | shasum -a 256
```

**Or use Node.js:**
```js
const crypto = require("crypto");
console.log(crypto.createHash("sha256").update("yourusername:yourpassword").digest("hex"));
```

Copy the resulting hash — that's your `AUTH_HASH`.

---

### 3. Add GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these two secrets:

| Secret Name | Value |
|---|---|
| `AUTH_HASH` | The SHA-256 hash from step 2 |
| `MM_TOKEN` | Your ModelMatch API bearer token |

---

### 4. Enable GitHub Pages

Go to repo → **Settings → Pages**

- Source: **GitHub Actions**
- That's it — the workflow handles deployment automatically.

---

### 5. Push to `main`

Every push to `main` triggers the workflow:
1. Injects your secrets into `app.js` at build time
2. Deploys the built files to GitHub Pages

Your URL will be: `https://yourusername.github.io/your-repo-name/`

---

## How It Works

```
User visits URL
     │
     ▼
Login screen (username + password)
     │
     ├─ SHA-256 hash compared to AUTH_HASH secret
     │
     ▼ (if match)
App unlocks — session stored in sessionStorage
     │
     ▼
Enter NMLS ID → hits ModelMatch API
     │
     ├─ /originators?nmls_id=...  → profile + contact info
     └─ /loans?nmls_id=...        → full loan history + rates
     │
     ▼
Results render → Download Excel button
     │
     └─ SheetJS generates .xlsx client-side (no server needed)
```

---

## Security Notes

- The `AUTH_HASH` and `MM_TOKEN` are **never in your source code** — only injected at build time
- The built `app.js` on GitHub Pages contains the hash and token in the deployed JS — so this is appropriate for **internal/limited use** only, not a public-facing app with sensitive creds
- Consider adding your GitHub Pages URL to ModelMatch's allowed origins if they support CORS allowlisting
- Session clears on tab/browser close (sessionStorage, not localStorage)

---

## Changing the Password

1. Generate a new `AUTH_HASH` with the new `username:password`
2. Update the `AUTH_HASH` secret in GitHub
3. Push any commit to `main` to trigger a redeploy

No code changes needed.
