const express = require('express')
const cookieParser = require('cookie-parser')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
const cookies = []
const port = 8080

app.use(cookieParser())

const gameproxy = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com/',
  changeOrigin: true,
  selfHandleResponse: true,  // we will handle response manually

  onProxyReq(proxyReq, req) {
    if (cookies.length) {
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
      proxyReq.setHeader('cookie', cookieStr)
    }
    const url = new URL(req.originalUrl, 'http://dummy')
    url.searchParams.set('gd_sdk_referrer_url', 'yjgames.gamedistribution.com')
    proxyReq.path = url.pathname + url.search
  },

  onProxyRes(proxyRes, req, res) {
    const location = proxyRes.headers['location']
    if (location) {
      // remove the flag from the location header if present
      const newLocation = location.replace(/\?gd_sdk_referrer_url=yjgames\.gamedistribution\.com/, '')
      proxyRes.headers['location'] = newLocation
    }

    // pipe the proxied response to client
    proxyRes.pipe(res)
  }
})

app.use(gameproxy)

app.listen(port, () => {
  console.log(`proxy running on http://localhost:${port}`)
})
