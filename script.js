// SKYCAST — Open-Meteo powered, no API key, works locally (CORS-friendly)

const WMO = {
  0:["☀️","Clear Sky"],1:["🌤️","Mainly Clear"],2:["⛅","Partly Cloudy"],3:["☁️","Overcast"],
  45:["🌫️","Foggy"],48:["🌫️","Icy Fog"],
  51:["🌦️","Light Drizzle"],53:["🌧️","Drizzle"],55:["🌧️","Heavy Drizzle"],
  56:["🌧️","Freezing Drizzle"],57:["🌧️","Heavy Freezing Drizzle"],
  61:["🌧️","Light Rain"],63:["🌧️","Moderate Rain"],65:["🌧️","Heavy Rain"],
  66:["🌧️","Freezing Rain"],67:["🌧️","Heavy Freezing Rain"],
  71:["🌨️","Slight Snow"],73:["❄️","Moderate Snow"],75:["❄️","Heavy Snow"],77:["🌨️","Snow Grains"],
  80:["🌦️","Showers"],81:["🌧️","Heavy Showers"],82:["⛈️","Violent Showers"],
  85:["🌨️","Snow Showers"],86:["❄️","Heavy Snow Showers"],
  95:["⛈️","Thunderstorm"],96:["⛈️","Hail Storm"],99:["⛈️","Heavy Hail Storm"],
};

const AQI_LEVELS = [
  {m:50,  l:"Good",          c:"#4ADE80", bg:"rgba(74,222,128,.15)",  n:"Air quality is satisfactory"},
  {m:100, l:"Satisfactory",  c:"#A3E635", bg:"rgba(163,230,53,.15)",  n:"Minor discomfort to sensitive people"},
  {m:200, l:"Moderate",      c:"#FACC15", bg:"rgba(250,204,21,.15)",  n:"Discomfort to lung/heart patients"},
  {m:300, l:"Poor",          c:"#FB923C", bg:"rgba(251,146,60,.15)",  n:"Breathing discomfort on prolonged exposure"},
  {m:400, l:"Very Poor",     c:"#F87171", bg:"rgba(248,113,113,.15)", n:"Respiratory illness risk"},
  {m:500, l:"Severe",        c:"#C084FC", bg:"rgba(192,132,252,.15)", n:"Serious risk for everyone"},
  {m:9999,l:"Hazardous",     c:"#EF4444", bg:"rgba(239,68,68,.2)",    n:"Health emergency"},
];

function getTheme(wmo_code, temp_c) {
  if ([95,96,99,82].includes(wmo_code)) return { from:"#0f0c29", via:"#1a1a3e", to:"#24243e", accent:"#818CF8", accent2:"#6366F1", glow:"rgba(129,140,248,.2)" };
  if ([51,53,55,61,63,65,80,81].includes(wmo_code)) return { from:"#0f2027", via:"#203a43", to:"#2c5364", accent:"#38BDF8", accent2:"#0284C7", glow:"rgba(56,189,248,.2)" };
  if ([71,73,75,77,85,86].includes(wmo_code)) return { from:"#1a1a2e", via:"#2d3561", to:"#3a4680", accent:"#BAE6FD", accent2:"#0284C7", glow:"rgba(186,230,253,.2)" };
  if ([45,48].includes(wmo_code)) return { from:"#1c1c2e", via:"#2d2d44", to:"#3d3d5c", accent:"#94A3B8", accent2:"#64748B", glow:"rgba(148,163,184,.2)" };
  if (temp_c >= 35) return { from:"#1a0a00", via:"#2d1400", to:"#3d2000", accent:"#FB923C", accent2:"#EA580C", glow:"rgba(251,146,60,.2)" };
  if (temp_c >= 25) return { from:"#0f1a2e", via:"#1a2d40", to:"#1e3a5f", accent:"#38BDF8", accent2:"#0284C7", glow:"rgba(56,189,248,.2)" };
  return { from:"#0a1628", via:"#0f2042", to:"#1a2d5e", accent:"#60A5FA", accent2:"#2563EB", glow:"rgba(96,165,250,.2)" };
}

