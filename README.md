# LO Intel — GitHub Pages Edition

Single-file, password-protected LO data tool. Uses ModelMatch session cookies directly — **no backend, no Vercel, no API keys to manage.**

---

## File Structure

```
lo-intel/
├── index.html                  ← Everything (UI + logic)
├── .gitignore
├── README.md
└── .github/
    └── workflows/
        └── deploy.yml          ← Injects secret + deploys to Pages
```

---

## How It Works

1. User logs in with username/password (checked against SHA-256 hash)
2. App calls `app.modelmatch.com/api/` directly using the user's existing session cookie
3. Results render inline — profile, stats, full transaction history
4. One click exports to Excel (SheetJS, client-side)

**No proxy needed** — the API is on the same domain as the ModelMatch app, so session cookies work seamlessly.

---

## Setup (10 min)

### 1. Push to GitHub
Create a new repo and push all files.

### 2. Generate your AUTH_HASH
Open any browser tab → F12 → Console:
```js
const str = "yourusername:yourpassword";
const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
console.log(hash);
```

### 3. Add GitHub Secret
Repo → Settings → Secrets → Actions → New secret:
- Name: `AUTH_HASH`
- Value: the hash from step 2

### 4. Enable GitHub Pages
Repo → Settings → Pages → Source: **GitHub Actions**

### 5. Push to main
GitHub Actions builds and deploys automatically.

**Your URL:** `https://yourusername.github.io/your-repo-name/`

---

## Important

The user must be **logged into app.modelmatch.com** in the same browser for the API calls to work (session cookie required). This tool is designed for internal team use where everyone has a ModelMatch account.

---

## Changing Password
1. Generate new hash with new `username:password`
2. Update `AUTH_HASH` secret in GitHub
3. Push any commit to redeploy — no code changes needed
