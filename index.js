const express = require("express");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const storedCookies = [];
const PORT = 5000;

app.use(cookieParser());


app.use((req, res, next) => {
  if (req.url.includes("rvvASMiM")) {
    next();
  } else {
    next();
  }
});

const customProxy = createProxyMiddleware({
  target: "https://html5.gamedistribution.com",
  changeOrigin: true,
  onProxyReq: (proxyReq) => {
    storedCookies.forEach((cookie) => {
      proxyReq.setHeader("cookie", `${cookie.name}=${cookie.value}`);
    });
  }
});

app.use(customProxy); 

app.listen(PORT, () => {
  console.log(`FA-v2 server listening on port ${PORT}`);
});
