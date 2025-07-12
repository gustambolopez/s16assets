import express from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import zlib from 'zlib'; // Import zlib for handling compressed content

// s16dih
const app = express();
const PORT = 5000;
const storedCookies = []; // Not used in this current snippet, but kept for context

app.use(cookieParser());

// Parameters to append for redirection and proxying
const bypassParams = 'gd_sdk_referrer_url=https://y8.com/&key=10322731&value=194340';

// --- MIDDLEWARE FOR CLIENT-SIDE REDIRECTION (Ensures URL has params for client) ---
app.use((req, res, next) => {
  // Check if the URL starts with /src AND does not already contain our bypass parameters
  if (req.url.startsWith('/src') && !req.url.includes(bypassParams.split('=')[0])) { // Check for 'gd_sdk_referrer_url'
    const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    
    // Construct the new URL with parameters appended directly after the pathname
    const redirectUrl = `${currentUrl.origin}${currentUrl.pathname}?${bypassParams}`;

    console.log(`Client-side redirecting: ${req.originalUrl} -> ${redirectUrl}`);
    return res.redirect(302, redirectUrl); // Send a 302 Found redirect
  }
  next(); // If no redirect needed, pass control to the next middleware
});
// --- END NEW MIDDLEWARE ---

// middleware 
const proxy = createProxyMiddleware({
  target: 'https://html5.gamedistribution.com',
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true, // IMPORTANT: Set to true to allow manual response handling (content modification)

  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Referer', 'https://html5.gamedistribution.com/');
    proxyReq.setHeader('Origin', 'https://html5.gamedistribution.com');

    console.log(`Proxying request: ${req.url} -> ${proxyReq.path}`);

    // This block ensures the parameters are on the URL sent to the target server.
    // It overrides any existing query parameters to ensure our specific ones are used.
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

      // --- Redirect Blocking ---
      try {
        if (loc.includes(BLOCKED_STRING_IN_REDIRECT)) {
          console.warn(`Blocked redirect: ${loc}`);
          delete proxyRes.headers.location; // Remove the problematic location header
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Game not available here.');
          return; // Stop processing this response
        }
      } catch (e) {
        console.error('Error parsing redirect URL for blocking check:', e);
      }

      // --- Redirect Rewriting (Fixes /rvvASMiM and ensures correct parameters) ---
      try {
        const targetOrigin = `${proxyRes.req.protocol}//${proxyRes.req.host}`;
        const fullRedirect = new URL(loc, targetOrigin);

        if (fullRedirect.origin === proxy.target) {
          // Replace /rvvASMiM with /src for the client's view
          const newPath = fullRedirect.pathname.replace(/^\/rvvASMiM/, '/src'); 
          // Construct the new URL, forcing our bypassParams and ignoring target's original query
          const newUrl = `${req.protocol}://${req.get('host')}${newPath}?${bypassParams}`; 
          proxyRes.headers.location = newUrl; // Set the modified location header
          console.log(`Rewriting redirect: ${loc} -> ${newUrl}`);
        } else {
          console.log(`Redirecting to external site, not rewriting: ${loc}`);
        }
      } catch (error) {
        console.error('Redirect rewrite error:', error);
      }
    }

    // 2. Handle Content Rewriting (Fixes Mixed Content and internal hostnames/paths)
    const contentType = proxyRes.headers['content-type'];
    const contentEncoding = proxyRes.headers['content-encoding'];
    // Determine if content is text-based and needs rewriting
    const isTextContent = contentType && (
      contentType.includes('text/html') || 
      contentType.includes('application/javascript') || 
      contentType.includes('text/css') || 
      contentType.includes('image/svg+xml') // SVG files can also contain URLs
    );

    if (isTextContent) {
        let chunks = [];
        proxyRes.on('data', chunk => chunks.push(chunk)); // Collect response data chunks
        proxyRes.on('end', () => {
            const buffer = Buffer.concat(chunks);
            let content = buffer;

            // --- Decompression ---
            try {
                if (contentEncoding === 'gzip') {
                    content = zlib.gunzipSync(buffer);
                } else if (contentEncoding === 'deflate') {
                    content = zlib.inflateSync(buffer);
                } else if (contentEncoding === 'br') { // Brotli compression
                    content = zlib.brotliDecompressSync(buffer);
                }
            } catch (e) {
                console.error(`Decompression error for ${req.url}:`, e);
                // Fallback to original buffer if decompression fails
                content = buffer; 
            }

            let textContent = content.toString('utf8');

            // --- URL Rewriting within content ---
            // Rewrite http:// to https:// for all embedded URLs
            textContent = textContent.replace(/http:\/\//g, 'https://');

            // Rewrite original GameDistribution domains to your proxy's domain
            const proxyHost = req.get('host');
            textContent = textContent.replace(/https?:\/\/html5\.gamedistribution\.com/g, `https://${proxyHost}`);
            textContent = textContent.replace(/https?:\/\/html5\.api\.gamedistribution\.com/g, `https://${proxyHost}`);
            
            // Also rewrite any remaining /rvvASMiM paths within the content to /src
            textContent = textContent.replace(/\/rvvASMiM/g, '/src');

            // --- Re-encoding (if desired, to maintain compression) ---
            let recompressedContent = Buffer.from(textContent); // Start with uncompressed modified content
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
                // Fallback to uncompressed text if recompression fails
                recompressedContent = Buffer.from(textContent);
            }

            // --- Set Headers for Client Response ---
            res.setHeader('Content-Type', contentType);
            // Remove content-encoding header as we've handled compression/decompression
            res.removeHeader('Content-Encoding'); 
            res.setHeader('Content-Length', recompressedContent.length);

            res.end(recompressedContent); // Send the modified content to the client
        });
    } else {
        // For non-text content (e.g., images, binary files), just pipe directly without modification
        proxyRes.pipe(res);
    }
  },

  pathRewrite: {
    '^/src': '/rvvASMiM', // Continues to rewrite /src to /rvvASMiM for the target server
  },
});

// Middleware to block all paths except those starting with /src
app.use((req, res, next) => {
  if (req.url.startsWith('/src')) { 
    proxy(req, res, next); // Pass to the proxy middleware
  } else {
    res.status(404).send(`Cannot GET ${req.url}`); // Block other paths
  }
});

app.listen(PORT, () => {
  console.log(`FA-v2 server is running at http://localhost:${PORT}`);
});
