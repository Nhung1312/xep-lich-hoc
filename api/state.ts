import { dbRepository } from '../server/repository.ts';
import { createInitialSeedData } from '../server/db.ts';

export default async function handler(req: any, res: any) {
  // Enable CORS & proper content type
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    const data = await dbRepository.getState();
    return res.status(200).json(data);
  } catch (err) {
    console.error('api/state handler error:', err);
    try {
      const fallback = createInitialSeedData();
      return res.status(200).json(fallback);
    } catch {
      return res.status(500).json({ error: 'Không thể tải dữ liệu từ máy chủ' });
    }
  }
}
