/* Vitrine digitale PRO - GTI (vanilla)
   URL params:
   - agence=FIRMINY
   - screen=2&screens=6
   - mode=grid|slide
   - rotate=seconds (slide)
   - refresh=seconds (reload JSON)
   - src=data/catalogue_vitrine.json (default)
   - seed=number
   - bright=1 (boost lumineux)
   - ken=1 (Ken Burns zoom)
   - max=N (limit items after filtering)
*/

const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  src: "data/catalogue_vitrine.json",
  mode: "slide",
  rotate: 12,
  refresh: 90,
  screen: 1,
  screens: 1,
  seed: 0,
  agence: "",
  bright: 1,
  ken: 1,
  max: 0
};

const BLOCKED_STATUSES = new Set(["ARCHIVED","DELETED","INACTIVE","SOLD"]);

function clampInt(v, def, min, max){
  const n = parseInt(v, 10);
  if (!isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function getParams(){
  const p = new URLSearchParams(location.search);
  const obj = { ...DEFAULTS };

  if (p.get("src")) obj.src = p.get("src");
  if (p.get("mode")) obj.mode = (p.get("mode") || "").toLowerCase();
  obj.rotate = clampInt(p.get("rotate"), DEFAULTS.rotate, 2, 120);
  obj.refresh = clampInt(p.get("refresh"), DEFAULTS.refresh, 10, 3600);

  obj.screen = clampInt(p.get("screen"), 1, 1, 99);
  obj.screens = clampInt(p.get("screens"), 1, 1, 99);
  obj.seed = clampInt(p.get("seed"), 0, -999, 999);

  obj.bright = clampInt(p.get("bright"), DEFAULTS.bright, 0, 1);
  obj.ken = clampInt(p.get("ken"), DEFAULTS.ken, 0, 1);
  obj.max = clampInt(p.get("max"), 0, 0, 5000);

  if (p.get("agence")) obj.agence = (p.get("agence") || "").trim().toUpperCase();
  if (obj.screen > obj.screens) obj.screen = 1;

  // apply flags to body
  document.body.dataset.bright = String(obj.bright);
  document.body.dataset.ken = String(obj.ken);

  return obj;
}

function safeText(s){ return (s == null ? "" : String(s)).trim(); }

function moneyEUR(n){
  const v = Number(n || 0);
  if (!isFinite(v) || v <= 0) return "Prix sur demande";
  return v.toLocaleString("fr-FR") + " €";
}

function normalizeStatus(s){ return safeText(s).toUpperCase(); }

function pickPhoto(item, i=0){
  const photos = Array.isArray(item.photos) ? item.photos : [];
  return photos[i] || "";
}

function buildTitle(item){
  const offer = (safeText(item.offerType) || "").toLowerCase();
  const offerLabel = offer.includes("vente") ? "Vente" : (offer ? offer : "Annonce");
  const typeGuess = safeText(item.title).split("|")[0].trim() || safeText(item.title) || "Bien";
  const city = safeText(item.city);
  const pc = safeText(item.postalCode);
  return `${offerLabel} | ${typeGuess} | ${city}${pc ? " ("+pc+")" : ""}`;
}

function buildMeta(item){
  const city = safeText(item.city);
  const pc = safeText(item.postalCode);
  const s = Number(item.surface || 0);
  const r = Number(item.rooms || 0);
  const parts = [];
  if (city) parts.push(city + (pc ? " " + pc : ""));
  if (s) parts.push(`${s} m²`);
  if (r) parts.push(`${r} pièce${r>1?"s":""}`);
  return parts.join(" • ") || "—";
}

function sortItems(items){
  return items.slice().sort((a,b) => {
    const da = safeText(a.updatedAt);
    const db = safeText(b.updatedAt);
    if (da !== db) return db.localeCompare(da);
    const wa = Number(a.weight || 0);
    const wb = Number(b.weight || 0);
    return wb - wa;
  });
}

function filterItems(all, agence){
  let items = Array.isArray(all) ? all : [];
  items = items.filter(it => !BLOCKED_STATUSES.has(normalizeStatus(it.status)));
  if (agence) items = items.filter(it => safeText(it.agence).toUpperCase() === agence);
  return items;
}

function distribute(items, screen, screens, seed){
  if (!screens || screens <= 1) return items;
  const shift = ((seed % screens) + screens) % screens;
  const idxWanted = ((screen - 1 + shift) % screens);
  return items.filter((_, i) => (i % screens) === idxWanted);
}

async function fetchCatalogue(src){
  const url = src + (src.includes("?") ? "&" : "?") + "ts=" + Date.now();
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

/* Views */
function show(view){
  $("gridView").hidden = view !== "grid";
  $("slideView").hidden = view !== "slide";
  $("emptyView").hidden = view !== "empty";
}

/* HUD + footer */
function setHUD(params, count, generatedAt){
  $("pillAgency").textContent = params.agence ? params.agence : "GTI";
  $("pillMode").textContent = params.mode.toUpperCase();
  $("pillCount").textContent = `${count} annonces`;
  $("pillScreen").textContent = `ÉCRAN ${params.screen}/${params.screens}`;

  const t = generatedAt ? safeText(generatedAt).replace("T"," ") : "—";
  $("pillTime").textContent = t;
}

function setFooter(left, right){
  $("footLeft").textContent = left || "—";
  $("footRight").textContent = right || "—";
}

/* GRID */
function renderGrid(items){
  const host = $("gridCards");
  host.innerHTML = "";

  const maxCards = 12;
  const slice = items.slice(0, maxCards);

  slice.forEach(it => {
    const photo = pickPhoto(it, 0);

    const card = document.createElement("article");
    card.className = "card";

    const media = document.createElement("div");
    media.className = "card__media";

    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = photo || "";
    img.onerror = () => { img.style.display = "none"; };

    const badge = document.createElement("div");
    badge.className = "card__badge";
    badge.textContent = moneyEUR(it.price);

    media.appendChild(img);
    media.appendChild(badge);

    const body = document.createElement("div");
    body.className = "card__body";

    const h = document.createElement("h3");
    h.className = "card__title";
    h.textContent = safeText(it.title) || buildTitle(it);

    const meta = document.createElement("div");
    meta.className = "card__meta";
    meta.textContent = buildMeta(it);

    const ref = document.createElement("div");
    ref.className = "card__ref";
    ref.textContent = safeText(it.ref) ? `Réf. ${it.ref}` : "";

    body.appendChild(h);
    body.appendChild(meta);
    body.appendChild(ref);

    card.appendChild(media);
    card.appendChild(body);

    host.appendChild(card);
  });
}

/* SLIDE PRO: preload + crossfade + fallback to next photo */
const imgA = () => $("imgA");
const imgB = () => $("imgB");

function preload(url){
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const i = new Image();
    i.onload = () => resolve(true);
    i.onerror = () => resolve(false);
    i.src = url;
  });
}

function setProgress(pct){
  $("progressBar").style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function renderSlideText(item, index, total, params){
  $("slidePrice").textContent = moneyEUR(item.price);
  $("slideRef").textContent = safeText(item.ref) ? `Réf. ${item.ref}` : `#${safeText(item.id) || (index+1)}`;

  $("slideTitle").textContent = buildTitle(item);
  $("slideMeta").textContent = buildMeta(item);

  // chips
  const chips = $("slideChips");
  chips.innerHTML = "";

  const agence = safeText(item.agence);
  const status = normalizeStatus(item.status);
  const surface = Number(item.surface || 0);
  const rooms = Number(item.rooms || 0);
  const beds = Number(item.bedrooms || 0);

  const list = [];
  if (agence) list.push({ t: agence, soft:false });
  if (surface) list.push({ t: `${surface} m²`, soft:true });
  if (rooms) list.push({ t: `${rooms} pièce${rooms>1?"s":""}`, soft:true });
  if (beds) list.push({ t: `${beds} chambre${beds>1?"s":""}`, soft:true });
  if (status) list.push({ t: status, soft:true });

  list.slice(0, 6).forEach(c => {
    const s = document.createElement("span");
    s.className = "chip" + (c.soft ? " chip--soft" : "");
    s.textContent = c.t;
    chips.appendChild(s);
  });

  $("contactBrand").textContent = agence ? `GTI Immobilier • ${agence}` : "GTI Immobilier";
  $("contactPhone").textContent = safeText(item.phone) || "—";

  setFooter(
    `${params.agence || "GTI"} • SLIDE • ${index+1}/${total}`,
    safeText(item.updatedAt) ? `Maj: ${safeText(item.updatedAt).replace("T"," ")}` : ""
  );
}

async function setSlideImageWithFallback(item, frontIsA){
  const fallback = $("mediaFallback");
  const front = frontIsA ? imgA() : imgB();
  const back  = frontIsA ? imgB() : imgA();

  // try first 3 photos max (avoid long loops)
  let chosen = "";
  for (let k=0;k<3;k++){
    const u = pickPhoto(item, k);
    if (!u) continue;
    const ok = await preload(u);
    if (ok){ chosen = u; break; }
  }

  if (!chosen){
    fallback.hidden = false;
    front.src = "";
    back.src = "";
    front.classList.add("is-front");
    back.classList.remove("is-front");
    return false;
  }

  fallback.hidden = true;

  // put chosen on back buffer first, then fade
  back.src = chosen;

  // force repaint for transition reliability
  back.classList.add("is-front");
  front.classList.remove("is-front");

  return true;
}

/* State */
let state = {
  params: getParams(),
  allItems: [],
  items: [],
  generatedAt: "",
  slideIndex: 0,
  slideTimer: null,
  refreshTimer: null,
  progressTimer: null,
  frontIsA: true,
  slideStartAt: 0
};

function stopTimers(){
  if (state.slideTimer) { clearInterval(state.slideTimer); state.slideTimer = null; }
  if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; }
  if (state.progressTimer) { clearInterval(state.progressTimer); state.progressTimer = null; }
}

async function loadAndRender(){
  const params = getParams();
  state.params = params;

  try{
    const data = await fetchCatalogue(params.src);
    const gen = safeText(data.generatedAt || "");
    state.generatedAt = gen;

    const all = Array.isArray(data.items) ? data.items : [];
    let filtered = filterItems(all, params.agence);
    filtered = sortItems(filtered);
    filtered = distribute(filtered, params.screen, params.screens, params.seed);
    if (params.max > 0) filtered = filtered.slice(0, params.max);

    state.allItems = all;
    state.items = filtered;
    state.slideIndex = 0;

    setHUD(params, filtered.length, gen);

    if (!filtered.length){
      show("empty");
      $("emptyHint").textContent =
        `0 annonce après filtres (agence=${params.agence || "—"}) • src=${params.src}`;
      setFooter("—", "—");
      return;
    }

    if (params.mode === "grid"){
      show("grid");
      renderGrid(filtered);
      setFooter(`${params.agence || "GTI"} • GRID • ${filtered.length} annonces`, gen ? `Catalogue: ${gen.replace("T"," ")}` : "");
      return;
    }

    show("slide");

    // first slide
    const item = filtered[0];
    renderSlideText(item, 0, filtered.length, params);
    state.frontIsA = true;
    await setSlideImageWithFallback(item, state.frontIsA);
    setProgress(0);

    // preload next 2 images in background (no await)
    preloadNext();

  }catch(err){
    show("empty");
    $("emptyHint").textContent = `Erreur chargement JSON (${err?.message || err}). src=${params.src}`;
    setFooter("Erreur", safeText(err?.message || err));
  }
}

function preloadNext(){
  const items = state.items;
  if (!items.length) return;
  const n1 = items[(state.slideIndex + 1) % items.length];
  const n2 = items[(state.slideIndex + 2) % items.length];
  [pickPhoto(n1,0), pickPhoto(n1,1), pickPhoto(n2,0)].forEach(u => { preload(u); });
}

function startProgress(){
  if (state.progressTimer) clearInterval(state.progressTimer);
  state.slideStartAt = Date.now();
  const dur = state.params.rotate * 1000;

  state.progressTimer = setInterval(() => {
    const t = Date.now() - state.slideStartAt;
    const pct = (t / dur) * 100;
    setProgress(pct);
  }, 120);
}

function startSlideRotation(){
  stopTimers();

  const params = state.params;
  if (params.mode !== "slide") return;
  if (!state.items.length) return;

  startProgress();

  state.slideTimer = setInterval(async () => {
    const items = state.items;
    if (!items.length) return;

    state.slideIndex = (state.slideIndex + 1) % items.length;

    const item = items[state.slideIndex];
    renderSlideText(item, state.slideIndex, items.length, state.params);

    // crossfade buffers
    state.frontIsA = !state.frontIsA;
    await setSlideImageWithFallback(item, state.frontIsA);

    setProgress(0);
    startProgress();
    preloadNext();

  }, params.rotate * 1000);
}

function startRefresh(){
  state.refreshTimer = setInterval(async () => {
    await loadAndRender();
    startSlideRotation();
  }, state.params.refresh * 1000);
}

/* Boot */
(async function boot(){
  await loadAndRender();
  startSlideRotation();
  startRefresh();

  // quick manual refresh (kiosk keyboard)
  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R"){
      loadAndRender().then(startSlideRotation);
    }
  });
})();
