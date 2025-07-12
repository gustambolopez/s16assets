const express = require("express");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const storedCookies = [];
const PORT = 5000;

app.use(cookieParser());

// No specific /src path; all requests to your proxy go to target
const customProxy = createProxyMiddleware({
  target: "https://html5.gamedistribution.com",
  changeOrigin: true, // Crucial
  ws: true,
  onProxyReq: (proxyReq, req, res) => {
    storedCookies.forEach((cookie) => {
      proxyReq.setHeader("cookie", `${cookie.name}=${cookie.value}`);
    });
    // Still spoof Referer/Origin
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');
    console.log(`Proxying request: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // ... (your existing CSP and X-Frame-Options modifications here) ...

    // Your blocking logic (if you still want to block certain paths on the target)
    const originalLocation = proxyRes.headers.location;
    const BLOCKED_STRING_IN_REDIRECT = "https://html5.api.gamedistribution.com/blocked.html?domain=s16apitest.vercel.app";
    if (originalLocation && originalLocation.includes(BLOCKED_STRING_IN_REDIRECT)) {
        console.warn(`Blocked redirect to: ${originalLocation} (contains blocked string)`);
        delete proxyRes.headers.location;
        res.status(200).send("Game not available here. This content is blocked via proxy due to an unauthorized domain redirect.");
        return;
    }

    // ONLY rewrite redirects if they point back to the target's original domain
    // This makes sure internal Gamedistribution redirects stay within the proxied context
    if (originalLocation && originalLocation.startsWith(proxyRes.req.protocol + '//' + proxyRes.req.host)) {
        // Replace the target's domain with your proxy's domain in the redirect
        proxyRes.headers.location = originalLocation.replace(proxyRes.req.protocol + '//' + proxyRes.req.host, `${req.protocol}://${req.get('host')}`);
        console.log(`Rewriting internal redirect to: ${proxyRes.headers.location}`);
    }
  },
  // No pathRewrite needed if you're proxying the entire domain
});

// Apply the proxy to all incoming requests
app.use('/', customProxy); // All requests to your proxy go to gamedistribution.com

app.listen(PORT, () => {
  console.log(`FA-v2 server listening on port ${PORT}`);
});
