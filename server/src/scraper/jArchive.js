import axios from 'axios';
import * as cheerio from 'cheerio';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 60 * 60 * 24, checkperiod: 600 });

const BASE = 'https://j-archive.com';
const USER_AGENT =
  'Mozilla/5.0 (compatible; J!PlayBot/1.0; educational/non-commercial)';

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1000;

async function politeFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  console.log(`[scrape] GET ${url}`);
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    console.log(`[scrape] OK ${url} (${res.data?.length || 0} bytes)`);
    return res.data;
  } catch (e) {
    console.error(`[scrape] FAIL ${url}: ${e.code || ''} ${e.message}`);
    throw e;
  }
}

function stripHtml(html) {
  if (!html) return '';
  return cheerio
    .load(`<div>${html}</div>`)('div')
    .text()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseValueText(txt) {
  if (!txt) return null;
  const m = txt.replace(/,/g, '').match(/\$?(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function parseAirDate($) {
  const title = $('title').text();
  // "J! Archive - Show #1234, aired 1998-01-15" or "Show #1234 - Thursday, January 15, 1998"
  const isoMatch = title.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const longMatch = title.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/i
  );
  if (longMatch) {
    const months = {
      january: '01',
      february: '02',
      march: '03',
      april: '04',
      may: '05',
      june: '06',
      july: '07',
      august: '08',
      september: '09',
      october: '10',
      november: '11',
      december: '12',
    };
    const mo = months[longMatch[1].toLowerCase()];
    const d = String(parseInt(longMatch[2], 10)).padStart(2, '0');
    return `${longMatch[3]}-${mo}-${d}`;
  }
  return null;
}

function parseShowNumber($) {
  const title = $('title').text();
  const m = title.match(/#(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function defaultValuesFor(roundKey, row) {
  // row is 1-indexed (1..5)
  if (roundKey === 'J') return row * 200;
  if (roundKey === 'DJ') return row * 400;
  return 0;
}

function parseRound($, roundSelector, roundKey, gameAirDateYear) {
  const $round = $(roundSelector);
  if (!$round.length) return null;

  const categories = [];
  $round.find('td.category_name').each((i, el) => {
    categories.push($(el).text().trim());
  });

  const clues = [];
  $round.find('td.clue').each((i, el) => {
    const $cell = $(el);
    const $clueText = $cell.find('td.clue_text').first();
    if (!$clueText.length) return; // empty cell

    const id = $clueText.attr('id') || '';
    // id like clue_J_1_1 or clue_DJ_3_4
    const idMatch = id.match(/^clue_(J|DJ|FJ)_(\d+)_(\d+)$/);
    if (!idMatch) return;
    const col = parseInt(idMatch[2], 10);
    const row = parseInt(idMatch[3], 10);

    const isDailyDouble = $cell.find('td.clue_value_daily_double').length > 0;
    const valueText =
      $cell.find('td.clue_value').first().text() ||
      $cell.find('td.clue_value_daily_double').first().text();
    let value = parseValueText(valueText);
    if (value == null) value = defaultValuesFor(roundKey, row);

    const rawText = $clueText.html() || '';
    const text = stripHtml(rawText);

    // Answer is in the second clue_text (with _r suffix) or in mouseover
    let answer = null;
    const $resp = $cell.find(`#clue_${roundKey}_${col}_${row}_r`).first();
    if ($resp.length) {
      const $correct = $resp.find('em.correct_response').first();
      if ($correct.length) answer = stripHtml($correct.html());
    }
    if (!answer) {
      // older games stash it in onmouseover
      const onmouseover = $cell.find('div[onmouseover]').attr('onmouseover');
      if (onmouseover) {
        const m = onmouseover.match(
          /<em class=\\?"correct_response\\?">([\s\S]*?)<\/em>/
        );
        if (m) answer = stripHtml(m[1]);
      }
    }

    const unrevealed = /\[unrevealed\]/i.test(rawText) || !text;

    clues.push({
      id,
      category: categories[col - 1] || null,
      categoryIndex: col - 1,
      row,
      value,
      text: unrevealed ? null : text,
      answer: answer || null,
      isDailyDouble,
      isRevealed: false,
    });
  });

  return { categories, clues };
}

function parseFinalJeopardy($) {
  const $fj = $('#final_jeopardy_round');
  if (!$fj.length) return null;
  const category = $fj.find('td.category_name').first().text().trim() || null;
  const $clueText = $fj.find('#clue_FJ').first();
  const text = stripHtml($clueText.html());
  let answer = null;
  const $resp = $fj.find('#clue_FJ_r').first();
  if ($resp.length) {
    const $correct = $resp.find('em.correct_response').first();
    if ($correct.length) answer = stripHtml($correct.html());
  }
  if (!answer) {
    const onmouseover = $fj.find('div[onmouseover]').attr('onmouseover');
    if (onmouseover) {
      const m = onmouseover.match(
        /<em class=\\?"correct_response\\?">([\s\S]*?)<\/em>/
      );
      if (m) answer = stripHtml(m[1]);
    }
  }
  return { category, clue: { text: text || null, answer: answer || null } };
}

function parseContestants($) {
  const contestants = [];
  // names
  $('p.contestants a').each((i, el) => {
    const name = $(el).text().trim();
    if (name) contestants.push({ name, finalScore: null, coryatScore: null });
  });

  // final scores: table#final_scores or class final_scores
  const $finalScores = $('table.final_scores, #final_scores').first();
  if ($finalScores.length) {
    const names = [];
    const scores = [];
    $finalScores.find('td.score_player_nickname').each((i, el) => {
      names.push($(el).text().trim());
    });
    $finalScores.find('td.score_positive, td.score_negative').each((i, el) => {
      const t = $(el).text().trim();
      const neg = $(el).hasClass('score_negative');
      const v = parseInt(t.replace(/[^0-9]/g, ''), 10);
      if (!Number.isNaN(v)) scores.push(neg ? -v : v);
    });
    names.forEach((n, i) => {
      const c = contestants.find((x) => x.name === n);
      if (c) c.finalScore = scores[i] ?? null;
      else contestants.push({ name: n, finalScore: scores[i] ?? null, coryatScore: null });
    });
  }

  // coryat scores
  const $coryat = $('table#coryat_scores, table.coryat_scores').first();
  if ($coryat.length) {
    const names = [];
    const scores = [];
    $coryat.find('td.score_player_nickname').each((i, el) => {
      names.push($(el).text().trim());
    });
    $coryat.find('td.score_positive, td.score_negative').each((i, el) => {
      const t = $(el).text().trim();
      const v = parseInt(t.replace(/[^0-9]/g, ''), 10);
      if (!Number.isNaN(v)) scores.push(v);
    });
    names.forEach((n, i) => {
      const c = contestants.find((x) => x.name === n);
      if (c) c.coryatScore = scores[i] ?? null;
    });
  }

  return contestants;
}

export async function scrapeGame(gameId) {
  const key = `game:${gameId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = `${BASE}/showgame.php?game_id=${gameId}`;
  let html;
  try {
    html = await politeFetch(url);
  } catch (e) {
    if (e.response && e.response.status === 404) return null;
    throw e;
  }

  const $ = cheerio.load(html);
  if (!$('#game_title').length && !$('#jeopardy_round').length) return null;

  const airDate = parseAirDate($);
  const showNumber = parseShowNumber($);

  const jeopardy = parseRound($, '#jeopardy_round', 'J');
  const doubleJeopardy = parseRound($, '#double_jeopardy_round', 'DJ');
  const finalJeopardy = parseFinalJeopardy($);
  const contestants = parseContestants($);

  if (!jeopardy && !doubleJeopardy && !finalJeopardy) return null;

  const data = {
    gameId: Number(gameId),
    airDate,
    showNumber,
    rounds: {
      jeopardy: jeopardy || { categories: [], clues: [] },
      doubleJeopardy: doubleJeopardy || { categories: [], clues: [] },
      finalJeopardy: finalJeopardy || {
        category: null,
        clue: { text: null, answer: null },
      },
    },
    contestants,
  };

  cache.set(key, data);
  return data;
}

export async function scrapeSeasonList() {
  const key = 'seasons:list';
  const cached = cache.get(key);
  if (cached) return cached;

  const url = `${BASE}/listseasons.php`;
  const html = await politeFetch(url);
  const $ = cheerio.load(html);
  const seasons = [];
  $('table a[href*="listseason.php?season="]').each((i, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/season=([^&]+)/);
    if (!m) return;
    const id = m[1];
    const label = $(el).text().trim();
    const $row = $(el).closest('tr');
    const yearText = $row.find('td').eq(1).text().trim();
    seasons.push({ id, label, years: yearText });
  });
  cache.set(key, seasons, 60 * 60 * 24 * 7);
  return seasons;
}

export async function scrapeSeasonGameIds(seasonId) {
  const key = `season:${seasonId}:games`;
  const cached = cache.get(key);
  if (cached) return cached;
  const url = `${BASE}/listseason.php?season=${encodeURIComponent(seasonId)}`;
  const html = await politeFetch(url);
  const $ = cheerio.load(html);
  const ids = new Set();
  $('a[href*="showgame.php?game_id="]').each((i, el) => {
    const m = ($(el).attr('href') || '').match(/game_id=(\d+)/);
    if (m) ids.add(parseInt(m[1], 10));
  });
  const arr = [...ids];
  cache.set(key, arr, 60 * 60 * 24);
  return arr;
}
