// api/get-token.js
// Gets a fresh JWT by hitting insights.modelmatch.com/refresh server-side
// Uses the MM session cookie — refreshes automatically, no expiry issues

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sessionToken = process.env.MM_SESSION_TOKEN;

  try {
    const r = await fetch("https://insights.modelmatch.com/refresh", {
      method: "POST",
      headers: {
        "Cookie": `better-auth.session_token=${sessionToken}`,
        "Origin": "https://insights.modelmatch.com",
        "Referer": "https://insights.modelmatch.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: `Refresh failed: ${text}` });
    }

    const data = await r.json();
    return res.status(200).json({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      userId: data.user,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
