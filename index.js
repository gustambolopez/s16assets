const express = require('express')
const cookieParser = require('cookie-parser')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
const cookies = []
const port = 8080

app.use(cookieParser())

// middleware to redirect if flag missing
app.use((req, res, next) => {
  const url = new URL(req.originalUrl, 'http://dummy')
  if (!url.searchParams.has('gd_sdk_referrer_url')) {
    url.searchParams.set('gd_sdk_referrer_url', 'yjgames.gamedistribution.com')
    return res.redirect(url.pathname + url.search)
  }
  next()
})

const gameproxy = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com/',
  changeOrigin: true,
  onProxyReq(proxyReq, req) {
    if (cookies.length) {
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
      proxyReq.setHeader('cookie', cookieStr)
    }
    // path already has the flag from redirect
    proxyReq.path = req.originalUrl
  }
})

app.use(gameproxy)

app.listen(port, () => {
  console.log(`proxy running on http://localhost:${port}`)
})
