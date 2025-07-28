const express = require('express')
const cookieParser = require('cookie-parser')
const { createProxyMiddleware } = require('http-proxy-middleware')
const app = express()
const storedcookies = []
const port = 8080

app.use(cookieParser())

app.get('/', (req, res) => {
  res.status(404).send('Cannot GET /');
});

const handler = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com',
  changeOrigin: true,
  selfHandleResponse: true,
  onProxyReq: (proxyReq) => {
    proxyReq.removeHeader('accept-encoding')

    storedcookies.forEach(cookie => {
      proxyReq.setHeader('cookie', `${cookie.name}=${cookie.value}`)
    })
  },
  onProxyRes: (proxyRes, req, res) => {
    const contentType = proxyRes.headers['content-type'] || ''
    const ishtml = contentType.includes('text/html')
    const chunks = []

    if (!ishtml) {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      return proxyRes.pipe(res)
    }

    proxyRes.on('data', chunk => chunks.push(chunk))
    proxyRes.on('end', () => {
      const buffer = Buffer.concat(chunks)
      let html

      try {
        html = buffer.toString('utf8')
      } catch (err) {
        console.error('decode failed', err)
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        return res.end(buffer)
      }
      // gdab saved my ahh again
      const script = `<script type="text/javascript">window.onbeforeunload=function(){setTimeout((function(){window.stop()}),1)};const originalWindowOpen=window.open;window.open=function(){return null},window.confirm=function(){return!1},window.alert=function(e){};const currentDomain=window.location.hostname;function isSameDomain(e){if(!e)return!0;try{if(e.startsWith("/")||!e.includes("://"))return!0;return new URL(e).hostname===currentDomain}catch(e){return!1}}const originalFetch=window.fetch;window.fetch=function(e,n){const t="string"==typeof e?e:e.url;return isSameDomain(t)?originalFetch.apply(this,arguments):(console.log("Blocked external fetch request to:",t),new Promise(((e,n)=>{n(new Error("External network request blocked"))})))};const originalXHR=window.XMLHttpRequest;window.XMLHttpRequest=function(){const e=new originalXHR,n=e.open;e.open=function(t,o,...i){return e._blockedUrl=isSameDomain(o)?null:o,n.apply(this,[t,o,...i])};const t=e.send;return e.send=function(n){return e._blockedUrl?(console.log("Blocked external XHR request to:",e._blockedUrl),Object.defineProperty(this,"status",{value:0}),Object.defineProperty(this,"statusText",{value:"Error"}),void setTimeout((()=>{const e=new Event("error");this.dispatchEvent(e)}),0)):t.apply(this,arguments)},e};const originalImage=window.Image;window.Image=function(){const e=new originalImage,n=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");return Object.defineProperty(e,"src",{set:function(e){isSameDomain(e)?n.set.call(this,e):console.log("Blocked external image loading:",e)},get:function(){return n.get.call(this)}}),e};const originalCreateElement=document.createElement;document.createElement=function(e){const n=originalCreateElement.call(document,e);if("script"===e.toLowerCase()){const e=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,"src");Object.defineProperty(n,"src",{set:function(n){isSameDomain(n)?e.set.call(this,n):console.log("Blocked external script loading:",n)},get:function(){return e.get.call(this)}})}if("iframe"===e.toLowerCase()){const e=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,"src");Object.defineProperty(n,"src",{set:function(n){isSameDomain(n)?e.set.call(this,n):console.log("Blocked external iframe loading:",n)},get:function(){return e.get.call(this)}})}return n};const originalSendBeacon=navigator.sendBeacon;navigator.sendBeacon=function(e,n){return isSameDomain(e)?originalSendBeacon.call(this,e,n):(console.log("Blocked external beacon request to:",e),!1)};const originalWebSocket=window.WebSocket;window.WebSocket=function(e,n){return isSameDomain(e)?new originalWebSocket(e,n):(console.log("Blocked external WebSocket connection to:",e),{send:function(){},close:function(){},addEventListener:function(){}})},console.log("%cGDAB is running!","color: white; background-color: black; font-size: 22px; text-align: center; display: block; padding: 10px"),console.log("%cGameDistribution-AntiBlock BETA, by syncintellect @ github, and forked/improved by endlessguyin on github","color: white; background-color: black; font-size: 12px; text-align: center; display: block; padding: 10px");</script>`
      html = html.includes('</body>')
        ? html.replace('</body>', `${script}</body>`)
        : html + script

      proxyRes.headers['content-length'] = Buffer.byteLength(html, 'utf8')

      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      res.end(html, 'utf8')
    })
  }
})

app.use(handler)

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`)
})
