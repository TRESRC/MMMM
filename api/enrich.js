// api/enrich.js
// Accepts accessToken from browser (browser calls /refresh with its own cookie)
// Then proxies to api.next.modelmatch.com server-side (no CORS issues)

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth, x-mm-token, x-mm-user");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { table } = req.query;
  if (!table || !["enriched_property", "enriched_loan"].includes(table)) {
    return res.status(400).json({ error: "table must be enriched_property or enriched_loan" });
  }

  // Access token comes from browser which has the insights session cookie
  const accessToken = req.headers["x-mm-token"];
  const userId = req.headers["x-mm-user"] || process.env.MM_USER_ID || "usr_01K232E13FWH0D650C46BMX9F6";

  if (!accessToken) {
    return res.status(400).json({ error: "x-mm-token header required" });
  }

  const shapeKey = table === "enriched_property" ? "enriched-property" : "enriched-loan";
  const shape = { table, where: "user_id = $1", params: [userId] };

  try {
    // Step 1: Get proxy URL from api.next.modelmatch.com (server-side, no CORS)
    const shapeRes = await fetch(`https://api.next.modelmatch.com/shape/${shapeKey}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Origin": "https://insights.modelmatch.com",
        "Referer": "https://insights.modelmatch.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({ shape }),
    });

    if (!shapeRes.ok) {
      const err = await shapeRes.text();
      // Token expired — tell browser to refresh
      if (shapeRes.status === 401 || err.includes("invalid_token")) {
        return res.status(401).json({ error: "token_expired", message: "Please refresh token" });
      }
      return res.status(shapeRes.status).json({ error: err });
    }

    const shapeData = await shapeRes.json();

    if (!shapeData.url || !shapeData.headers?.Authorization) {
      return res.status(500).json({ error: "No proxy URL", shapeData });
    }

    // Step 2: Fetch actual data from Cloudflare worker (server-side, no CORS)
    const dataRes = await fetch(shapeData.url, {
      headers: { "Authorization": shapeData.headers.Authorization },
    });

    const text = await dataRes.text();

    // Parse streaming/NDJSON response
    const records = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (item.value !== undefined && item.value !== null) records.push(item.value);
          });
        }
      } catch {}
    }

    return res.status(200).json({ records, count: records.length });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
