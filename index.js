import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 5000;
const storedCookies = []; // This variable is not used in the current code

app.use(cookieParser());

// Define the bypass parameters once
const bypassParams = 'gd_sdk_referrer_url=https://y8.com/&key=10322731&value=194340';

// --- CLIENT-SIDE REDIRECTION MIDDLEWARE ---
// This middleware runs BEFORE the proxy.
// It checks if the URL starts with /src and does NOT already contain our specific parameters.
// If not, it sends a 302 redirect to the client's browser, appending the parameters.
app.use((req, res, next) => {
  // Check if the URL starts with /src AND does not already contain the 'gd_sdk_referrer_url' parameter
  if (req.url.startsWith('/src') && !req.url.includes(bypassParams.split('=')[0])) {
    const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    
    // Construct the new URL: origin + pathname (which includes trailing slash if present) + our parameters
    // Example: /src/game-id -> /src/game-id?params
    // Example: /src/game-id/ -> /src/game-id/?params
    const redirectUrl = `${currentUrl.origin}${currentUrl.pathname}?${bypassParams}`;

    console.log(`Client-side redirecting: ${req.originalUrl} -> ${redirectUrl}`);
    return res.redirect(302, redirectUrl); // Send the redirect response to the browser
  }
  next(); // If parameters are already present or not a /src path, pass to next middleware (the proxy)
});
// --- END CLIENT-SIDE REDIRECTION MIDDLEWARE ---

// The main proxy middleware - this will now handle all incoming requests
const proxy = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com',
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false, // Keeping this as false, as per your request

  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    // --- BYPASS PARAMS LOGIC REMOVED FROM ONPROXYREQ ---
    // The client-side redirect now handles ensuring the URL has these parameters.
    // So, no need to modify proxyReq.path here for bypassParams.
    // --- END REMOVED ---

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
          // This line is from your working code: it preserves any existing query parameters from the target's redirect
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
    '^/src': '/rvvASMiM', // This rewrite rule will still apply when the path starts with /src
  },
});

// All requests will now go through the proxy.
app.use(proxy); 

app.listen(PORT, () => {
  console.log(`FA-v2 server is running at http://localhost:${PORT}`);
});
