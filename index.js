const express = require("express");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const storedCookies = [];
const PORT = 5000;

app.use(cookieParser());

const customProxy = createProxyMiddleware({
  target: "https://html5.gamedistribution.com",
  changeOrigin: true, // This is crucial for the target server to correctly serve content
  onProxyReq: (proxyReq, req, res) => { // Added req, res to onProxyReq arguments
    storedCookies.forEach((cookie) => {
      proxyReq.setHeader("cookie", `${cookie.name}=${cookie.value}`);
    });
    // Log the actual URL being sent to the target for debugging
    console.log(`Proxying request: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Check for redirects (3xx status codes)
    if (proxyRes.headers.location) {
      const originalLocation = proxyRes.headers.location;
      console.log(`Original redirect location: ${originalLocation}`);

      // Modify the redirect location to point back to your proxy server
      // This is the most common reason for being redirected to a "blocked" link
      // if the target site redirects to its own domain.
      try {
        const targetUrl = new URL(proxyRes.req.protocol + '//' + proxyRes.req.host + proxyRes.req.path);
        const redirectUrl = new URL(originalLocation, targetUrl); // Resolve relative redirects

        // Only rewrite if the redirect is to the target domain itself
        // or a path that needs to be routed through your proxy's /src alias.
        if (redirectUrl.origin === customProxy.target) {
            // Reconstruct the path relative to the target's base,
            // then ensure it's rewritten to /src on your proxy
            const newPath = redirectUrl.pathname.replace(/^\/rvvASMiM/, '/src'); // Change /rvvASMiM back to /src
            const newLocation = `${req.protocol}://${req.get('host')}${newPath}${redirectUrl.search}`;
            proxyRes.headers.location = newLocation;
            console.log(`Rewriting redirect to: ${newLocation}`);
        } else {
            console.log(`Redirecting to external site, not rewriting: ${originalLocation}`);
        }
      } catch (error) {
        console.error("Error processing redirect location:", error);
      }
    }
  },
  pathRewrite: {
    '^/src': '/rvvASMiM',
  },
  // You might need to add secure: false if the target has certificate issues (unlikely for gamedistribution.com)
  // secure: false,
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
