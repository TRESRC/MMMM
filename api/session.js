// api/session.js
// Returns the stored MM JWT token for app.modelmatch.com API calls
// MM_JWT is stored directly in Vercel - refresh via the app's "Refresh Token" button

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth, x-new-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // POST: update the stored token (called by the "Refresh Token" button)
  if (req.method === "POST") {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "token required" });
    // We can't update env vars at runtime, so we just validate and echo back
    // The token refresh is done by updating MM_SESSION_TOKEN in Vercel
    return res.status(200).json({ ok: true, token });
  }

  // GET: return the current session token from env
  const sessionToken = process.env.MM_SESSION_TOKEN;
  if (!sessionToken) return res.status(500).json({ error: "MM_SESSION_TOKEN not configured" });

  // Try to get a fresh JWT using the session token
  for (const cookie of [
    `better-auth.session_token=${sessionToken}`,
    `__Secure-better-auth.session_token=${sessionToken}`,
  ]) {
    try {
      const r = await fetch("https://auth.modelmatch.com/api/auth/get-session", {
        headers: {
          "Cookie": cookie,
          "Origin": "https://app.modelmatch.com",
          "Referer": "https://app.modelmatch.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "x-forwarded-for": "63.147.207.122", // use known MM IP
        }
      });
      const jwt = r.headers.get("set-auth-jwt");
      const data = await r.json();
      if (data?.session?.token) {
        return res.status(200).json({
          token: data.session.token,
          jwt: jwt || null,
          userId: data.user?.id,
          authenticated: true,
        });
      }
    } catch(e) { continue; }
  }

  return res.status(401).json({ 
    error: "Session expired",
    action: "Please update MM_SESSION_TOKEN in Vercel with a fresh token from app.modelmatch.com"
  });
};
