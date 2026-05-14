// api/mm.js — Vercel proxy for app.modelmatch.com API
// Accepts MM token from browser (x-mm-token header) — no stored token needed
// This means NO weekly token rotation required in Vercel env vars

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth, x-mm-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: "path required" });

  // Use token from browser — browser gets it from its active ModelMatch session
  // Falls back to env var if browser didn't provide one
  const mmToken = req.headers["x-mm-token"] || process.env.MM_SESSION_TOKEN;
  if (!mmToken) return res.status(400).json({ error: "No MM token available" });

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== "path") params.set(k, v);
  }

  const url = `https://app.modelmatch.com${path}${params.toString() ? "?" + params.toString() : ""}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${mmToken}`,
        "Accept": "application/json",
        "x-organization-id": process.env.MM_ORG_ID || "5Zh2dlrSnPPZGRJaC2hI53RPB8aqQSBf",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      },
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
