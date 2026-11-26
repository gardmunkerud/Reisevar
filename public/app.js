// Reisevær – browser app.
(() => {
  'use strict';

  // --- Texts --------------------------------------------------------------------------
  const T = {
    nb: {
      headline: 'Hei Jens, hvor går turen?', lead: 'Skriv inn hvor du starter og hvor du skal. Reisevær foreslår stopp langs ruten der været er varmest og sol­rikest.',
      from: 'Fra', to: 'Til', fromPlaceholder: 'By, sted eller adresse', toPlaceholder: 'By, sted eller adresse', swap: 'Bytt fra og til',
      date: 'Avreise', days: 'Antall dager', moreDays: 'Én dag til', fewerDays: 'Én dag færre', submit: 'Finn beste stopp', dayN: (n) => (n === 1 ? '1 dag' : `${n} dager`),
      map: 'Kart over ruten', ad: 'Annonse',
      adPreviewTitle: 'Annonseplass (forhåndsvisning)', adPreviewText: 'Her vises en liten Google-annonse når AdSense-kontoen er godkjent.',
      notConfigured: 'Værvarselet er ikke slått på ennå: legg inn kontaktinformasjon i MET_CONTACT i .env-filen og start appen på nytt.',
      credits: 'Værvarsel fra <a href="https://www.met.no/" target="_blank" rel="noopener">Meteorologisk institutt</a> – de samme dataene som <a href="https://www.yr.no/" target="_blank" rel="noopener">Yr</a> bruker (<a href="https://creativecommons.org/licenses/by/4.0/deed.no" target="_blank" rel="noopener">CC BY 4.0</a>). Kart og stedsnavn © <a href="https://www.kartverket.no/" target="_blank" rel="noopener">Kartverket</a>. Ruteberegning © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-bidragsytere, <a href="https://routing.openstreetmap.de/" target="_blank" rel="noopener">FOSSGIS</a>. Reisevær er ikke tilknyttet Yr eller Meteorologisk institutt.',
      regionAu: 'Australia', regionNo: 'Norge',
      ghostTip: 'Dra for å kjøre en annen vei', viaTip: 'Dra for å flytte · klikk for å fjerne', updatingRoute: 'Oppdaterer ruten …', resetRoute: 'Tilbakestill rute',
      dragHint: 'Tips: dra den blå ruten på kartet for å kjøre via andre byer eller veier.', viaCount: (n) => (n === 1 ? 'via 1 punkt du har valgt' : `via ${n} punkter du har valgt`),
      creditsAu: 'Værvarsel fra <a href="https://www.met.no/" target="_blank" rel="noopener">Meteorologisk institutt</a> – de samme dataene som <a href="https://www.yr.no/" target="_blank" rel="noopener">Yr</a> bruker (<a href="https://creativecommons.org/licenses/by/4.0/deed.no" target="_blank" rel="noopener">CC BY 4.0</a>). Kart, steder og ruteberegning © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-bidragsytere (ODbL), stedssøk via <a href="https://photon.komoot.io/" target="_blank" rel="noopener">Photon</a>, ruter via <a href="https://routing.openstreetmap.de/" target="_blank" rel="noopener">FOSSGIS</a>. Offisielle farevarsler for Australia finner du hos <a href="https://www.bom.gov.au/" target="_blank" rel="noopener">Bureau of Meteorology</a>. Reisevær er ikke tilknyttet Yr eller Meteorologisk institutt.',
      pickFrom: 'Velg hvor du starter.', pickTo: 'Velg hvor du skal.', samePlace: 'Start og mål er det samme stedet.', noMatch: (q) => `Fant ikke «${q}». Prøv et annet stedsnavn.`,
      searching: 'Søker …', loading: (km) => (km ? `Henter værvarsel langs ${km} km vei …` : 'Beregner rute og henter værvarsel …'),
      loadingSub: 'Vi sjekker været i byer og tettsteder langs hele ruten.',
      errors: {
        invalid_place: 'Velg steder fra listen.', different_regions: 'Start og mål må være i samme land.', invalid_via: 'Ruten kan bare dras til steder i samme land.', invalid_date: 'Velg en gyldig dato.', invalid_days: 'Velg antall dager.',
        date_past: 'Avreisedatoen har allerede vært.', beyond_forecast: 'Avreisen må være innen ca. 9 dager, så langt rekker værvarselet.',
        too_many_days: 'Så mange dager blir veldig korte etapper på denne ruten. Velg færre dager.',
        too_short: 'Turen er for kort til å foreslå stopp.', no_route: 'Fant ingen kjørerute mellom stedene.',
        not_configured: 'Værvarselet er ikke slått på (MET_CONTACT mangler i .env).', weather_unavailable: 'Værvarselet er ikke tilgjengelig akkurat nå. Prøv igjen om litt.',
        rate_limited: 'For mange søk på kort tid. Vent litt og prøv igjen.', upstream_error: 'En av tjenestene vi bruker svarer ikke. Prøv igjen om litt.',
        network: 'Ingen forbindelse med serveren.', default: 'Noe gikk galt. Prøv igjen.',
      },
      drive: 'kjøring', dayTitle: (n) => `Dag ${n}`, kmShort: 'km', hoursFmt: (h) => { const t = Math.round(h * 60); return `${Math.floor(t / 60)} t ${t % 60} min`; },
      roles: { start: 'Start', visit: 'Stopp underveis', overnight: 'Overnatting', destination: 'Mål' },
      best: 'Best vær', bestLine: (name, day) => `Best vær på turen: ${name}, dag ${day + 1}`,
      cloud: 'Skydekke', precip: 'Nedbør', noForecast: 'Varsel kommer senere',
      dayNoForecast: (d) => `Værvarselet rekker foreløpig til ${d}. Stoppene denne dagen er fordelt jevnt langs ruten – kom tilbake nærmere avreise for å se været.`,
      coarse: 'Langt frem i tid er varselet mindre detaljert (6-timers steg) og mer usikkert.',
      warnTitle: 'Følg med på været',
      warn: { heavy_rain: (p) => `Mye nedbør ved ${p}`, strong_wind: (p) => `Sterk vind ved ${p}`, snow_ice: (p) => `Mulig snø eller glatt føre ved ${p}`, thunder: (p) => `Torden ved ${p}` },
      alertLevel: { yellow: 'Gult farevarsel', orange: 'Oransje farevarsel', red: 'Rødt farevarsel' },
      noStops: 'Kort etappe – ingen ekstra stopp foreslått.',
      noOvernight: 'Ingen by eller tettsted nær dagens endepunkt. Se etter hytte, hotell eller camping langs veien.',
      updated: (t) => `Varsel oppdatert ${t}`, kmFromStart: (km) => `${km} km fra start`, legend: { warm: 'Varmt og sol', cool: 'Kjølig eller skyet' },
      dayChip: (n) => `Dag ${n}`,
    },
    en: {
      headline: 'Hi Jens, where are you heading?', lead: 'Enter where you start and where you’re going. Reisevær suggests stops along the route where the weather is warmest and sunniest.',
      from: 'From', to: 'To', fromPlaceholder: 'City, place or address', toPlaceholder: 'City, place or address', swap: 'Swap from and to',
      date: 'Departure', days: 'Number of days', moreDays: 'One more day', fewerDays: 'One day less', submit: 'Find the best stops', dayN: (n) => (n === 1 ? '1 day' : `${n} days`),
      map: 'Map of the route', ad: 'Advertisement',
      adPreviewTitle: 'Ad space (preview)', adPreviewText: 'A small Google ad appears here once the AdSense account is approved.',
      notConfigured: 'The weather forecast is not switched on yet: add contact information to MET_CONTACT in the .env file and restart the app.',
      credits: 'Weather forecast from the <a href="https://www.met.no/en" target="_blank" rel="noopener">Norwegian Meteorological Institute</a> – the same data that <a href="https://www.yr.no/en" target="_blank" rel="noopener">Yr</a> uses (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>). Map and place names © <a href="https://www.kartverket.no/en" target="_blank" rel="noopener">Kartverket</a>. Routing © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, <a href="https://routing.openstreetmap.de/" target="_blank" rel="noopener">FOSSGIS</a>. Reisevær is not affiliated with Yr or the Norwegian Meteorological Institute.',
      regionAu: 'Australia', regionNo: 'Norway',
      ghostTip: 'Drag to take another road', viaTip: 'Drag to move · click to remove', updatingRoute: 'Updating the route …', resetRoute: 'Reset route',
      dragHint: 'Tip: drag the blue route on the map to go via other towns or roads.', viaCount: (n) => (n === 1 ? 'via 1 point you chose' : `via ${n} points you chose`),
      creditsAu: 'Weather forecast from the <a href="https://www.met.no/en" target="_blank" rel="noopener">Norwegian Meteorological Institute</a> – the same data that <a href="https://www.yr.no/en" target="_blank" rel="noopener">Yr</a> uses (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>). Map, places and routing © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors (ODbL), place search by <a href="https://photon.komoot.io/" target="_blank" rel="noopener">Photon</a>, routes by <a href="https://routing.openstreetmap.de/" target="_blank" rel="noopener">FOSSGIS</a>. For official Australian weather warnings, see the <a href="https://www.bom.gov.au/" target="_blank" rel="noopener">Bureau of Meteorology</a>. Reisevær is not affiliated with Yr or the Norwegian Meteorological Institute.',
      pickFrom: 'Choose where you start.', pickTo: 'Choose where you’re going.', samePlace: 'Start and destination are the same place.', noMatch: (q) => `Couldn’t find “${q}”. Try another place name.`,
      searching: 'Searching …', loading: (km) => (km ? `Fetching the forecast along ${km} km of road …` : 'Calculating the route and fetching the forecast …'),
      loadingSub: 'We check the weather in towns and villages along the whole route.',
      errors: {
        invalid_place: 'Choose places from the list.', different_regions: 'Start and destination must be in the same country.', invalid_via: 'The route can only be dragged to places in the same country.', invalid_date: 'Choose a valid date.', invalid_days: 'Choose the number of days.',
        date_past: 'The departure date has already passed.', beyond_forecast: 'Departure must be within about 9 days – that’s as far as the forecast reaches.',
        too_many_days: 'That many days makes very short stages on this route. Choose fewer days.',
        too_short: 'The trip is too short to suggest stops.', no_route: 'No driving route found between the places.',
        not_configured: 'The weather forecast is switched off (MET_CONTACT missing in .env).', weather_unavailable: 'The forecast is not available right now. Try again shortly.',
        rate_limited: 'Too many searches in a short time. Wait a moment and try again.', upstream_error: 'One of the services we use is not responding. Try again shortly.',
        network: 'No connection to the server.', default: 'Something went wrong. Try again.',
      },
      drive: 'driving', dayTitle: (n) => `Day ${n}`, kmShort: 'km', hoursFmt: (h) => { const t = Math.round(h * 60); return `${Math.floor(t / 60)} h ${t % 60} min`; },
      roles: { start: 'Start', visit: 'Stop on the way', overnight: 'Overnight', destination: 'Destination' },
      best: 'Best weather', bestLine: (name, day) => `Best weather on the trip: ${name}, day ${day + 1}`,
      cloud: 'Cloud cover', precip: 'Precipitation', noForecast: 'Forecast comes later',
      dayNoForecast: (d) => `The forecast currently reaches ${d}. Stops on this day are spread evenly along the route – come back closer to departure to see the weather.`,
      coarse: 'Further ahead the forecast is less detailed (6-hour steps) and less certain.',
      warnTitle: 'Keep an eye on the weather',
      warn: { heavy_rain: (p) => `Heavy rain near ${p}`, strong_wind: (p) => `Strong wind near ${p}`, snow_ice: (p) => `Possible snow or icy roads near ${p}`, thunder: (p) => `Thunder near ${p}` },
      alertLevel: { yellow: 'Yellow warning', orange: 'Orange warning', red: 'Red warning' },
      noStops: 'Short stretch – no extra stops suggested.',
      noOvernight: 'No town near the end of this day’s drive. Look for a cabin, hotel or campsite along the road.',
      updated: (t) => `Forecast updated ${t}`, kmFromStart: (km) => `${km} km from start`, legend: { warm: 'Warm and sunny', cool: 'Cool or cloudy' },
      dayChip: (n) => `Day ${n}`,
    },
  };

  const storage = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
  let lang = storage.get('reisevaer-lang') || (/^(nb|nn|no)/i.test(navigator.language || '') ? 'nb' : 'en');
  if (!T[lang]) lang = 'nb';
  const t = (k) => T[lang][k];
  // Country: Australia (default) or Norway. Decides place search, map and time zone.
  let region = storage.get('reisevaer-region') === 'no' ? 'no' : 'au';
  const locale = () => (lang === 'en' ? 'en-GB' : 'nb-NO');

  const $ = (id) => document.getElementById(id);
  const els = { form: $('trip'), from: $('from'), to: $('to'), date: $('date'), days: $('days'), go: $('go'), error: $('form-error'), results: $('results'), notice: $('config-notice'), adSlot: $('ad-slot') };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let info = { configured: true, today: new Date().toISOString().slice(0, 10), lastDate: null, maxDays: 21 };
  const chosen = { from: null, to: null };
  let lastPlan = null;
  let loading = false;

  // --- Weather icons ------------------------------------------------------------------
  const SUN = '<circle cx="12" cy="12" r="4.2" fill="#f5b300"/><g stroke="#f5b300" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5"/></g>';
  const MOON = '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.4A7 7 0 0 1 15.5 3.5z" fill="#c6cfdb"/>';
  const cloud = (x = 0, y = 0, c = '#a8b4c0') => `<path transform="translate(${x} ${y})" d="M7.5 19h9.8a4.2 4.2 0 0 0 .5-8.4 5.6 5.6 0 0 0-10.7 1.6A3.4 3.4 0 0 0 7.5 19z" fill="${c}"/>`;
  function icon(code) {
    if (!code) return '<svg viewBox="0 0 24 24" class="wx" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="#cfd6de"/></svg>';
    const night = code.endsWith('_night');
    const body = night ? MOON : SUN;
    const base = code.replace(/_(day|night|polartwilight)$/, '');
    let s;
    if (base === 'clearsky') s = body;
    else if (base === 'fair') s = `<g transform="translate(-2 -2) scale(.9)">${body}</g>${cloud(3, 3, '#c3ccd6')}`;
    else if (base === 'partlycloudy') s = `<g transform="translate(-3 -3) scale(.85)">${body}</g>${cloud(1, 1)}`;
    else if (base === 'fog') s = '<g stroke="#a8b4c0" stroke-width="2" stroke-linecap="round"><path d="M4 9h16M3 13h18M5 17h14"/></g>';
    else {
      const drops = /snow/.test(base) ? '<g fill="#7fb0dd"><circle cx="9" cy="21.5" r="1.2"/><circle cx="14" cy="22" r="1.2"/></g>'
        : /sleet/.test(base) ? '<path d="M9 20.5l-1 2.5" stroke="#3b82c4" stroke-width="1.8" stroke-linecap="round"/><circle cx="14.5" cy="21.8" r="1.2" fill="#7fb0dd"/>'
        : /rain/.test(base) ? `<g stroke="#3b82c4" stroke-width="1.8" stroke-linecap="round"><path d="M9 20.5l-1 2.5M13 20.5l-1 2.5${/heavy/.test(base) ? 'M17 20.5l-1 2.5' : ''}"/></g>` : '';
      const bolt = /thunder/.test(base) ? '<path d="M12.5 15.5 10 20h2.6l-1.2 3.5 3.6-5h-2.6l1.2-3z" fill="#f5b300"/>' : '';
      const showers = /showers/.test(base) ? `<g transform="translate(-3 -4) scale(.8)">${body}</g>` : '';
      s = `${showers}${cloud(0, -2, base === 'cloudy' ? '#9aa6b2' : '#8e9aa7')}${drops}${bolt}`;
    }
    return `<svg viewBox="0 0 24 24" class="wx" aria-hidden="true">${s}</svg>`;
  }

  // --- Texts on the page ----------------------------------------------------------------
  function applyTexts() {
    document.documentElement.lang = lang === 'en' ? 'en' : 'nb';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); if (el.tagName === 'BUTTON') el.title = t(el.dataset.i18nLabel); });
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    document.querySelectorAll('[data-region]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.region === region)));
    document.querySelector('.credits p').innerHTML = t(region === 'au' ? 'creditsAu' : 'credits');
    const current = Number(els.days.value) || 2;
    els.days.innerHTML = Array.from({ length: info.maxDays }, (_, i) => `<option value="${i + 1}">${esc(t('dayN')(i + 1))}</option>`).join('');
    els.days.value = String(current);
    constrainDays();
  }

  function constrainDays() {
    // Every length up to the maximum is allowed; days beyond the forecast get stops without weather.
    updateStepper();
  }

  // Up/down buttons next to the number of days (skip days the forecast doesn't reach).
  const daysUp = $('days-up');
  const daysDown = $('days-down');
  const allowedDays = () => [...els.days.options].filter((o) => !o.disabled).map((o) => Number(o.value));
  function updateStepper() {
    const allowed = allowedDays();
    const n = Number(els.days.value);
    daysUp.disabled = !allowed.some((v) => v > n);
    daysDown.disabled = !allowed.some((v) => v < n);
  }
  function stepDays(dir) {
    const n = Number(els.days.value);
    const allowed = allowedDays();
    const next = dir > 0 ? allowed.find((v) => v > n) : allowed.reverse().find((v) => v < n);
    if (next) { els.days.value = String(next); updateStepper(); }
  }
  daysUp.addEventListener('click', () => stepDays(1));
  daysDown.addEventListener('click', () => stepDays(-1));
  els.days.addEventListener('change', updateStepper);

  // --- Place search (autocomplete) -------------------------------------------------------
  function setupPlace(role) {
    const input = els[role];
    const list = $(`${role}-list`);
    let items = [];
    let active = -1;
    let timer = null;
    let seq = 0;

    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
    const render = () => {
      list.innerHTML = items.map((p, i) => `<li role="option" id="${role}-opt-${i}" class="${i === active ? 'active' : ''}" data-i="${i}" aria-selected="${i === active}">
        <span class="s-name">${esc(p.name)}</span><span class="s-detail">${esc(p.detail || '')}</span></li>`).join('');
      list.hidden = !items.length;
      input.setAttribute('aria-expanded', String(!list.hidden));
      if (active >= 0) input.setAttribute('aria-activedescendant', `${role}-opt-${active}`); else input.removeAttribute('aria-activedescendant');
    };
    const choose = (p) => { chosen[role] = p; input.value = p.name; close(); hideError(); };

    input.addEventListener('input', () => {
      chosen[role] = null;
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { items = []; render(); return; }
      timer = setTimeout(async () => {
        const my = ++seq;
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&region=${region}`);
          const data = await res.json();
          if (my !== seq) return;
          items = data.results ?? [];
          active = items.length ? 0 : -1;
          render();
        } catch { /* ignore; the user can try again */ }
      }, 220);
    });
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; render(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active]); }
      else if (e.key === 'Escape') close();
    });
    list.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[data-i]');
      if (li) { e.preventDefault(); choose(items[Number(li.dataset.i)]); }
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
    return { first: async () => {
      const q = input.value.trim();
      if (q.length < 2) return null;
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&region=${region}`);
      const data = await res.json();
      return data.results?.[0] ?? null;
    } };
  }
  const placeFields = { from: setupPlace('from'), to: setupPlace('to') };

  $('swap').addEventListener('click', () => {
    [chosen.from, chosen.to] = [chosen.to, chosen.from];
    [els.from.value, els.to.value] = [els.to.value, els.from.value];
  });

  // --- Map --------------------------------------------------------------------------------
  // Australia: OpenStreetMap tiles, starting over Melbourne. Norway: Kartverket's topographic map.
  const VIEWS = { au: { center: [-37.8136, 144.9631], zoom: 9 }, no: { center: [64.5, 13], zoom: 5 } };
  const TILES = {
    au: () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://www.met.no/" target="_blank" rel="noopener">MET Norway</a>',
    }),
    no: () => L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', {
      maxZoom: 18, attribution: '© <a href="https://www.kartverket.no/" target="_blank" rel="noopener">Kartverket</a> · <a href="https://www.met.no/" target="_blank" rel="noopener">MET Norway</a>',
    }),
  };
  const map = L.map('map', { zoomControl: true, attributionControl: true }).setView(VIEWS[region].center, VIEWS[region].zoom);
  let tiles = TILES[region]().addTo(map);
  function showRegionMap() {
    map.removeLayer(tiles);
    tiles = TILES[region]().addTo(map);
    map.setView(VIEWS[region].center, VIEWS[region].zoom);
  }
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  const layers = L.layerGroup().addTo(map);
  const markers = new Map(); // stop id -> marker

  // Colour from the weather score: blue (cool/cloudy) → yellow → orange (warm and sunny).
  function scoreColor(score) {
    const stops = [[-5, [93, 140, 186]], [5, [143, 180, 196]], [12, [242, 196, 84]], [20, [240, 140, 40]]];
    const s = Math.max(stops[0][0], Math.min(stops.at(-1)[0], score ?? 0));
    for (let i = 1; i < stops.length; i++) {
      if (s <= stops[i][0]) {
        const [a, ca] = stops[i - 1]; const [b, cb] = stops[i]; const f = (s - a) / (b - a);
        return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * f)).join(',')})`;
      }
    }
    return 'rgb(240,140,40)';
  }

  function stopId(s) { return `${s.role}-${s.day}-${s.lat}-${s.lon}`; }

  function drawMap(p, fit = true) {
    layers.clearLayers();
    markers.clear();
    const line = L.polyline(p.route.line, { color: '#1f5f8b', weight: 5, opacity: 0.75, interactive: false }).addTo(layers);
    // A wide, invisible copy of the line catches the mouse, so the route is easy to grab and drag.
    const hit = L.polyline(p.route.line, { weight: 22, opacity: 0, className: 'route-hit' }).addTo(layers);
    setupRouteDrag(line, hit);
    for (const town of p.towns) {
      L.circleMarker([town.lat, town.lon], { radius: 5, weight: 1, color: '#fff', fillColor: scoreColor(town.score), fillOpacity: 0.95 })
        .bindTooltip(`${esc(town.name)} · ${town.tempMax ?? '–'}° · ${esc(t('cloud'))} ${town.cloud ?? '–'} % · ${esc(t('dayChip')(town.day + 1))}`, { direction: 'top' })
        .addTo(layers);
    }
    allStops(p).forEach((s, i) => {
      const cls = `pin pin-${s.role}${p.bestStop && s.name === p.bestStop.name && s.day === p.bestStop.day ? ' pin-best' : ''}`;
      const html = `<span class="${cls}"><b>${i + 1}</b>${s.weather?.tempMax != null ? `<i>${s.weather.tempMax}°</i>` : ''}</span>`;
      const m = L.marker([s.lat, s.lon], { icon: L.divIcon({ html, className: 'pin-wrap', iconSize: null, iconAnchor: [16, 16] }), title: s.name, riseOnHover: true })
        .bindPopup(popupHtml(s), { closeButton: true, autoPanPadding: [30, 30] })
        .addTo(layers);
      m.on('click', () => highlight(stopId(s), false));
      markers.set(stopId(s), m);
    });
    drawVias();
    if (fit) map.fitBounds(line.getBounds(), { padding: [30, 30] });
  }

  // --- Draggable route (like Google Maps) ----------------------------------------------------
  // Hover the route to get a handle, drag it to another town or road, and the route and the plan are
  // recalculated through that point. Dragged points stay as white dots: drag them again or click to remove.
  // On touch screens, tap the route to place a handle and then drag it.
  let vias = []; // points the route is forced through, in route order: [{ lat, lon }]
  let route = null; // { line } – the drawn route
  const routeUi = L.layerGroup().addTo(map); // via dots, the hover handle and the drag preview
  let ghost = null;
  let ghostTimer = null;
  let dragging = false;
  let lastDragEnd = 0;
  let updating = false;
  const handleIcon = (cls) => L.divIcon({ className: 'via-wrap', html: `<span class="via-handle ${cls}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });

  // Nearest point on the drawn route, and how far along the route it is (screen pixels at the current zoom).
  function projectOnRoute(latlng) {
    const pts = route.line.getLatLngs().map((ll) => map.latLngToLayerPoint(ll));
    const p = map.latLngToLayerPoint(latlng);
    let best = null;
    let along = 0;
    for (let i = 1; i < pts.length; i++) {
      const q = L.LineUtil.closestPointOnSegment(p, pts[i - 1], pts[i]);
      const d = p.distanceTo(q);
      if (!best || d < best.d) best = { d, q, along: along + pts[i - 1].distanceTo(q) };
      along += pts[i - 1].distanceTo(pts[i]);
    }
    return { latlng: map.layerPointToLatLng(best.q), along: best.along };
  }
  const ll = (v) => L.latLng(v.lat, v.lon);
  // Where a new point at `along` falls among the existing via points, and the points before and after it.
  function slotFor(along) {
    const k = vias.filter((v) => projectOnRoute(ll(v)).along < along).length;
    return { k, prev: k === 0 ? ll(chosen.from) : ll(vias[k - 1]), next: k === vias.length ? ll(chosen.to) : ll(vias[k]) };
  }

  function attachDrag(marker, index) {
    let slot = null;
    let preview = null;
    marker.on('dragstart', () => {
      dragging = true;
      clearTimeout(ghostTimer);
      slot = index == null ? slotFor(projectOnRoute(marker.getLatLng()).along)
        : { k: index, prev: index === 0 ? ll(chosen.from) : ll(vias[index - 1]), next: index === vias.length - 1 ? ll(chosen.to) : ll(vias[index + 1]) };
      preview = L.polyline([slot.prev, marker.getLatLng(), slot.next], { color: '#1f5f8b', weight: 4, opacity: 0.7, dashArray: '6 8', interactive: false }).addTo(routeUi);
    });
    marker.on('drag', () => preview.setLatLngs([slot.prev, marker.getLatLng(), slot.next]));
    marker.on('dragend', () => {
      dragging = false;
      lastDragEnd = Date.now();
      const p = marker.getLatLng();
      const point = { lat: Math.round(p.lat * 1e5) / 1e5, lon: Math.round(p.lng * 1e5) / 1e5 };
      const next = [...vias];
      if (index == null) next.splice(slot.k, 0, point); else next[index] = point;
      replan(next);
    });
  }

  function hideGhost() {
    if (ghost && !dragging) { routeUi.removeLayer(ghost); ghost = null; }
  }
  function showGhost(latlng) {
    if (dragging || updating) return;
    clearTimeout(ghostTimer);
    if (ghost) { ghost.setLatLng(latlng); return; }
    ghost = L.marker(latlng, { icon: handleIcon('ghost'), draggable: true, zIndexOffset: 1000, keyboard: false, title: t('ghostTip') }).addTo(routeUi);
    ghost.on('mouseover', () => clearTimeout(ghostTimer));
    ghost.on('mouseout', () => { ghostTimer = setTimeout(hideGhost, 300); });
    attachDrag(ghost, null);
  }

  function setupRouteDrag(line, hit) {
    route = { line };
    hit.on('mousemove', (e) => showGhost(projectOnRoute(e.latlng).latlng));
    hit.on('mouseout', () => { ghostTimer = setTimeout(hideGhost, 300); });
    hit.on('click', (e) => { L.DomEvent.stopPropagation(e); showGhost(projectOnRoute(e.latlng).latlng); });
  }
  map.on('click', hideGhost);

  function drawVias() {
    routeUi.clearLayers();
    ghost = null;
    vias.forEach((v, i) => {
      const m = L.marker(ll(v), { icon: handleIcon('via'), draggable: true, zIndexOffset: 900, keyboard: false, title: t('viaTip') }).addTo(routeUi);
      attachDrag(m, i);
      // Click removes the point (a click right after a drag is ignored).
      m.on('click', () => { if (Date.now() - lastDragEnd > 400 && !updating) replan(vias.filter((_, j) => j !== i)); });
    });
    routeCtl.render();
  }

  // Map control: "Updating the route …" while recalculating, and "Reset route" when the route has via points.
  const RouteCtl = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      this.div = L.DomUtil.create('div', 'route-ctl');
      L.DomEvent.disableClickPropagation(this.div);
      this.div.addEventListener('click', (e) => { if (e.target.closest('.route-reset') && !updating) replan([]); });
      return this.div;
    },
    render() {
      if (!this.div) return;
      this.div.innerHTML = updating ? `<span class="route-busy"><span class="spinner" aria-hidden="true"></span>${esc(t('updatingRoute'))}</span>`
        : vias.length && lastPlan ? `<button type="button" class="route-reset">${esc(t('resetRoute'))}</button>` : '';
    },
  });
  const routeCtl = new RouteCtl().addTo(map);

  async function replan(nextVias) {
    if (loading || updating) return;
    const before = vias;
    vias = nextVias;
    updating = true;
    hideGhost();
    routeCtl.render();
    const ok = await requestPlan({ fit: false });
    updating = false;
    if (!ok) vias = before;
    if (lastPlan) drawMap(lastPlan, false); else drawVias();
  }

  // Fetch a plan for the chosen places, days and via points, and show it. Returns true on success.
  async function requestPlan({ fit }) {
    loading = true;
    els.go.disabled = true;
    hideError();
    if (fit) renderLoading();
    try {
      const res = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: chosen.from, to: chosen.to, date: els.date.value, days: Number(els.days.value), vias, lang: lang === 'en' ? 'en' : 'no' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'default'), { code: data.error });
      lastPlan = data;
      renderPlan(data);
      drawMap(data, fit);
      return true;
    } catch (err) {
      if (fit) els.results.innerHTML = '';
      const errs = t('errors');
      showError(errs[err.code] ?? (err instanceof TypeError ? errs.network : errs.default));
      return false;
    } finally {
      loading = false;
      els.go.disabled = false;
    }
  }

  function popupHtml(s) {
    const w = s.weather;
    return `<div class="pop"><strong>${esc(s.name)}</strong><span>${esc(t('roles')[s.role])} · ${esc(t('dayChip')(s.day + 1))}</span>
      ${w ? `<div class="pop-wx">${icon(w.symbol)}<b>${w.tempMax}°</b><span>${esc(t('cloud'))} ${w.cloud} %</span></div>` : `<em>${esc(t('noForecast'))}</em>`}</div>`;
  }

  function highlight(id, pan = true) {
    document.querySelectorAll('.stop.selected').forEach((el) => el.classList.remove('selected'));
    const el = document.querySelector(`.stop[data-id="${CSS.escape(id)}"]`);
    if (el) { el.classList.add('selected'); if (!pan) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    const m = markers.get(id);
    if (m && pan) { map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 9), { duration: 0.6 }); m.openPopup(); }
  }

  // --- Results ----------------------------------------------------------------------------
  const allStops = (p) => [p.from, ...p.days.flatMap((d) => d.stops), p.to];

  function fmtDate(d) {
    return new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  }

  function stopHtml(s, n, best) {
    const w = s.weather;
    const flags = [...(s.alerts ?? []).map((a) => `<span class="chip chip-${esc(a.level)}">${esc(t('alertLevel')[a.level] ?? a.title)}</span>`),
      ...(s.flags ?? []).map((f) => `<span class="chip chip-warn">${esc(t('warn')[f](s.name).replace(/ (ved|near) .*$/, ''))}</span>`)];
    return `<li class="stop stop-${s.role}${best ? ' is-best' : ''}" data-id="${esc(stopId(s))}" tabindex="0">
      <span class="num">${n}</span>
      <div class="stop-main">
        <div class="stop-head">
          <span class="stop-name">${esc(s.name)}${s.altName ? ` <span class="alt-name">${esc(s.altName)}</span>` : ''}</span>
          ${best ? `<span class="best">${esc(t('best'))}</span>` : ''}
        </div>
        <div class="stop-meta">${esc(t('roles')[s.role])}${s.municipality && s.municipality !== s.name ? ` · ${esc(s.municipality)}` : ''}${s.role !== 'start' && s.alongKm ? ` · ${esc(t('kmFromStart')(s.alongKm))}` : ''}</div>
        ${flags.length ? `<div class="chips">${flags.join('')}</div>` : ''}
      </div>
      ${w ? `<div class="wx-box" data-color="${scoreColor(s.score)}">
          ${icon(w.symbol)}
          <div class="temp"><b>${w.tempMax}°</b><span>${w.tempMin}°</span></div>
          <div class="clouds" title="${esc(t('cloud'))} ${w.cloud} %">
            <span class="c-label">${esc(t('cloud'))}</span>
            <span class="bar"><i data-w="${Number(w.cloud) || 0}"></i></span>
            <span class="c-val">${w.cloud} %</span>
          </div>
        </div>` : `<div class="wx-box wx-none">${esc(t('noForecast'))}</div>`}
    </li>`;
  }

  function renderPlan(p) {
    const stops = allStops(p);
    let n = 0;
    const isBest = (s) => p.bestStop && s.name === p.bestStop.name && s.day === p.bestStop.day;
    const days = p.days.map((d) => {
      const list = [...(d.index === 0 ? [p.from] : []), ...d.stops, ...(d.index === p.days.length - 1 ? [p.to] : [])];
      const warnings = d.warnings.map((w) => (w.kind === 'alert'
        ? `<li class="w-alert w-${esc(w.level)}">${esc(t('alertLevel')[w.level] ?? '')}: ${esc(w.title)}</li>`
        : `<li>${esc(t('warn')[w.kind](w.place))}</li>`)).join('');
      return `<section class="day">
        <header class="day-head">
          <div><h2>${esc(t('dayTitle')(d.index + 1))}</h2><span class="day-date">${esc(fmtDate(d.date))}</span></div>
          <span class="day-drive">${d.km} ${esc(t('kmShort'))} · ${esc(t('hoursFmt')(d.hours))} ${esc(t('drive'))}</span>
        </header>
        ${d.noForecast ? `<p class="no-forecast">${esc(t('dayNoForecast')(fmtDate(p.lastForecastDate)))}</p>` : ''}
        ${warnings ? `<div class="warnings"><strong>${esc(t('warnTitle'))}</strong><ul>${warnings}</ul></div>` : ''}
        <ol class="stops">${list.map((s) => stopHtml(s, ++n, isBest(s))).join('')}</ol>
        ${d.noOvernight ? `<p class="muted small">${esc(t('noOvernight'))}</p>` : !d.stops.length && p.days.length > 1 ? `<p class="muted small">${esc(t('noStops'))}</p>` : ''}
      </section>`;
    }).join('');
    const updated = p.updatedAt ? new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(p.updatedAt)) : null;
    els.results.innerHTML = `
      <div class="summary">
        <div class="sum-route"><span>${esc(p.from.name)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span>${esc(p.to.name)}</span></div>
        <div class="sum-meta">${p.route.km} ${esc(t('kmShort'))} · ${esc(t('hoursFmt')(p.route.hours))} ${esc(t('drive'))} · ${esc(t('dayN')(p.days.length))}${p.vias?.length ? ` · ${esc(t('viaCount')(p.vias.length))}` : ''}</div>
        <p class="route-hint">${esc(t('dragHint'))}</p>
        ${p.bestStop ? `<div class="sum-best">${icon('clearsky_day')}<span>${esc(t('bestLine')(p.bestStop.name, p.bestStop.day))}</span></div>` : ''}
      </div>
      ${days}
      <div class="foot-notes">
        <div class="legend"><span class="lg-bar"></span><span>${esc(t('legend').cool)}</span><span>${esc(t('legend').warm)}</span></div>
        ${p.coarse ? `<p class="muted small">${esc(t('coarse'))}</p>` : ''}
        ${updated ? `<p class="muted small">${esc(t('updated')(updated))}</p>` : ''}
      </div>`;
    // Styles are set from script (the security policy does not allow inline style attributes).
    els.results.querySelectorAll('[data-w]').forEach((el) => { el.style.width = `${el.dataset.w}%`; });
    els.results.querySelectorAll('[data-color]').forEach((el) => { el.style.setProperty('--c', el.dataset.color); });
    void stops;
  }

  function renderLoading() {
    els.results.innerHTML = `<div class="loading"><span class="spinner" aria-hidden="true"></span><div><strong>${esc(t('loading')(null))}</strong><p class="muted small">${esc(t('loadingSub'))}</p></div></div>`;
  }

  function showError(msg) { els.error.textContent = msg; els.error.hidden = false; }
  function hideError() { els.error.hidden = true; }

  els.results.addEventListener('click', (e) => {
    const li = e.target.closest('.stop');
    if (li) highlight(li.dataset.id, true);
  });
  els.results.addEventListener('keydown', (e) => {
    const li = e.target.closest('.stop');
    if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); highlight(li.dataset.id, true); }
  });

  // --- Submit -------------------------------------------------------------------------------
  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (loading) return;
    hideError();
    for (const role of ['from', 'to']) {
      if (!chosen[role] && els[role].value.trim().length >= 2) {
        try { chosen[role] = await placeFields[role].first(); } catch { /* handled below */ }
        if (!chosen[role]) return showError(t('noMatch')(els[role].value.trim()));
        els[role].value = chosen[role].name;
      }
    }
    if (!chosen.from) return showError(t('pickFrom'));
    if (!chosen.to) return showError(t('pickTo'));
    if (Math.abs(chosen.from.lat - chosen.to.lat) < 0.01 && Math.abs(chosen.from.lon - chosen.to.lon) < 0.01) return showError(t('samePlace'));

    // A new start or destination starts a new route; same places (other date or days) keep the dragged route.
    const same = (a, b) => a && b && a.lat === b.lat && a.lon === b.lon;
    if (!lastPlan || !same(lastPlan.from, chosen.from) || !same(lastPlan.to, chosen.to)) vias = [];
    const ok = await requestPlan({ fit: true });
    if (ok && window.matchMedia('(max-width: 900px)').matches) document.querySelector('.map-wrap').scrollIntoView({ behavior: 'smooth' });
  });

  // --- Departure date picker ---------------------------------------------------------------------
  // A small calendar of our own, so one click opens it and the next click closes it.
  const datePicker = (() => {
    const btn = $('date-btn');
    const pop = $('date-pop');
    const label = $('date-label');
    let view = null; // 'YYYY-MM' shown in the calendar
    const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const parts = (s) => s.split('-').map(Number);
    const min = () => info.today;
    const max = () => info.lastDate || info.today;
    const isOpen = () => !pop.hidden;

    function updateLabel() {
      const v = els.date.value;
      label.textContent = v ? new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${v}T12:00:00Z`)) : '';
    }

    function render() {
      const [y, m] = parts(view);
      const first = new Date(Date.UTC(y, m - 1, 1));
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const lead = (first.getUTCDay() + 6) % 7; // Monday first
      const monthName = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
      const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))));
      const [minY, minM] = parts(min());
      const [maxY, maxM] = parts(max());
      const canPrev = y * 12 + m > minY * 12 + minM;
      const canNext = y * 12 + m < maxY * 12 + maxM;
      let cells = '';
      for (let i = 0; i < lead; i++) cells += '<span></span>';
      for (let d = 1; d <= daysInMonth; d++) {
        const v = iso(y, m, d);
        const off = v < min() || v > max();
        cells += `<button type="button" class="cal-day${v === els.date.value ? ' selected' : ''}${v === info.today ? ' today' : ''}" data-date="${v}"${off ? ' disabled' : ''} aria-pressed="${v === els.date.value}" tabindex="${v === els.date.value ? 0 : -1}">${d}</button>`;
      }
      pop.innerHTML = `
        <div class="cal-head">
          <button type="button" class="cal-nav" data-nav="-1" aria-label="${lang === 'en' ? 'Previous month' : 'Forrige måned'}"${canPrev ? '' : ' disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
          <span class="cal-title">${esc(monthName)}</span>
          <button type="button" class="cal-nav" data-nav="1" aria-label="${lang === 'en' ? 'Next month' : 'Neste måned'}"${canNext ? '' : ' disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
        </div>
        <div class="cal-grid cal-weekdays">${weekdays.map((w) => `<span>${esc(w.replace('.', ''))}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <p class="cal-note">${esc(lang === 'en' ? 'The forecast reaches about 9 days ahead.' : 'Værvarselet rekker ca. 9 dager frem.')}</p>`;
    }

    // Place the calendar under the button (or above it if there isn't room below), inside the window.
    function place() {
      const r = btn.getBoundingClientRect();
      const w = pop.offsetWidth;
      const h = pop.offsetHeight;
      let top = r.bottom + 8;
      if (top + h > window.innerHeight - 8) {
        // Not room below: open above the button, or as low as fits in a short window.
        top = r.top - h - 8 >= 8 ? r.top - h - 8 : window.innerHeight - h - 8;
      }
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      pop.style.top = `${Math.max(8, top)}px`;
      pop.style.left = `${left}px`;
    }
    function open() {
      view = (els.date.value || min()).slice(0, 7);
      render();
      pop.hidden = false;
      place();
      btn.setAttribute('aria-expanded', 'true');
      (pop.querySelector('.cal-day.selected') || pop.querySelector('.cal-day:not([disabled])'))?.focus({ preventScroll: true });
    }
    function close(focusButton = false) {
      if (!isOpen()) return;
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (focusButton) btn.focus();
    }
    function select(v) {
      els.date.value = v;
      updateLabel();
      constrainDays();
      close(true);
    }

    btn.addEventListener('click', () => (isOpen() ? close() : open()));
    pop.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav && !nav.disabled) {
        const [y, m] = parts(view);
        const d = new Date(Date.UTC(y, m - 1 + Number(nav.dataset.nav), 1));
        view = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        render();
        return;
      }
      const day = e.target.closest('[data-date]');
      if (day && !day.disabled) select(day.dataset.date);
    });
    // Arrow keys move between days, Enter/space picks, Escape closes.
    pop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      const current = document.activeElement?.dataset?.date;
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!current || !step) return;
      e.preventDefault();
      const next = new Date(Date.parse(`${current}T12:00:00Z`) + step * 864e5).toISOString().slice(0, 10);
      if (next < min() || next > max()) return;
      if (next.slice(0, 7) !== view) { view = next.slice(0, 7); render(); }
      pop.querySelector(`[data-date="${next}"]`)?.focus();
    });
    // Click anywhere else closes the calendar.
    document.addEventListener('mousedown', (e) => {
      if (isOpen() && !pop.contains(e.target) && !btn.contains(e.target)) close();
    });
    document.addEventListener('focusin', (e) => {
      if (isOpen() && !pop.contains(e.target) && e.target !== btn) close();
    });
    // Keep it next to the button when the page scrolls or the window changes size.
    document.addEventListener('scroll', () => { if (isOpen()) place(); }, true);
    window.addEventListener('resize', () => { if (isOpen()) place(); });
    return { updateLabel, rerender: () => { updateLabel(); if (isOpen()) render(); } };
  })();

  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang;
    storage.set('reisevaer-lang', lang);
    applyTexts();
    datePicker.rerender();
    renderAdPreview();
    if (lastPlan) { renderPlan(lastPlan); drawMap(lastPlan, false); } else routeCtl.render();
  }));

  // --- Advertisement (Google AdSense) ------------------------------------------------------------
  // One responsive ad at the bottom of the list, clearly labelled and away from the buttons.
  // Preview mode (ADS_ENABLED=true without IDs) shows an empty box so the placement can be judged.
  let adsInfo = null;
  function renderAdPreview() {
    if (!adsInfo?.preview) return;
    $('ad-box').innerHTML = `<div class="ad-preview"><strong>${esc(t('adPreviewTitle'))}</strong><span>${esc(t('adPreviewText'))}</span></div>`;
  }
  function setupAds(ads) {
    adsInfo = ads;
    if (!ads?.enabled) return;
    els.adSlot.hidden = false;
    if (ads.preview) { renderAdPreview(); return; }
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    Object.assign(ins.dataset, { adClient: ads.client, adSlot: ads.slot, adFormat: 'auto', fullWidthResponsive: 'true' });
    if (ads.test) ins.dataset.adtest = 'on'; // test ads while developing: no real impressions or clicks
    $('ad-box').append(ins);
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ads.client)}`;
    document.head.append(script);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }

  // --- Start ----------------------------------------------------------------------------------
  els.date.value = info.today;
  applyTexts();
  datePicker.updateLabel();
  let adsDone = false;
  function loadInfo() {
    return fetch(`/api/info?region=${region}`).then((r) => r.json()).then((data) => {
      info = { ...info, ...data };
      els.notice.hidden = data.configured;
      if (!els.date.value || els.date.value < data.today || els.date.value > data.lastDate) els.date.value = data.today;
      datePicker.updateLabel();
      if (!adsDone) { setupAds(data.ads); adsDone = true; }
      applyTexts();
    }).catch(() => {});
  }
  loadInfo();

  // Switching country clears the trip and moves the map; "today" follows the country's time zone.
  document.querySelectorAll('[data-region]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.region === region) return;
    region = b.dataset.region;
    storage.set('reisevaer-region', region);
    chosen.from = null; chosen.to = null;
    els.from.value = ''; els.to.value = '';
    lastPlan = null;
    els.results.innerHTML = '';
    hideError();
    layers.clearLayers(); markers.clear();
    vias = []; routeUi.clearLayers(); ghost = null; routeCtl.render();
    showRegionMap();
    applyTexts();
    loadInfo();
  }));
})();
