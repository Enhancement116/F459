// Homepage globe: a real Earth (Natural Earth countries via world-atlas), initially centered on NKUST,
// with GPS and BeiDou satellites computed from a full day of broadcast ephemerides
// ("real" mode, data built by tools/build-ephemeris.js) or an idealized constellation ("teach" mode).
// Everything is drawn in the Earth-fixed (ECEF) frame, so the Earth itself does not spin.
(() => {
  const root = document.getElementById('globe-console');
  if (!root) return;
  const canvas = document.getElementById('globe-canvas');
  const ctx = canvas.getContext('2d');
  const sky = document.getElementById('globe-sky');
  const skyCtx = sky.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const EPHEMERIS_URL = 'data/gnss-2026-265.json';
  const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
  const RE = 6378137;
  const LAT0 = 22.75843215402263, LON0 = 120.33823886027615; // NKUST
  const D2R = Math.PI / 180;
  // Display radius = R * (1 + (r/RE - 1) * K): directions are exact, altitude is compressed.
  const K = 0.231;
  const COLORS = { GEO: '#f6c775', IGSO: '#bd9aff', MEO: '#70e3ed', GPS: '#ff9f7a' };
  const TAIWAN_ID = '158';

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // East/north/up unit vectors at a geodetic point (spherical approximation).
  function enu(latDeg, lonDeg) {
    const la = latDeg * D2R, lo = lonDeg * D2R;
    return {
      east: [-Math.sin(lo), Math.cos(lo), 0],
      north: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
      up: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
    };
  }
  // Observation site: NKUST by default; the ground map lets users pick another point.
  let SITE_ENU = enu(LAT0, LON0);
  let SITE = SITE_ENU.up.map(v => v * RE);

  const state = {
    mode: 'real', filter: 'all', playing: !reduced.matches, visible: true,
    speed: 600, t: 0, teachT: 0, last: 0,
    w: 0, h: 0, dpr: 1, R: 100, cx: 0, cy: 0,
    viewLat: LAT0, viewLon: LON0, view: enu(LAT0, LON0), earthDirty: true,
    zoom: 1, baseR: 100, ground: false,
    mask: 10, onlyVisible: false, // elevation mask (degrees) for "visible from the site"
    site: { lat: LAT0, lon: LON0, custom: false },
    teachCounts: { GEO: 1, IGSO: 1, MEO: 3, GPS: 3 },
    sats: [], tracks: [], world: null, dayStart: null, leap: 18, error: false
  };
  const satColor = s => s.sys === 'G' || s.kind === 'GPS' ? COLORS.GPS : COLORS[s.kind];

  const text = {
    zh: {
      real: '真實星曆', teach: '教學示意', play: '暫停 Ⅱ', pause: '播放 ▷',
      brief: {
        all: {
          title: '三種軌道，互補構成定位幾何',
          lead: 'GNSS 定位至少需要 4 顆衛星，同時解出三維位置與接收機鐘差。衛星在天空分布越分散，幾何精度因子（DOP）越小、定位越穩定。北斗以 GEO＋IGSO＋MEO 混合星座強化亞太覆蓋；GPS 全部採用 MEO。',
          rows: [['本日資料', 'data:source'], ['NKUST 現在可見', 'live:classes']],
          points: ['GEO 提供穩定、連續的訊號；IGSO 補強亞太上空的高仰角；MEO 負責全球覆蓋與快速變化的幾何。', '點選上方卡片，可單獨檢視一類軌道的 24 小時軌跡與規格。']
        },
        GEO: {
          title: 'GEO｜地球靜止軌道',
          rows: [['高度', '35,786 km'], ['傾角', '≈ 0°（赤道上空）'], ['週期', '23 h 56 m，與地球自轉同步'], ['本日資料', 'real:北斗 C01–C04，定點約 140°E、80°E、110.5°E、160°E'], ['NKUST 現在可見', 'live:GEO']],
          points: ['從地面看位置幾乎固定，NKUST 可長時間連續接收，天線不需追蹤大範圍移動。', '北斗 GEO 以 D2 導航電文（500 bps）播發，並附帶廣域差分與完好性資訊。', '限制：只位於赤道上空，緯度越高仰角越低；幾何幾乎不變，單靠 GEO 無法改善 DOP。']
        },
        IGSO: {
          title: 'IGSO｜傾斜地球同步軌道',
          rows: [['高度', '35,786 km（半長軸 42,164 km）'], ['傾角', '≈ 55°'], ['週期', '23 h 56 m'], ['本日資料', 'real:北斗 C06–C10（5 顆）'], ['NKUST 現在可見', 'live:IGSO']],
          points: ['地面軌跡呈 8 字形，本日集中在東經約 80°–135°，長時間停留在亞太上空。', '高仰角時間長，可補強 GEO 在高緯度與城市峽谷中的幾何不足。', '這是北斗為區域增強設計的軌道；日本 QZSS 也採用類似的傾斜同步軌道。']
        },
        MEO: {
          title: 'MEO｜中地球軌道',
          rows: [['高度', 'GPS 20,200 km · 北斗 21,528 km'], ['傾角', '55°'], ['週期', 'GPS 11 h 58 m · 北斗 12 h 53 m'], ['軌道面', 'GPS 6 面 · 北斗 3 面'], ['本日資料', 'data:meo'], ['NKUST 現在可見', 'live:MEO']],
          points: ['全球覆蓋的主力：衛星相對地面快速移動，天空幾何持續變化，有助於改善 DOP。', '移動快也代表都卜勒頻移大（地面靜止接收約 ±5 kHz），接收機捕獲時需搜尋較寬的頻率範圍。', 'GeoTrust 模擬的 GPS L1 C/A 與北斗 B1I（D1 電文，50 bps）主要來自這一類衛星。']
        }
      },
      teachData: n => `教學模型 · ${n} 顆`,
      live: (g, i, m) => `GEO ${g} · IGSO ${i} · MEO ${m}`, liveOne: n => `${n} 顆（仰角 ≥ 10°）`,
      dataSource: (g, c) => `GPS ${g} 顆 · 北斗 ${c} 顆（2026-09-22）`, dataMeo: (g, c) => `GPS ${g} 顆 · 北斗 ${c} 顆`,
      cardMeta: { all: 'GPS＋北斗', GEO: '35,786 km', IGSO: '傾角 55°', MEO: '約 2 萬 km' }, cardCount: n => `${n} 顆`,
      customSite: '自訂觀測點', sea: '海域',
      heroLive: (time, site, n, g, c) => `2026-09-22 UTC ${time}　${site} 上空可見 ${n} 顆衛星（GPS ${g}・北斗 ${c}）`,
      heroTeach: n => `教學示意　可見 ${n} 顆衛星`, visibleTitle: name => `${name} 可見衛星`,
      bds: n => `北斗 ${n}`, gps: n => `GPS ${n}`, site: '國立高雄科技大學 · 台灣',
      sourceReal: (g, c) => `廣播星曆 2026-09-22（DOY 265）· GPS ${g} 顆＋北斗 ${c} 顆`,
      sourceTeach: '理想化星座 · GPS＋北斗',
      noteReal: '地球：Natural Earth 國界與海陸。衛星：每個時刻選用參考時間最接近的廣播星曆（GPS 每 2 小時、北斗每小時更新），方向依星曆計算，高度經壓縮顯示。夜側依當下太陽位置繪製。',
      noteTeach: '教學示意：軌道平面、衛星數量與速度皆為理想化，非即時星曆；高度經壓縮顯示。',
      frameReal: '為什麼地球不會轉？畫面採用「地球固定座標（ECEF）」：觀察視角跟著地球一起自轉，因此地球看起來靜止，衛星呈現的是相對地面的運動——GEO 停在原地，IGSO 畫出 8 字形。夜側的移動反映了真實的自轉。',
      frameTeach: '教學示意中地球保持靜止、未顯示自轉，只示意衛星沿軌道面的運動；實際上地球約每 23 小時 56 分自轉一圈。',
      frameTag: 'ECEF 地球固定座標 · 地球不自轉顯示', frameTagTeach: '地球靜止 · 未顯示自轉',
      clockTeach: '教學示意 · 時間加速', taiwan: '台灣',
      skyEmpty: '目前沒有高於仰角遮罩的衛星',
      loading: '載入地球與星曆…', failed: '無法載入星曆，改用教學示意。',
      ocean: ['太平洋', '印度洋', '大西洋'], places: { cn: '中國', jp: '日本', ph: '菲律賓', au: '澳洲', id: '印尼', in: '印度' }
    },
    en: {
      real: 'Real ephemeris', teach: 'Teaching model', play: 'Pause Ⅱ', pause: 'Play ▷',
      brief: {
        all: {
          title: 'Three orbit classes, one positioning geometry',
          lead: 'A GNSS fix needs at least four satellites to solve 3-D position and receiver clock bias. The more spread out they are in the sky, the lower the dilution of precision (DOP). BeiDou mixes GEO, IGSO and MEO to strengthen Asia-Pacific coverage; GPS uses MEO only.',
          rows: [['Today’s data', 'data:source'], ['Visible from NKUST', 'live:classes']],
          points: ['GEO gives steady, continuous signals; IGSO adds high elevations over Asia-Pacific; MEO delivers global coverage and fast-changing geometry.', 'Select a card above to inspect one class’s 24-hour tracks and specifications.']
        },
        GEO: {
          title: 'GEO | Geostationary orbit',
          rows: [['Altitude', '35,786 km'], ['Inclination', '≈ 0° (above the equator)'], ['Period', '23 h 56 m, synchronous with Earth'], ['Today’s data', 'real:BeiDou C01–C04 at about 140°E, 80°E, 110.5°E, 160°E'], ['Visible from NKUST', 'live:GEO']],
          points: ['Nearly fixed in the sky, so NKUST can receive continuously without tracking wide motion.', 'BeiDou GEO broadcasts the D2 navigation message (500 bps) with wide-area differential and integrity data.', 'Limits: only above the equator, so elevation drops at high latitudes; geometry barely changes, so GEO alone cannot improve DOP.']
        },
        IGSO: {
          title: 'IGSO | Inclined geosynchronous orbit',
          rows: [['Altitude', '35,786 km (semi-major axis 42,164 km)'], ['Inclination', '≈ 55°'], ['Period', '23 h 56 m'], ['Today’s data', 'real:BeiDou C06–C10 (5 satellites)'], ['Visible from NKUST', 'live:IGSO']],
          points: ['Figure-eight ground tracks, today spanning roughly 80°E–135°E, dwelling over Asia-Pacific.', 'Long periods at high elevation reinforce GEO geometry at higher latitudes and in urban canyons.', 'A BeiDou regional-enhancement design; Japan’s QZSS uses a similar inclined synchronous orbit.']
        },
        MEO: {
          title: 'MEO | Medium Earth orbit',
          rows: [['Altitude', 'GPS 20,200 km · BeiDou 21,528 km'], ['Inclination', '55°'], ['Period', 'GPS 11 h 58 m · BeiDou 12 h 53 m'], ['Planes', 'GPS 6 · BeiDou 3'], ['Today’s data', 'data:meo'], ['Visible from NKUST', 'live:MEO']],
          points: ['The backbone of global coverage: satellites move quickly across the sky, continuously reshaping geometry and improving DOP.', 'Fast motion also means large Doppler shifts (about ±5 kHz for a static receiver), so acquisition must search a wider frequency range.', 'The GPS L1 C/A and BeiDou B1I (D1 message, 50 bps) signals GeoTrust simulates come mainly from this class.']
        }
      },
      teachData: n => `Teaching model · ${n} satellites`,
      live: (g, i, m) => `GEO ${g} · IGSO ${i} · MEO ${m}`, liveOne: n => `${n} (elevation ≥ 10°)`,
      dataSource: (g, c) => `${g} GPS · ${c} BeiDou (2026-09-22)`, dataMeo: (g, c) => `${g} GPS · ${c} BeiDou`,
      cardMeta: { all: 'GPS + BeiDou', GEO: '35,786 km', IGSO: '55° incl.', MEO: '~20,000 km' }, cardCount: n => `${n} sats`,
      customSite: 'Custom site', sea: 'Open sea',
      heroLive: (time, site, n, g, c) => `2026-09-22 UTC ${time} · ${n} satellites above ${site} (GPS ${g} · BeiDou ${c})`,
      heroTeach: n => `Teaching model · ${n} satellites visible`, visibleTitle: name => `Visible from ${name}`,
      bds: n => `BeiDou ${n}`, gps: n => `GPS ${n}`, site: 'Kaohsiung, Taiwan',
      sourceReal: (g, c) => `Broadcast ephemerides 2026-09-22 (DOY 265) · ${g} GPS + ${c} BeiDou`,
      sourceTeach: 'Idealized constellation · GPS + BeiDou',
      noteReal: 'Earth: Natural Earth borders, land and ocean. Satellites: each moment uses the broadcast ephemeris with the nearest reference time (GPS every 2 h, BeiDou hourly); directions follow the ephemeris, altitude is compressed. Night side follows the Sun.',
      noteTeach: 'Teaching model: planes, counts and speeds are idealized, not live ephemerides; altitude is compressed.',
      frameReal: 'Why doesn’t the Earth spin? The view uses the Earth-fixed frame (ECEF): the camera rotates with the Earth, so the globe stays still and satellites show their motion relative to the ground — GEO stays put, IGSO traces a figure-eight. The moving night side reflects the real rotation.',
      frameTeach: 'In the teaching model the Earth is held still and its rotation is not shown; only motion along each orbital plane is illustrated. The real Earth turns once every 23 h 56 min.',
      frameTag: 'Earth-fixed frame (ECEF) · rotation not shown', frameTagTeach: 'Earth held still · rotation not shown',
      clockTeach: 'Teaching model · accelerated time', taiwan: 'Taiwan',
      skyEmpty: 'No satellites above the elevation mask',
      loading: 'Loading Earth and ephemeris…', failed: 'Ephemeris unavailable; showing the teaching model.',
      ocean: ['Pacific Ocean', 'Indian Ocean', 'Atlantic Ocean'], places: { cn: 'China', jp: 'Japan', ph: 'Philippines', au: 'Australia', id: 'Indonesia', in: 'India' }
    }
  };
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'zh';
  const PLACES = { cn: [104, 34], jp: [138.5, 36.5], ph: [122.5, 12], au: [134, -25], id: [117, -1.5], in: [79, 22] };
  const OCEANS = [[162, 12], [80, -22], [-35, 15]];

  // ---------- Projection ----------
  function project(p) {
    const r = Math.hypot(p[0], p[1], p[2]);
    const u = [p[0] / r, p[1] / r, p[2] / r];
    const s = state.R * (1 + (r / RE - 1) * K);
    const z = dot(u, state.view.up);
    return {
      x: state.cx + dot(u, state.view.east) * s,
      y: state.cy - dot(u, state.view.north) * s,
      front: z >= 0 || s * Math.sqrt(1 - z * z) > state.R
    };
  }
  // Elevation and azimuth (degrees) of an ECEF point as seen from the observation site.
  function lookAngles(p) {
    const d = [p[0] - SITE[0], p[1] - SITE[1], p[2] - SITE[2]];
    const n = Math.hypot(d[0], d[1], d[2]);
    return {
      el: Math.asin(dot(d, SITE_ENU.up) / n) / D2R,
      az: Math.atan2(dot(d, SITE_ENU.east), dot(d, SITE_ENU.north)) / D2R
    };
  }

  function setView(lon, lat) {
    state.viewLon = ((lon + 540) % 360) - 180;
    state.viewLat = Math.max(-85, Math.min(85, lat));
    state.view = enu(state.viewLat, state.viewLon);
    if (projection) projection.rotate([-state.viewLon, -state.viewLat]);
    state.earthDirty = true;
    markChanged();
  }

  const MAX_ZOOM = 4;
  function setZoom(z) {
    if (z > MAX_ZOOM && state.zoom >= MAX_ZOOM - 0.01) { setWheelActive(true); enterGround(); return; }
    state.zoom = Math.max(0.6, Math.min(MAX_ZOOM, z));
    state.R = state.baseR * state.zoom;
    if (projection) projection.scale(state.R);
    drawBackground();
    state.earthDirty = true;
    markChanged();
  }

  function markChanged() {
    const moved = Math.abs(state.viewLon - state.site.lon) > 0.5 || Math.abs(state.viewLat - state.site.lat) > 0.5 || Math.abs(state.zoom - 1) > 0.01;
    root.classList.toggle('is-rotated', moved);
  }

  // ---------- Teaching constellation ----------
  let TEACH = [];
  function buildTeach() {
    const list = [], c = state.teachCounts;
    const add = (kind, r, inc, raan, phase, period, label) =>
      list.push({ kind, r, inc: inc * D2R, raan: raan * D2R, phase: phase * D2R, rate: period ? 2 * Math.PI / period : 0, prn: label });
    [110.5, 80, 140].slice(0, c.GEO).forEach((lon, i) => add('GEO', 42164e3, 0, 0, lon, 0, i === 0 ? 'GEO' : ''));
    [118, 238, 358].slice(0, c.IGSO).forEach((raan, i) => add('IGSO', 42164e3, 55, raan, 40 + i * 120, 86164, i === 0 ? 'IGSO' : ''));
    // Spread n satellites over three planes, evenly phased within each plane.
    const planes = (kind, n, r, raans, period, label) => raans.forEach((raan, p) => {
      const m = Math.floor(n / 3) + (p < n % 3 ? 1 : 0);
      for (let k = 0; k < m; k++) add(kind, r, 55, raan, k * 360 / m + p * 30, period, p === 0 && k === 0 ? label : '');
    });
    planes('MEO', c.MEO, 27906e3, [20, 140, 260], 46404, 'BDS MEO');
    planes('GPS', c.GPS, 26560e3, [70, 190, 310], 43082, 'GPS');
    TEACH = list;
  }
  function ringPoint(s, angle) {
    const x = s.r * Math.cos(angle), y = s.r * Math.sin(angle);
    const y1 = y * Math.cos(s.inc), z1 = y * Math.sin(s.inc);
    return [x * Math.cos(s.raan) - y1 * Math.sin(s.raan), x * Math.sin(s.raan) + y1 * Math.cos(s.raan), z1];
  }
  const teachKind = k => k === 'GPS' ? 'MEO' : k;

  // ---------- Sun (night side) ----------
  function subsolar(date) {
    const d = date / 86400000 + 2440587.5 - 2451545.0;
    const g = (357.529 + 0.98560028 * d) * D2R;
    const q = 280.459 + 0.98564736 * d;
    const lambda = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    const eps = (23.439 - 0.00000036 * d) * D2R;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
    const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * D2R;
    let lon = (ra - gmst) / D2R;
    lon = ((lon + 540) % 360) - 180;
    return [lon, dec / D2R];
  }

  // ---------- Layout and static layers ----------
  const bg = document.createElement('canvas'), earth = document.createElement('canvas');
  let projection = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    state.w = rect.width; state.h = rect.height;
    for (const c of [canvas, bg, earth]) { c.width = Math.round(state.w * state.dpr); c.height = Math.round(state.h * state.dpr); }
    state.baseR = Math.min(state.w / (state.w < 500 ? 3.8 : 4.5), state.h / 3.9);
    state.R = state.baseR * state.zoom;
    state.cx = state.w / 2; state.cy = state.h / 2;
    if (window.d3) projection = d3.geoOrthographic().rotate([-state.viewLon, -state.viewLat]).translate([state.cx, state.cy]).scale(state.R).clipAngle(90).precision(0.3);
    const skySize = Math.round(sky.getBoundingClientRect().width * state.dpr);
    sky.width = sky.height = skySize;
    drawBackground(); state.earthDirty = true;
  }

  function drawBackground() {
    const c = bg.getContext('2d');
    c.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    c.clearRect(0, 0, state.w, state.h);
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < Math.round(state.w * state.h / 2600); i++) {
      c.globalAlpha = 0.15 + rand() * 0.5;
      c.fillStyle = '#b9d3ef';
      c.fillRect(rand() * state.w, rand() * state.h, rand() < 0.1 ? 1.6 : 0.9, rand() < 0.1 ? 1.6 : 0.9);
    }
    c.globalAlpha = 1;
    const glow = c.createRadialGradient(state.cx, state.cy, state.R * 0.95, state.cx, state.cy, state.R * 1.28);
    glow.addColorStop(0, '#4aa9ff55'); glow.addColorStop(0.35, '#4aa9ff1c'); glow.addColorStop(1, '#4aa9ff00');
    c.fillStyle = glow;
    c.beginPath(); c.arc(state.cx, state.cy, state.R * 1.28, 0, 2 * Math.PI); c.fill();
  }

  function countryColor(id) {
    const palette = ['#5f8a55', '#6c9358', '#7b9a5e', '#8f9c64', '#a1996a', '#68905e', '#768f57'];
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return palette[h % palette.length];
  }

  function drawEarth() {
    state.earthDirty = false;
    const c = earth.getContext('2d');
    c.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    c.clearRect(0, 0, state.w, state.h);
    const { cx, cy, R } = state;
    const ocean = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    ocean.addColorStop(0, '#2a74b4'); ocean.addColorStop(0.6, '#15508a'); ocean.addColorStop(1, '#0a2c55');
    c.fillStyle = ocean;
    c.beginPath(); c.arc(cx, cy, R, 0, 2 * Math.PI); c.fill();
    if (projection) {
      const path = d3.geoPath(projection, c);
      c.beginPath(); path(d3.geoGraticule10());
      c.strokeStyle = '#9fd0ff22'; c.lineWidth = 0.6; c.stroke();
      if (state.world) {
        for (const f of state.world.countries) {
          c.beginPath(); path(f);
          c.fillStyle = f.id === TAIWAN_ID ? '#9bd27a' : countryColor(f.id);
          c.fill();
        }
        c.beginPath(); path(state.world.borders);
        c.strokeStyle = '#f2f7ffa0'; c.lineWidth = 0.55; c.stroke();
        c.beginPath(); path(state.world.coast);
        c.strokeStyle = '#d9f0ff66'; c.lineWidth = 0.7; c.stroke();
      }
    }
    // Sphere shading and limb.
    const shade = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.2, cx, cy, R * 1.02);
    shade.addColorStop(0, '#ffffff14'); shade.addColorStop(0.7, '#00000000'); shade.addColorStop(1, '#02081899');
    c.fillStyle = shade;
    c.beginPath(); c.arc(cx, cy, R, 0, 2 * Math.PI); c.fill();
    c.strokeStyle = '#82bfff99'; c.lineWidth = 1; c.stroke();
  }

  // Real mode: 24 h Earth-fixed tracks (ECEF), computed once and projected per frame.
  function buildTracks() {
    state.tracks = state.sats.map(s => {
      const pts = [];
      for (let t = 0; t <= 86400; t += 600) pts.push(positionAt(s, t));
      return pts;
    });
  }

  // ---------- Frame ----------
  const shown = kind => state.filter === 'all' || state.filter === kind;
  const lineTo = (pts, front) => {
    ctx.beginPath();
    let pen = false;
    for (const p of pts) {
      if (p.front === front) { pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; } else pen = false;
    }
    ctx.stroke();
  };

  // Position at t seconds after 00:00 GPST, using the ephemeris whose toe is nearest.
  function positionAt(s, t) {
    let best = s.recs[0];
    for (const r of s.recs) if (Math.abs(t - r.rel) < Math.abs(t - best.rel)) best = r;
    return GnssOrbit.position(best.eph, t - best.rel);
  }

  function currentSats() {
    if (state.mode === 'real' && state.sats.length) {
      return state.sats.map((s, i) => {
        const p = positionAt(s, state.t);
        return { kind: s.kind, sys: s.sys, label: s.prn, p, index: i, ...project(p), ...lookAngles(p) };
      });
    }
    return TEACH.map(s => {
      const p = ringPoint(s, s.phase + s.rate * state.teachT);
      return { kind: s.kind, label: s.prn, p, ring: s, ...project(p), ...lookAngles(p) };
    });
  }

  function drawOrbits(front, sats) {
    ctx.lineWidth = 1.2;
    if (state.mode === 'real' && state.sats.length) {
      sats.forEach(s => {
        const ecef = state.tracks[s.index];
        if (state.filter === 'all') {
          // Recent trail only, to keep the overview legible.
          const k = Math.floor(state.t / 600);
          const trail = ecef.slice(Math.max(0, k - 6), k + 1).map(project);
          trail.push(s);
          ctx.strokeStyle = satColor(s) + (front ? 'aa' : '44');
          lineTo(trail, front);
        } else {
          ctx.strokeStyle = satColor(s) + (front ? '88' : '33');
          lineTo(ecef.map(project), front);
        }
      });
    } else {
      const seen = new Set();
      sats.forEach(({ ring: s }) => {
        const key = s.kind + s.raan + s.inc;
        if (seen.has(key)) return;
        seen.add(key);
        const pts = [];
        for (let a = 0; a <= 360; a += 3) pts.push(project(ringPoint(s, a * D2R)));
        ctx.strokeStyle = COLORS[s.kind] + (front ? 'b0' : '40');
        ctx.setLineDash(s.kind === 'IGSO' ? [8, 5] : s.kind === 'GEO' ? [] : [3, 5]);
        lineTo(pts, front);
      });
      ctx.setLineDash([]);
    }
  }

  function drawSat(s, front) {
    const color = satColor(s);
    ctx.globalAlpha = front ? 1 : 0.35;
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 11);
    glow.addColorStop(0, color + '88'); glow.addColorStop(1, color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(s.x, s.y, 11, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#18324b'; ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.fillRect(s.x - 9, s.y - 2.5, 5, 5); ctx.strokeRect(s.x - 9, s.y - 2.5, 5, 5);
    ctx.fillRect(s.x + 4, s.y - 2.5, 5, 5); ctx.strokeRect(s.x + 4, s.y - 2.5, 5, 5);
    ctx.fillStyle = color; ctx.fillRect(s.x - 3, s.y - 3.5, 6, 7);
    ctx.globalAlpha = 1;
  }

  function label(textValue, x, y, color, size = 11, align = 'center', c = ctx) {
    c.font = `700 ${size}px Orbitron, 'Noto Sans TC', sans-serif`;
    c.textAlign = align; c.textBaseline = 'middle';
    c.lineWidth = 3; c.strokeStyle = '#07101ecc'; c.strokeText(textValue, x, y);
    c.fillStyle = color; c.fillText(textValue, x, y);
  }

  function drawNight() {
    if (!projection || state.mode !== 'real' || state.dayStart === null) return;
    const [lon, lat] = subsolar(utcMs());
    const path = d3.geoPath(projection, ctx);
    for (const [radius, alpha] of [[96, 0.16], [92, 0.16], [88, 0.2]]) {
      ctx.beginPath(); path(d3.geoCircle().center([lon + 180, -lat]).radius(radius)());
      ctx.fillStyle = `rgba(2,8,22,${alpha})`; ctx.fill();
    }
  }

  function drawLabels() {
    if (!projection) return;
    const t = text[lang()], center = [state.viewLon, state.viewLat];
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.75;
    OCEANS.forEach((c, i) => {
      if (d3.geoDistance(c, center) > 1.35) return;
      const p = projection(c);
      ctx.font = `italic 500 ${Math.min(20, Math.max(13, state.R / 12))}px 'Noto Sans TC', sans-serif`;
      ctx.textAlign = 'center'; ctx.fillStyle = '#bfe3ff'; ctx.fillText(t.ocean[i], p[0], p[1]);
    });
    ctx.globalAlpha = 0.85;
    if (state.R > 110) Object.entries(PLACES).forEach(([k, c]) => {
      if (d3.geoDistance(c, center) > 1.3) return;
      const p = projection(c);
      ctx.font = `500 ${Math.min(17, Math.max(12, state.R / 14))}px 'Noto Sans TC', sans-serif`;
      ctx.textAlign = 'center'; ctx.fillStyle = '#f4f8ef'; ctx.fillText(t.places[k], p[0], p[1]);
    });
    ctx.globalAlpha = 1;
  }

  const coordText = () => {
    const { lat, lon } = state.site;
    return `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`;
  };
  // Country and city of a custom site, from OpenStreetMap Nominatim; null until it arrives.
  const placeCache = new Map();
  const place = () => state.site.custom ? placeCache.get(placeKey()) || null : null;
  const placeKey = () => `${state.site.lat.toFixed(4)},${state.site.lon.toFixed(4)},${lang()}`;
  function lookupPlace() {
    if (!state.site.custom) return;
    const key = placeKey();
    if (placeCache.has(key)) return;
    placeCache.set(key, null);
    const { lat, lon } = state.site;
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&accept-language=${lang() === 'en' ? 'en' : 'zh-TW,zh'}`;
    fetch(url).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(data => {
      const a = data.address || {};
      const city = a.city || a.town || a.county || a.state_district || a.state || a.village || a.municipality || '';
      const country = a.country || '';
      placeCache.set(key, city || country ? { city, country } : { city: '', country: text[lang()].sea });
      if (key === placeKey()) { updateGroundSite(); updateUi(); }
    }).catch(() => placeCache.delete(key));
  }
  // Short name for titles: city (or country) for a custom site.
  const siteName = () => {
    if (!state.site.custom) return 'NKUST';
    const p = place();
    return p && (p.city || p.country) || text[lang()].customSite;
  };
  // Full place line: "country city", or the coordinates until the lookup returns.
  const placeLine = () => {
    const p = place();
    return p ? [p.country, p.city].filter(Boolean).join(' ') : text[lang()].customSite;
  };
  function setSite(lat, lon, custom) {
    state.site = { lat, lon: ((lon + 540) % 360) - 180, custom };
    SITE_ENU = enu(state.site.lat, state.site.lon);
    SITE = SITE_ENU.up.map(v => v * RE);
    root.classList.toggle('is-custom-site', custom);
    lookupPlace();
    markChanged();
    updateGroundSite();
    updateUi();
  }
  // Centre the globe on the observation site at the default zoom.
  function resetView() {
    setView(state.site.lon, state.site.lat);
    setZoom(1);
  }

  function drawSite(visible) {
    if (dot(SITE_ENU.up, state.view.up) <= 0) return; // the site is on the far side
    const { x, y } = project(SITE);
    ctx.lineWidth = 1;
    visible.forEach(s => {
      ctx.strokeStyle = satColor(s) + '70';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(s.x, s.y); ctx.stroke();
    });
    ctx.setLineDash([]);
    const pulse = (performance.now() / 1600) % 1;
    ctx.strokeStyle = `rgba(138,255,221,${1 - pulse})`;
    ctx.beginPath(); ctx.arc(x, y, 5 + pulse * 14, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#c8fff1'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = '#8affdd'; ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 26, y); ctx.lineTo(x + 36, y - 20); ctx.stroke();
    // Site tag: a badge ("TW" for NKUST, "PIN" for a custom point), a name and a subtitle.
    const custom = state.site.custom;
    const badge = custom ? 'PIN' : 'TW', name = custom ? placeLine() : 'NKUST';
    const sub = custom ? coordText() : text[lang()].site;
    const nameFont = custom ? "700 14px 'Noto Sans TC', sans-serif" : "700 14px Orbitron, sans-serif";
    ctx.font = nameFont;
    const badgeW = custom ? 30 : 24;
    const w1 = badgeW + 6 + ctx.measureText(name).width;
    ctx.font = "500 13px 'Noto Sans TC', sans-serif";
    const bw = Math.max(w1, ctx.measureText(sub).width) + 18, bx = x + 36, by = y - 44;
    ctx.fillStyle = '#06101ee6'; ctx.strokeStyle = '#8affdd99';
    ctx.fillRect(bx, by, bw, 44); ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 43);
    ctx.fillStyle = custom ? '#ffd27a' : '#8affdd'; ctx.fillRect(bx + 8, by + 7, badgeW, 15);
    ctx.fillStyle = '#062421'; ctx.font = "800 10px Orbitron, sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(badge, bx + 8 + badgeW / 2, by + 15);
    ctx.fillStyle = '#e4fff8'; ctx.font = nameFont; ctx.textAlign = 'left';
    ctx.fillText(name, bx + 14 + badgeW, by + 15);
    ctx.fillStyle = '#b9cfe2'; ctx.font = "500 13px 'Noto Sans TC', sans-serif";
    ctx.fillText(sub, bx + 8, by + 33);
  }

  // Polar sky plot as seen from NKUST: centre = zenith, rim = horizon, north up.
  function drawSky(sats) {
    const c = skyCtx, size = sky.width / state.dpr;
    if (!size) return;
    c.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    c.clearRect(0, 0, size, size);
    const r0 = size / 2 - 16, cx = size / 2, cy = size / 2;
    const rad = el => r0 * (90 - el) / 90;
    c.fillStyle = '#0b1d2f'; c.beginPath(); c.arc(cx, cy, r0, 0, 2 * Math.PI); c.fill();
    // Region below the elevation mask.
    c.fillStyle = '#ff7a5a1f';
    c.beginPath(); c.arc(cx, cy, r0, 0, 2 * Math.PI); c.arc(cx, cy, rad(state.mask), 0, 2 * Math.PI, true); c.fill();
    c.strokeStyle = '#3b6680'; c.lineWidth = 1;
    for (const el of [0, 30, 60]) { c.beginPath(); c.arc(cx, cy, rad(el), 0, 2 * Math.PI); c.stroke(); }
    c.beginPath(); c.moveTo(cx - r0, cy); c.lineTo(cx + r0, cy); c.moveTo(cx, cy - r0); c.lineTo(cx, cy + r0); c.stroke();
    c.strokeStyle = '#ff9f7a'; c.setLineDash([3, 3]);
    c.beginPath(); c.arc(cx, cy, rad(state.mask), 0, 2 * Math.PI); c.stroke(); c.setLineDash([]);
    c.font = "600 12px Orbitron, sans-serif"; c.fillStyle = '#9ebfe1'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N', cx, cy - r0 - 9); c.fillText('S', cx, cy + r0 + 9); c.fillText('E', cx + r0 + 9, cy); c.fillText('W', cx - r0 - 9, cy);
    const up = sats.filter(s => s.el >= state.mask);
    up.forEach(s => {
      const x = cx + rad(s.el) * Math.sin(s.az * D2R), y = cy - rad(s.el) * Math.cos(s.az * D2R);
      c.fillStyle = satColor(s); c.beginPath(); c.arc(x, y, 3.5, 0, 2 * Math.PI); c.fill();
      if (s.label && size > 150) label(s.label, x, y - 10, satColor(s), 10, 'center', c);
    });
    if (!up.length) {
      c.fillStyle = '#9bb7cf'; c.font = "13px 'Noto Sans TC', sans-serif";
      c.fillText(text[lang()].skyEmpty, cx, cy);
    }
  }

  let lastPanel = 0;
  function frame(now) {
    const dt = Math.min((now - state.last) / 1000, 0.25);
    state.last = now;
    if (state.playing && state.visible && !document.hidden) {
      state.t = (state.t + dt * state.speed) % 86400;
      state.teachT += dt * state.speed;
    }
    if (state.earthDirty) drawEarth();
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.w, state.h);
    ctx.drawImage(bg, 0, 0, state.w, state.h);

    const every = currentSats();
    const all = every.filter(s => shown(state.mode === 'real' ? s.kind : teachKind(s.kind)));
    const visible = all.filter(s => s.el >= state.mask);
    const sats = state.onlyVisible ? visible : all;
    drawOrbits(false, sats);
    sats.filter(s => !s.front).forEach(s => drawSat(s, false));
    ctx.drawImage(earth, 0, 0, state.w, state.h);
    drawNight();
    drawLabels();
    drawSite(visible);
    drawOrbits(true, sats);
    sats.filter(s => s.front).forEach(s => drawSat(s, true));
    const many = state.mode === 'real' && state.filter === 'all' && !state.onlyVisible;
    sats.filter(s => s.front && s.label && (!many || (s.el >= state.mask && state.R > 110)))
      .forEach(s => label(s.label, s.x, s.y - 15, satColor(s), state.mode === 'real' ? 12 : 13));

    if (now - lastPanel > 250) {
      lastPanel = now;
      updatePanel(visible); drawSky(all);
      const byClass = { GEO: 0, IGSO: 0, MEO: 0 };
      every.forEach(s => { if (s.el >= state.mask) byClass[teachKind(s.kind)]++; });
      updateBriefLive(byClass);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Panel ----------
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  // Simulation time as UTC milliseconds (GPST − leap seconds).
  const utcMs = () => state.dayStart + (state.t - state.leap) * 1000;
  function updatePanel(visible) {
    const t = text[lang()];
    const real = state.mode === 'real' && state.sats.length;
    if (real) {
      const d = new Date(utcMs()), tw = new Date(utcMs() + 8 * 3600000);
      $('globe-clock').textContent = `UTC ${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} · ${t.taiwan} ${pad(tw.getUTCHours())}:${pad(tw.getUTCMinutes())} · ${state.speed}×`;
    } else {
      $('globe-clock').textContent = `${t.clockTeach} · ${state.speed}×`;
    }
    const gps = visible.filter(s => s.sys === 'G' || s.kind === 'GPS');
    $('globe-vis-count').textContent = visible.length;
    $('globe-vis-bds').textContent = t.bds(visible.length - gps.length);
    $('globe-vis-gps').textContent = t.gps(gps.length);
    // Hero line above the globe: the same live figures, so the headline hands off to the globe.
    const heroLive = document.getElementById('hero-live-text');
    if (heroLive && (real || state.mode === 'teach')) {
      const d = new Date(utcMs());
      heroLive.textContent = real
        ? t.heroLive(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`, siteName(), visible.length, gps.length, visible.length - gps.length)
        : t.heroTeach(visible.length);
    }
    // PRN chips (real mode only; teaching satellites have no PRN).
    $('globe-visible-list').replaceChildren(...(real ? visible : []).slice().sort((a, b) => a.label.localeCompare(b.label)).map(s => {
      const chip = document.createElement('span');
      chip.textContent = s.label;
      chip.className = s.sys === 'G' ? 'is-gps' : 'is-bds';
      return chip;
    }));
  }

  // Orbit brief: title, spec rows (static, data-derived or live) and key points.
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // All four briefs are rendered into the same grid cell and only the selected one is shown,
  // so the panel keeps the height of the longest brief whichever class is selected.
  function renderBrief(real, counts) {
    const t = text[lang()];
    const article = key => {
      const b = t.brief[key];
      const cell = v => {
        if (v === 'data:source') return esc(real ? t.dataSource(counts.GPS, state.sats.length - counts.GPS) : t.teachData(TEACH.length));
        if (v === 'data:meo') return esc(real ? t.dataMeo(counts.GPS, counts.MEO) : t.teachData(counts.GPS + counts.MEO));
        if (v.startsWith('live:')) return `<span data-live="${v.slice(5)}">—</span>`;
        if (v.startsWith('real:')) return esc(real ? v.slice(5) : t.teachData(counts[key]));
        return esc(v);
      };
      const active = key === state.filter;
      return `<article class="ob${active ? ' is-active' : ''}"${active ? '' : ' aria-hidden="true"'}>` +
        `<h4 style="--c:${key === 'all' ? '#a2ecd8' : COLORS[key]}">${esc(b.title)}</h4>` +
        (b.lead ? `<p class="ob-lead">${esc(b.lead)}</p>` : '') +
        `<dl class="ob-specs">${b.rows.map(([k, v]) => `<div><dt>${esc(k.replace('NKUST', siteName()))}</dt><dd>${cell(v)}</dd></div>`).join('')}</dl>` +
        `<ul class="ob-points">${b.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></article>`;
    };
    $('globe-explanation').innerHTML = ['all', 'GEO', 'IGSO', 'MEO'].map(article).join('');
    // Card subtitles: a key figure plus the satellite count for this mode.
    const total = real ? state.sats.length : TEACH.length;
    root.querySelectorAll('[data-card-meta]').forEach(el => {
      const k = el.dataset.cardMeta;
      const n = k === 'all' ? total : k === 'MEO' ? counts.MEO + counts.GPS : counts[k];
      el.textContent = `${t.cardMeta[k]} · ${t.cardCount(n)}`;
    });
  }
  // Live "visible from NKUST" figures inside the brief, refreshed with the panel.
  function updateBriefLive(byClass) {
    const t = text[lang()];
    root.querySelectorAll('[data-live]').forEach(el => {
      const k = el.dataset.live;
      el.textContent = k === 'classes' ? t.live(byClass.GEO, byClass.IGSO, byClass.MEO) : t.liveOne(byClass[k]);
    });
  }

  function updateUi() {
    const t = text[lang()];
    const real = state.mode === 'real' && state.sats.length;
    root.dataset.mode = state.mode;
    $('globe-play').textContent = state.playing ? t.play : t.pause;
    $('globe-play').setAttribute('aria-pressed', String(state.playing));
    root.querySelectorAll('[data-mode]').forEach(b => {
      b.textContent = t[b.dataset.mode];
      b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
    });
    root.querySelectorAll('[data-orbit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.orbit === state.filter)));
    root.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === state.speed)));
    const counts = { GEO: 0, IGSO: 0, MEO: 0, GPS: 0 };
    (real ? state.sats : TEACH).forEach(s => counts[s.sys === 'G' || s.kind === 'GPS' ? 'GPS' : s.kind]++);
    renderBrief(real, counts);
    $('gp-visible-title').textContent = t.visibleTitle(siteName());
    $('gp-site-coords').textContent = state.site.custom ? `${placeLine()} · ${coordText()}` : 'NKUST · 22.758°N 120.338°E';
    root.querySelectorAll('[data-count]').forEach(el => { el.textContent = counts[el.dataset.count]; });
    $('globe-source').textContent = state.error ? t.failed : real ? t.sourceReal(counts.GPS, state.sats.length - counts.GPS) : state.mode === 'real' ? t.loading : t.sourceTeach;
    $('globe-note').textContent = real ? t.noteReal : t.noteTeach;
    $('globe-frame-text').textContent = state.mode === 'real' ? t.frameReal : t.frameTeach;
    $('globe-frame-tag').textContent = state.mode === 'real' ? t.frameTag : t.frameTagTeach;
    root.querySelectorAll('[data-teach-count]').forEach(el => { el.textContent = state.teachCounts[el.dataset.teachCount]; });
    lastPanel = 0;
  }


  // ---------- Ground-level map ----------
  // Past the globe's maximum zoom, a Leaflet map (imagery, terrain or streets) takes over,
  // centred on the current view. Zooming all the way out returns to the globe.
  const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const ESRI_ATTR = 'Imagery © Esri, Maxar, Earthstar Geographics · Labels © Esri';
  let ground = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = LEAFLET + 'leaflet.min.css';
      document.head.append(css);
      const js = document.createElement('script');
      js.src = LEAFLET + 'leaflet.min.js'; js.onload = resolve; js.onerror = reject;
      document.head.append(js);
    });
  }
  async function enterGround() {
    if (state.ground) return;
    state.ground = true;
    root.classList.add('is-ground');
    $('globe-ground').hidden = false;
    try { await loadLeaflet(); } catch { exitGround(); return; }
    if (!ground) {
      const map = L.map('globe-ground-map', { scrollWheelZoom: wheelActive, dragging: !coarse, minZoom: 4, maxZoom: 18, worldCopyJump: true, zoomSnap: 0.5, zoomControl: false, attributionControl: false });
      L.control.zoom({ position: 'topright' }).addTo(map);
      const layers = {
        imagery: L.layerGroup([
          L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: ESRI_ATTR }),
          L.tileLayer(ESRI + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }),
          L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 })
        ]),
        topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          maxZoom: 17, subdomains: 'abc',
          attribution: 'Map data © OpenStreetMap contributors, SRTM · Style © OpenTopoMap (CC-BY-SA)'
        }),
        street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18, attribution: '© OpenStreetMap contributors'
        })
      };
      layers.imagery.addTo(map);
      L.circleMarker([LAT0, LON0], { radius: 7, color: '#8affdd', weight: 2, fillColor: '#c8fff1', fillOpacity: 0.9 })
        .addTo(map).bindTooltip('TW · NKUST 國立高雄科技大學', { permanent: true, direction: 'right', className: 'nkust-tip' });
      // Wheel-out at the minimum zoom leaves the map.
      map.getContainer().addEventListener('wheel', e => {
        if (!wheelActive) { showScrollHint(); return; }
        if (e.deltaY > 0 && map.getZoom() <= map.getMinZoom()) exitGround(false);
      });
      // Clicking the map moves the observation site there.
      map.on('click', e => setSite(e.latlng.lat, e.latlng.lng, true));
      ground = { map, layers, current: 'imagery', pin: null };
      updateGroundSite();
    }
    ground.map.invalidateSize();
    ground.map.setView([state.viewLat, state.viewLon], 7);
  }
  // Keep the custom-site pin on the ground map in step with state.site.
  function updateGroundSite() {
    if (!ground) return;
    if (ground.pin) { ground.map.removeLayer(ground.pin); ground.pin = null; }
    if (!state.site.custom) return;
    ground.pin = L.circleMarker([state.site.lat, state.site.lon], { radius: 8, color: '#ffd27a', weight: 3, fillColor: '#fff3d6', fillOpacity: 0.95 })
      .addTo(ground.map).bindTooltip(`PIN · ${place() ? placeLine() : coordText()}`, { permanent: true, direction: 'right', className: 'nkust-tip pin-tip' });
  }
  function setGroundLayer(name) {
    if (!ground || ground.current === name) return;
    ground.map.removeLayer(ground.layers[ground.current]);
    ground.layers[name].addTo(ground.map);
    ground.current = name;
    root.querySelectorAll('[data-layer]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.layer === name)));
  }
  // The "back to globe" button resets the view; wheeling out continues from the map position.
  function exitGround(reset) {
    if (!state.ground) return;
    state.ground = false;
    root.classList.remove('is-ground');
    $('globe-ground').hidden = true;
    if (reset) { resetView(); return; }
    if (ground) {
      const c = ground.map.getCenter();
      setView(c.lng, c.lat);
    }
    setZoom(MAX_ZOOM - 1);
  }

  // ---------- Events ----------
  let wheelActive = false;
  const coarse = matchMedia('(pointer: coarse)').matches;
  $('globe-play').addEventListener('click', () => { state.playing = !state.playing; updateUi(); });
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { state.mode = b.dataset.mode; updateUi(); }));
  root.querySelectorAll('[data-orbit]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.orbit; updateUi(); }));
  root.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { state.speed = Number(b.dataset.speed); updateUi(); }));
  $('globe-reset').addEventListener('click', () => { state.t = 0; state.teachT = 0; updateUi(); });
  $('globe-only-visible').addEventListener('change', e => { state.onlyVisible = e.target.checked; updateUi(); });
  root.querySelectorAll('[data-teach-input]').forEach(input => input.addEventListener('input', () => {
    state.teachCounts[input.dataset.teachInput] = Number(input.value);
    buildTeach(); updateUi();
  }));
  $('globe-recenter').addEventListener('click', resetView);
  $('globe-ground-enter').addEventListener('click', () => { setWheelActive(true); enterGround(); });
  root.querySelectorAll('[data-site-reset]').forEach(b => b.addEventListener('click', () => setSite(LAT0, LON0, false)));
  $('globe-ground-exit').addEventListener('click', () => exitGround(true));
  root.querySelectorAll('[data-layer]').forEach(b => b.addEventListener('click', () => setGroundLayer(b.dataset.layer)));
  root.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => setZoom(state.zoom * (b.dataset.zoom > 0 ? 1.25 : 0.8))));
  document.addEventListener('languagechange', () => { lookupPlace(); updateGroundSite(); updateUi(); });
  reduced.addEventListener('change', () => { if (reduced.matches) state.playing = false; updateUi(); });
  new IntersectionObserver(entries => { state.visible = entries[0].isIntersecting; }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  new ResizeObserver(resize).observe(sky);

  // Scrolling the page past the globe must never move it. The wheel zooms only after the globe has been
  // clicked (until the pointer leaves the console) or with Ctrl/⌘ held; on touch, one finger scrolls the
  // page, a sideways drag rotates and two fingers zoom.
  const scrollHint = document.createElement('div');
  scrollHint.className = 'globe-scroll-hint';
  scrollHint.setAttribute('aria-hidden', 'true');
  canvas.parentElement.append(scrollHint);
  let hintTimer = 0, touchHinted = false;
  function showScrollHint(touch) {
    const en = document.documentElement.lang === 'en';
    scrollHint.textContent = touch
      ? (en ? 'Drag sideways to rotate · pinch to zoom' : '左右拖曳可旋轉 · 兩指可縮放')
      : (en ? 'Click the globe first, or hold Ctrl (⌘ on Mac) while scrolling, to zoom' : '先點一下地球，或按住 Ctrl（Mac 為 ⌘）再滾動，即可縮放');
    scrollHint.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => scrollHint.classList.remove('is-on'), 1600);
  }
  function setWheelActive(v) {
    wheelActive = v;
    if (ground) ground.map.scrollWheelZoom[v ? 'enable' : 'disable']();
  }
  root.addEventListener('mouseleave', () => setWheelActive(false));
  $('globe-ground').addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') setWheelActive(true); });

  // Drag to rotate, wheel or pinch to zoom; arrow keys and +/− do the same for keyboard users.
  const pointers = new Map();
  let drag = null, pinch = null;
  const pinchDistance = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') setWheelActive(true);
    else if (!touchHinted) { touchHinted = true; showScrollHint(true); }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 2) { drag = null; pinch = { d: pinchDistance(), zoom: state.zoom }; }
    else { drag = { x: e.clientX, y: e.clientY, lon: state.viewLon, lat: state.viewLat }; root.classList.add('is-dragging'); }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) { setZoom(pinch.zoom * pinchDistance() / pinch.d); return; }
    if (!drag) return;
    const k = 57 / state.R; // degrees per pixel, roughly matching the globe surface
    setView(drag.lon - (e.clientX - drag.x) * k, drag.lat + (e.clientY - drag.y) * k);
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) { drag = null; root.classList.remove('is-dragging'); }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', e => {
    if (!wheelActive && !e.ctrlKey && !e.metaKey) { showScrollHint(false); return; }
    e.preventDefault();
    setZoom(state.zoom * Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  canvas.addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(state.zoom * 1.25); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(state.zoom * 0.8); return; }
    const step = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key];
    if (!step) return;
    e.preventDefault();
    setView(state.viewLon + step[0], state.viewLat + step[1]);
  });

  // ---------- Data ----------
  fetch(EPHEMERIS_URL).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(data => {
    state.sats = Object.entries(data.sats).map(([prn, list]) => {
      const sys = prn[0], prnNum = Number(prn.slice(1));
      const recs = list.map(([rel, ...values]) => ({ rel, eph: GnssOrbit.fromRecord(sys, prnNum, values) }));
      return { prn, sys, kind: recs[0].eph.kind, recs };
    });
    if (!state.sats.length) throw new Error('no satellites');
    const [y, m, d] = data.date.split('-').map(Number);
    state.dayStart = Date.UTC(y, m - 1, d); // 00:00 GPST on the calendar
    state.leap = data.leapSeconds;
    buildTracks(); updateUi();
  }).catch(() => { state.error = true; state.mode = 'teach'; updateUi(); });

  if (window.d3 && window.topojson) {
    fetch(WORLD_URL).then(r => r.json()).then(topo => {
      const obj = topo.objects.countries;
      state.world = {
        countries: topojson.feature(topo, obj).features,
        borders: topojson.mesh(topo, obj, (a, b) => a !== b),
        coast: topojson.mesh(topo, obj, (a, b) => a === b)
      };
      state.earthDirty = true;
    }).catch(() => {});
  }

  buildTeach(); resize(); updateUi();
  requestAnimationFrame(now => { state.last = now; frame(now); });
})();

// Why-GeoTrust steps: draw the progress line across the three beats when the section scrolls into view.
(() => {
  const why = document.querySelector('.why-home');
  if (!why) return;
  new IntersectionObserver((entries, obs) => {
    if (entries[0].isIntersecting) { why.classList.add('is-in'); obs.disconnect(); }
  }, { threshold: 0.3 }).observe(why);
})();
