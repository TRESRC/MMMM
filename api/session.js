// api/session.js
// Fetches MM session token server-side using the stored session token
// No CORS issues since this runs on Vercel's servers

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sessionToken = process.env.MM_SESSION_TOKEN;
  if (!sessionToken) return res.status(500).json({ error: "MM_SESSION_TOKEN not set" });

  try {
    // Try both cookie names
    for (const cookie of [
      `better-auth.session_token=${sessionToken}`,
      `__Secure-better-auth.session_token=${sessionToken}`,
    ]) {
      const r = await fetch("https://auth.modelmatch.com/api/auth/get-session", {
        headers: {
          "Cookie": cookie,
          "Origin": "https://app.modelmatch.com",
          "Referer": "https://app.modelmatch.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }
      });
      const data = await r.json();
      if (data?.session?.token) {
        return res.status(200).json({ token: data.session.token, expiresAt: data.session.expiresAt });
      }
    }
    return res.status(401).json({ error: "Session expired — please update MM_SESSION_TOKEN in Vercel" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
