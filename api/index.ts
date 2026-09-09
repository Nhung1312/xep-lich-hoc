import app from '../server/app.ts';

export default function handler(req: any, res: any) {
  // If Vercel rewrote /api/(.*) to /api, restore the original requested path
  const matchedPath =
    req.headers?.['x-matched-path'] ||
    req.headers?.['x-forwarded-uri'] ||
    req.headers?.['x-vercel-matched-path'];

  if (matchedPath && typeof matchedPath === 'string' && matchedPath.startsWith('/api')) {
    req.url = matchedPath;
  }

  // Pass req and res to the Express application
  return app(req, res);
}
