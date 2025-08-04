const express = require("express")
const cookieParser = require("cookie-parser")
const { createProxyMiddleware } = require("http-proxy-middleware")

const app = express()
const storedcookies = []
const port = 8080

app.use(cookieParser())

const gamedb = createProxyMiddleware({
  target: "https://html5.gamedistribution.com/rvvASMiM/?gd_sdk_referrer_url=yjgames.gamedistribution.com",
  changeOrigin: true,
  pathRewrite: (path, req) => {
    if (path.includes("?")) {
      return `${path}&gd_sdk_referrer_url=yjgames.gamedistribution.com`
    } else {
      return `${path}?gd_sdk_referrer_url=yjgames.gamedistribution.com`
    }
  },
  onProxyReq: (proxyReq) => {
    storedcookies.forEach((cookie) => {
      proxyReq.setHeader("cookie", `${cookie.name}=${cookie.value}`)
    })
  }
})

app.use(gamedb)

app.listen(port, () => {
  console.log(`listening on http://localhost${port}`)
})
