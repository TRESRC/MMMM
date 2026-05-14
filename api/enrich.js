// api/enrich.js
// Enriches loans/properties via insights.modelmatch.com API
// Auto-refreshes JWT token using session cookie - no manual token management needed

async function getAccessToken(sessionToken) {
  const r = await fetch("https://insights.modelmatch.com/refresh", {
    method: "POST",
    headers: {
      "Cookie": `better-auth.session_token=${sessionToken}`,
      "Origin": "https://insights.modelmatch.com",
      "Referer": "https://insights.modelmatch.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) throw new Error(`Token refresh failed: ${r.status}`);
  const data = await r.json();
  return { accessToken: data.accessToken, userId: data.user };
}

async function fetchShape(shapeKey, shape, accessToken) {
  const r = await fetch(`https://api.next.modelmatch.com/shape/${shapeKey}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Origin": "https://insights.modelmatch.com",
      "Referer": "https://insights.modelmatch.com/",
    },
    body: JSON.stringify({ shape }),
  });
  if (!r.ok) throw new Error(`Shape API error: ${r.status}`);
  return r.json();
}

async function fetchProxyData(proxyUrl, proxyToken) {
  // The proxy streams data — we need to handle chunked/SSE responses
  const r = await fetch(proxyUrl, {
    headers: { "Authorization": proxyToken },
  });
  if (!r.ok) throw new Error(`Proxy error: ${r.status}`);
  const text = await r.text();
  
  // Parse streaming response - filter out header-only lines
  const records = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        // Filter out header-only records
        const data = parsed.filter(item => item.value !== undefined);
        records.push(...data.map(item => item.value));
      }
    } catch {}
  }
  return records;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { table } = req.query;
  if (!table || !["enriched_property", "enriched_loan"].includes(table)) {
    return res.status(400).json({ error: "table must be enriched_property or enriched_loan" });
  }

  const sessionToken = process.env.MM_SESSION_TOKEN;
  const shapeKey = table === "enriched_property" ? "enriched-property" : "enriched-loan";

  try {
    // Step 1: Get fresh JWT automatically
    const { accessToken, userId } = await getAccessToken(sessionToken);

    // Step 2: Get proxy URL + short-lived token
    const shape = {
      table,
      where: "user_id = $1",
      params: [userId],
    };
    const shapeData = await fetchShape(shapeKey, shape, accessToken);

    if (!shapeData.url || !shapeData.headers?.Authorization) {
      return res.status(500).json({ error: "No proxy URL returned", shapeData });
    }

    // Step 3: Fetch actual data from proxy
    const records = await fetchProxyData(shapeData.url, shapeData.headers.Authorization);

    return res.status(200).json({ 
      records, 
      count: records.length,
      userId 
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
