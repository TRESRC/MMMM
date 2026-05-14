# LO Intel v3 — Vercel Edition

Password-protected LO data tool. Vercel proxies all ModelMatch API calls server-side using a stored session token — no CORS issues, no token exposed to the browser.

---

## File Structure

```
lo-intel/
├── index.html              ← Full UI (single file)
├── api/
│   └── mm.js              ← Vercel proxy → ModelMatch API
├── vercel.json
├── package.json
└── README.md
```

---

## Deploy to Vercel

### 1. Push to GitHub
Create a repo and push all files.

### 2. Import to Vercel
- vercel.com → New Project → import repo
- Framework: **Other**

### 3. Add Environment Variables (Vercel → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `AUTH_HASH` | SHA-256 hash of `username:password` |
| `MM_SESSION_TOKEN` | `QAvHyOzVf913u6PL46Fkw0qrXCpAfBdP` |

### 4. Generate AUTH_HASH
Open any browser → F12 → Console:
```js
const str = "yourusername:yourpassword";
const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
console.log(hash);
```

### 5. Deploy
Push to main → Vercel auto-deploys. Your URL:
```
https://your-project.vercel.app
```

---

## Session Token Refresh

The `MM_SESSION_TOKEN` expires **May 20, 2026**. When it expires:
1. Log into app.modelmatch.com
2. Open DevTools → Console → paste:
   ```js
   fetch('https://auth.modelmatch.com/api/auth/get-session', {credentials:'include'})
     .then(r=>r.json()).then(d=>console.log(d.session.token))
   ```
3. Copy the new token → update `MM_SESSION_TOKEN` in Vercel env vars → redeploy
