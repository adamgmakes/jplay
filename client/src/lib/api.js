import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({ baseURL, timeout: 30000 });

export async function fetchGame(gameId, { withResponses = false } = {}) {
  const { data } = await api.get(`/api/game/${gameId}`, {
    params: withResponses ? { include: 'responses' } : {},
  });
  return data;
}

export async function fetchRandomGame(season) {
  const { data } = await api.get('/api/game/random', {
    params: season ? { season } : {},
  });
  return data;
}

export async function fetchSeasons() {
  const { data } = await api.get('/api/seasons');
  return data.seasons || [];
}

export async function fetchSeasonGames(seasonId) {
  const { data } = await api.get(
    `/api/seasons/${encodeURIComponent(seasonId)}/games`
  );
  return data.games || [];
}
