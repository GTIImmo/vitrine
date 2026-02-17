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

    // images
    slideImgA: $("#slideImgA"),
    slideImgB: $("#slideImgB"),

    // ✅ contact card fields
    contactAdvisor: $("#contactAdvisor"),
    contactAgencyPhone: $("#contactAgencyPhone"),
    contactAdvisorMobile: $("#contactAdvisorMobile"),

    // ✅ DPE
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

  function safeText(s) {
    return (s == null ? "" : String(s)).trim();
  }

  function normalizeAgency(s) {
    return safeText(s).toUpperCase();
  }

  function parseDateKey(x) {
    const s = safeText(x);
    if (!s) return 0;
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  }

  function formatPriceEUR(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "Prix sur demande";
    try {
      return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${Math.round(n).toLocaleString("fr-FR")} €`;
    }
  }

  function normalizePhotos(photos, max = 5) {
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

  function normalizeItem(item) {
    return { ...item, photos: normalizePhotos(item.photos, 5) };
  }

  function getPhoto(item, idx) {
    const arr = Array.isArray(item.photos) ? item.photos : [];
    if (arr.length === 0) return PLACEHOLDER_SVG;
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
  // Téléphone & parsing "agence"
  // ---------------------------
  function digitsOnly(s) {
    return safeText(s).replace(/[^\d]/g, "");
  }

  function formatFR10(d10) {
    return d10.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }

  function isLikelyFRPhone(d) {
    return d.length === 10 && d.startsWith("0");
  }

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

  // ✅ DPE helpers
  function setDpe(item) {
    const conso = item && item.dpe ? safeText(item.dpe.conso) : "";
    const ges = item && item.dpe ? safeText(item.dpe.ges) : "";

    const hasAny = !!(conso || ges);
    if (!els.dpeCard) return;

    els.dpeCard.classList.toggle("hidden", !hasAny);

    if (els.dpeConsoImg) {
      if (conso) {
        els.dpeConsoImg.src = conso;
        els.dpeConsoImg.classList.remove("hidden");
      } else {
        els.dpeConsoImg.removeAttribute("src");
        els.dpeConsoImg.classList.add("hidden");
      }
    }

    if (els.dpeGesImg) {
      if (ges) {
        els.dpeGesImg.src = ges;
        els.dpeGesImg.classList.remove("hidden");
      } else {
        els.dpeGesImg.removeAttribute("src");
        els.dpeGesImg.classList.add("hidden");
      }
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
  // Slide engine
  // ---------------------------
  const state = {
    items: [],
    itemIndex: 0,
    photoIndex: 0,
    usingA: true,
    photoTimer: null,
    tickTimer: null,
    nextItemAt: 0,
  };

  function clearTimers() {
    if (state.photoTimer) clearInterval(state.photoTimer);
    if (state.tickTimer) clearInterval(state.tickTimer);
    state.photoTimer = null;
    state.tickTimer = null;
  }

  function setSlideItem(item) {
    // Base slide
    els.slidePrice.textContent = formatPriceEUR(item.price);
    els.slideRef.textContent = safeText(item.ref || "");
    els.slideTitle.textContent = safeText(item.title || "Bien immobilier");

    const parts = [];
    const cityLine = safeText(item.city || "");
    if (cityLine) parts.push(cityLine);
    if (item.surface) parts.push(`${Math.round(Number(item.surface))} m²`);
    if (item.rooms) parts.push(`${item.rooms} pièce${Number(item.rooms) > 1 ? "s" : ""}`);
    if (item.bedrooms) parts.push(`${item.bedrooms} chambre${Number(item.bedrooms) > 1 ? "s" : ""}`);
    els.slideMeta.textContent = parts.join(" • ") || "—";

    // ✅ DPE (conso + GES)
    setDpe(item);

    // ✅ Contact : parse depuis item.agence
    const extracted = extractContactFromAgence(item.agence);

    els.contactAdvisor.textContent = extracted.advisorName || "Conseiller GTI";
    els.contactAgencyPhone.textContent = extracted.agencyPhone || "—";
    els.contactAdvisorMobile.textContent = pickAdvisorMobile(item, extracted);

    // Photos
    state.photoIndex = 0;
    state.usingA = true;

    els.slideImgA.src = getPhoto(item, 0);
    els.slideImgB.src = getPhoto(item, 1);

    els.slideImgA.classList.add("is-visible");
    els.slideImgB.classList.remove("is-visible");
  }

  function preload(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
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
  }

  function computeItemDurationSec(item, rotateMinSec, photoRotateSec) {
    const count = Array.isArray(item.photos) ? item.photos.length : 0;
    const photoSlots = Math.max(1, count);
    const fullPhotosDuration = photoSlots * photoRotateSec;
    return Math.max(rotateMinSec, fullPhotosDuration);
  }

  function startSlide(items, rotateMinSec, photoRotateSec) {
    clearTimers();
    state.items = items;
    state.itemIndex = 0;

    const first = items[0];
    setSlideItem(first);
    state.nextItemAt = Date.now() + computeItemDurationSec(first, rotateMinSec, photoRotateSec) * 1000;

    state.photoTimer = setInterval(() => {
      const item = state.items[state.itemIndex];
      swapPhoto(item);
    }, photoRotateSec * 1000);

    state.tickTimer = setInterval(() => {
      if (Date.now() < state.nextItemAt) return;

      state.itemIndex = (state.itemIndex + 1) % state.items.length;
      const item = state.items[state.itemIndex];
      setSlideItem(item);

      state.nextItemAt = Date.now() + computeItemDurationSec(item, rotateMinSec, photoRotateSec) * 1000;
    }, 250);

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
        startSlide(items, params.rotate, params.photoRotate);
      } else {
        showView("slide");
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
