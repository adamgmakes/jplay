import { Router } from 'express';
import { scrapeSeasonList, scrapeSeasonGames } from '../scraper/jArchive.js';

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

router.get('/:seasonId/games', async (req, res) => {
  try {
    const games = await scrapeSeasonGames(req.params.seasonId);
    res.json({ games });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Failed to fetch season games' });
  }
});

export default router;
