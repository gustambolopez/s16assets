const express = require("express");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const storedCookies = [];
const PORT = 5000;

app.use(cookieParser());

const customProxy = createProxyMiddleware({
  target: "https://html5.gamedistribution.com",
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false,

  onProxyReq: (proxyReq, req, res) => {
    storedCookies.forEach((cookie) => {
      proxyReq.setHeader("cookie", `${cookie.name}=${cookie.value}`);
    });

    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    console.log(`Proxying request: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
  },

  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.headers.location) {
      const originalLocation = proxyRes.headers.location;
      console.log(`Original redirect location: ${originalLocation}`);

      // Define the specific string that, if found anywhere in the redirect URL, should trigger a block.
      // Make sure this string is unique enough to avoid false positives.
      const BLOCKED_STRING_IN_REDIRECT = "https://html5.api.gamedistribution.com/blocked.html?domain=s16apitest.vercel.app";

      // Check if the original redirect location CONTAINS the blocked string
      if (originalLocation.includes(BLOCKED_STRING_IN_REDIRECT)) {
        console.warn(`Blocked redirect to: ${originalLocation} (contains blocked string)`);
        delete proxyRes.headers.location; // Remove the Location header
        res.status(200).send("Game not available here. This content is blocked via proxy due to an unauthorized domain redirect.");
        return; // Stop further processing for this response
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
