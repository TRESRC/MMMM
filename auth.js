// api/auth.js
// Validates username:password against the stored hash server-side

import { createHash } from "crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  const hash = createHash("sha256")
    .update(`${username}:${password}`)
    .digest("hex");

  const stored = process.env.AUTH_HASH;
  if (!stored) return res.status(500).json({ error: "AUTH_HASH not configured" });

  if (hash === stored) {
    // Return the hash itself as the session token
    // Frontend sends it as x-app-auth on subsequent requests
    return res.status(200).json({ ok: true, token: hash });
  }

  return res.status(401).json({ ok: false, error: "Invalid credentials" });
}
