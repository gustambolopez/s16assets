const express = require("express");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const storedCookies = [];
const PORT = 5000;

app.use(cookieParser());

const customProxy = createProxyMiddleware({
  target: "https://html5.gamedistribution.com",
  changeOrigin: true, // Remains true to change the Host header sent to target
  ws: true,           // Important for many games that use WebSockets
  selfHandleResponse: false, // Keep this false unless you plan to modify response body

  onProxyReq: (proxyReq, req, res) => {
    storedCookies.forEach((cookie) => {
      proxyReq.setHeader("cookie", `${cookie.name}=${cookie.value}`);
    });

    // --- ADDED/MODIFIED FOR SPOOFING ---
    // Spoof Referer and Origin headers to make the request appear to come
    // from the target domain itself. This can sometimes bypass server-side checks.
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');
    // --- END SPOOFING ADDITIONS ---

    console.log(`Proxying request: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
  },

  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.headers.location) {
      const originalLocation = proxyRes.headers.location;
      console.log(`Original redirect location: ${originalLocation}`);

      const BLOCKED_REDIRECT_BASE_URL = "https://html5.api.gamedistribution.com/blocked.html";

      try {
        const redirectUrlObject = new URL(originalLocation);
        const redirectBaseUrl = `${redirectUrlObject.origin}${redirectUrlObject.pathname}`;

        if (redirectBaseUrl === BLOCKED_REDIRECT_BASE_URL) {
          console.warn(`Blocked redirect to: ${originalLocation} (matched base URL)`);
          delete proxyRes.headers.location;
          // Optionally, set the status to 200 OK to indicate "success"
          // but send a custom message, to prevent the browser from thinking
          // there was a redirect it couldn't follow.
          res.status(200).send("Game not available here due to a blocked redirect. This content is not allowed via proxy.");
          return;
        }
      } catch (e) {
        console.error("Error parsing redirect URL for blocking check:", e);
      }

      // If it's not the specifically blocked URL, proceed with existing rewrite logic for internal redirects
      try {
        const targetUrl = new URL(proxyRes.req.protocol + '//' + proxyRes.req.host + proxyRes.req.path);
        const redirectUrl = new URL(originalLocation, targetUrl);

        if (redirectUrl.origin === customProxy.target) {
            const newPath = redirectUrl.pathname.replace(/^\/rvvASMiM/, '/src');
            const newLocation = `${req.protocol}://${req.get('host')}${newPath}${redirectUrl.search}`;
            proxyRes.headers.location = newLocation;
            console.log(`Rewriting redirect to: ${newLocation}`);
        } else {
            console.log(`Redirecting to external site, not rewriting: ${originalLocation}`);
        }
      } catch (error) {
        console.error("Error processing redirect location for rewriting:", error);
      }
    }
    // No `return` here, allowing the response to continue to the client
  },
  pathRewrite: {
    '^/src': '/rvvASMiM',
  },
});

app.use((req, res, next) => {
  if (req.url.startsWith('/src')) {
    customProxy(req, res, next);
  } else {
    res.status(404).send(`Cannot GET ${req.url}`);
  }
});

app.listen(PORT, () => {
  console.log(`FA-v2 server listening on port ${PORT}`);
});
