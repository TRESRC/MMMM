// api/mm.js — Vercel serverless proxy for ModelMatch API
// Session token stored as env var, never exposed to browser

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Validate app password hash
  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: "path required" });

  // Forward all other query params except 'path'
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== "path") params.set(k, v);
  }

  const url = `https://app.modelmatch.com${path}${params.toString() ? "?" + params.toString() : ""}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "Cookie": `better-auth.session_token=${process.env.MM_SESSION_TOKEN}; better-auth.session_data=${process.env.MM_SESSION_TOKEN}`,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      },
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
