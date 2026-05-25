import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({ baseURL, timeout: 30000 });

export async function fetchGame(gameId) {
  const { data } = await api.get(`/api/game/${gameId}`);
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
