import { Router } from 'express';
import {
  scrapeGame,
  scrapeSeasonGameIds,
} from '../scraper/jArchive.js';

const router = Router();

router.get('/random', async (req, res) => {
  try {
    const season = req.query.season;
    let pool = null;
    if (season) {
      try {
        pool = await scrapeSeasonGameIds(season);
      } catch {
        pool = null;
      }
    }
    const tried = new Set();
    const MAX_TRIES = 10;
    for (let i = 0; i < MAX_TRIES; i++) {
      let id;
      if (pool && pool.length) {
        id = pool[Math.floor(Math.random() * pool.length)];
      } else {
        id = Math.floor(Math.random() * 9000) + 1;
      }
      if (tried.has(id)) continue;
      tried.add(id);
      try {
        const game = await scrapeGame(id);
        if (game) return res.json(game);
      } catch {
        // continue
      }
    }
    return res.status(404).json({ error: 'No game found after retries' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Random game lookup failed' });
  }
});

router.get('/:gameId', async (req, res) => {
  const id = parseInt(req.params.gameId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid game id' });
  }
  try {
    const game = await scrapeGame(id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Failed to fetch game from J! Archive' });
  }
});

export default router;