const wmoLookup = code => WMO[code] || ["🌡️","Unknown"];
const c2f = c => Math.round(c * 9/5 + 32);
const aqiInfo = v => AQI_LEVELS.find(a => v <= a.m) || AQI_LEVELS[5];
const uvLabel = u => u<=2?"Low":u<=5?"Moderate":u<=7?"High":u<=10?"Very High":"Extreme";
const uvColor = u => u<=2?"#4ADE80":u<=5?"#FACC15":u<=7?"#FB923C":u<=10?"#F87171":"#C084FC";

function sunPos(sunriseISO, sunsetISO) {
  try {
    const sr = new Date(sunriseISO).getTime();
    const ss = new Date(sunsetISO).getTime();
    const now = Date.now();
    const t = Math.max(0, Math.min(1, (now-sr)/(ss-sr)));
    return { t, cx:+(5+90*t).toFixed(1), cy:+(50-46*Math.sin(Math.PI*t)).toFixed(1) };
  } catch { return {t:.5, cx:50, cy:10}; }
}
function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}); }
  catch { return "—"; }
}

// ── OPEN-METEO API — Free, no key, full CORS support, works from local files ──
async function geocodeCity(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Location search failed. Please try again.");
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new Error(`No location found for "${query}". Try a different spelling.`);
  return data.results[0];
}

