// api/session.js — Gets MM Bearer token server-side
// Uses the session token to call auth.modelmatch.com and extract the JWT

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-auth");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-app-auth"] !== process.env.AUTH_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sessionToken = process.env.MM_SESSION_TOKEN;
  if (!sessionToken) return res.status(500).json({ error: "MM_SESSION_TOKEN not set" });

  const cookieVariants = [
    `better-auth.session_token=${sessionToken}`,
    `__Secure-better-auth.session_token=${sessionToken}`,
    `better-auth.session_token=${sessionToken}; better-auth.session_data=${sessionToken}`,
  ];

  const origins = ["https://app.modelmatch.com", "https://insights.modelmatch.com"];

  for (const origin of origins) {
    for (const cookie of cookieVariants) {
      try {
        const r = await fetch("https://auth.modelmatch.com/api/auth/get-session", {
          headers: {
            "Cookie": cookie,
            "Origin": origin,
            "Referer": origin + "/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            "Accept": "application/json",
          }
        });
        
        // Check set-auth-jwt header — this is the Bearer token the app uses
        const jwt = r.headers.get("set-auth-jwt");
        const data = await r.json();
        
        if (data?.session?.token) {
          return res.status(200).json({ 
            token: data.session.token,
            jwt: jwt, // Bearer JWT for api.next.modelmatch.com
            expiresAt: data.session.expiresAt,
            userId: data.user?.id,
            cookieUsed: cookie.slice(0, 30) + "...",
            origin,
          });
        }
      } catch(e) {
        continue;
      }
    }
  }

  return res.status(401).json({ 
    error: "Session expired — please update MM_SESSION_TOKEN in Vercel",
    hint: "Log into app.modelmatch.com, open console, run: fetch('https://auth.modelmatch.com/api/auth/get-session',{credentials:'include'}).then(r=>r.json()).then(d=>console.log(d.session.token))"
  });
};
