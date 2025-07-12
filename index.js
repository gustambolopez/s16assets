// Change require to import for all modules
import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const storedCookies = [];
const PORT = 5000;

app.use(cookieParser());

const customProxy = createProxyMiddleware({
  target: "https://html5.gamedistribution.com",
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,

  onProxyReq: (proxyReq, req, res) => {
    storedCookies.forEach((cookie) => {
      proxyReq.setHeader("cookie", `${cookie.name}=${cookie.value}`);
    });

    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    console.log(`Original request path: ${req.url}`);

    const SDK_BYPASS_PARAMS = "?gd_sdk_referrer_url=https://y8.com/&key=10322731&value=194340";

    let newPath = proxyReq.path;
    if (req.url.startsWith('/src') && !newPath.includes("gd_sdk_referrer_url")) {
      newPath = newPath + (newPath.includes('?') ? '&' : '') + SDK_BYPASS_PARAMS.substring(1);
    }
    proxyReq.path = newPath;

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

    let body = [];
    proxyRes.on('data', (chunk) => {
      body.push(chunk);
    });
    proxyRes.on('end', () => {
      let responseBody = Buffer.concat(body).toString();
      const contentType = proxyRes.headers['content-type'] || '';

      Object.keys(proxyRes.headers).forEach(function (header) {
        if (header.toLowerCase() === 'content-length') return;
        res.setHeader(header, proxyRes.headers[header]);
      });

      if (contentType.includes('text/html') || contentType.includes('application/javascript')) {
         // console.log(`Attempting basic content rewrite for ${req.url}`);
         // responseBody = responseBody.replace(/html5\.gamedistribution\.com/g, `${req.get('host')}`);
      }

      res.end(responseBody);
    });
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
