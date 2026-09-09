import app from '../server/app.ts';

export default function handler(req: any, res: any) {
  try {
    let targetPath = req.url || '/';

    // 1. Check if originalUrl exists and starts with /api
    if (req.originalUrl && typeof req.originalUrl === 'string' && req.originalUrl.startsWith('/api')) {
      targetPath = req.originalUrl;
    }
    // 2. Check query parameter __path from Vercel rewrite /api/(.*) -> /api?__path=$1
    else if (req.query?.__path && typeof req.query.__path === 'string') {
      const cleanSubPath = req.query.__path.replace(/^\/+/, '');
      targetPath = `/api/${cleanSubPath}`;
    }
    // 3. Check Vercel edge rewrite headers
    else {
      const matchedHeader =
        req.headers?.['x-matched-path'] ||
        req.headers?.['x-forwarded-uri'] ||
        req.headers?.['x-vercel-matched-path'] ||
        req.headers?.['x-invoke-path'] ||
        req.headers?.['x-real-origin-url'];

      if (matchedHeader && typeof matchedHeader === 'string' && matchedHeader.startsWith('/api')) {
        targetPath = matchedHeader;
      }
    }

    req.url = targetPath;
    return app(req, res);
  } catch (err: any) {
    console.error('Unhandled serverless handler error in api/index.ts:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Internal server error' });
    }
  }
}
