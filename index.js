import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const storedCookies = [];
const PORT = 5000;

app.use(cookieParser());

const customProxy = createProxyMiddleware({
  target: "https://html5.gamedistribution.com?gd_sdk_referrer_url=https://y8.com/&key=10322731&value=194340",
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false, // Keeping this false as per your request for 'no custom logic'

  onProxyReq: (proxyReq, req, res) => {
    // Basic headers for the target server
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    console.log(`Original request path: ${req.url}`);

    const SDK_BYPASS_PARAMS = "?gd_sdk_referrer_url=https://y8.com/&key=10322731&value=194340";

    // Append SDK bypass params only if client URL starts with /src and params aren't already there
    if (req.url.startsWith('/src') && !proxyReq.path.includes("gd_sdk_referrer_url")) {
      proxyReq.path = proxyReq.path + (proxyReq.path.includes('?') ? '&' : '') + SDK_BYPASS_PARAMS.substring(1);
    }
    
    console.log(`Proxying request to target: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
  },

  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.headers.location) {
      const originalLocation = proxyRes.headers.location;
      console.log(`Original redirect location: ${originalLocation}`);

      const BLOCKED_STRING_IN_REDIRECT = "https://html5.api.gamedistribution.com/blocked.html?domain=s16apitest.vercel.app";

      try {
        if (originalLocation.includes(BLOCKED_STRING_IN_REDIRECT)) {
          console.warn(`Blocked redirect to: ${originalLocation} (contains blocked string)`);
          delete proxyRes.headers.location;
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end("Game not available here. This content is blocked via proxy due to an unauthorized domain redirect.");
          return;
        }
      } catch (e) {
        console.error("Error parsing redirect URL for blocking check:", e);
      }

      // Rewrite internal /rvvASMiM redirects back to /src for the client
      try {
        const targetUrl = new URL(proxyRes.req.protocol + '//' + proxyRes.req.host + proxyRes.req.path);
        const redirectUrl = new URL(originalLocation, targetUrl);
        if (redirectUrl.origin === customProxy.target) {
          const newPath = redirectUrl.pathname.replace(/^\/rvvASMiM/, '/src');
          const newLocation = `${req.protocol}://${req.get('host')}${newPath}${redirectUrl.search}`;
          proxyRes.headers.location = newLocation;
          console.log(`Rewriting internal redirect to: ${newLocation}`);
        } else {
          console.log(`Redirecting to external site, not rewriting: ${originalLocation}`);
        }
      } catch (error) {
        console.error("Error processing redirect location for rewriting:", error);
      }
    }
  },

  pathRewrite: {
    '^/src': '/rvvASMiM', // Client /src maps to target /rvvASMiM
  },
});

// --- MODIFIED: Only allow paths starting with /src and return 404 for others ---
app.use((req, res, next) => {
  if (req.url.startsWith('/src')) {
    customProxy(req, res, next);
  } else {
    res.status(404).send(`Cannot GET ${req.url}`);
  }
});
// --- END MODIFIED ---

app.listen(PORT, () => {
  console.log(`FA-v2 server listening on http://localhost:${PORT}`);
});
