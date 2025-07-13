import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 5000;
const storedCookies = []; // This variable is not used in the current code

app.use(cookieParser());

// --- NEW: Middleware to block main page and URLs containing '?search=' ---
// This middleware runs BEFORE the proxy, so it can intercept and block specific paths.
app.use((req, res, next) => {
    // Block the root path '/'
    if (req.path === '/') {
        console.log(`Blocking request to root path: ${req.path}`);
        return res.status(404).send(`Cannot GET ${req.path}`);
    }
    // Block any URL that contains '?search='
    // This checks the full original URL including query parameters
    if (req.url.includes('?search=')) {
        console.log(`Blocking request containing '?search=': ${req.url}`);
        return res.status(404).send(`Cannot GET ${req.url}`);
    }
    next(); // If not blocked, pass control to the next middleware (the proxy)
});
// --- END NEW MIDDLEWARE ---

const proxy = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com',
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false, // Keeping this as false, as per your request

  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    console.log(`Proxying request: ${req.url} -> ${proxyReq.path}`);
  },

  onProxyRes: (proxyRes, req, res) => {
    const loc = proxyRes.headers.location;

    if (loc) {
      console.log(`Redirect found: ${loc}`);

      const blockedRedirect = 'https://html5.api.gamedistribution.com/blocked.html?domain=s16apitest.vercel.app';

      if (loc.includes(blockedRedirect)) {
        console.warn(`Blocked redirect: ${loc}`);
        delete proxyRes.headers.location;
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Game not available here.');
        return;
      }

      try {
        const targetOrigin = `${proxyRes.req.protocol}//${proxyRes.req.host}`;
        const fullRedirect = new URL(loc, targetOrigin);

        if (fullRedirect.origin === proxy.target) {
          // This rewrites /rvvASMiM back to /src for the client
          const newPath = fullRedirect.pathname.replace(/^\/rvvASMiM/, '/src');
          // This line preserves any existing query parameters from the target's redirect
          const newUrl = `${req.protocol}://${req.get('host')}${newPath}${fullRedirect.search}`;
          proxyRes.headers.location = newUrl;
          console.log(`Rewriting redirect: ${loc} -> ${newUrl}`);
        }
      } catch (err) {
        console.error(`Redirect rewrite error:`, err);
      }
    }
    // No content rewriting here, as selfHandleResponse is false.
  },

  pathRewrite: {
    '^/src': '/rvvASMiM', // This rewrite rule remains for proxying /src paths to /rvvASMiM on the target
  },
});

// All requests that pass the initial blocking middleware will now go through the proxy.
app.use(proxy); 

app.listen(PORT, () => {
  console.log(`FA-v2 server is running at http://localhost:${PORT}`);
});
