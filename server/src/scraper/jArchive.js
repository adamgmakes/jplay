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
  // Names from the contestants paragraph at the top.
  $('p.contestants a').each((i, el) => {
    const name = $(el).text().trim();
    if (name) contestants.push({ name, finalScore: null, coryatScore: null });
  });

  // Anchor on the <h3> headings — J! Archive doesn't class the score tables.
  function tableAfterHeading(rx) {
    let $found = null;
    $('h3').each((_, h) => {
      if (rx.test($(h).text())) {
        const $next = $(h).nextAll('table').first();
        if ($next.length) {
          $found = $next;
          return false;
        }
      }
    });
    return $found;
  }

  function extract($table) {
    const names = [];
    const scores = [];
    $table.find('td.score_player_nickname').each((i, el) => {
      names.push($(el).text().trim());
    });
    $table.find('td.score_positive, td.score_negative').each((i, el) => {
      const t = $(el).text().trim();
      const neg = $(el).hasClass('score_negative');
      const v = parseInt(t.replace(/[^0-9]/g, ''), 10);
      if (!Number.isNaN(v)) scores.push(neg ? -v : v);
    });
    return { names, scores };
  }

  function upsertScore(name, key, value) {
    if (!name) return;
    let c = contestants.find((x) => x.name === name);
    if (!c) {
      c = { name, finalScore: null, coryatScore: null };
      contestants.push(c);
    }
    c[key] = value;
  }

  const $final = tableAfterHeading(/final\s+scores/i);
  if ($final) {
    const { names, scores } = extract($final);
    names.forEach((n, i) => upsertScore(n, 'finalScore', scores[i] ?? null));
  } else {
    // Fallback: some older games omit the "Final scores:" heading. Use the
    // last score table on the page that isn't the Coryat one.
    const tables = [];
    $('table').each((_, t) => {
      const $t = $(t);
      const isCoryat = /coryat/i.test(
        $t.prev('h3').text() + ' ' + $t.prevAll('h3').first().text()
      );
      const hasScores = $t.find('td.score_positive, td.score_negative').length > 0;
      const hasNames = $t.find('td.score_player_nickname').length > 0;
      if (hasScores && hasNames && !isCoryat) tables.push($t);
    });
    if (tables.length) {
      const { names, scores } = extract(tables[tables.length - 1]);
      names.forEach((n, i) => upsertScore(n, 'finalScore', scores[i] ?? null));
    }
  }

  const $coryat = tableAfterHeading(/coryat/i);
  if ($coryat) {
    const { names, scores } = extract($coryat);
    names.forEach((n, i) => upsertScore(n, 'coryatScore', scores[i] ?? null));
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
  // J! Archive links seasons via showseason.php?season=<id> OR listseason.php?season=<id>
  $('a[href*="season="]').each((i, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/(?:show|list)season\.php\?season=([^&"]+)/);
    if (!m) return;
    const id = m[1];
    if (seasons.find((s) => s.id === id)) return;
    const label = $(el).text().trim();
    const $row = $(el).closest('tr');
    const tds = $row.find('td');
    const yearText = tds.length > 1 ? $(tds.get(1)).text().trim() : '';
    seasons.push({ id, label: label || `Season ${id}`, years: yearText });
  });
  cache.set(key, seasons, 60 * 60 * 24 * 7);
  return seasons;
}

export async function scrapeSeasonGames(seasonId) {
  const key = `season:${seasonId}:gamesMeta`;
  const cached = cache.get(key);
  if (cached) return cached;
  // Try showseason first, then listseason as fallback
  let html;
  try {
    html = await politeFetch(
      `${BASE}/showseason.php?season=${encodeURIComponent(seasonId)}`
    );
  } catch (e) {
    html = await politeFetch(
      `${BASE}/listseason.php?season=${encodeURIComponent(seasonId)}`
    );
  }
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();
  $('a[href*="showgame.php?game_id="]').each((i, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/game_id=(\d+)/);
    if (!m) return;
    const id = parseInt(m[1], 10);
    if (seen.has(id)) return;
    seen.add(id);
    const linkText = $(el).text().trim(); // e.g. "#1234"
    const $row = $(el).closest('tr');
    const rowText = $row.text().replace(/\s+/g, ' ').trim();
    const dateMatch = rowText.match(
      /(\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/
    );
    const contestants = rowText
      .split(/ vs\.? /i)
      .filter((p) => /[a-z]/i.test(p))
      .slice(0, 3);
    out.push({
      gameId: id,
      showLabel: linkText,
      airDate: dateMatch ? dateMatch[1] : null,
      rowText,
      contestants:
        contestants.length >= 2 && contestants.length <= 4
          ? contestants.map((c) => c.replace(/^[^A-Za-z]+|[^A-Za-z\s]+$/g, '').trim())
          : [],
    });
  });
  cache.set(key, out, 60 * 60 * 24);
  return out;
}

// Back-compat alias used by /api/game/random?season=
export async function scrapeSeasonGameIds(seasonId) {
  const games = await scrapeSeasonGames(seasonId);
  return games.map((g) => g.gameId);
}

// Play-along data: order in which clues were selected and who responded.
// Parses /showgameresponses.php?game_id=X — defensive against missing pieces.
export async function scrapeGameResponses(gameId) {
  const cacheKey = `responses:${gameId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  let html;
  try {
    html = await politeFetch(`${BASE}/showgameresponses.php?game_id=${gameId}`);
  } catch (e) {
    return null;
  }
  const $ = cheerio.load(html);
  if (!$('#jeopardy_round').length && !$('#double_jeopardy_round').length) {
    return null;
  }

  // Contestant nickname map: showgameresponses lists the contestants up top.
  const contestants = [];
  $('p.contestants a').each((i, el) => {
    const full = $(el).text().trim();
    if (!full) return;
    contestants.push({ name: full, nickname: full.split(/\s+/)[0] });
  });

  function parseRoundResponses(roundSelector, roundKey) {
    const $round = $(roundSelector);
    if (!$round.length) return [];
    const out = [];
    $round.find('td.clue').each((i, el) => {
      const $cell = $(el);
      const $clueText = $cell.find('td.clue_text').first();
      if (!$clueText.length) return;
      const id = $clueText.attr('id') || '';
      const idMatch = id.match(/^clue_(J|DJ|FJ)_(\d+)_(\d+)$/);
      if (!idMatch) return;
      const col = parseInt(idMatch[2], 10);
      const row = parseInt(idMatch[3], 10);

      // Clue order number is shown as a small number in the cell (often class="clue_order_number")
      let order = null;
      const $order = $cell.find('td.clue_order_number, .clue_order_number').first();
      if ($order.length) {
        const n = parseInt($order.text().trim(), 10);
        if (!Number.isNaN(n)) order = n;
      }

      // Daily Double wager (shown in the clue text when applicable, format varies)
      let wager = null;
      const $valueDD = $cell.find('td.clue_value_daily_double').first();
      if ($valueDD.length) {
        const wm = $valueDD.text().match(/\$?([\d,]+)/);
        if (wm) wager = parseInt(wm[1].replace(/,/g, ''), 10);
      }

      // Triple Stumper marker
      const cellText = $cell.text();
      const tripleStumper = /Triple\s*Stumper/i.test(cellText);

      // Right / wrong attempts:
      //   <td class="right">Chris</td>
      //   <td class="wrong">Sidney</td>
      const attempts = [];
      $cell.find('td.right, td.wrong, .right, .wrong').each((j, ael) => {
        const $a = $(ael);
        const isRight = $a.hasClass('right');
        const name = $a.text().trim();
        if (!name) return;
        if (name.length > 80) return; // safety
        attempts.push({ name, correct: isRight });
      });

      // Parenthetical verbal responses, e.g. "(Sidney: What is Trump?)"
      // We'll grab any "(Name: ...)" snippets and pair them with attempts by name.
      const responses = [];
      const rawHtml = $cell.html() || '';
      const respRegex = /\(([A-Za-z][A-Za-z .'-]{0,40}):\s*([^()]+?)\)/g;
      let m;
      while ((m = respRegex.exec(rawHtml.replace(/<[^>]+>/g, ' '))) !== null) {
        responses.push({ name: m[1].trim(), response: m[2].trim() });
      }
      const correctBy = attempts.find((a) => a.correct)?.name || null;

      out.push({
        clueId: id,
        round: roundKey,
        categoryIndex: col - 1,
        row,
        order,
        wager,
        attempts,
        responses,
        correctBy,
        isTripleStumper: tripleStumper || (attempts.length > 0 && !correctBy),
      });
    });
    return out;
  }

  const jeopardy = parseRoundResponses('#jeopardy_round', 'J');
  const doubleJeopardy = parseRoundResponses('#double_jeopardy_round', 'DJ');

  // Final Jeopardy responses are typically all 3 contestants with wagers
  const finalJeopardy = (() => {
    const $fj = $('#final_jeopardy_round');
    if (!$fj.length) return null;
    const attempts = [];
    $fj.find('td.right, td.wrong, .right, .wrong').each((j, ael) => {
      const $a = $(ael);
      const isRight = $a.hasClass('right');
      const name = $a.text().trim();
      if (!name) return;
      attempts.push({ name, correct: isRight, wager: null, response: null });
    });
    // wagers + responses are typically shown as "Name: $X,XXX" near the contestant names
    const fjText = $fj.text();
    attempts.forEach((a) => {
      const wRe = new RegExp(
        `${a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^$\\d]{0,40}\\$([\\d,]+)`
      );
      const wm = fjText.match(wRe);
      if (wm) a.wager = parseInt(wm[1].replace(/,/g, ''), 10);
    });
    return { attempts };
  })();

  const data = {
    gameId: Number(gameId),
    contestants,
    rounds: { jeopardy, doubleJeopardy, finalJeopardy },
  };
  cache.set(cacheKey, data);
  return data;
}
