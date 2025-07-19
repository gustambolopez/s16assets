import express from 'express'
import cookieParser from 'cookie-parser'
import { createProxyMiddleware } from 'http-proxy-middleware'

const app = express()
const port = 5000

app.use(cookieParser())

// middleware
const Proxy = createProxyMiddleware({
  target: 'https://velara.cc',
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false,
  onProxyReq: (proxyReq, req, res) => {
})

// routes
app.use((req, res, next) => {
  if (req.url.startsWith('/assets/game-imgs') || req.url.startsWith('/hosted/')) {
    return Proxy(req, res, next) 
  }

  // fallback
  console.log(`Cannot get ${req.url}`)
  res.status(404).send(`Cannot get ${req.url} `)
})

app.listen(port, () => {
console.log(`listening on  http://localhost:${port} http://127.0.0.1:${port}`)
})
