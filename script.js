(function () {
  const $ = (sel) => document.querySelector(sel);

  const els = {
    hudAgency: $("#hudAgency"),
    hudMode: $("#hudMode"),
    hudInfo: $("#hudInfo"),

    viewSlide: $("#viewSlide"),
    viewEmpty: $("#viewEmpty"),

    emptyTitle: $("#emptyTitle"),
    emptySub: $("#emptySub"),

    slidePrice: $("#slidePrice"),
    slideRef: $("#slideRef"),
    slideTitle: $("#slideTitle"),
    slideMeta: $("#slideMeta"),

    slideImgA: $("#slideImgA"),
    slideImgB: $("#slideImgB"),
    slideProg: $("#slideProg"),   // ✅ présent maintenant dans le HTML

    slideStats: $("#slideStats"),

    contactAdvisor: $("#contactAdvisor"),
    contactAgencyPhone: $("#contactAgencyPhone"),
    contactAdvisorMobile: $("#contactAdvisorMobile"),

    dpeCard: $("#dpeCard"),
    dpeConsoImg: $("#dpeConsoImg"),
    dpeGesImg: $("#dpeGesImg"),
  };

  const PLACEHOLDER_SVG =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900">
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0" stop-color="#eef1f6"/>
            <stop offset="1" stop-color="#f6f7fb"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <circle cx="420" cy="420" r="220" fill="rgba(194,24,91,.12)"/>
        <circle cx="980" cy="300" r="260" fill="rgba(15,118,110,.12)"/>
        <text x="50%" y="52%" fill="rgba(18,19,24,.82)" font-family="Inter, Arial" font-size="52" font-weight="900" text-anchor="middle">
          GTI Immobilier
        </text>
        <text x="50%" y="60%" fill="rgba(18,19,24,.55)" font-family="Inter, Arial" font-size="24" font-weight="650" text-anchor="middle">
          Visuel indisponible
        </text>
      </svg>
    `);

  // ---------------------------
  // Helpers
  // ---------------------------
  function clampInt(v, min, max, def) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  }
  function safeText(s) { return (s == null ? "" : String(s)).trim(); }
  function normalizeAgency(s) { return safeText(s).toUpperCase(); }
  function parseDateKey(x) { const t = Date.parse(safeText(x)); return Number.isFinite(t) ? t : 0; }
  function asNumber(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }

  function formatPriceEUR(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "Prix sur demande";
    try {
      return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${Math.round(n).toLocaleString("fr-FR")} €`;
    }
  }

  // ✅ Nettoie le titre : retire “X pièce(s)” + coupe si trop long
  function cleanTitle(raw) {
    let t = safeText(raw || "Bien immobilier");
    if (!t) return "Bien immobilier";

    // retire " 5 pièce(s)" (avec ou sans tiret)
    t = t.replace(/\s*[-–—]?\s*\d+\s*pi[eè]ce(?:\(\s*s\s*\)|s)?\s*$/i, "");
    t = t.replace(/\b\d+\s*pi[eè]ce(?:\(\s*s\s*\)|s)\b/ig, "").replace(/\s{2,}/g, " ").trim();

    // coupe doux si vraiment énorme (sécurité)
    const max = 38;
    if (t.length > max) t = t.slice(0, max - 1).trim() + "…";
    return t || "Bien immobilier";
  }

  function normalizePhotos(photos, max = 10) {
    if (!Array.isArray(photos)) return [];
    const out = [];
    const seen = new Set();
    for (const u of photos) {
      const url = (u || "").toString().trim();
      if (!url) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      if (out.length >= max) break;
    }
    return out;
  }

  // salles de bain : support large
  function readBathrooms(item) {
    const candidates = [
      item.bathrooms, item.bathroom, item.bathroomCount,
      item.nbBathrooms, item.sdb, item.nbSdb, item.nb_sdb, item.bains
    ];
    for (const c of candidates) {
      const n = asNumber(c);
      if (n != null && n > 0) return Math.round(n);
    }
    return null;
  }
  function readWC(item){
    const candidates = [item.wc, item.WC, item.nbWc, item.nb_wc];
    for (const c of candidates){
      const n = asNumber(c);
      if (n != null && n >= 0) return Math.round(n);
    }
    return null;
  }
  function readLevels(item){
    const candidates = [item.levels, item.level, item.nbLevels, item.niveaux, item.etages];
    for (const c of candidates){
      const n = asNumber(c);
      if (n != null && n > 0) return Math.round(n);
    }
    return null;
  }
  function readTerrain(item){
    const candidates = [item.terrain, item.land, item.landSurface, item.surfterrain, item.surfaceTerrain];
    for (const c of candidates){
      const n = asNumber(c);
      if (n != null && n > 0) return Math.round(n);
    }
    return null;
  }
  function readCellar(item){
    const v = item.cellar ?? item.cave ?? item.hasCellar;
    if (typeof v === "boolean") return v;
    const s = safeText(v).toUpperCase();
    if (!s) return null;
    if (["OUI","YES","TRUE","1"].includes(s)) return true;
    if (["NON","NO","FALSE","0"].includes(s)) return false;
    return null;
  }

  function normalizeItem(item) {
    const it = { ...item };
    it.photos = normalizePhotos(it.photos, 10);

    const s = asNumber(it.surface);
    if (s != null) it.surface = s;

    const r = asNumber(it.rooms);
    if (r != null) it.rooms = Math.round(r);

    const b = asNumber(it.bedrooms);
    if (b != null) it.bedrooms = Math.round(b);

    const ba = readBathrooms(it);
    if (ba != null) it.bathrooms = ba;

    const wc = readWC(it);
    if (wc != null) it.wc = wc;

    const lv = readLevels(it);
    if (lv != null) it.levels = lv;

    const terr = readTerrain(it);
    if (terr != null) it.terrain = terr;

    const cel = readCellar(it);
    if (cel != null) it.cellar = cel;

    return it;
  }

  function getPhoto(item, idx) {
    const arr = Array.isArray(item.photos) ? item.photos : [];
    if (!arr.length) return PLACEHOLDER_SVG;
    const i = ((idx % arr.length) + arr.length) % arr.length;
    return arr[i] || PLACEHOLDER_SVG;
  }

  function sortItems(items) {
    return items.slice().sort((a, b) => {
      const da = parseDateKey(a.updatedAt);
      const db = parseDateKey(b.updatedAt);
      if (db !== da) return db - da;
      const wa = Number(a.weight || 0);
      const wb = Number(b.weight || 0);
      return wb - wa;
    });
  }

  function splitAcrossScreens(items, screen, screens, seed) {
    if (screens <= 1) return items;
    return items.filter((_, index) => ((index + seed) % screens) === (screen - 1));
  }

  // ---------------------------
  // Contact parsing (agence string)
  // ---------------------------
  function digitsOnly(s) { return safeText(s).replace(/[^\d]/g, ""); }
  function formatFR10(d10) { return d10.replace(/(\d{2})(?=\d)/g, "$1 ").trim(); }
  function isLikelyFRPhone(d) { return d.length === 10 && d.startsWith("0"); }

  function extractContactFromAgence(agenceStr) {
    const s = safeText(agenceStr);
    const out = { agencyName: "", agencyPhone: "", advisorName: "", advisorMobile: "" };
    if (!s) return out;

    const mName = s.match(/^(.+?)\s*T[ÉE]L\s*:/i);
    if (mName) out.agencyName = safeText(mName[1]);

    const mAgencyPhone = s.match(/T[ÉE]L\s*:\s*([0-9 .-]{8,})/i);
    if (mAgencyPhone) {
      const d = digitsOnly(mAgencyPhone[1]);
      if (isLikelyFRPhone(d)) out.agencyPhone = formatFR10(d);
    }

    const mAdvisor = s.match(/N[ÉE]GOCIATEUR\s+EN\s+CHARGE\s+DU\s+BIEN\s*:\s*([^:]+?)\s*T[ÉE]L\s*:/i);
    if (mAdvisor) out.advisorName = safeText(mAdvisor[1]);

    const mAdvisorMobile = s.match(/N[ÉE]GOCIATEUR\s+EN\s+CHARGE\s+DU\s+BIEN\s*:\s*.+?\s*T[ÉE]L\s*:\s*([0-9 .-]{8,})/i);
    if (mAdvisorMobile) {
      const d = digitsOnly(mAdvisorMobile[1]);
      if (isLikelyFRPhone(d)) out.advisorMobile = formatFR10(d);
    }

    return out;
  }

  function pickAdvisorMobile(item, extracted) {
    if (extracted && extracted.advisorMobile) return extracted.advisorMobile;
    const d = digitsOnly(item.phone);
    if (isLikelyFRPhone(d)) return formatFR10(d);
    return "—";
  }

  // ---------------------------
  // SVG icons (modern)
  // ---------------------------
  function iconSVG(name) {
    switch (name) {
      case "surface":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case "rooms":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 10.5V20h16v-9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 10.5 12 4l9 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 20v-6h4v6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>`;
      case "bedrooms":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 18v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
      case "bathrooms":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h14v3a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5v-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M7 12V7a3 3 0 0 1 3-3h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M16 8h2M18 6v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
      case "wc":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 7a5 5 0 0 1 10 0v6a5 5 0 0 1-10 0V7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M7 11h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M9 20h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
      case "levels":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M7 20V10l5-4 5 4v10" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M10 20v-5h4v5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>`;
      case "cellar":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 10l8-5 8 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M9 21v-6a3 3 0 0 1 6 0v6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>`;
      case "terrain":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 19l7-14 2 4 7-3-6 13H4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M6 19h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
      default:
        return "";
    }
  }

  function plural(n, one, many) { return n > 1 ? many : one; }

  // ---------------------------
  // ✅ 1 LIGNE MAX sous la photo (auto-fit)
  // ---------------------------
  function limitStatsToOneLine(container) {
    if (!container) return;
    const chips = Array.from(container.querySelectorAll(".statChip"));
    if (!chips.length) return;

    // reset
    chips.forEach(ch => { ch.style.display = ""; });

    const maxW = container.clientWidth;
    if (!maxW) return;

    // Masque les derniers jusqu'à ce que ça rentre
    let safety = 80;
    while (container.scrollWidth > maxW && safety-- > 0) {
      const last = [...container.querySelectorAll(".statChip")].reverse().find(x => x.style.display !== "none");
      if (!last) break;
      last.style.display = "none";
    }
  }

  // ✅ relance auto si la largeur change (kiosque/rotation/zoom)
  let __statsResizeRaf = 0;
  function scheduleFitStats() {
    if (!els.slideStats) return;
    cancelAnimationFrame(__statsResizeRaf);
    __statsResizeRaf = requestAnimationFrame(() => limitStatsToOneLine(els.slideStats));
  }
  window.addEventListener("resize", scheduleFitStats, { passive: true });

  // ✅ Priorités + limite anti “bloc trop long”
  function renderStats(item) {
    if (!els.slideStats) return;

    const stats = [];

    const surface = (item.surface != null && Number(item.surface) > 0) ? Math.round(Number(item.surface)) : null;
    const rooms = (item.rooms != null && Number(item.rooms) > 0) ? Math.round(Number(item.rooms)) : null;
    const bedrooms = (item.bedrooms != null && Number(item.bedrooms) > 0) ? Math.round(Number(item.bedrooms)) : null;
    const baths = (item.bathrooms != null && Number(item.bathrooms) > 0) ? Math.round(Number(item.bathrooms)) : null;

    const wc = (item.wc != null && Number(item.wc) > 0) ? Math.round(Number(item.wc)) : null;
    const levels = (item.levels != null && Number(item.levels) > 0) ? Math.round(Number(item.levels)) : null;
    const terrain = (item.terrain != null && Number(item.terrain) > 0) ? Math.round(Number(item.terrain)) : null;
    const cellar = (typeof item.cellar === "boolean") ? item.cellar : null;

    // Priorités (ordre important)
    if (surface != null) stats.push({ pr: 100, key:"surface", value:`${surface} m²`, label:"Surface" });
    if (rooms != null) stats.push({ pr: 90, key:"rooms", value:`${rooms}`, label: plural(rooms, "Pièce", "Pièces") });
    if (bedrooms != null) stats.push({ pr: 80, key:"bedrooms", value:`${bedrooms}`, label: plural(bedrooms, "Chambre", "Chambres") });
    if (baths != null) stats.push({ pr: 70, key:"bathrooms", value:`${baths}`, label: plural(baths, "Salle de bain", "Salles de bain") });

    if (terrain != null) stats.push({ pr: 65, key:"terrain", value:`${terrain} m²`, label:"Terrain" });
    if (wc != null) stats.push({ pr: 60, key:"wc", value:`${wc}`, label:"WC" });
    if (levels != null) stats.push({ pr: 55, key:"levels", value:`${levels}`, label: plural(levels, "Niveau", "Niveaux") });
    if (cellar != null) stats.push({ pr: 50, key:"cellar", value: cellar ? "Oui" : "Non", label:"Cave" });

    stats.sort((a,b)=>b.pr-a.pr);

    // ⚠️ On génère “un peu plus” puis on fait fitter sur 1 ligne
    const preList = stats.slice(0, 10);

    if (!preList.length) {
      els.slideStats.innerHTML = "";
      els.slideStats.classList.add("hidden");
      return;
    }

    els.slideStats.classList.remove("hidden");
    els.slideStats.innerHTML = preList.map(s => `
      <div class="statChip" data-stat="${s.key}">
        <div class="statIcon" aria-hidden="true">${iconSVG(s.key)}</div>
        <div class="statText">
          <div class="statValue">${s.value}</div>
          <div class="statLabel">${s.label}</div>
        </div>
      </div>
    `).join("");

    // ✅ fit en 1 ligne après layout
    scheduleFitStats();
  }

  // ---------------------------
  // DPE
  // ---------------------------
  function setDpe(item) {
    const conso = item && item.dpe ? safeText(item.dpe.conso) : "";
    const ges = item && item.dpe ? safeText(item.dpe.ges) : "";

    const hasAny = !!(conso || ges);
    if (!els.dpeCard) return;

    els.dpeCard.classList.toggle("hidden", !hasAny);

    if (els.dpeConsoImg) {
      if (conso) { els.dpeConsoImg.src = conso; els.dpeConsoImg.classList.remove("hidden"); }
      else { els.dpeConsoImg.removeAttribute("src"); els.dpeConsoImg.classList.add("hidden"); }
    }
    if (els.dpeGesImg) {
      if (ges) { els.dpeGesImg.src = ges; els.dpeGesImg.classList.remove("hidden"); }
      else { els.dpeGesImg.removeAttribute("src"); els.dpeGesImg.classList.add("hidden"); }
    }
  }

  // ---------------------------
  // Params / fetch
  // ---------------------------
  function getParams() {
    const u = new URL(window.location.href);
    const p = u.searchParams;
    return {
      agence: (p.get("agence") || "").trim(),
      screen: clampInt(p.get("screen"), 1, 999, 1),
      screens: clampInt(p.get("screens"), 1, 999, 1),
      seed: clampInt(p.get("seed"), 0, 999999, 0),

      rotate: clampInt(p.get("rotate"), 3, 3600, 12),
      photoRotate: clampInt(p.get("photoRotate"), 2, 120, 4),
      refresh: clampInt(p.get("refresh"), 10, 3600, 120),

      src: (p.get("src") || "exports/catalogue_vitrine.json").trim(),
      debug: p.get("debug") === "1",
    };
  }

  async function fetchCatalogue(src) {
    const url = new URL(src, window.location.href);
    url.searchParams.set("ts", String(Date.now()));
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.items)) throw new Error("JSON invalide (attendu: {generatedAt, items[]})");
    return data;
  }

  function showView(name) {
    $("#viewSlide").classList.toggle("hidden", name !== "slide");
    $("#viewEmpty").classList.toggle("hidden", name !== "empty");
  }

  function showEmpty(title, sub) {
    $("#emptyTitle").textContent = title;
    $("#emptySub").textContent = sub;
    showView("empty");
  }

  function setHud(params, count, generatedAt) {
    if (!params.debug) return;
    document.body.classList.add("debug");
    if (els.hudAgency) els.hudAgency.textContent = params.agence ? params.agence.toUpperCase() : "TOUTES AGENCES";
    if (els.hudMode) els.hudMode.textContent = "SLIDE";
    if (els.hudInfo) els.hudInfo.textContent = `Écran ${params.screen}/${params.screens} • ${count} annonces • ${generatedAt || "…"}`;
  }

  // ---------------------------
  // Preload queue (PRO)
  // ---------------------------
  const preloadCache = new Map();
  function preload(url) {
    if (!url) return Promise.resolve(false);
    if (preloadCache.has(url)) return preloadCache.get(url);

    const pr = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });

    preloadCache.set(url, pr);
    if (preloadCache.size > 200) {
      const firstKey = preloadCache.keys().next().value;
      preloadCache.delete(firstKey);
    }
    return pr;
  }

  async function warmupItem(item, startIdx, count) {
    const arr = Array.isArray(item.photos) ? item.photos : [];
    if (!arr.length) return;
    const n = Math.min(count, arr.length);
    for (let k = 0; k < n; k++) {
      await preload(getPhoto(item, startIdx + k));
    }
  }

  // ---------------------------
  // Slide engine
  // ---------------------------
  const state = {
    items: [],
    itemIndex: 0,
    photoIndex: 0,
    usingA: true,
    photoTimer: null,
    tickTimer: null,
    progTimer: null,
    nextItemAt: 0,
    itemDurationMs: 0
  };

  function clearTimers() {
    if (state.photoTimer) clearInterval(state.photoTimer);
    if (state.tickTimer) clearInterval(state.tickTimer);
    if (state.progTimer) clearInterval(state.progTimer);
    state.photoTimer = null;
    state.tickTimer = null;
    state.progTimer = null;
  }

  function computeItemDurationSec(item, rotateMinSec, photoRotateSec) {
    const count = Array.isArray(item.photos) ? item.photos.length : 0;
    const photoSlots = Math.max(1, count);
    const fullPhotosDuration = photoSlots * photoRotateSec;
    return Math.max(rotateMinSec, fullPhotosDuration);
  }

  function updateProgress() {
    if (!els.slideProg || !state.itemDurationMs) return;
    const now = Date.now();
    const elapsed = Math.max(0, state.itemDurationMs - Math.max(0, state.nextItemAt - now));
    const pct = Math.max(0, Math.min(1, elapsed / state.itemDurationMs));
    els.slideProg.style.width = `${(pct * 100).toFixed(1)}%`;
  }

  function setSlideItem(item, rotateMinSec, photoRotateSec) {
    els.slidePrice.textContent = formatPriceEUR(item.price);
    els.slideRef.textContent = safeText(item.ref || "");

    // ✅ titre clean (plus de "5 pièce(s)" dans le titre)
    els.slideTitle.textContent = cleanTitle(item.title || "Bien immobilier");

    const parts = [];
    const cityLine = safeText(item.city || "");
    if (cityLine) parts.push(cityLine);
    els.slideMeta.textContent = parts.join(" • ") || "—";

    renderStats(item);   // ✅ 1 ligne auto-fit ici
    setDpe(item);

    const extracted = extractContactFromAgence(item.agence);
    els.contactAdvisor.textContent = extracted.advisorName || "Conseiller GTI";
    els.contactAgencyPhone.textContent = extracted.agencyPhone || "—";
    els.contactAdvisorMobile.textContent = pickAdvisorMobile(item, extracted);

    state.photoIndex = 0;
    state.usingA = true;

    const p0 = getPhoto(item, 0);
    const p1 = getPhoto(item, 1);

    els.slideImgA.src = p0;
    els.slideImgB.src = p1;
    els.slideImgA.classList.add("is-visible");
    els.slideImgB.classList.remove("is-visible");

    const durSec = computeItemDurationSec(item, rotateMinSec, photoRotateSec);
    state.itemDurationMs = durSec * 1000;
    state.nextItemAt = Date.now() + state.itemDurationMs;
    if (els.slideProg) els.slideProg.style.width = "0%";

    warmupItem(item, 1, 3).catch(()=>{});
    const nextItem = state.items[(state.itemIndex + 1) % state.items.length];
    if (nextItem) preload(getPhoto(nextItem, 0)).catch(()=>{});
  }

  async function swapPhoto(item) {
    const photos = Array.isArray(item.photos) ? item.photos : [];
    if (photos.length <= 1) return;

    state.photoIndex++;
    const nextUrl = getPhoto(item, state.photoIndex);

    const show = state.usingA ? els.slideImgB : els.slideImgA;
    const hide = state.usingA ? els.slideImgA : els.slideImgB;

    await preload(nextUrl);
    show.src = nextUrl;

    requestAnimationFrame(() => {
      hide.classList.remove("is-visible");
      show.classList.add("is-visible");
    });

    state.usingA = !state.usingA;

    warmupItem(item, state.photoIndex + 1, 2).catch(()=>{});
  }

  function startSlide(items, rotateMinSec, photoRotateSec) {
    clearTimers();
    state.items = items;
    state.itemIndex = 0;

    const first = items[0];
    setSlideItem(first, rotateMinSec, photoRotateSec);

    state.photoTimer = setInterval(() => {
      const item = state.items[state.itemIndex];
      swapPhoto(item);
    }, photoRotateSec * 1000);

    state.tickTimer = setInterval(() => {
      if (Date.now() < state.nextItemAt) return;

      state.itemIndex = (state.itemIndex + 1) % state.items.length;
      const item = state.items[state.itemIndex];
      setSlideItem(item, rotateMinSec, photoRotateSec);
    }, 250);

    state.progTimer = setInterval(updateProgress, 120);

    showView("slide");
  }

  // ---------------------------
  // Refresh loop
  // ---------------------------
  let refreshTimer = null;
  let lastFingerprint = "";

  function fingerprint(items) {
    return items.map(i => `${i.id}|${i.updatedAt}|${(i.photos && i.photos.length) || 0}|${i.dpe ? "dpe" : ""}`).join(";;");
  }

  async function runOnce() {
    const params = getParams();
    document.body.classList.toggle("debug", !!params.debug);

    try {
      const data = await fetchCatalogue(params.src);

      let items = Array.isArray(data.items) ? data.items : [];
      items = items.map(normalizeItem);

      if (params.agence) {
        const target = normalizeAgency(params.agence);
        items = items.filter(x => normalizeAgency(x.agence).includes(target));
      }

      items = sortItems(items);
      items = splitAcrossScreens(items, params.screen, params.screens, params.seed);

      setHud(params, items.length, data.generatedAt);

      if (!items.length) {
        clearTimers();
        showEmpty("Aucune annonce à afficher", "Vérifie agence/screen/screens et src=exports/catalogue_vitrine.json");
        return;
      }

      const fp = fingerprint(items);
      if (fp !== lastFingerprint) {
        lastFingerprint = fp;
        preload(getPhoto(items[0], 0)).catch(()=>{});
        startSlide(items, params.rotate, params.photoRotate);
      } else {
        showView("slide");
        // au cas où le kiosque a changé la largeur (zoom etc.)
        scheduleFitStats();
      }
    } catch (e) {
      clearTimers();
      showEmpty("Erreur de chargement", `Impossible de charger le catalogue (${safeText(e.message || e)}).`);
    }
  }

  function startRefreshLoop() {
    if (refreshTimer) clearInterval(refreshTimer);
    const params = getParams();
    refreshTimer = setInterval(runOnce, params.refresh * 1000);
  }

  runOnce();
  startRefreshLoop();
})();
