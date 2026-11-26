# Reisevær

Reisevær helps tourists plan a road trip in **Australia** or **Norway**. You choose the country at the top of the page; Australia is the default and the map opens over Melbourne. You enter where you start, where you're going, the departure date and how many days the trip should take. The app suggests stops along the route where the weather is warmest and sunniest, and it warns about bad weather on the way.

- **List and map.** The stops for each day are listed on the left and in the middle of the screen, with temperature and cloud cover. An interactive map is on the right. On a phone, the map sits between the form and the list.
- **Norwegian and English.** You can switch language at the top of the page.
- **Free to use.** A space for a small advertisement is reserved but not active (see "Advertisement").

## How it works

1. **Place search.** Place names come from Kartverket's place-name register, and addresses come from the Norwegian address register.
2. **Route.** The driving route comes from an OSRM routing server. By default this is FOSSGIS's server, which is based on OpenStreetMap.
3. **Towns along the route.** The towns come from [data/towns.json](data/towns.json): 896 cities and towns in mainland Norway, taken from Kartverket. The app picks up to 2 towns per 25 km of road, each within 12 km of the route.
4. **Weather.** Forecasts come from MET Norway's Locationforecast 2.0, the same data that Yr uses. For each town, the app summarises the daytime weather (08–20) on the date you'll pass it.
5. **Choosing stops.** The drive is split evenly into days.
   - For each day except the last, the app picks the overnight stop with the best weather near that day's end point.
   - It also picks one or two stops during the day, chosen for warmth, little cloud and little rain.
   - Score = average temperature + 0.08 × (100 − cloud %) − 1.2 × rain in mm − a penalty for wind over 10 m/s.
6. **Warnings.** Official warnings come from MET (MetAlerts). The app adds its own flags for heavy rain, strong wind, possible snow or ice, and thunder.

**Trip length and forecast range.**
- A trip can last 1–21 days, as long as departure is within the forecast, which reaches about 9 days ahead.
- Days beyond the forecast still get overnight stops, chosen near the day's end point with cities preferred. They are marked "Varsel kommer senere" / "Forecast comes later".
- Beyond about 2.5 days the forecast comes in 6-hour steps, and the app says so.
- There must be at least 20 km of driving per day.

**Staying in Norway.** The fastest route sometimes goes through Sweden, for example Oslo–Tromsø. When a stretch of more than 150 km has no Norwegian town, the app routes via the nearest Norwegian city and checks again, up to 5 times.

**Place names.** Towns are shown with their Norwegian name. Where the official main name is Sami, it is shown as well, for example "Drag (Ájluokta)".

## Changing the route by dragging

The route works like a walking route in Google Maps:

- **Drag the route.** Point at the blue route and a white handle appears. Drag it to another town or road and let go: the route is recalculated through that point, and the days, stops and weather are updated. While you drag, a dashed line shows the new route.
- **Via points.** Each place you drag to stays as a white dot. Drag a dot to move it, or click it to remove it. **Reset route** on the map removes them all.
- **Phones.** Tap the route to place a handle, then drag it.
- **What is kept.** Changing the date or the number of days keeps the via points. A new start or destination starts a new route.

The server takes up to 10 via points (`vias` in POST /api/plan), all in the same country as the trip, and asks the router for a route through them in order. The router snaps each point to the nearest road. With via points, Norway no longer forces the route to stay inside Norway, because you have chosen the roads yourself.

## Australia

You switch between Australia and Norway at the top of the page. In Australia, the app works like this:

