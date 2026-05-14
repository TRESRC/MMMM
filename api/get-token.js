// api/get-token.js — tries all cookie name variations and logs raw response
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = process.env.MM_SESSION_TOKEN;
  const results = [];

  const cookieVariants = [
    `better-auth.session_token=${token}`,
    `__Secure-better-auth.session_token=${token}`,
    `better-auth.session_token=${token}; better-auth.session_data=${token}`,
    `session=${token}`,
    `sessionToken=${token}`,
  ];

  for (const cookie of cookieVariants) {
    try {
      const r = await fetch("https://insights.modelmatch.com/refresh", {
        method: "POST",
        headers: {
          "Cookie": cookie,
          "Origin": "https://insights.modelmatch.com",
          "Referer": "https://insights.modelmatch.com/",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        },
      });
      const text = await r.text();
      results.push({ cookie: cookie.slice(0, 40) + "...", status: r.status, body: text.slice(0, 300) });
    } catch(e) {
      results.push({ cookie: cookie.slice(0, 40) + "...", error: e.message });
    }
  }

  return res.status(200).json({ results });
};