async function fetchOpenMeteoWeather(lat, lon, timezone) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: timezone || "auto",
    current: ["temperature_2m","apparent_temperature","weather_code","relative_humidity_2m","wind_speed_10m","wind_direction_10m","surface_pressure","visibility","precipitation","cloud_cover","uv_index","dew_point_2m"].join(","),
    daily: ["weather_code","temperature_2m_max","temperature_2m_min","sunrise","sunset","precipitation_sum"].join(","),
    forecast_days: 5
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather service error (${res.status}).`);
  const data = await res.json();
  if (data.error) throw new Error(data.reason || "Weather data unavailable.");
  return data;
}

async function fetchAQI(lat, lon) {
  try {
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.current?.us_aqi ?? null;
  } catch { return null; }
}

async function fetchWeather(query) {
  const geo = await geocodeCity(query);
  const [weather, aqi] = await Promise.all([
    fetchOpenMeteoWeather(geo.latitude, geo.longitude, geo.timezone),
    fetchAQI(geo.latitude, geo.longitude)
  ]);
  const c = weather.current, d = weather.daily;
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  const windDir = dirs[Math.round((c.wind_direction_10m||0)/45) % 8];

  return {
    city: geo.name, state: geo.admin1 || "", country: geo.country || "",
    country_code: (geo.country_code||"").toUpperCase(),
    temp_c: c.temperature_2m, feels_like_c: c.apparent_temperature,
    temp_max_c: d.temperature_2m_max[0], temp_min_c: d.temperature_2m_min[0],
    condition: wmoLookup(c.weather_code)[1], wmo_code: c.weather_code,
    humidity: c.relative_humidity_2m, wind_kph: Math.round(c.wind_speed_10m),
    wind_dir: windDir, wind_deg: c.wind_direction_10m || 0,
    pressure_hpa: Math.round(c.surface_pressure || 0),
    visibility_km: +((c.visibility||10000)/1000).toFixed(1),
    cloud_pct: c.cloud_cover, uv_index: Math.round(c.uv_index || 0),
    precipitation_mm: c.precipitation || 0, dew_point_c: c.dew_point_2m || 0,
    sunrise: fmtTime(d.sunrise[0]), sunset: fmtTime(d.sunset[0]),
    sunrise_iso: d.sunrise[0], sunset_iso: d.sunset[0],
    aqi: aqi, aqi_scale: "US AQI",
    forecast: d.weather_code.map((code,i) => ({
      day: i===0 ? "Today" : new Date(d.sunrise[i]).toLocaleDateString("en-US",{weekday:"short"}),
      wmo_code: code, max_c: d.temperature_2m_max[i], min_c: d.temperature_2m_min[i],
      precip_mm: d.precipitation_sum[i] || 0
    }))
  };
}

// ── STATE ──
let currentUnit = "C", currentWx = null, isLoading = false;
const $ = id => document.getElementById(id);
const dp = c => currentUnit==="C" ? `${Math.round(c)}°C` : `${c2f(c)}°F`;

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent2", theme.accent2);
  root.style.setProperty("--glow", theme.glow);
  $("body").style.background = `linear-gradient(160deg,${theme.from} 0%,${theme.via} 45%,${theme.to} 100%)`;
}

function renderHeroCompact() {
  $("hero").classList.add("compact");
  const timeStr = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  $("heroTitle").innerHTML = `<div class="hero-compact-title"><h2>Know Your <span class="grad-text">Sky</span></h2><span class="time">${timeStr}</span></div>`;
}

function windCompassSVG(deg) {
  return `<svg width="38" height="38" viewBox="0 0 38 38" class="wind-compass">
    <circle cx="19" cy="19" r="17" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.1)" stroke-width="1"/>
    <text x="19" y="8" text-anchor="middle" dominant-baseline="middle" font-size="5" fill="var(--accent)" font-weight="700">N</text>
    <text x="30" y="19" text-anchor="middle" dominant-baseline="middle" font-size="5" fill="rgba(255,255,255,.3)" font-weight="700">E</text>
    <text x="19" y="30" text-anchor="middle" dominant-baseline="middle" font-size="5" fill="rgba(255,255,255,.3)" font-weight="700">S</text>
    <text x="8" y="19" text-anchor="middle" dominant-baseline="middle" font-size="5" fill="rgba(255,255,255,.3)" font-weight="700">W</text>
    <g transform="rotate(${deg},19,19)"><polygon points="19,6 21,19 19,17 17,19" fill="var(--accent)" opacity=".9"/><polygon points="19,32 21,19 19,21 17,19" fill="rgba(255,255,255,.25)"/></g>
    <circle cx="19" cy="19" r="2.5" fill="var(--accent)"/></svg>`;
}

function renderStatGrid(wx) {
  const uv = wx.uv_index || 0;
  const uvPct = Math.min(Math.round(uv/12*100), 100);
  const pills = [
    {l:"💧 Humidity", v:`${wx.humidity||0}%`, s:"Relative"},
    {l:"🌡 Pressure", v:`${wx.pressure_hpa||0}`, s:"hPa"},
    {l:"☁️ Cloud Cover", v:`${wx.cloud_pct||0}%`, s:"Sky"},
    {l:"👁 Visibility", v:`${wx.visibility_km||0} km`, s:""},
    {l:"🌧 Precip.", v:`${wx.precipitation_mm||0} mm`, s:"Now"},
    {l:"🌊 Dew Point", v:dp(wx.dew_point_c||0), s:""},
  ];
  let html = pills.map(p => `<div class="stat-pill"><div class="stat-lbl">${p.l}</div><div class="stat-val">${p.v}</div>${p.s?`<div class="stat-sub">${p.s}</div>`:""}</div>`).join("");
  html += `<div class="stat-pill"><div class="stat-lbl">💨 Wind</div><div class="wind-pill">${windCompassSVG(wx.wind_deg||0)}<div class="wind-vals"><div class="wind-kph">${wx.wind_kph||0} <span>km/h</span></div><div class="wind-dir">${wx.wind_dir||"N"}</div></div></div></div>`;
  html += `<div class="stat-pill"><div class="stat-lbl">☀️ UV Index</div><div class="stat-val" style="color:${uvColor(uv)}">${uv} <span style="font-size:.7rem;font-weight:600">${uvLabel(uv)}</span></div><div class="uv-bar"><div class="uv-pip" style="left:calc(${uvPct}% - 5px)"></div></div></div>`;
  $("statGrid").innerHTML = html;
}

function renderForecast(wx) {
  $("fcStrip").innerHTML = (wx.forecast||[]).slice(0,5).map(f => {
    const [icon] = wmoLookup(f.wmo_code||0);
    const hasRain = (f.precip_mm||0) > 0;
    return `<div class="fc-card"><div class="fc-day">${f.day}</div><div class="fc-icon">${icon}</div><div class="fc-hi">${dp(f.max_c)}</div><div class="fc-lo">${dp(f.min_c)}</div>${hasRain?`<div class="fc-rain">💧${f.precip_mm.toFixed(1)}mm</div>`:""}</div>`;
  }).join("");
}

function renderAQI(wx) {
  if (wx.aqi == null) { $("aqiCard").style.display="none"; $("aqiLabel").style.display="none"; return; }
  const info = aqiInfo(wx.aqi);
  $("aqiCard").style.display="block"; $("aqiLabel").style.display="flex";
  const dot = $("aqiDot");
  dot.style.background = info.bg; dot.style.border = `2px solid ${info.c}`;
  dot.innerHTML = `<div class="num" style="color:${info.c};font-size:${wx.aqi>=100?'1.1rem':'1.3rem'}">${Math.round(wx.aqi)}</div><div class="scale" style="color:${info.c}">${wx.aqi_scale||"AQI"}</div>`;
  $("aqiName").textContent = info.l; $("aqiName").style.color = info.c;
  $("aqiNote").textContent = info.n;
  const pct = Math.min(Math.round(wx.aqi)/500*100, 99);
  $("aqiBarDot").style.left = `calc(${pct}% - 7px)`;
  $("aqiBarDot").style.border = `3px solid ${info.c}`;
  $("aqiBarDot").style.boxShadow = `0 0 12px ${info.c}, 0 0 4px rgba(0,0,0,.5)`;
}

function render(wx) {
  currentWx = wx;
  applyTheme(getTheme(wx.wmo_code, wx.temp_c));
  const [icon, condLabel] = wmoLookup(wx.wmo_code);
  const now = new Date();
  $("oRegion").textContent = [wx.state, wx.country].filter(Boolean).join(" · ") || "—";
  $("oCity").textContent = wx.city || "—";
  $("oDateTime").textContent = now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}) + " · " + now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  $("oIcon").textContent = icon;
  $("oCond").textContent = wx.condition || condLabel;
  $("oTemp").textContent = dp(wx.temp_c);
  $("oFeels").textContent = dp(wx.feels_like_c);
  $("oHi").textContent = `↑ ${dp(wx.temp_max_c)}`;
  $("oLo").textContent = `↓ ${dp(wx.temp_min_c)}`;
  renderStatGrid(wx);
  $("oSR").textContent = wx.sunrise || "—";
  $("oSS").textContent = wx.sunset || "—";
  const sdot = sunPos(wx.sunrise_iso, wx.sunset_iso);
  $("sunDot").setAttribute("cx", sdot.cx); $("sunDot").setAttribute("cy", sdot.cy);
  $("sunDotInner").setAttribute("cx", sdot.cx); $("sunDotInner").setAttribute("cy", sdot.cy);
  $("daylightPct").textContent = `${Math.round(sdot.t*100)}% of daylight passed`;
  renderForecast(wx);
  renderAQI(wx);
  $("out").classList.add("show");
  renderHeroCompact();
}

function showError(msg) { const box=$("errBox"); box.textContent="⚠️ "+msg; box.classList.add("show"); }
function clearError() { $("errBox").classList.remove("show"); $("errBox").textContent=""; }
function setLoading(loading) {
  isLoading = loading;
  const btn = $("searchBtn");
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="spinner"></span> Searching` : `Search`;
  $("cityInput").disabled = loading;
}

