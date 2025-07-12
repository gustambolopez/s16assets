import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import zlib from 'zlib';

const app = express();
const PORT = 5000;
const storedCookies = [];

app.use(cookieParser());

const bypassParams = 'gd_sdk_referrer_url=https://y8.com/&key=10322731&value=194340';

app.use((req, res, next) => {
  if (req.url.startsWith('/src') && !req.url.includes(bypassParams.split('=')[0])) {
    const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const redirectUrl = `${currentUrl.origin}${currentUrl.pathname}?${bypassParams}`;
    console.log(`Client-side redirecting: ${req.originalUrl} -> ${redirectUrl}`);
    return res.redirect(302, redirectUrl);
  }
  next();
});

const proxy = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com',
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,

  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    console.log(`Proxying request: ${req.url} -> ${proxyReq.path}`);

    if (req.url.startsWith('/src')) {
      const pathname = proxyReq.path.split('?')[0]; 
      proxyReq.path = `${pathname}?${bypassParams}`;
    }
  },

  onProxyRes: (proxyRes, req, res) => {
    // 1. Handle Location Header (Redirects)
    const loc = proxyRes.headers.location;
    if (loc) {
      console.log(`Redirect found: ${loc}`);
      const BLOCKED_STRING_IN_REDIRECT = 'https://html5.api.gamedistribution.com/blocked.html?domain=s16apitest.vercel.app';

      try {
        if (loc.includes(BLOCKED_STRING_IN_REDIRECT)) {
          console.warn(`Blocked redirect: ${loc}`);
          // Do not set response headers if we're ending early with a custom message
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Game not available here.');
          return; 
        }
      } catch (e) {
        console.error('Error parsing redirect URL for blocking check:', e);
      }

      try {
        const targetOrigin = `${proxyRes.req.protocol}//${proxyRes.req.host}`;
        const fullRedirect = new URL(loc, targetOrigin);

        if (fullRedirect.origin === proxy.target) {
          const newPath = fullRedirect.pathname.replace(/^\/rvvASMiM/, '/src'); 
          const newUrl = `${req.protocol}://${req.get('host')}${newPath}?${bypassParams}`; 
          
          // When handling redirects, you typically set the Location header directly and end the response.
          // You don't need to pass through the content-handling part for redirects.
          // Copy relevant headers for redirect
          for (const header in proxyRes.headers) {
              if (header.toLowerCase() !== 'content-encoding' && header.toLowerCase() !== 'content-length') {
                  res.setHeader(header, proxyRes.headers[header]);
              }
          }
          res.setHeader('Location', newUrl);
          res.writeHead(proxyRes.statusCode || 302); // Use original status code or 302
          res.end(); // End the response for the redirect
          console.log(`Rewriting redirect: ${loc} -> ${newUrl}`);
          return; // IMPORTANT: Stop processing this response as it's a redirect
        } else {
          console.log(`Redirecting to external site, not rewriting: ${loc}`);
          // For external redirects, still copy headers and send original status/location
          for (const header in proxyRes.headers) {
            if (header.toLowerCase() !== 'content-encoding' && header.toLowerCase() !== 'content-length') {
              res.setHeader(header, proxyRes.headers[header]);
            }
          }
          res.writeHead(proxyRes.statusCode || 302);
          res.end();
          return;
        }
      } catch (error) {
        console.error('Redirect rewrite error:', error);
      }
    }

    // 2. Handle Content Rewriting (Fixes Mixed Content and internal hostnames/paths)
    const contentType = proxyRes.headers['content-type'];
    const contentEncoding = proxyRes.headers['content-encoding'];
    const isTextContent = contentType && (
      contentType.includes('text/html') || 
      contentType.includes('application/javascript') || 
      contentType.includes('text/css') || 
      contentType.includes('image/svg+xml')
    );

    // Copy all headers from proxyRes to res first, then modify if needed
    // This ensures correct caching, content-type, etc. for the client
    for (const header in proxyRes.headers) {
        // Don't copy Content-Encoding and Content-Length yet, as we might modify them
        if (header.toLowerCase() !== 'content-encoding' && header.toLowerCase() !== 'content-length') {
            res.setHeader(header, proxyRes.headers[header]);
        }
    }

    if (isTextContent) {
        let chunks = [];
        proxyRes.on('data', chunk => chunks.push(chunk));
        proxyRes.on('end', () => {
            const buffer = Buffer.concat(chunks);
            let content = buffer;

            try {
                if (contentEncoding === 'gzip') {
                    content = zlib.gunzipSync(buffer);
                } else if (contentEncoding === 'deflate') {
                    content = zlib.inflateSync(buffer);
                } else if (contentEncoding === 'br') {
                    content = zlib.brotliDecompressSync(buffer);
                }
            } catch (e) {
                console.error(`Decompression error for ${req.url}:`, e);
                content = buffer;
            }

            let textContent = content.toString('utf8');

            // Rewrite http:// to https://
            textContent = textContent.replace(/http:\/\//g, 'https://');

            // Rewrite target domains to proxy domain
            const proxyHost = req.get('host');
            textContent = textContent.replace(/https?:\/\/html5\.gamedistribution\.com/g, `https://${proxyHost}`);
            textContent = textContent.replace(/https?:\/\/html5\.api\.gamedistribution\.com/g, `https://${proxyHost}`);
            textContent = textContent.replace(/\/rvvASMiM/g, '/src');

            // Re-encode (optional, but good practice if original was compressed)
            let recompressedContent = Buffer.from(textContent);
            try {
                if (contentEncoding === 'gzip') {
                    recompressedContent = zlib.gzipSync(recompressedContent);
                } else if (contentEncoding === 'deflate') {
                    recompressedContent = zlib.deflateSync(recompressedContent);
                } else if (contentEncoding === 'br') {
                    recompressedContent = zlib.brotliCompressSync(recompressedContent);
                }
            } catch (e) {
                console.error(`Recompression error for ${req.url}:`, e);
                recompressedContent = Buffer.from(textContent);
            }

            // Set final headers for the client response
            // No Content-Encoding if we've modified content
            res.removeHeader('Content-Encoding'); 
            res.setHeader('Content-Length', recompressedContent.length); // Correct length after modification

            res.writeHead(proxyRes.statusCode || 200); // Write status code before body
            res.end(recompressedContent); // Send the modified content
        });
    } else {
        // For non-text content (images, binary files), pipe directly
        // IMPORTANT: Copy headers and set status code before piping!
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers); // Copy all headers and status
        proxyRes.pipe(res); // Pipe the original content
    }
  },

  pathRewrite: {
    '^/src': '/rvvASMiM',
  },
});

app.use((req, res, next) => {
  if (req.url.startsWith('/src')) { 
    proxy(req, res, next);
  } else {
    res.status(404).send(`Cannot GET ${req.url}`);
  }
});

app.listen(PORT, () => {
  console.log(`FA-v2 server is running at http://localhost:${PORT}`);
});
