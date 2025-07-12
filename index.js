import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
// No need for 'zlib' import since we're not handling compression/decompression manually anymore

const app = express();
const PORT = 5000;
const storedCookies = []; // Not used in this current snippet, but kept for context

app.use(cookieParser());

const bypassParams = 'gd_sdk_referrer_url=https://y8.com/&key=10322731&value=194340';

// --- MIDDLEWARE FOR CLIENT-SIDE REDIRECTION (Ensures URL has params for client) ---
app.use((req, res, next) => {
  // Check if the URL starts with /src AND does not already contain our bypass parameters
  if (req.url.startsWith('/src') && !req.url.includes(bypassParams.split('=')[0])) {
    const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const redirectUrl = `${currentUrl.origin}${currentUrl.pathname}?${bypassParams}`;

    console.log(`Client-side redirecting: ${req.originalUrl} -> ${redirectUrl}`);
    return res.redirect(302, redirectUrl);
  }
  next();
});
// --- END MIDDLEWARE ---

const proxy = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com',
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false, // IMPORTANT: Reverted to false to let http-proxy-middleware handle the response body automatically

  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    console.log(`Proxying request: ${req.url} -> ${proxyReq.path}`);

    if (req.url.startsWith('/src')) {
      const pathname = proxyReq.path.split('?')[0]; 
      proxyReq.path = `${pathname}?${bypassParams}`;
    }
  },

  onProxyRes: (proxyRes, req, res) => {
    // 1. Handle Location Header (Redirects) - This part is kept as it modifies headers only
    const loc = proxyRes.headers.location;
    if (loc) {
      console.log(`Redirect found: ${loc}`);
      const BLOCKED_STRING_IN_REDIRECT = 'https://html5.api.gamedistribution.com/blocked.html?domain=s16apitest.vercel.app';

      try {
        if (loc.includes(BLOCKED_STRING_IN_REDIRECT)) {
          console.warn(`Blocked redirect: ${loc}`);
          delete proxyRes.headers.location; // Remove problematic header
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Game not available here.');
          return; 
        }
      } catch (e) {
        console.error('Error parsing redirect URL for blocking check:', e);
      }

      try {
        const targetOrigin = `${proxyRes.req.protocol}//${proxyRes.req.host}`;
        const fullRedirect = new URL(loc, targetOrigin);

        if (fullRedirect.origin === proxy.target) {
          const newPath = fullRedirect.pathname.replace(/^\/rvvASMiM/, '/src'); 
          const newUrl = `${req.protocol}://${req.get('host')}${newPath}?${bypassParams}`; 
          proxyRes.headers.location = newUrl; // Set the modified location header
          console.log(`Rewriting redirect: ${loc} -> ${newUrl}`);
        } else {
          console.log(`Redirecting to external site, not rewriting: ${loc}`);
        }
      } catch (error) {
        console.error('Redirect rewrite error:', error);
      }
    }
    // No explicit content handling here. http-proxy-middleware will pipe the response
    // directly to the client with its original headers and body.
  },

  pathRewrite: {
    '^/src': '/rvvASMiM',
  },
});

app.use((req, res, next) => {
  if (req.url.startsWith('/src')) { 
    proxy(req, res, next);
  } else {
    res.status(404).send(`Cannot GET ${req.url}`);
  }
});

app.listen(PORT, () => {
  console.log(`FA-v2 server is running at http://localhost:${PORT}`);
});
