import { dbRepository } from '../server/repository.ts';

export default function handler(_req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    status: 'ok',
    database: dbRepository.getDatabaseType(),
    timestamp: new Date().toISOString(),
  });
}
