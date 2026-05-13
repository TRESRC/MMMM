# LO Intelligence — Vercel Edition

Password-protected web app that proxies the ModelMatch API server-side and exports loan officer data to Excel.

---

## File Structure

```
lo-intel/
├── api/
│   ├── auth.js        ← Login endpoint (validates password)
│   └── lookup.js      ← ModelMatch proxy (holds your MM token)
├── public/
│   ├── index.html     ← Frontend UI
│   └── app.js         ← Frontend logic
├── package.json
├── vercel.json
└── README.md
```

---

## Deploy to Vercel (10 minutes)

### 1. Push to GitHub
Create a new repo and push all files.

### 2. Import to Vercel
- Go to [vercel.com](https://vercel.com) → New Project
- Import your GitHub repo
- Framework preset: **Other**
- Root directory: leave as `/`

### 3. Add Environment Variables
In Vercel → Project → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `AUTH_HASH` | SHA-256 of `username:password` (see below) |
| `MM_TOKEN` | Your ModelMatch Bearer token |

### 4. Generate AUTH_HASH
Open any browser tab → F12 → Console, paste:
```js
const str = "yourusername:yourpassword";
const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
console.log(hash);
```

### 5. Get your MM_TOKEN
- Log into app.modelmatch.com
- Open DevTools → Network tab
- Filter by `api.modelmatch.com`
- Click any request → Headers → copy the `Authorization: Bearer ...` value

### 6. Deploy
Push to `main` — Vercel auto-deploys. Your URL:
```
https://your-project.vercel.app
```

---

## How It Works

```
Browser → /api/auth       → validates password → returns session token
Browser → /api/lookup     → proxy to ModelMatch API (token stays server-side)
Browser → Excel download  → generated client-side with SheetJS
```

CORS is never an issue because all ModelMatch calls happen from Vercel's servers, not the browser.

---

## Finding the Token (first time)

If the app shows "diagnostic" output instead of real data, it means we need to fine-tune the API endpoint params. The diagnostic output will show which HTTP status codes each param variation returned — paste that here and we'll fix it in minutes.
