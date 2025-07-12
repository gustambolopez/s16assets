import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
// s16dih
const app = express();
const PORT = 5000;
const storedCookies = [];

app.use(cookieParser());

// Parameters to append for redirection
const bypassParams = 'gd_sdk_referrer_url=https://y8.com/&key=10322731&value=194340';

// --- NEW MIDDLEWARE FOR CLIENT-SIDE REDIRECTION ---
app.use((req, res, next) => {
  // Check if the URL starts with /src AND does not already contain our bypass parameters
  if (req.url.startsWith('/src') && !req.url.includes(bypassParams.split('=')[0])) { // Check for 'gd_sdk_referrer_url'
    const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    
    // Construct the new URL with parameters
    // We append the parameters to the pathname, before any original query or hash
    const redirectUrl = `${currentUrl.origin}${currentUrl.pathname}?${bypassParams}`;

    console.log(`Client-side redirecting: ${req.originalUrl} -> ${redirectUrl}`);
    return res.redirect(302, redirectUrl); // Send a 302 Found redirect
  }
  next(); // If no redirect needed, pass control to the next middleware
});
// --- END NEW MIDDLEWARE ---

// middleware 
const proxy = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com',
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false,

  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    console.log(`Proxying request: ${req.url} -> ${proxyReq.path}`);

    // This block ensures the parameters are on the URL sent to the target server.
    // After the client-side redirect, req.url will already have them,
    // but this acts as a safeguard or for direct requests with params.
    if (req.url.startsWith('/src')) {
      const pathname = proxyReq.path.split('?')[0]; 
      proxyReq.path = `${pathname}?${bypassParams}`;
    }
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

// block all paths but /src (this middleware will now be hit *after* the redirect logic)
app.use((req, res, next) => {
  if (req.url.startsWith('/src')) { // This check still ensures only /src paths get proxied
    proxy(req, res, next);
  } else {
    res.status(404).send(`Cannot GET ${req.url}`);
  }
});

app.listen(PORT, () => {
  console.log(`FA-v2 server is running at http://localhost:${PORT}`);
});
