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
  selfHandleResponse: true,

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
    // remove content-encoding header to avoid gzipped response download issue
    delete proxyRes.headers['content-encoding']

    // rewrite location header if present
    const location = proxyRes.headers['location']
    if (location) {
      proxyRes.headers['location'] = location.replace(/\?gd_sdk_referrer_url=yjgames\.gamedistribution\.com/, '')
    }

    // set headers to response
    Object.entries(proxyRes.headers).forEach(([key, value]) => {
      res.setHeader(key, value)
    })

    proxyRes.pipe(res)
  }
})

app.use(gameproxy)

app.listen(port, () => {
  console.log(`proxy running on http://localhost:${port}`)
})