async function doSearch() {
  const query = $("cityInput").value.trim();
  if (!query) { showError("Please enter a city, country or ZIP code."); return; }
  clearError(); setLoading(true);
  $("out").classList.remove("show");
  try {
    const data = await fetchWeather(query);
    render(data);
  } catch (e) {
    showError(e.message || "Something went wrong. Please try again.");
  } finally { setLoading(false); }
}

function initStars() {
  const container = $("stars");
  const frag = document.createDocumentFragment();
  for (let i=0; i<90; i++) {
    const el = document.createElement("div");
    el.className = "star";
    const size = (Math.random()*1.8+.3).toFixed(2);
    el.style.cssText = `top:${Math.random()*100}%; left:${Math.random()*100}%; width:${size}px; height:${size}px; opacity:${(Math.random()*.4+.06).toFixed(2)}; animation-duration:${(Math.random()*5+2).toFixed(1)}s; animation-delay:${(Math.random()*7).toFixed(1)}s;`;
    frag.appendChild(el);
  }
  container.appendChild(frag);
}

function switchUnit(u) {
  currentUnit = u;
  $("btnC").classList.toggle("on", u==="C");
  $("btnF").classList.toggle("on", u==="F");
  if (currentWx) render(currentWx);
}

function init() {
  initStars();
  $("btnC").addEventListener("click", () => switchUnit("C"));
  $("btnF").addEventListener("click", () => switchUnit("F"));
  $("searchBtn").addEventListener("click", doSearch);
  $("cityInput").addEventListener("keydown", e => { if (e.key==="Enter") doSearch(); });
}

document.addEventListener("DOMContentLoaded", init);