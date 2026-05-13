// api/lookup.js
// Vercel serverless function — proxies ModelMatch API requests server-side
// so the token never touches the browser and CORS is not an issue.

const MM_API = "https://api.modelmatch.com";

// Known routes from api.modelmatch.com root discovery
const ROUTES = [
  "/originators",
  "/loans",
  "/sales",
  "/agents",
  "/properties",
];

// Param name variations to try for NMLS lookup
const NMLS_PARAMS = ["nmls_id", "nmls", "nmlsId", "originator_nmls", "id"];

async function mmFetch(path, params, token) {
  const url = new URL(MM_API + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  return { status: res.status, url: url.toString(), data: res.ok ? await res.json() : null };
}

export default async function handler(req, res) {
  // CORS headers — allow your Vercel domain
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Auth check — validate app password hash passed from frontend
  const appAuth = req.headers["x-app-auth"];
  if (appAuth !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { nmls, type = "originator" } = req.query;
  if (!nmls) return res.status(400).json({ error: "nmls parameter required" });

  const token = process.env.MM_TOKEN;
  if (!token) return res.status(500).json({ error: "MM_TOKEN not configured" });

  try {
    if (type === "originator") {
      // Try all param name variations until one returns data
      const results = {};
      for (const param of NMLS_PARAMS) {
        const { status, data } = await mmFetch("/originators", { [param]: nmls, limit: 1 }, token);
        results[param] = { status, hasData: !!data };
        if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
          return res.status(200).json({ source: "originators", param, data });
        }
      }
      // Nothing worked — return diagnostic info
      return res.status(200).json({ diagnostic: true, tried: results });
    }

    if (type === "loans") {
      const results = {};
      for (const param of NMLS_PARAMS) {
        const { status, data } = await mmFetch("/loans", { [param]: nmls, limit: 200 }, token);
        results[param] = { status, hasData: !!data };
        if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
          return res.status(200).json({ source: "loans", param, data });
        }
      }
      return res.status(200).json({ diagnostic: true, tried: results });
    }

    if (type === "sales") {
      const { status, data } = await mmFetch("/sales", { nmls_id: nmls, limit: 200 }, token);
      return res.status(200).json({ source: "sales", status, data });
    }

    // Diagnostic mode — probe all routes with the NMLS
    if (type === "probe") {
      const probe = {};
      for (const route of ROUTES) {
        for (const param of NMLS_PARAMS.slice(0, 2)) {
          const { status, data } = await mmFetch(route, { [param]: nmls }, token);
          probe[`${route}?${param}=${nmls}`] = { status, hasData: !!data };
        }
      }
      return res.status(200).json({ probe });
    }

    return res.status(400).json({ error: "Invalid type. Use: originator, loans, sales, probe" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
