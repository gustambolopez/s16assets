const express = require("express");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const storedCookies = [];
const PORT = 5000;

app.use(cookieParser());

const customProxy = createProxyMiddleware({
  target: "https://html5-portal-api.gamedistribution.com/",
  changeOrigin: true,
  onProxyReq: (proxyReq) => {
    storedCookies.forEach((cookie) => {
      proxyReq.setHeader("cookie", `${cookie.name}=${cookie.value}`);
    });
  }
});

app.use((req, res, next) => {
  const ignoredPaths = ["/404.html"];

  if (!ignoredPaths.includes(req.url)) {
    customProxy(req, res, next);
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`FA-v2 server listening on port ${PORT}`);
});
