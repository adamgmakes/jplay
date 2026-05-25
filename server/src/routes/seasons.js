import { Router } from 'express';
import { scrapeSeasonList } from '../scraper/jArchive.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const seasons = await scrapeSeasonList();
    res.json({ seasons });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Failed to fetch seasons' });
  }
});

export default router;
