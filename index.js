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
  onProxyReq: (proxyReq, req, res) => {
    storedCookies.forEach((cookie) => {
      proxyReq.setHeader("cookie", `${cookie.name}=${cookie.value}`);
    });
    console.log(`Proxying request: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.headers.location) {
      const originalLocation = proxyRes.headers.location;
      console.log(`Original redirect location: ${originalLocation}`);

      // Define the specific blocked URL you want to prevent
      const BLOCKED_REDIRECT_URL = "https://html5.api.gamedistribution.com/blocked.html?domain=s16apitest.vercel.app";

      // Check if the original redirect location matches the blocked URL
      if (originalLocation === BLOCKED_REDIRECT_URL) {
        console.warn(`Blocked redirect to: ${originalLocation}`);
        // Instead of redirecting, you could send a custom error message,
        // or just let the response go through (which might show the blocked page content directly if not an actual redirect)
        // For now, we'll actively prevent the redirect by removing the Location header
        delete proxyRes.headers.location;
        // Optionally, send a generic error or redirect to a safe page on your proxy
        res.status(200).send("Game not available here due to a blocked redirect."); // Or render a custom HTML error page
        return; // Stop further processing of this response in onProxyRes
      }

      // If it's not the specifically blocked URL, proceed with existing rewrite logic
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
        console.error("Error processing redirect location:", error);
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
