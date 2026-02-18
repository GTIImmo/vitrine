(function () {
  const $ = (s) => document.querySelector(s);

  const els = {
    viewSlide: $("#viewSlide"),
    viewEmpty: $("#viewEmpty"),
    emptyTitle: $("#emptyTitle"),
    emptySub: $("#emptySub"),

    imgA: $("#imgA"),
    imgB: $("#imgB"),
    price: $("#price"),
    ref: $("#ref"),

    title: $("#title"),
    city: $("#city"),

    stats: $("#stats"),
    quickFacts: $("#quickFacts"),

    dpeCard: $("#dpeCard"),
    dpeConso: $("#dpeConso"),
    dpeGes: $("#dpeGes"),

    cName: $("#cName"),
    cAgency: $("#cAgency"),
    cMobile: $("#cMobile"),
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
        <text x="50%" y="52%" fill="rgba(18,19,24,.82)" font-family="Inter, Arial" font-size="52" font-weight="900" text-anchor="middle">
          GTI Immobilier
        </text>
        <text x="50%" y="60%" fill="rgba(18,19,24,.55)" font-family="Inter, Arial" font-size="24" font-weight="650" text-anchor="middle">
          Visuel indisponible
        </text>
      </svg>
    `);

  function safeText(v){ return (v == null ? "" : String(v)).trim(); }
  function asNumber(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function clampInt(v, min, max, def){ const n = parseInt(v,10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def; }
  function parseDateKey(x){ const t = Date.parse(safeText(x)); return Number.isFinite(t) ? t : 0; }
  function normalizeAgency(s){ return safeText(s).toUpperCase(); }

  function formatPriceEUR(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "Prix sur demande";
    try {
      return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${Math.round(n).toLocaleString("fr-FR")} €`;
    }
  }

  function digitsOnly(s){ return safeText(s).replace(/[^\d]/g,""); }
  function isLikelyFRPhone(d){ return d.length === 10 && d.startsWith("0"); }
  function formatFR10(d10){ return d10.replace(/(\d{2})(?=\d)/g, "$1 ").trim(); }

  function extractContactFromAgence(agenceStr) {
    const s = safeText(agenceStr);
    const out = { agencyPhone: "", advisorName: "", advisorMobile: "" };
    if (!s) return out;

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

  function pickAdvisorMobile(item, extracted){
    if (extracted?.advisorMobile) return extracted.advisorMobile;
    const d = digitsOnly(item.phone);
    return isLikelyFRPhone(d) ? formatFR10(d) : "—";
  }

  // ✅ supprime “X pièce(s)” du titre (déjà dans stats)
  function cleanTitle(rawTitle){
    let t = safeText(rawTitle || "");
    if (!t) return "Bien immobilier";
    t = t.replace(/\s*[-–—]?\s*\d+\s*pi[eè]ce(?:\(\s*s\s*\)|s)?\s*$/i, "");
    t = t.replace(/\b\d+\s*pi[eè]ce(?:\(\s*s\s*\)|s)\b/ig, "").replace(/\s{2,}/g, " ").trim();
    t = t.replace(/\s+[-–—]\s*$/g, "").trim();
    return t || "Bien immobilier";
  }

  function normalizePhotos(photos, max=10){
    if (!Array.isArray(photos)) return [];
    const out=[]; const seen=new Set();
    for (const u of photos){
      const url = (u||"").toString().trim();
      if (!url || seen.has(url)) continue;
      seen.add(url); out.push(url);
      if (out.length>=max) break;
    }
    return out;
  }

  function readBathrooms(item){
    const c=[item.bathrooms,item.bathroom,item.bathroomCount,item.nbBathrooms,item.sdb,item.nbSdb,item.nb_sdb,item.bains];
    for (const v of c){ const n=asNumber(v); if (n!=null && n>0) return Math.round(n); }
    return null;
  }
  function readWC(item){
    const c=[item.wc,item.WC,item.nbWc,item.nb_wc];
    for (const v of c){ const n=asNumber(v); if (n!=null && n>=0) return Math.round(n); }
    return null;
  }
  function readLevels(item){
    const c=[item.levels,item.level,item.nbLevels,item.niveaux,item.etages];
    for (const v of c){ const n=asNumber(v); if (n!=null && n>0) return Math.round(n); }
    return null;
  }
  function readTerrain(item){
    const c=[item.terrain,item.land,item.landSurface,item.surfterrain,item.surfaceTerrain];
    for (const v of c){ const n=asNumber(v); if (n!=null && n>0) return Math.round(n); }
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

  function normalizeItem(item){
    const it={...item};
    it.photos = normalizePhotos(it.photos, 10);

    const s=asNumber(it.surface); if (s!=null) it.surface=s;
    const r=asNumber(it.rooms); if (r!=null) it.rooms=Math.round(r);
    const b=asNumber(it.bedrooms); if (b!=null) it.bedrooms=Math.round(b);

    const ba=readBathrooms(it); if (ba!=null) it.bathrooms=ba;
    const wc=readWC(it); if (wc!=null) it.wc=wc;
    const lv=readLevels(it); if (lv!=null) it.levels=lv;
    const terr=readTerrain(it); if (terr!=null) it.terrain=terr;
    const cel=readCellar(it); if (cel!=null) it.cellar=cel;

    return it;
  }

  function getPhoto(item, idx){
    const arr = Array.isArray(item.photos) ? item.photos : [];
    if (!arr.length) return PLACEHOLDER_SVG;
    const i = ((idx % arr.length) + arr.length) % arr.length;
    return arr[i] || PLACEHOLDER_SVG;
  }

  function sortItems(items){
    return items.slice().sort((a,b)=>{
      const da=parseDateKey(a.updatedAt);
      const db=parseDateKey(b.updatedAt);
      if (db!==da) return db-da;
      const wa=Number(a.weight||0), wb=Number(b.weight||0);
      return wb-wa;
    });
  }

  function splitAcrossScreens(items, screen, screens, seed){
    if (screens<=1) return items;
    return items.filter((_,i)=>((i+seed)%screens)===(screen-1));
  }

  function iconSVG(key){
    const s = (path) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${path}</svg>`;
    switch(key){
      case "surface": return s(`<path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
      case "rooms": return s(`<path d="M4 10.5V20h16v-9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 10.5 12 4l9 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
      case "bedrooms": return s(`<path d="M3 18v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`);
      case "bathrooms": return s(`<path d="M5 12h14v3a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5v-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 12V7a3 3 0 0 1 3-3h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`);
      case "wc": return s(`<path d="M7 7a5 5 0 0 1 10 0v6a5 5 0 0 1-10 0V7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 11h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`);
      case "levels": return s(`<path d="M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 20V10l5-4 5 4v10" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`);
      case "cellar": return s(`<path d="M4 10l8-5 8 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`);
      case "terrain": return s(`<path d="M4 19l7-14 2 4 7-3-6 13H4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M6 19h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`);
      default: return "";
    }
  }

  function statDef(key, value, label, weight){
    return { key, value, label, weight };
  }

  // ✅ Stats 2×3 : on choisit les 6 meilleurs (surface/rooms/bedrooms/bathrooms prioritaires)
  function buildStats(item){
    const surface = (item.surface!=null && Number(item.surface)>0) ? Math.round(Number(item.surface)) : null;
    const rooms = (item.rooms!=null && Number(item.rooms)>0) ? Math.round(Number(item.rooms)) : null;
    const bedrooms = (item.bedrooms!=null && Number(item.bedrooms)>0) ? Math.round(Number(item.bedrooms)) : null;
    const bathrooms = (item.bathrooms!=null && Number(item.bathrooms)>0) ? Math.round(Number(item.bathrooms)) : null;
    const wc = (item.wc!=null && Number(item.wc)>0) ? Math.round(Number(item.wc)) : null;
    const levels = (item.levels!=null && Number(item.levels)>0) ? Math.round(Number(item.levels)) : null;
    const terrain = (item.terrain!=null && Number(item.terrain)>0) ? Math.round(Number(item.terrain)) : null;
    const cellar = (typeof item.cellar === "boolean") ? item.cellar : null;

    const list = [];

    if (surface!=null) list.push(statDef("surface", `${surface} m²`, "Surface", 100));
    if (rooms!=null) list.push(statDef("rooms", `${rooms}`, rooms>1 ? "Pièces" : "Pièce", 90));
    if (bedrooms!=null) list.push(statDef("bedrooms", `${bedrooms}`, bedrooms>1 ? "Chambres" : "Chambre", 80));
    if (bathrooms!=null) list.push(statDef("bathrooms", `${bathrooms}`, bathrooms>1 ? "Salles de bain" : "Salle de bain", 70));

    if (terrain!=null) list.push(statDef("terrain", `${terrain} m²`, "Terrain", 65));
    if (wc!=null) list.push(statDef("wc", `${wc}`, "WC", 60));
    if (levels!=null) list.push(statDef("levels", `${levels}`, levels>1 ? "Niveaux" : "Niveau", 55));
    if (cellar!=null) list.push(statDef("cellar", cellar ? "Oui" : "Non", "Cave", 50));

    // trie par poids, garde 6
    list.sort((a,b)=>b.weight-a.weight);
    return list.slice(0, 6);
  }

  function renderStats(item){
    const stats = buildStats(item);
    if (!els.stats) return;

    els.stats.innerHTML = stats.map(s => `
      <div class="stat" data-k="${s.key}">
        <div class="ico">${iconSVG(s.key)}</div>
        <div class="stxt">
          <div class="sv">${s.value}</div>
          <div class="sl">${s.label}</div>
        </div>
      </div>
    `).join("");
  }

  // quick facts (on photo) = 3 essentiels
  function renderQuickFacts(item){
    if (!els.quickFacts) return;

    const surface = (item.surface!=null && Number(item.surface)>0) ? `${Math.round(Number(item.surface))} m²` : null;
    const rooms = (item.rooms!=null && Number(item.rooms)>0) ? `${Math.round(Number(item.rooms))} p.` : null;
    const bedrooms = (item.bedrooms!=null && Number(item.bedrooms)>0) ? `${Math.round(Number(item.bedrooms))} ch.` : null;

    const parts = [];
    if (surface) parts.push({v: surface, l:"Surface"});
    if (rooms) parts.push({v: rooms, l:"Pièces"});
    if (bedrooms) parts.push({v: bedrooms, l:"Chambres"});

    els.quickFacts.innerHTML = parts.slice(0,3).map(p => `
      <div class="qf"><b>${p.v}</b><span>${p.l}</span></div>
    `).join("");
    els.quickFacts.style.display = parts.length ? "flex" : "none";
  }

  function setDpe(item){
    const conso = item?.dpe ? safeText(item.dpe.conso) : "";
    const ges = item?.dpe ? safeText(item.dpe.ges) : "";
    const hasAny = !!(conso || ges);

    els.dpeCard.classList.toggle("hidden", !hasAny);

    if (conso) els.dpeConso.src = conso;
    else els.dpeConso.removeAttribute("src");

    if (ges) els.dpeGes.src = ges;
    else els.dpeGes.removeAttribute("src");
  }

  // Preload images
  const preloadCache = new Map();
  function preload(url){
    if (!url) return Promise.resolve(false);
    if (preloadCache.has(url)) return preloadCache.get(url);
    const pr = new Promise((resolve)=>{
      const img = new Image();
      img.decoding="async";
      img.onload=()=>resolve(true);
      img.onerror=()=>resolve(false);
      img.src=url;
    });
    preloadCache.set(url, pr);
    if (preloadCache.size>200){
      const k=preloadCache.keys().next().value;
      preloadCache.delete(k);
    }
    return pr;
  }

  function showView(which){
    els.viewSlide.classList.toggle("hidden", which !== "slide");
    els.viewEmpty.classList.toggle("hidden", which !== "empty");
  }
  function showEmpty(title, sub){
    els.emptyTitle.textContent = title;
    els.emptySub.textContent = sub;
    showView("empty");
  }

  function getParams(){
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
    };
  }

  async function fetchCatalogue(src){
    const url = new URL(src, window.location.href);
    url.searchParams.set("ts", String(Date.now()));
    const res = await fetch(url.toString(), { cache:"no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.items)) throw new Error("JSON invalide (attendu: {generatedAt, items[]})");
    return data;
  }

  const state = {
    items: [],
    itemIndex: 0,
    photoIndex: 0,
    usingA: true,
    photoTimer: null,
    tickTimer: null,
    nextItemAt: 0,
    itemDurationMs: 0
  };

  function clearTimers(){
    if (state.photoTimer) clearInterval(state.photoTimer);
    if (state.tickTimer) clearInterval(state.tickTimer);
    state.photoTimer = null;
    state.tickTimer = null;
  }

  function computeItemDurationSec(item, rotateMinSec, photoRotateSec){
    const count = Array.isArray(item.photos) ? item.photos.length : 0;
    return Math.max(rotateMinSec, Math.max(1, count) * photoRotateSec);
  }

  function setSlideItem(item, rotateMinSec, photoRotateSec){
    els.price.textContent = formatPriceEUR(item.price);
    els.ref.textContent = safeText(item.ref || "—");

    els.title.textContent = cleanTitle(item.title || "Bien immobilier");
    els.city.textContent = safeText(item.city || "—");

    renderStats(item);
    renderQuickFacts(item);
    setDpe(item);

    const extracted = extractContactFromAgence(item.agence);
    els.cName.textContent = extracted.advisorName || "Conseiller GTI";
    els.cAgency.textContent = extracted.agencyPhone || "—";
    els.cMobile.textContent = pickAdvisorMobile(item, extracted);

    state.photoIndex = 0;
    state.usingA = true;

    const p0 = getPhoto(item, 0);
    const p1 = getPhoto(item, 1);

    els.imgA.src = p0;
    els.imgB.src = p1;
    els.imgA.classList.add("is-visible");
    els.imgB.classList.remove("is-visible");

    const durSec = computeItemDurationSec(item, rotateMinSec, photoRotateSec);
    state.itemDurationMs = durSec * 1000;
    state.nextItemAt = Date.now() + state.itemDurationMs;

    const nextItem = state.items[(state.itemIndex + 1) % state.items.length];
    if (nextItem) preload(getPhoto(nextItem, 0)).catch(()=>{});
  }

  async function swapPhoto(item){
    const photos = Array.isArray(item.photos) ? item.photos : [];
    if (photos.length <= 1) return;

    state.photoIndex++;
    const nextUrl = getPhoto(item, state.photoIndex);

    const show = state.usingA ? els.imgB : els.imgA;
    const hide = state.usingA ? els.imgA : els.imgB;

    await preload(nextUrl);
    show.src = nextUrl;

    requestAnimationFrame(()=>{
      hide.classList.remove("is-visible");
      show.classList.add("is-visible");
    });

    state.usingA = !state.usingA;
  }

  function startSlide(items, rotateMinSec, photoRotateSec){
    clearTimers();
    state.items = items;
    state.itemIndex = 0;

    setSlideItem(items[0], rotateMinSec, photoRotateSec);
    showView("slide");

    state.photoTimer = setInterval(()=>{
      swapPhoto(state.items[state.itemIndex]);
    }, photoRotateSec * 1000);

    state.tickTimer = setInterval(()=>{
      if (Date.now() < state.nextItemAt) return;
      state.itemIndex = (state.itemIndex + 1) % state.items.length;
      setSlideItem(state.items[state.itemIndex], rotateMinSec, photoRotateSec);
    }, 250);
  }

  let refreshTimer = null;
  let lastFingerprint = "";

  function fingerprint(items){
    return items.map(i => `${i.id}|${i.updatedAt}|${(i.photos && i.photos.length) || 0}|${i.dpe ? "dpe" : ""}`).join(";;");
  }

  async function runOnce(){
    const params = getParams();

    try{
      const data = await fetchCatalogue(params.src);
      let items = (data.items || []).map(normalizeItem);

      if (params.agence){
        const target = normalizeAgency(params.agence);
        items = items.filter(x => normalizeAgency(x.agence).includes(target));
      }

      items = sortItems(items);
      items = splitAcrossScreens(items, params.screen, params.screens, params.seed);

      if (!items.length){
        clearTimers();
        showEmpty("Aucune annonce à afficher", "Vérifie agence/screen/screens et src=exports/catalogue_vitrine.json");
        return;
      }

      const fp = fingerprint(items);
      if (fp !== lastFingerprint){
        lastFingerprint = fp;
        preload(getPhoto(items[0], 0)).catch(()=>{});
        startSlide(items, params.rotate, params.photoRotate);
      }
    } catch(e){
      clearTimers();
      showEmpty("Erreur de chargement", `Impossible de charger le catalogue (${safeText(e.message || e)}).`);
    }
  }

  function startRefreshLoop(){
    if (refreshTimer) clearInterval(refreshTimer);
    const params = getParams();
    refreshTimer = setInterval(runOnce, params.refresh * 1000);
  }

  runOnce();
  startRefreshLoop();
})();
