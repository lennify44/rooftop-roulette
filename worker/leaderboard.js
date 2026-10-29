// Leaderboard for the Rooftop Roulette games: a small Cloudflare Worker with one KV namespace (binding SCORES).
// GET  /scores?game=elevator&date=YYYY-MM-DD  -> { alltime: top 20, daily: top 20 for that day }
// POST /scores {game, id, name, score, dist, city, daily, date} -> { ok, rank: { alltime, daily } }
// Each device id keeps only its best score per board. Only the games' own site may post.
// Rooftop Roulette (no game field) keeps its original keys `alltime` and `daily:<date>`;
// the other games use `<game>:alltime` and `<game>:daily:<date>`. `dist` is each game's second number.
const ORIGINS = ['https://lennify44.github.io'];
const GAMES = {
  rooftop: { prefix: '', maxScore: 5e6, maxDist: 2e5 },
  elevator: { prefix: 'elevator:', maxScore: 1e12, maxDist: 1000 },   // cash-out, floor
  volcano: { prefix: 'volcano:', maxScore: 1e8, maxDist: 10000 },     // points, bingos
  rogueball: { prefix: 'rogueball:', maxScore: 1e10, maxDist: 10000 }, // chips, spins
  room404: { prefix: 'room404:', maxScore: 2701, maxDist: 100 },        // seconds left at the escape, hints used
};
const TOP = 50, SHOW = 20, DAILY_TTL = 8 * 86400;
const NAME_RE = /^[\p{L}\p{N} _.\-]{1,16}$/u;
const recent = new Map();   // best-effort per-isolate rate limit by IP

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (data, status, origin) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
// the game uses the player's local date; accept today in UTC plus or minus one day
function recentDay(d) {
  if (!isDay(d)) return false;
  const diff = Math.abs(Date.parse(d + 'T12:00:00Z') - Date.now());
  return diff < 1.6 * 86400 * 1000;
}
async function board(env, key) { return (await env.SCORES.get(key, 'json')) || []; }
const publicEntry = ({ id, name, score, dist, city, at }) => ({ id, name, score, dist, city, at });

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname !== '/scores') return json({ error: 'not found' }, 404, origin);

    const gameOf = (name) => GAMES[name || 'rooftop'];
    if (req.method === 'GET') {
      const date = url.searchParams.get('date') || '', g = gameOf(url.searchParams.get('game'));
      if (!g) return json({ error: 'unknown game' }, 400, origin);
      const [alltime, daily] = await Promise.all([board(env, g.prefix + 'alltime'), isDay(date) ? board(env, g.prefix + 'daily:' + date) : []]);
      return json({ alltime: alltime.slice(0, SHOW).map(publicEntry), daily: daily.slice(0, SHOW).map(publicEntry) }, 200, origin);
    }
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
    if (!ORIGINS.includes(origin)) return json({ error: 'origin not allowed' }, 403, origin);

    let b;
    try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, origin); }
    const g = gameOf(typeof b.game === 'string' ? b.game : '');
    if (!g) return json({ error: 'unknown game' }, 400, origin);
    const name = String(b.name || '').trim(), id = String(b.id || '');
    const score = Math.floor(Number(b.score)), dist = Math.floor(Number(b.dist));
    if (!NAME_RE.test(name) || !/^[a-z0-9]{8,32}$/.test(id) || !(score > 0 && score < g.maxScore) || !(dist >= 0 && dist < g.maxDist)) {
      return json({ error: 'invalid score' }, 400, origin);
    }
    const ip = req.headers.get('CF-Connecting-IP') || '?', now = Date.now();
    if (now - (recent.get(ip) || 0) < 5000) return json({ error: 'too fast' }, 429, origin);
    recent.set(ip, now);
    if (recent.size > 5000) recent.clear();

    const entry = { id, name, score, dist, city: String(b.city || '').replace(/[^A-Z]/g, '').slice(0, 4), at: now };
    const boards = [['alltime', g.prefix + 'alltime', null]];
    if (b.daily && recentDay(String(b.date || ''))) boards.push(['daily', g.prefix + 'daily:' + b.date, DAILY_TTL]);
    const rank = {};
    for (const [label, key, ttl] of boards) {
      const list = await board(env, key);
      const mine = list.find((e) => e.id === id);
      if (mine && mine.score >= score) { rank[label] = list.indexOf(mine) + 1; continue; }
      const next = list.filter((e) => e.id !== id);
      next.push(entry);
      next.sort((x, y) => y.score - x.score);
      const kept = next.slice(0, TOP), pos = kept.indexOf(entry) + 1;
      if (pos) await env.SCORES.put(key, JSON.stringify(kept), ttl ? { expirationTtl: ttl } : undefined);
      rank[label] = pos || null;
    }
    return json({ ok: true, rank }, 200, origin);
  },
};
