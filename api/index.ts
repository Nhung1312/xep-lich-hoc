import app from '../server/app.ts';

export default function handler(req: unknown, res: unknown) {
  // Pass req and res to the Express application
  return (app as unknown as (req: unknown, res: unknown) => void)(req, res);
}
