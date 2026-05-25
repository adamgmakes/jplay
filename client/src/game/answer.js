// Levenshtein distance (iterative, O(n*m))
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\b(a|an|the)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkAnswer(userAnswer, correctAnswer) {
  const u = normalize(userAnswer);
  const c = normalize(correctAnswer);
  if (!u || !c) return false;
  if (u === c) return true;
  if (c.includes(u) && u.length >= 3) return true;
  if (u.includes(c) && c.length >= 3) return true;
  const d = levenshtein(u, c);
  if (d <= 2) return true;
  if (d <= Math.floor(c.length * 0.2)) return true;
  // Also try token overlap for multi-word answers
  const uTokens = new Set(u.split(' ').filter((t) => t.length > 2));
  const cTokens = new Set(c.split(' ').filter((t) => t.length > 2));
  if (cTokens.size > 0) {
    let hit = 0;
    for (const t of cTokens) if (uTokens.has(t)) hit++;
    if (hit / cTokens.size >= 0.7) return true;
  }
  return false;
}
