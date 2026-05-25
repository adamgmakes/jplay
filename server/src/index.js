import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import gameRouter from './routes/game.js';
import seasonsRouter from './routes/seasons.js';

const app = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

app.use(helmet());
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  })
);

const gameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/game', gameLimiter, gameRouter);
app.use('/api/seasons', seasonsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[jplay-server] listening on :${PORT}`);
});
