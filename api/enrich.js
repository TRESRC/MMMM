// api/enrich.js
// Accepts JWT from browser (obtained via insights.modelmatch.com/refresh)
// Proxies to api.next.modelmatch.com server-side (no CORS issues)

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth, x-mm-token, x-mm-user");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { table } = req.query;
  if (!table || !["enriched_property", "enriched_loan"].includes(table)) {
    return res.status(400).json({ error: "table must be enriched_property or enriched_loan" });
  }

  // JWT comes from browser's insights session (passed via x-mm-token header)
  const jwt = req.headers["x-mm-token"];
  const userId = req.headers["x-mm-user"] || process.env.MM_USER_ID || "usr_01K232E13FWH0D650C46BMX9F6";

  if (!jwt) {
    return res.status(400).json({ error: "x-mm-token required — connect insights first" });
  }

  const shapeKey = table === "enriched_property" ? "enriched-property" : "enriched-loan";
  const shape = { table, where: "user_id = $1", params: [userId] };

  try {
    // Step 1: Get proxy URL from api.next.modelmatch.com
    const shapeRes = await fetch(`https://api.next.modelmatch.com/shape/${shapeKey}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Origin": "https://insights.modelmatch.com",
        "Referer": "https://insights.modelmatch.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({ shape }),
    });

    if (!shapeRes.ok) {
      const err = await shapeRes.text();
      if (shapeRes.status === 401 || err.includes("invalid_token")) {
        return res.status(401).json({ error: "JWT expired — reconnect insights" });
      }
      return res.status(shapeRes.status).json({ error: err });
    }

    const shapeData = await shapeRes.json();

    if (!shapeData.url || !shapeData.headers?.Authorization) {
      return res.status(500).json({ error: "No proxy URL returned", shapeData });
    }

    // Step 2: Fetch data from Cloudflare worker proxy
    const dataRes = await fetch(shapeData.url, {
      headers: { "Authorization": shapeData.headers.Authorization },
    });

    const text = await dataRes.text();

    // Parse streaming NDJSON response
    const records = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (item.value !== undefined && item.value !== null) {
              records.push(item.value);
            }
          });
        }
      } catch {}
    }

    return res.status(200).json({ records, count: records.length });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
