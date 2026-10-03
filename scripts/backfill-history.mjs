// One-time history fill for the price graphs (no API key needed).
// The metals.dev free plan has no copper/aluminium history, so past prices come from:
//   - LME official cash-settlement prices (USD/tonne) published by westmetall.com
//   - USD→INR reference rates (ECB) from the free Frankfurter API
// Days already in prices.json (from the daily metals.dev job) are never overwritten.
//
//   node scripts/backfill-history.mjs <path/to/prices.json> [days=365]

import { readFile, writeFile } from 'node:fs/promises';

const file = process.argv[2];
const days = Number(process.argv[3]) || 365;
if (!file) { console.error('Usage: node scripts/backfill-history.mjs <prices.json> [days]'); process.exit(1); }

const SERIES = { copper: 'LME_Cu_cash', aluminium: 'LME_Al_cash' };
const RANGE = { copper: [200, 5000], aluminium: [50, 1500] }; // sanity limits, ₹/kg
const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
const ymd = (d) => d.toISOString().slice(0, 10);

const since = new Date(); since.setUTCDate(since.getUTCDate() - days);
const from = ymd(since), to = ymd(new Date());

async function get(url, as) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (essentials price history)' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

// "02. October 2026" + "14,355.00" rows → { '2026-10-02': 14355 }
async function lmeYear(field, year) {
  const html = await get(`https://www.westmetall.com/en/markdaten.php?action=table&field=${field}&year=${year}`);
  const out = {};
  const re = /<td[^>]*>\s*(\d{1,2})\.\s*([A-Za-z]+)\s+(\d{4})\s*<\/td>\s*<td[^>]*>\s*([\d,.]+)\s*<\/td>/g;
  let m;
  while ((m = re.exec(html))) {
    const mon = MONTHS[m[2]];
    if (!mon) continue;
    const date = `${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const usd = Number(m[4].replace(/,/g, ''));
    if (usd > 0) out[date] = usd;
  }
  return out;
}

const fx = (await get(`https://api.frankfurter.app/${from}..${to}?from=USD&to=INR`, 'json')).rates || {};
const fxDates = Object.keys(fx).sort();
function inrOn(date) {
  // ECB has no rate on some days; use the most recent earlier one.
  let rate = null;
  for (const d of fxDates) { if (d > date) break; rate = fx[d].INR; }
  return rate ?? fx[fxDates[0]]?.INR ?? null;
}

let store;
try { store = JSON.parse(await readFile(file, 'utf8')); } catch { store = {}; }

for (const [metal, field] of Object.entries(SERIES)) {
  const years = [...new Set([since.getUTCFullYear(), new Date().getUTCFullYear()])];
  const usd = {};
  for (const y of years) Object.assign(usd, await lmeYear(field, y));
  const existing = new Map((store[metal] || []).map((r) => [r[0], r[1]]));
  let added = 0;
  for (const [date, perTonne] of Object.entries(usd)) {
    if (date < from || existing.has(date)) continue;
    const rate = inrOn(date);
    if (!rate) continue;
    const perKg = Math.round(perTonne * rate / 100) / 10; // USD/t × INR/USD ÷ 1000, 1 decimal
    if (perKg < RANGE[metal][0] || perKg > RANGE[metal][1]) { console.warn(`WARN ${metal} ${date}: ₹${perKg}/kg out of range, skipped`); continue; }
    existing.set(date, perKg);
    added++;
  }
  store[metal] = [...existing.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const s = store[metal];
  console.log(`${metal}: +${added} days → ${s.length} total (${s[0]?.[0]} … ${s[s.length - 1]?.[0]})`);
}

store.unit = 'INR/kg';
store.source = 'LME reference via metals.dev (daily); history: LME cash settlement via westmetall.com, USD/INR via ECB';
store.updated = store.updated || new Date().toISOString();
await writeFile(file, JSON.stringify({ updated: store.updated, unit: store.unit, source: store.source, copper: store.copper, aluminium: store.aluminium }) + '\n');
console.log(`Saved ${file}`);
