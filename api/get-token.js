// api/get-token.js — diagnostic: probe Lambda from server side (no CORS)
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const sessionToken = process.env.MM_SESSION_TOKEN;
  const userId = process.env.MM_USER_ID || "usr_01K232E13FWH0D650C46BMX9F6";
  const lambdaUrl = "https://swlx46gtlc36ngabi7ps2ximhy0idsfu.lambda-url.us-east-1.on.aws/";

  const attempts = [];

  const configs = [
    { label: "Bearer + body", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}`, "Origin": "https://insights.modelmatch.com" }, body: JSON.stringify({ userID: userId }) },
    { label: "Cookie + body", headers: { "Content-Type": "application/json", "Cookie": `better-auth.session_token=${sessionToken}`, "Origin": "https://insights.modelmatch.com" }, body: JSON.stringify({ userID: userId }) },
    { label: "Cookie no body", headers: { "Cookie": `better-auth.session_token=${sessionToken}`, "Origin": "https://insights.modelmatch.com" }, body: undefined },
    { label: "Bearer no body", headers: { "Authorization": `Bearer ${sessionToken}`, "Origin": "https://insights.modelmatch.com" }, body: undefined },
    { label: "__Secure cookie", headers: { "Content-Type": "application/json", "Cookie": `__Secure-better-auth.session_token=${sessionToken}`, "Origin": "https://insights.modelmatch.com" }, body: JSON.stringify({ userID: userId }) },
  ];

  for (const cfg of configs) {
    try {
      const r = await fetch(lambdaUrl, {
        method: "POST",
        headers: { ...cfg.headers, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        body: cfg.body,
      });
      const text = await r.text();
      attempts.push({ label: cfg.label, status: r.status, body: text.slice(0, 300) });
    } catch(e) {
      attempts.push({ label: cfg.label, error: e.message });
    }
  }

  return res.status(200).json({ attempts });
};
