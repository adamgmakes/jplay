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

const origins = ALLOWED_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
console.log('[jplay-server] allowed origins:', origins);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin / curl / health probes (no origin header)
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      console.warn('[cors] rejected origin', origin);
      return cb(new Error('CORS: origin not allowed'));
    },
    credentials: true,
  })
);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());

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
