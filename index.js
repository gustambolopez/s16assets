import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
// s16dih
const app = express();
const PORT = 5000;
const storedCookies = [];

app.use(cookieParser());

// middleware 
const proxy = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com',
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false,

  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    const bypassParams = 'gd_sdk_referrer_url=https://y8.com/&key=10322731&value=194340';

    // --- MODIFIED: Ensure parameters are always at the end of the path, overriding others ---
    if (req.url.startsWith('/src')) {
      // Split the path to isolate the pathname part (before any '?')
      const pathname = proxyReq.path.split('?')[0]; 
      // Reconstruct proxyReq.path with only our desired parameters
      proxyReq.path = `${pathname}?${bypassParams}`;
    }
    // --- END MODIFIED ---

    console.log(`Proxying request: ${req.url} -> ${proxyReq.path}`);
  },

  onProxyRes: (proxyRes, req, res) => {
    const loc = proxyRes.headers.location;

    if (loc) {
      console.log(`Redirect found: ${loc}`);

      const blockedRedirect = 'https://html5.api.gamedistribution.com/blocked.html?domain=s16apitest.vercel.app';

      // 
      if (loc.includes(blockedRedirect)) {
        console.warn(`Blocked redirect: ${loc}`);
        delete proxyRes.headers.location;
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Game not available here.');
        return;
      }

      try {
        // so ts is so /rvvASMiM is /src 
        const targetOrigin = `${proxyRes.req.protocol}//${proxyRes.req.host}`;
        const fullRedirect = new URL(loc, targetOrigin);

        if (fullRedirect.origin === proxy.target) {
          const newPath = fullRedirect.pathname.replace(/^\/rvvASMiM/, '/src');
          const newUrl = `${req.protocol}://${req.get('host')}${newPath}${fullRedirect.search}`;
          proxyRes.headers.location = newUrl;
          console.log(`Rewriting redirect: ${loc} -> ${newUrl}`);
        }
      } catch (err) {
        console.error(`Redirect rewrite error:`, err);
      }
    }
  },

  pathRewrite: {
    '^/src': '/rvvASMiM',
  },
});

// block all paths but /src
app.use((req, res, next) => {
  if (req.url.startsWith('/src')) {
    proxy(req, res, next);
  } else {
    res.status(404).send(`Cannot GET ${req.url}`);
  }
});
// random ahh mesage lmao
app.listen(PORT, () => {
  console.log(`FA-v2 server is running at http://localhost:${PORT}`);
});