| | Australia | Norway |
|---|---|---|
| Map | OpenStreetMap tiles, starting over Melbourne | Kartverket's topographic map |
| Place search | Our town list first, then [Photon](https://photon.komoot.io/) (OpenStreetMap-based search) limited to Australia | Kartverket's place names and addresses |
| Towns along the route | [data/towns-au.json](data/towns-au.json): 3,043 cities, towns and villages from OpenStreetMap (ODbL), with state | data/towns.json from Kartverket |
| Overnight stops and stops on the way | Towns and cities first; a village only when a stretch has nothing larger | Cities and towns |
| Local time ("today", daytime 08–20) | By state: Perth, Darwin, Adelaide, Brisbane, Sydney/Melbourne/Canberra and Hobart time, approximated from the position | Oslo time |
| Official warnings | Not included. The footer points to the Bureau of Meteorology | MET's warnings (MetAlerts) |
| Keeping the route inside the country | Not needed | Yes (see above) |

Start and destination must be in the same country. `npm.cmd run build:towns:au` downloads the Australian town list again from the Overpass API, one state at a time.

Photon's public server, OpenStreetMap's tile server and FOSSGIS's routing server are free for light use. If the app gets real traffic, use a paid or self-hosted service for each of them.

**User-Agent:** only MET receives the contact information from `MET_CONTACT`. All other services get the app name only.

## Data terms (MET Norway / Yr)

The app follows [MET Norway's terms of service](https://api.met.no/doc/TermsOfService):

- **Identification.** Every request carries a `User-Agent` header with the app name and **contact information** (`MET_CONTACT` in `.env`). The app fetches no weather until this is filled in.
- **Caching.** The server keeps the forecasts in memory until the `Expires` time from MET, then asks again with `If-Modified-Since`. Coordinates are rounded to 2 decimals, which is within the 4-decimal limit.
- **Request rate.** The server sends at most 10 requests per second and 6 at a time. All requests go through the server, never directly from the browser.
- **Attribution.** The footer and the map credit MET Norway and Yr under CC BY 4.0. They also say that Reisevær is not affiliated with Yr or MET. Yr's logo and name must not be used as if this were Yr's own app.

Kartverket's data (map and place names) is CC BY 4.0. The routing is © OpenStreetMap contributors via FOSSGIS. FOSSGIS's server is meant for moderate use. If Reisevær gets heavy traffic, you need your own routing server or a paid service (set `ROUTING_URL`).

Check the terms again before going public, because the data providers can change them.

## Setup

1. `copy .env.example .env`, then write your contact information (email or website) after `MET_CONTACT=`.
2. `npm.cmd install` (only the first time).
3. `npm.cmd run dev`, then open <http://localhost:3200>.

`npm.cmd test` runs automated tests with fake services, so nothing is sent to MET or Kartverket.
`npm.cmd run build:towns` downloads the town list from Kartverket again (rarely needed).

## Advertisement (Google AdSense)

There is one responsive ad at the bottom of the list. It has its own card labelled "Annonse" / "Advertisement" and is placed away from buttons and the map, to avoid accidental clicks. If Google has no ad to show, the card is hidden.

| Setting in `.env` | Effect |
|---|---|
| `ADS_ENABLED=false` | No ad space and no Google code (default). |
| `ADS_ENABLED=true` with no IDs | A preview box shows where the ad will appear. No requests go to Google. |
| `+ ADSENSE_CLIENT=ca-pub-…` | Adds the site-verification tag (`google-adsense-account`) and `/ads.txt`. Needed during Google's review. |
| `+ ADSENSE_SLOT=…` | The ad is live. The AdSense script is loaded and the page uses Google's "strict CSP" with a new nonce for each request. |
| `ADSENSE_TEST=true/false` | Shows Google test ads. The default is test ads except in production (`NODE_ENV=production`). |

**Steps to go live:**
1. Put the app online with a public domain and HTTPS. AdSense does not accept localhost.
2. Add a privacy page that describes the cookies and Google ads, with contact details.
3. Create an account at adsense.google.com and add the domain.
4. Fill in `ADSENSE_CLIENT` and restart. Then choose verification by "ads.txt" or "meta tag" in AdSense.
5. Wait for Google's review, which takes from a few days to a few weeks.
6. In **Privacy & messaging**, create a consent message for the EEA/UK. It is required in Norway, and the AdSense code shows it automatically.
7. Under **Ads → By ad unit**, create a "Display ad" (responsive). Then fill in `ADSENSE_SLOT` and restart.

Never click your own ads, and never ask others to. That can get the account closed.

## Files

```
src/server.js     web server and API (/api/search, /api/plan, /api/info), security headers, rate limit
src/planner.js    splits the trip into days and picks the stops with the best weather
src/weather.js    MET Locationforecast + MetAlerts, daytime summary, score and warnings
src/places.js     place search (Kartverket) and towns along the route
src/route.js      driving route (OSRM)
src/http.js       HTTP client: User-Agent, cache with Expires/If-Modified-Since, rate limiting
src/geo.js        distances, position along the route, point in polygon
data/towns.json   cities and towns in Norway (Kartverket)
public/           the page: index.html, app.js, styles.css (Leaflet for the map)
tests/run.js      tests with fake services
```
