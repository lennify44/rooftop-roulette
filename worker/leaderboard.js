// Rooftop Roulette leaderboard: a small Cloudflare Worker with one KV namespace (binding SCORES).
// GET  /scores?date=YYYY-MM-DD  -> { alltime: top 20, daily: top 20 for that day }
// POST /scores {id, name, score, dist, city, daily, date} -> { ok, rank: { alltime, daily } }
// Each device id keeps only its best score per board. Only the game's own site may post.
const ORIGINS = ['https://lennify44.github.io'];
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

    if (req.method === 'GET') {
      const date = url.searchParams.get('date') || '';
      const [alltime, daily] = await Promise.all([board(env, 'alltime'), isDay(date) ? board(env, 'daily:' + date) : []]);
      return json({ alltime: alltime.slice(0, SHOW).map(publicEntry), daily: daily.slice(0, SHOW).map(publicEntry) }, 200, origin);
    }
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
    if (!ORIGINS.includes(origin)) return json({ error: 'origin not allowed' }, 403, origin);

    let b;
    try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, origin); }
    const name = String(b.name || '').trim(), id = String(b.id || '');
    const score = Math.floor(Number(b.score)), dist = Math.floor(Number(b.dist));
    if (!NAME_RE.test(name) || !/^[a-z0-9]{8,32}$/.test(id) || !(score > 0 && score < 5e6) || !(dist >= 0 && dist < 2e5)) {
      return json({ error: 'invalid score' }, 400, origin);
    }
    const ip = req.headers.get('CF-Connecting-IP') || '?', now = Date.now();
    if (now - (recent.get(ip) || 0) < 5000) return json({ error: 'too fast' }, 429, origin);
    recent.set(ip, now);
    if (recent.size > 5000) recent.clear();

    const entry = { id, name, score, dist, city: String(b.city || '').replace(/[^A-Z]/g, '').slice(0, 4), at: now };
    const boards = [['alltime', 'alltime', null]];
    if (b.daily && recentDay(String(b.date || ''))) boards.push(['daily', 'daily:' + b.date, DAILY_TTL]);
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
