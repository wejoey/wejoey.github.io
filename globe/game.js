'use strict';

/* =====================================================================
   GLOBE-TROTTEUR — retrouve des villes et des lieux sur un globe 3D.
   Le globe est dessiné « à la main » sur un canvas 2D : projection
   orthographique, découpe des pays sur l'horizon, pas de bibliothèque.
   ===================================================================== */
(function () {
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2, RAD = Math.PI / 180, EARTH = 6371, ROUNDS = 8;

  /* [nom, latitude, longitude, difficulté 1-3, 1 = lieu (sinon ville)] */
  const PLACES = [
    ['Paris', 48.86, 2.35, 1], ['Londres', 51.51, -0.13, 1], ['New York', 40.71, -74.01, 1], ['Tokyo', 35.68, 139.69, 1],
    ['Sydney', -33.87, 151.21, 1], ['Le Caire', 30.04, 31.24, 1], ['Rio de Janeiro', -22.91, -43.17, 1], ['Moscou', 55.76, 37.62, 1],
    ['Pékin', 39.90, 116.41, 1], ['Montréal', 45.50, -73.57, 1], ['Los Angeles', 34.05, -118.24, 1], ['Rome', 41.90, 12.50, 1],
    ['Madrid', 40.42, -3.70, 1], ['Mexico', 19.43, -99.13, 1], ['Le Cap', -33.92, 18.42, 1], ['Bombay', 19.08, 72.88, 1],
    ['Berlin', 52.52, 13.40, 1], ['Québec', 46.81, -71.21, 1], ['Toronto', 43.65, -79.38, 1], ['Vancouver', 49.28, -123.12, 1],
    ['Dubaï', 25.20, 55.27, 1], ['Buenos Aires', -34.60, -58.38, 1], ['Istanbul', 41.01, 28.98, 1], ['Athènes', 37.98, 23.73, 1],
    ['Miami', 25.76, -80.19, 1], ['Singapour', 1.35, 103.82, 1], ['Hong Kong', 22.32, 114.17, 1],
    ['les pyramides de Gizeh', 29.98, 31.13, 1, 1], ['les chutes du Niagara', 43.08, -79.07, 1, 1],

    ['Lima', -12.05, -77.04, 2], ['Nairobi', -1.29, 36.82, 2], ['Bangkok', 13.76, 100.50, 2], ['Séoul', 37.57, 126.98, 2],
    ['Lisbonne', 38.72, -9.14, 2], ['Stockholm', 59.33, 18.07, 2], ['Dakar', 14.72, -17.47, 2], ['Bogota', 4.71, -74.07, 2],
    ['Santiago du Chili', -33.45, -70.67, 2], ['Lagos', 6.52, 3.38, 2], ['Téhéran', 35.69, 51.39, 2], ['Jakarta', -6.21, 106.85, 2],
    ['Reykjavik', 64.15, -21.94, 2], ['La Havane', 23.11, -82.37, 2], ['Marrakech', 31.63, -7.99, 2], ['Chicago', 41.88, -87.63, 2],
    ['San Francisco', 37.77, -122.42, 2], ['Oslo', 59.91, 10.75, 2], ['Dublin', 53.35, -6.26, 2], ['Vienne', 48.21, 16.37, 2],
    ['Varsovie', 52.23, 21.01, 2], ['Kiev', 50.45, 30.52, 2], ['Alger', 36.75, 3.06, 2], ['Johannesburg', -26.20, 28.05, 2],
    ['New Delhi', 28.61, 77.21, 2], ['Shanghai', 31.23, 121.47, 2], ['Manille', 14.60, 120.98, 2], ['Auckland', -36.85, 174.76, 2],
    ['Honolulu', 21.31, -157.86, 2], ['Anchorage', 61.22, -149.90, 2], ['Halifax', 44.65, -63.57, 2], ['Winnipeg', 49.90, -97.14, 2],
    ['Calgary', 51.05, -114.07, 2],
    ['le mont Everest', 27.99, 86.93, 2, 1], ['le Machu Picchu', -13.16, -72.55, 2, 1], ['le Grand Canyon', 36.10, -112.11, 2, 1],
    ['le Kilimandjaro', -3.07, 37.35, 2, 1], ['le Taj Mahal', 27.17, 78.04, 2, 1], ['le mont Fuji', 35.36, 138.73, 2, 1],
    ['le détroit de Gibraltar', 35.97, -5.50, 2, 1], ['le canal de Panama', 9.08, -79.68, 2, 1], ['le mont Blanc', 45.83, 6.87, 2, 1],
    ['le Vésuve', 40.82, 14.43, 2, 1], ['le rocher Percé', 48.52, -64.20, 2, 1],

    ['Oulan-Bator', 47.89, 106.91, 3], ['Antananarivo', -18.88, 47.51, 3], ['Addis-Abeba', 9.03, 38.74, 3], ['Tachkent', 41.30, 69.24, 3],
    ['Katmandou', 27.72, 85.32, 3], ['La Paz', -16.50, -68.15, 3], ['Tombouctou', 16.77, -3.01, 3], ['Perth', -31.95, 115.86, 3],
    ['Vladivostok', 43.12, 131.89, 3], ['Nuuk', 64.18, -51.72, 3], ['Ushuaïa', -54.80, -68.30, 3], ['Kinshasa', -4.44, 15.27, 3],
    ['Hanoï', 21.03, 105.85, 3], ['Karachi', 24.86, 67.01, 3], ['Riyad', 24.71, 46.68, 3], ['Caracas', 10.48, -66.90, 3],
    ['Montevideo', -34.90, -56.16, 3], ['Helsinki', 60.17, 24.94, 3], ['Bucarest', 44.43, 26.10, 3], ['Luanda', -8.84, 13.23, 3],
    ['Dar es Salaam', -6.79, 39.21, 3], ['Colombo', 6.93, 79.86, 3], ['Port Moresby', -9.44, 147.18, 3], ['Yellowknife', 62.45, -114.37, 3],
    ['Iqaluit', 63.75, -68.52, 3], ['Tbilissi', 41.72, 44.83, 3], ['Astana', 51.17, 71.43, 3], ['Khartoum', 15.50, 32.56, 3],
    ['Quito', -0.18, -78.47, 3], ['Darwin', -12.46, 130.84, 3],
    ['l\'île de Pâques', -27.11, -109.35, 3, 1], ['les îles Galápagos', -0.83, -91.13, 3, 1], ['les chutes Victoria', -17.92, 25.86, 3, 1],
    ['Uluru', -25.34, 131.04, 3, 1], ['le cap Horn', -55.98, -67.27, 3, 1], ['le lac Baïkal', 53.5, 108.0, 3, 1],
    ['la mer Morte', 31.5, 35.5, 3, 1], ['Angkor Vat', 13.41, 103.87, 3, 1], ['Pétra', 30.33, 35.44, 3, 1],
    ['les chutes d\'Iguazú', -25.69, -54.44, 3, 1], ['le lac Titicaca', -15.8, -69.4, 3, 1], ['Yellowstone', 44.6, -110.5, 3, 1],
    ['Tahiti', -17.65, -149.43, 3, 1]
  ];
  const TIERS = [1, 1, 1, 2, 2, 2, 3, 3];

  const vec = (lat, lon) => { const p = lat * RAD, l = lon * RAD; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- Décodage de la carte ---------- */
  let maxN = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const countries = WORLD.map(([id, rings]) => {
    const ice = id === 10 || id === 304;   // Antarctique, Groenland
    const color = ice ? 'hsl(200,35%,88%)' : `hsl(${72 + rnd() * 78},${36 + rnd() * 16}%,${40 + rnd() * 14}%)`;
    return {
      color,
      rings: rings.map(flat => {
        const n = flat.length / 2, v = new Float32Array(n * 3), seam = new Uint8Array(n), lon = [], lat = [];
        let x = 0, y = 0;
        for (let i = 0; i < n; i++) {
          x += flat[2 * i]; y += flat[2 * i + 1]; lon.push(x / 20); lat.push(y / 20);
          const p = vec(y / 20, x / 20); v[3 * i] = p[0]; v[3 * i + 1] = p[1]; v[3 * i + 2] = p[2];
        }
        // Coutures artificielles (antiméridien, pôle Sud) : on ne trace pas de frontière dessus.
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          seam[i] = (Math.abs(lon[i]) > 179.9 && Math.abs(lon[j]) > 179.9) || (lat[i] < -89 || lat[j] < -89) ? 1 : 0;
        }
        maxN = Math.max(maxN, n);
        return { n, v, seam };
      })
    };
  });
  const PX = new Float32Array(maxN), PY = new Float32Array(maxN), PZ = new Float32Array(maxN);

  /* Graticule : méridiens et parallèles tous les 30°. */
  const graticule = [];
  for (let lon = -180; lon < 180; lon += 30) { const l = []; for (let lat = -84; lat <= 84; lat += 4) l.push(vec(lat, lon)); graticule.push(l); }
  for (let lat = -60; lat <= 60; lat += 30) { const l = []; for (let lon = -180; lon <= 180; lon += 4) l.push(vec(lat, lon)); graticule.push(l); }

  /* ---------- État ---------- */
  const cv = $('c'), ctx = cv.getContext('2d'), bg = document.createElement('canvas');
  let vw = 0, vh = 0, dpr = 1, cx = 0, cy = 0, R0 = 100;
  let lon0 = -1.2, lat0 = 0.5, zoom = 1, vLon = 0, vLat = 0, cam = null;
  let cl = 1, sl = 0, cp = 1, sp = 0, R = 100;
  let phase = 'menu', round = 0, score = 0, shown = 0, queue = [], place = null;
  let guess = null, truth = null, arcT = 0, pinT = 0, clock = 0, lastPts = 0;
  let best = 0, mute = false;
  try { const sv = JSON.parse(localStorage.getItem('globe-v1') || '{}'); best = sv.best || 0; mute = !!sv.mute; } catch (e) { /* stockage indisponible */ }
  const persist = () => { try { localStorage.setItem('globe-v1', JSON.stringify({ best, mute })); } catch (e) { /* ignore */ } };

  /* ---------- Son (synthétisé) ---------- */
  let ac = null, master = null;
  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC(); master = ac.createGain(); master.gain.value = mute ? 0 : 0.45; master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function tone(f, dur, vol, type, delay, slide) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const sfx = {
    pin() { tone(520, 0.12, 0.2, 'triangle', 0, 260); },
    result(pts) {
      const n = pts >= 900 ? 4 : pts >= 600 ? 3 : pts >= 250 ? 2 : 1, notes = [392, 523.25, 659.25, 783.99];
      if (pts < 100) { tone(220, 0.5, 0.18, 'sine', 0.5, 140); return; }
      for (let i = 0; i < n; i++) { tone(notes[i], 0.5, 0.17, 'triangle', 0.5 + i * 0.1); tone(notes[i] * 2, 0.3, 0.05, 'sine', 0.5 + i * 0.1); }
    },
    end() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.8, 0.15, 'triangle', i * 0.11)); }
  };

  /* ---------- Projection ---------- */
  function setView() { cl = Math.cos(lon0); sl = Math.sin(lon0); cp = Math.cos(lat0); sp = Math.sin(lat0); R = R0 * zoom; }
  // Monde → vue : renvoie [x, y, z] unitaires (z > 0 = face visible).
  function toView(p) {
    const x = p[0] * cl - p[2] * sl, z1 = p[0] * sl + p[2] * cl;
    return [x, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp];
  }
  function fromScreen(px, py) {
    const x = (px - cx) / R, y = -(py - cy) / R, d = x * x + y * y;
    if (d > 0.985) return null;
    const z = Math.sqrt(1 - d), y1 = y * cp + z * sp, z1 = -y * sp + z * cp;
    return [x * cl + z1 * sl, y1, -x * sl + z1 * cl];
  }

  /* ---------- Mise en page ---------- */
  function resize() {
    vw = window.innerWidth; vh = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = bg.width = Math.round(vw * dpr); cv.height = bg.height = Math.round(vh * dpr);
    const top = 118, bottom = 118, avail = Math.max(160, vh - top - bottom);
    R0 = Math.min(vw * 0.46, avail * 0.5); cx = vw / 2; cy = top + avail / 2;
    const g = bg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(vw, vh));
    base.addColorStop(0, '#0b1535'); base.addColorStop(1, '#02030a');
    g.fillStyle = base; g.fillRect(0, 0, vw, vh);
    let s2 = 99; const r = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; };
    for (let i = 0, n = Math.round(vw * vh / 2000); i < n; i++) {
      g.fillStyle = `hsla(${200 + r() * 60},80%,${80 + r() * 20}%,${0.2 + r() * 0.6})`;
      g.beginPath(); g.arc(r() * vw, r() * vh, r() * r() * 1.4 + 0.25, 0, TAU); g.fill();
    }
  }

  /* ---------- Dessin du globe ---------- */
  // Trace un anneau en le découpant proprement sur l'horizon du globe.
  function ringPath(ring, borders) {
    const n = ring.n, v = ring.v;
    let vis = 0;
    for (let i = 0; i < n; i++) {
      const X = v[3 * i], Y = v[3 * i + 1], Z = v[3 * i + 2], x = X * cl - Z * sl, z1 = X * sl + Z * cl;
      PX[i] = x; PY[i] = Y * cp - z1 * sp; PZ[i] = Y * sp + z1 * cp;
      if (PZ[i] > 0) vis++;
    }
    if (!vis) return;
    const sx = i => cx + PX[i] * R, sy = i => cy - PY[i] * R;
    for (let i = 0; i < n; i++) {
      const j = i + 1 === n ? 0 : i + 1;
      if (PZ[i] > 0 && PZ[j] > 0 && !ring.seam[i]) { borders.moveTo(sx(i), sy(i)); borders.lineTo(sx(j), sy(j)); }
    }
    if (vis === n) {
      ctx.moveTo(sx(0), sy(0));
      for (let i = 1; i < n; i++) ctx.lineTo(sx(i), sy(i));
      ctx.closePath(); return;
    }
    let i0 = 0;
    while (!(PZ[i0] > 0 && PZ[(i0 + n - 1) % n] <= 0)) i0++;
    let exitA = 0, firstA = 0;
    const limb = (a, b) => {                 // point de l'horizon entre a (visible) et b (caché)
      const t = PZ[a] / (PZ[a] - PZ[b]), x = PX[a] + t * (PX[b] - PX[a]), y = PY[a] + t * (PY[b] - PY[a]);
      return Math.atan2(-y, x);
    };
    const arcTo = (a0, a1) => { const d = ((a1 - a0) % TAU + TAU) % TAU; ctx.arc(cx, cy, R, a0, a1, d > Math.PI); };
    for (let k = 0; k < n; k++) {
      const i = (i0 + k) % n, p = (i + n - 1) % n;
      if (PZ[i] > 0) {
        if (PZ[p] <= 0) {
          const a = limb(i, p);
          if (k === 0) { firstA = a; ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } else arcTo(exitA, a);
        }
        ctx.lineTo(sx(i), sy(i));
      } else if (PZ[p] > 0) {
        exitA = limb(p, i);
        ctx.lineTo(cx + Math.cos(exitA) * R, cy + Math.sin(exitA) * R);
      }
    }
    arcTo(exitA, firstA); ctx.closePath();
  }

  function polyline(points, upTo) {
    let pen = false;
    const m = upTo === undefined ? points.length : upTo;
    for (let i = 0; i < m; i++) {
      const p = toView(points[i]);
      if (p[2] <= 0) { pen = false; continue; }
      const x = cx + p[0] * R, y = cy - p[1] * R;
      pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true;
    }
  }

  function pin(p, color, t, label) {
    const q = toView(p);
    if (q[2] <= 0.02) return;
    const x = cx + q[0] * R, drop = (1 - Math.min(1, t * 4)) * 40, y = cy - q[1] * R - drop, s = 1 + 0.12 * Math.sin(clock * 5);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + drop, 5, 2.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y + drop, 9 * s + 3, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.strokeStyle = '#06101f'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - 4, y - 9, x - 9, y - 13, x - 9, y - 19);
    ctx.arc(x, y - 19, 9, Math.PI, 0); ctx.bezierCurveTo(x + 9, y - 13, x + 4, y - 9, x, y); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#06101f'; ctx.beginPath(); ctx.arc(x, y - 19, 3.4, 0, TAU); ctx.fill();
    if (label) {
      ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(3,8,20,0.85)'; ctx.strokeText(label, x, y - 34);
      ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - 34);
    }
  }

  function draw() {
    setView();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Atmosphère
    let g = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.22);
    g.addColorStop(0, 'rgba(96,165,250,0.55)'); g.addColorStop(0.35, 'rgba(96,165,250,0.16)'); g.addColorStop(1, 'rgba(96,165,250,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, TAU); ctx.fill();
    // Océan
    g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R);
    g.addColorStop(0, '#3b9ae6'); g.addColorStop(0.6, '#1b62b8'); g.addColorStop(1, '#0c2f73');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.beginPath();
    for (const l of graticule) polyline(l);
    ctx.stroke();
    // Pays
    const borders = new Path2D();
    ctx.lineJoin = 'round';
    for (const c of countries) {
      ctx.beginPath();
      for (const r of c.rings) ringPath(r, borders);
      ctx.fillStyle = c.color; ctx.fill('evenodd');
    }
    ctx.strokeStyle = 'rgba(8,30,50,0.55)'; ctx.lineWidth = zoom > 2 ? 1 : 0.7; ctx.stroke(borders);
    // Ombre et reflet : donnent le volume de la sphère
    g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.2, cx - R * 0.1, cy - R * 0.1, R * 1.25);
    g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(2,6,30,0.28)'); g.addColorStop(1, 'rgba(2,6,30,0.72)');
    ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    // Arc de grand cercle entre la réponse et le bon endroit
    if (phase === 'reveal' && guess && arcT > 0) {
      const om = Math.acos(clamp(dot(guess, truth), -1, 1)), N = 72, pts = [];
      if (om > 1e-4) {
        for (let i = 0; i <= N; i++) {
          const t = i / N, a = Math.sin((1 - t) * om) / Math.sin(om), b = Math.sin(t * om) / Math.sin(om);
          pts.push([a * guess[0] + b * truth[0], a * guess[1] + b * truth[1], a * guess[2] + b * truth[2]]);
        }
        const m = Math.ceil((N + 1) * Math.min(1, arcT));
        ctx.lineCap = 'round'; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -clock * 22;
        ctx.strokeStyle = 'rgba(3,8,20,0.7)'; ctx.lineWidth = 5; ctx.beginPath(); polyline(pts, m); ctx.stroke();
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.5; ctx.beginPath(); polyline(pts, m); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(147,197,253,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    if (guess && phase !== 'menu') pin(guess, '#38bdf8', pinT);
    if (phase === 'reveal' && arcT >= 1) pin(truth, '#facc15', arcT - 1, place[0].replace(/^(les |le |la |l')/, '').replace(/^./, ch => ch.toUpperCase()));
  }

  /* ---------- Boucle ---------- */
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; clock += dt;
    if (cam) {
      const k = 1 - Math.exp(-dt * 4);
      let dl = cam.lon - lon0; dl = ((dl + Math.PI) % TAU + TAU) % TAU - Math.PI;
      lon0 += dl * k; lat0 += (cam.lat - lat0) * k; zoom += (cam.zoom - zoom) * k;
      if (Math.abs(dl) < 1e-3 && Math.abs(cam.lat - lat0) < 1e-3 && Math.abs(cam.zoom - zoom) < 1e-2) cam = null;
    } else if (phase === 'menu') lon0 += dt * 0.12;
    else if (!pointers.size && (Math.abs(vLon) > 1e-4 || Math.abs(vLat) > 1e-4)) {
      lon0 += vLon * dt; lat0 = clamp(lat0 + vLat * dt, -1.45, 1.45);
      const f = Math.pow(0.04, dt); vLon *= f; vLat *= f;
    }
    if (guess) pinT += dt;
    if (phase === 'reveal') arcT += dt * 1.1;
    if (shown !== score) { shown += Math.ceil((score - shown) * Math.min(1, dt * 6)); $('score').textContent = shown + ' pts'; }
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- Déroulement ---------- */
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function newGame() {
    round = 0; score = shown = 0; $('score').textContent = '0 pts'; queue = [];
    const used = new Set();
    for (const t of TIERS) {
      const pool = PLACES.filter(p => p[3] === t && !used.has(p));
      const p = pool[Math.floor(Math.random() * pool.length)]; used.add(p); queue.push(p);
    }
    document.body.classList.remove('menu');
    nextRound();
  }
  function nextRound() {
    place = queue[round]; round++; phase = 'guess'; guess = null; arcT = 0;
    truth = vec(place[1], place[2]);
    $('round').textContent = 'Manche ' + round + '/' + ROUNDS;
    $('q-kind').textContent = !place[4] ? 'Où se trouve la ville de…' : /^les /.test(place[0]) ? 'Où se trouvent…' : 'Où se trouve…';
    $('q-name').textContent = place[0] + ' ?';
    $('question').classList.remove('pop'); void $('question').offsetWidth; $('question').classList.add('pop');
    $('res').textContent = 'Fais tourner le globe et touche l\'endroit.';
    $('ok').textContent = 'Valider'; $('ok').disabled = true;
    cam = { lon: lon0, lat: lat0 * 0.6, zoom: 1 };
  }
  function validate() {
    const om = Math.acos(clamp(dot(guess, truth), -1, 1)), km = Math.round(om * EARTH);
    lastPts = km <= 100 ? 1000 : Math.round(1000 * Math.exp(-(km - 100) / 2000));
    score += lastPts; phase = 'reveal'; arcT = 0;
    // La caméra se place entre les deux points et zoome pour les montrer ensemble.
    let m = [guess[0] + truth[0], guess[1] + truth[1], guess[2] + truth[2]];
    const len = Math.hypot(m[0], m[1], m[2]);
    m = len < 0.3 ? truth : m.map(v => v / len);
    cam = { lon: Math.atan2(m[0], m[2]), lat: clamp(Math.asin(m[1]), -1.3, 1.3), zoom: clamp(0.75 / Math.max(Math.sin(om / 2), 0.15), 1, 5) };
    vLon = vLat = 0;
    const msg = km <= 100 ? 'En plein dans le mille ! 🎯' : km < 500 ? 'Tout près !' : km < 1500 ? 'Pas mal !' : km < 4000 ? 'Un peu loin…' : 'À l\'autre bout du monde ! 🌍';
    $('res').innerHTML = msg + '<br><b>' + fmt(km) + ' km</b> → <b>+' + lastPts + ' pts</b>';
    $('ok').textContent = round === ROUNDS ? 'Voir le résultat' : 'Lieu suivant';
    sfx.result(lastPts);
    if (navigator.vibrate) navigator.vibrate(20);
  }
  function endGame() {
    phase = 'menu'; guess = null; cam = { lon: lon0, lat: 0.35, zoom: 1 };
    const record = score > best; if (record) { best = score; persist(); }
    const rank = score >= 7000 ? 'Capitaine au long cours 🧭' : score >= 5500 ? 'Grand explorateur 🗺️' : score >= 3500 ? 'Voyageur aguerri 🎒' : score >= 1500 ? 'Touriste curieux 📸' : 'Moussaillon égaré 🌊';
    $('o-title').textContent = rank;
    $('o-big').hidden = false; $('o-big').textContent = fmt(score) + ' / ' + fmt(ROUNDS * 1000);
    $('o-text').textContent = record ? 'Nouveau record personnel !' : 'Ton record : ' + fmt(best) + ' points.';
    $('o-go').textContent = 'Rejouer';
    document.body.classList.add('menu'); $('overlay').classList.remove('hidden');
    sfx.end();
  }

  /* ---------- Entrées ---------- */
  const pointers = new Map();
  let tap = null, pinch = null, lastMove = 0;
  cv.addEventListener('pointerdown', e => {
    if (phase === 'menu') return;
    audio(); cam = null;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (pointers.size === 1) { tap = { x: e.clientX, y: e.clientY, t: performance.now() }; vLon = vLat = 0; }
    else { tap = null; const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom }; }
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap = null;
      if (tap) return;
      const now = performance.now(), dt = Math.max(0.008, (now - lastMove) / 1000); lastMove = now;
      const dLon = -dx / R, dLat = dy / R;
      lon0 += dLon; lat0 = clamp(lat0 + dLat, -1.45, 1.45);
      vLon = vLon * 0.5 + dLon / dt * 0.5; vLat = vLat * 0.5 + dLat / dt * 0.5;
    } else if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      zoom = clamp(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, 1, 6);
    }
  });
  const up = e => {
    if (!pointers.delete(e.pointerId)) return;
    pinch = null;
    if (performance.now() - lastMove > 80) vLon = vLat = 0;
    if (tap && e.type === 'pointerup' && phase === 'guess' && performance.now() - tap.t < 500) {
      setView();
      const p = fromScreen(e.clientX, e.clientY);
      if (p) { guess = p; pinT = 0; $('ok').disabled = false; $('res').textContent = 'Touche ailleurs pour déplacer l\'épingle, ou valide.'; sfx.pin(); }
    }
    tap = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { if (phase === 'menu') return; e.preventDefault(); cam = null; zoom = clamp(zoom * Math.exp(-e.deltaY * 0.0015), 1, 6); }, { passive: false });
  const zoomBy = f => () => { cam = { lon: lon0, lat: lat0, zoom: clamp((cam ? cam.zoom : zoom) * f, 1, 6) }; };
  $('zin').addEventListener('click', zoomBy(1.6)); $('zout').addEventListener('click', zoomBy(1 / 1.6));
  $('ok').addEventListener('click', () => {
    audio();
    if (phase === 'guess' && guess) validate();
    else if (phase === 'reveal') round === ROUNDS ? endGame() : nextRound();
  });
  $('o-go').addEventListener('click', () => { audio(); $('overlay').classList.add('hidden'); newGame(); });
  $('mute').addEventListener('click', () => { mute = !mute; persist(); audio(); if (master) master.gain.value = mute ? 0 : 0.45; $('mute').textContent = mute ? '🔇' : '🔊'; });
  $('mute').textContent = mute ? '🔇' : '🔊';
  document.addEventListener('visibilitychange', () => { if (ac) document.hidden ? ac.suspend() : ac.resume(); });
  window.addEventListener('resize', resize);

  document.body.classList.add('menu');
  resize();
  requestAnimationFrame(frame);
})();
