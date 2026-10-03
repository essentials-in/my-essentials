# Essentials

**Water supply and metals (copper & aluminium) for societies, businesses, and industry in Gurgaon & NCR.**

This repository hosts the official website for Essentials — a small multi-page site where customers pick the service they need and reach us instantly via WhatsApp or email.

🔗 **Live site:** _myessentials.co.in_

---

## About

Essentials provides two services, delivered with personal attention:

- **Water Supply** — scheduled tanker water for residential societies, RWAs, offices and businesses.
- **Metals** — copper and aluminium: we buy scrap and supply metal stock and custom castings.

We serve Gurgaon & NCR, Monday–Saturday, 9am–7pm.

---

## Site structure

| URL | Page |
|---|---|
| `/` | Home — who we are and a card for each service |
| `/water/` | Water Supply (blue theme) |
| `/metals/` | Metals overview (graphite theme) |
| `/metals/copper/` | Copper (copper theme) |
| `/metals/aluminium/` | Aluminium (silver theme) |

Each service lives on its own page, so a visitor looking for water only sees water unless they choose to explore further.

---

## Features

- Original warm-ivory look with a colour theme per service, light theme by default and an optional dark mode
- Welcome splash on first visit to the home page
- "Raise a Query" modal on every page — WhatsApp and Email, pre-filled with the chosen service and an auto-generated reference number
- Fully responsive and accessible (keyboard navigation, focus trap in the modal, screen-reader friendly)
- SEO: unique title, description and canonical URL per page, Open Graph/Twitter cards, `LocalBusiness`, `Service` and `BreadcrumbList` structured data, XML sitemap, custom 404

---

## Contact

- **WhatsApp / Phone:** +91 89509 98004 · +91 89504 38004
- **Email:** Myessentials.global@gmail.com

---

## Tech

Plain HTML, CSS, and JavaScript — no build step, no dependencies.

- `assets/site.css` — shared styles
- `assets/site.js` — theme toggle, splash, and the query modal (services are configured in the `SERVICES` list at the top)
- One `index.html` per page folder

Hosted on Netlify (`netlify.toml` handles the www redirect and headers).

### Metal price trend (Copper & Aluminium pages)

- `assets/price-trend.js` draws the interactive price graph (plain SVG, no libraries).
- Prices come from `prices.json` on the separate **`prices`** branch, read straight from GitHub — so daily price updates never trigger a Netlify deploy.
- `.github/workflows/prices.yml` runs every day at 8:00 am IST, fetches LME prices from metals.dev (`scripts/update-prices.mjs`), converts them to ₹/kg and commits to the `prices` branch.
- Needs the repository secret **`METALS_DEV_API_KEY`**. The daily job uses one request a day (free plan: 100/month).
- History: the metals.dev free plan has no copper/aluminium history, so past prices were loaded once with `scripts/backfill-history.mjs` (LME cash settlement via westmetall.com, USD/INR via ECB). It never overwrites days the daily job already saved. To re-run: check out the `prices` branch and run `node scripts/backfill-history.mjs prices.json 365`, then commit.
- If the price file can't be loaded, the graph section stays hidden.

---

© 2026 Essentials. All rights reserved.
