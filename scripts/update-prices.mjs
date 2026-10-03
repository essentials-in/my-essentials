// Fetches LME copper & aluminium prices from metals.dev and stores them as ₹/kg
// in a small JSON file that the website reads. Run by .github/workflows/prices.yml.
//
//   node scripts/update-prices.mjs <path/to/prices.json>              -> add today's price
//   node scripts/update-prices.mjs <path/to/prices.json> --backfill 365 -> also fill past days
//
// Needs the METALS_DEV_API_KEY environment variable.

import { readFile, writeFile } from 'node:fs/promises';

const API = process.env.METALS_DEV_API_BASE || 'https://api.metals.dev/v1';
const KEY = process.env.METALS_DEV_API_KEY;
const GRAMS_PER_TROY_OUNCE = 31.1034768;
// API field -> our name, plus a sanity range in ₹/kg (anything outside is treated as bad data)
const METALS = {
  copper:    { field: 'lme_copper',   min: 200, max: 5000 },
  aluminium: { field: 'lme_aluminum', min: 50,  max: 1500 }
};

const file = process.argv[2];
const bfIndex = process.argv.indexOf('--backfill');
const backfillDays = bfIndex > -1 ? Number(process.argv[bfIndex + 1]) || 0 : 0;

if (!file) fail('Usage: node scripts/update-prices.mjs <prices.json> [--backfill DAYS]');
if (!KEY) fail('METALS_DEV_API_KEY is not set (add it under GitHub → Settings → Secrets → Actions).');

function fail(msg) { console.error('ERROR: ' + msg); process.exit(1); }
const round1 = (n) => Math.round(n * 10) / 10;
const ymd = (d) => d.toISOString().slice(0, 10);

async function api(path, params) {
  const url = new URL(API + path);
  url.searchParams.set('api_key', KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.status === 'failure') {
    fail(`metals.dev ${path} failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

function checked(metal, value, label) {
  const { min, max } = METALS[metal];
  if (typeof value !== 'number' || !isFinite(value)) return null;
  if (value < min || value > max) {
    console.warn(`WARN: ${metal} ${label} = ₹${value}/kg is outside ${min}–${max}; skipped.`);
    return null;
  }
  return round1(value);
}

// metals.dev quotes currencies against USD. Accept either direction (USD per INR or INR per USD).
function inrPerUsd(currencies) {
  const r = currencies && Number(currencies.INR);
  if (!r) return null;
  return r < 1 ? 1 / r : r;
}

async function load() {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    return { copper: [], aluminium: [], ...data };
  } catch {
    return { copper: [], aluminium: [] };
  }
}

function upsert(series, date, value) {
  const i = series.findIndex((row) => row[0] === date);
  if (i > -1) series[i][1] = value; else series.push([date, value]);
}

async function backfill(store, days) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  let added = 0;
  // The timeseries endpoint allows at most 30 days per request.
  for (let offset = 0; offset < days; offset += 30) {
    const chunkEnd = new Date(end); chunkEnd.setUTCDate(end.getUTCDate() - offset);
    const chunkStart = new Date(chunkEnd); chunkStart.setUTCDate(chunkEnd.getUTCDate() - Math.min(29, days - offset - 1));
    const body = await api('/timeseries', { start_date: ymd(chunkStart), end_date: ymd(chunkEnd) });
    const rates = body.rates || body;
    for (const [date, day] of Object.entries(rates)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day || !day.metals) continue;
      const fx = inrPerUsd(day.currencies);
      if (!fx) continue;
      for (const [metal, { field }] of Object.entries(METALS)) {
        const usdPerToz = Number(day.metals[field]);
        const v = checked(metal, usdPerToz * fx * (1000 / GRAMS_PER_TROY_OUNCE), date);
        if (v != null) { upsert(store[metal], date, v); added++; }
      }
    }
    console.log(`Backfilled ${ymd(chunkStart)} → ${ymd(chunkEnd)}`);
  }
  console.log(`Backfill wrote ${added} values.`);
}

async function today(store) {
  // Prices per gram in rupees -> ×1000 = ₹/kg
  const body = await api('/latest', { currency: 'INR', unit: 'g' });
  const metals = body.metals || {};
  const date = ymd(new Date(body.timestamps?.metal || Date.now()));
  let wrote = 0;
  for (const [metal, { field }] of Object.entries(METALS)) {
    const v = checked(metal, Number(metals[field]) * 1000, 'today');
    if (v == null) continue;
    const series = store[metal];
    const last = series[series.length - 1];
    // Exchange holidays repeat the previous close — don't store a duplicate day.
    if (last && last[0] !== date && last[1] === v) { console.log(`${metal}: unchanged (holiday?), skipped.`); continue; }
    upsert(series, date, v);
    wrote++;
    console.log(`${metal} ${date}: ₹${v}/kg`);
  }
  if (!wrote) console.log('No new prices today.');
}

const store = await load();
if (backfillDays > 0) await backfill(store, backfillDays);
await today(store);

for (const metal of Object.keys(METALS)) {
  store[metal].sort((a, b) => a[0].localeCompare(b[0]));
  store[metal] = store[metal].slice(-800); // keep ~3 years of trading days at most
}
const out = {
  updated: new Date().toISOString(),
  unit: 'INR/kg',
  source: 'LME reference via metals.dev',
  copper: store.copper,
  aluminium: store.aluminium
};
await writeFile(file, JSON.stringify(out) + '\n');
console.log(`Saved ${file}: copper ${out.copper.length} days, aluminium ${out.aluminium.length} days.`);
