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

  const jwt = req.headers["x-mm-token"];
  const userId = req.headers["x-mm-user"] || process.env.MM_USER_ID || "usr_01K232E13FWH0D650C46BMX9F6";

  if (!jwt) {
    return res.status(400).json({ error: "x-mm-token required" });
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
      return res.status(shapeRes.status).json({ error: `Shape API ${shapeRes.status}: ${err.slice(0,200)}` });
    }

    const shapeData = await shapeRes.json();

    if (!shapeData.url || !shapeData.headers?.Authorization) {
      return res.status(500).json({ error: "No proxy URL returned", shapeData });
    }

    // Step 2: Fetch from Cloudflare worker - may need multiple requests for full data
    // First request gets the shape handle and initial data
    const dataRes = await fetch(shapeData.url, {
      headers: { "Authorization": shapeData.headers.Authorization },
    });

    const text = await dataRes.text();
    const lines = text.split("\n").filter(l => l.trim());
    
    // Parse all records from NDJSON stream
    const records = [];
    let shapeHandle = null;
    let lastOffset = null;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            // Header messages have control fields
            if (item.headers) {
              shapeHandle = item.headers["electric-shape-handle"] || shapeHandle;
              lastOffset = item.headers["electric-offset"] || lastOffset;
              continue;
            }
            // Data records have value field
            if (item.value !== undefined && item.value !== null) {
              records.push(item.value);
            }
          }
        } else if (parsed && typeof parsed === "object") {
          // Single object response
          if (parsed.headers) {
            shapeHandle = parsed.headers["electric-shape-handle"] || shapeHandle;
          } else if (parsed.value !== undefined) {
            records.push(parsed.value);
          }
        }
      } catch {}
    }

    // If we got a shape handle, fetch more data if available
    if (shapeHandle && records.length === 0 && lastOffset) {
      // Try fetching with the offset to get actual data
      const url2 = new URL(shapeData.url);
      url2.searchParams.set("handle", shapeHandle);
      url2.searchParams.set("offset", "-1"); // Start from beginning
      
      const dataRes2 = await fetch(url2.toString(), {
        headers: { "Authorization": shapeData.headers.Authorization },
      });
      const text2 = await dataRes2.text();
      
      for (const line of text2.split("\n").filter(l => l.trim())) {
        try {
          const parsed = JSON.parse(line);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item.value !== undefined && item.value !== null) records.push(item.value);
            }
          }
        } catch {}
      }
    }

    return res.status(200).json({ 
      records, 
      count: records.length,
      debug: { 
        rawLines: lines.length,
        shapeHandle,
        rawSample: text.slice(0, 300)
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
