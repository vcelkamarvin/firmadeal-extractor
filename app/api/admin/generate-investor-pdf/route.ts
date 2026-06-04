import { NextRequest, NextResponse } from 'next/server';

// ── Helpers ────────────────────────────────────────────────────────────────────
function genRef() { return `FD-2026-${Math.floor(1000 + Math.random() * 9000)}`; }

function fE(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n), neg = n < 0;
  let s: string;
  if (abs >= 1_000_000) s = `€${(abs / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) s = `€${Math.round(abs / 1000)}k`;
  else s = `€${abs}`;
  return neg ? `–${s}` : s;
}
function fEraw(n: number | null | undefined): string {
  if (n == null) return '—';
  const neg = n < 0;
  const s = `€${Math.abs(n).toLocaleString('de-DE')}`;
  return neg ? `–${s}` : s;
}
function fP(n: number | null | undefined, d = 1): string { return n != null ? `${n.toFixed(d)}%` : '—'; }
function fN(n: number | null | undefined): string { return n != null ? n.toLocaleString('de-DE') : '—'; }
function safe(v: string | null | undefined): string {
  return (v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function clr(n: number | null | undefined): string {
  if (n == null) return '#555';
  return n < 0 ? '#dc2626' : '#1A5C3A';
}
const DAY_DE: Record<string,string> = { Monday:'Montag', Tuesday:'Dienstag', Wednesday:'Mittwoch', Thursday:'Donnerstag', Friday:'Freitag', Saturday:'Samstag', Sunday:'Sonntag' };
function localDay(s: string) { return s.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/,m=>DAY_DE[m]??m); }

// Sector multiples
const MULTS: Record<string,{low:number;mid:number;high:number;label:string}> = {
  restaurant:{low:2.5,mid:3.5,high:4.5,label:'Gastronomie'},
  cafe:{low:2.0,mid:2.8,high:3.5,label:'Café'},
  bakery:{low:1.5,mid:2.2,high:3.0,label:'Bäckerei'},
  bar:{low:2.0,mid:2.8,high:3.5,label:'Bar'},
  lodging:{low:4.0,mid:5.5,high:7.0,label:'Beherbergung'},
  hair_care:{low:1.5,mid:2.0,high:2.5,label:'Friseur'},
  beauty_salon:{low:1.5,mid:2.0,high:2.5,label:'Kosmetik'},
  car_repair:{low:2.5,mid:3.2,high:4.0,label:'Kfz-Service'},
  car_dealer:{low:3.0,mid:4.0,high:5.0,label:'Kraftfahrzeughandel'},
  dentist:{low:3.0,mid:4.0,high:5.0,label:'Zahnarzt'},
  pharmacy:{low:3.5,mid:4.5,high:5.5,label:'Apotheke'},
  supermarket:{low:1.5,mid:2.2,high:3.0,label:'Lebensmittelhandel'},
  hardware_store:{low:2.0,mid:2.8,high:3.5,label:'Fachhandel'},
};
const MD = {low:2.5,mid:3.5,high:4.5,label:'Gewerbebetrieb'};

function anonRegion(r: any): string {
  const cc = r.address_detail?.country_code ?? 'DE';
  const reg = r.region ?? r.address_detail?.bundesland ?? null;
  return reg ? `${reg}, ${cc}` : cc;
}

// ── SVG chart helpers ──────────────────────────────────────────────────────────

// Bar + optional line chart (used for unemployment, seasonality, market dynamics)
function svgBarLine(opts: {
  bars: number[]; bLabels: string[]; bColor?: string;
  line?: number[]; lColor?: string; lLabel?: string;
  y2line?: number[]; y2Color?: string;
  yMax?: number; y2Max?: number;
  w?: number; h?: number; note?: string;
}): string {
  const W = opts.w ?? 540, H = opts.h ?? 130;
  const PAD = { t: 10, b: 30, l: 36, r: opts.line ? 36 : 8 };
  const bw = (W - PAD.l - PAD.r) / opts.bars.length;
  const yMax = opts.yMax ?? Math.max(...opts.bars) * 1.2;
  const y2Max = opts.y2Max ?? (opts.line ? Math.max(...opts.line) * 1.2 : 1);
  const plotH = H - PAD.t - PAD.b;

  function barY(v: number) { return PAD.t + plotH * (1 - v / yMax); }
  function barH(v: number) { return plotH * (v / yMax); }
  function ly(v: number, mx: number) { return PAD.t + plotH * (1 - v / mx); }

  const bColor = opts.bColor ?? '#1A5C3A';
  const lColor = opts.lColor ?? '#f59e0b';

  let bars = opts.bars.map((v, i) => {
    const x = PAD.l + i * bw + bw * 0.1;
    const bw2 = bw * 0.8;
    return `<rect x="${x.toFixed(1)}" y="${barY(v).toFixed(1)}" width="${bw2.toFixed(1)}" height="${barH(v).toFixed(1)}" fill="${bColor}" opacity="0.7"/>`;
  }).join('');

  let lineStr = '';
  if (opts.line && opts.line.length === opts.bars.length) {
    const pts = opts.line.map((v, i) => {
      const x = PAD.l + i * bw + bw / 2;
      return `${x.toFixed(1)},${ly(v, y2Max).toFixed(1)}`;
    }).join(' ');
    lineStr = `<polyline points="${pts}" fill="none" stroke="${lColor}" stroke-width="1.8" stroke-linejoin="round"/>`;
    opts.line.forEach((v, i) => {
      const x = PAD.l + i * bw + bw / 2;
      lineStr += `<circle cx="${x.toFixed(1)}" cy="${ly(v, y2Max).toFixed(1)}" r="2.2" fill="${lColor}"/>`;
    });
  }

  // X labels (show every ~3rd)
  const step = Math.max(1, Math.ceil(opts.bLabels.length / 7));
  let xlabels = opts.bLabels.map((lbl, i) => {
    if (i % step !== 0 && i !== opts.bLabels.length - 1) return '';
    const x = PAD.l + i * bw + bw / 2;
    return `<text x="${x.toFixed(1)}" y="${(H - 4).toFixed(1)}" text-anchor="middle" font-size="8" fill="#888">${safe(lbl)}</text>`;
  }).join('');

  // Y axis ticks
  const ticks = 4;
  let yaxis = '';
  for (let t = 0; t <= ticks; t++) {
    const v = (yMax / ticks) * t;
    const y = barY(v);
    yaxis += `<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${W - PAD.r}" y2="${y.toFixed(1)}" stroke="#e5e5e5" stroke-width="0.5"/>`;
    yaxis += `<text x="${(PAD.l - 3).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="7.5" fill="#aaa">${v.toFixed(1)}%</text>`;
  }
  if (opts.line) {
    for (let t = 0; t <= ticks; t++) {
      const v = (y2Max / ticks) * t;
      const y = ly(v, y2Max);
      yaxis += `<text x="${(W - PAD.r + 3).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="start" font-size="7.5" fill="${lColor}">${Math.round(v)}</text>`;
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:${W}px">${yaxis}${bars}${lineStr}${xlabels}</svg>`;
}

// Area chart for revenue trajectory (Bear/Base/Bull bands)
function svgRevTrajectory(opts: { bear: number[]; base: number[]; bull: number[]; labels: string[] }): string {
  const W = 540, H = 160;
  const PAD = { t: 14, b: 28, l: 52, r: 12 };
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const n = opts.labels.length;
  const allVals = [...opts.bear, ...opts.base, ...opts.bull].filter(v => isFinite(v));
  const yMax = allVals.length ? Math.max(...allVals) * 1.15 : 1;
  const yMin = Math.min(0, ...allVals);
  const yRange = yMax - yMin;

  function px(i: number) { return PAD.l + (i / (n - 1)) * plotW; }
  function py(v: number) { return PAD.t + plotH * (1 - (v - yMin) / yRange); }

  const bullPts  = opts.bull.map((v,i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const bearPts  = opts.bear.map((v,i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const basePts  = opts.base.map((v,i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');

  // Fill band between bear and bull
  const bandPts = opts.bull.map((v,i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ') + ' ' +
    [...opts.bear].reverse().map((v,i) => `${px(n-1-i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');

  // Y axis
  const ticks = 5;
  let axes = '';
  for (let t = 0; t <= ticks; t++) {
    const v = yMin + (yRange / ticks) * t;
    const y = py(v);
    axes += `<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${W-PAD.r}" y2="${y.toFixed(1)}" stroke="#e5e5e5" stroke-width="0.5"/>`;
    axes += `<text x="${(PAD.l-3).toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="7.5" fill="#aaa">${fE(Math.round(v))}</text>`;
  }
  // Zero line
  if (yMin < 0) {
    const y0 = py(0);
    axes += `<line x1="${PAD.l}" y1="${y0.toFixed(1)}" x2="${W-PAD.r}" y2="${y0.toFixed(1)}" stroke="#aaa" stroke-width="1" stroke-dasharray="3,2"/>`;
  }
  const xlabels = opts.labels.map((lbl,i) =>
    `<text x="${px(i).toFixed(1)}" y="${(H-6).toFixed(1)}" text-anchor="middle" font-size="8" fill="#888">${safe(lbl)}</text>`
  ).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:${W}px">
    <defs><linearGradient id="band" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1A5C3A" stop-opacity="0.12"/><stop offset="100%" stop-color="#1A5C3A" stop-opacity="0.02"/></linearGradient></defs>
    ${axes}
    <polygon points="${bandPts}" fill="url(#band)"/>
    <polyline points="${bullPts}" fill="none" stroke="#1A5C3A" stroke-width="1.2" stroke-dasharray="4,2" opacity="0.6"/>
    <polyline points="${bearPts}" fill="none" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="4,2" opacity="0.6"/>
    <polyline points="${basePts}" fill="none" stroke="#1A5C3A" stroke-width="2.2"/>
    ${opts.base.map((v,i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="3" fill="#1A5C3A"/>`).join('')}
    ${xlabels}
  </svg>`;
}

// Horizontal bar (PPP, EBITDA vs benchmark)
function svgHbar(value: number, segments: {label: string; v: number; color: string}[], maxV: number): string {
  const W = 300, H = 36, barH = 14;
  const usedW = W - 80;
  let bars = '';
  let x = 0;
  segments.forEach(seg => {
    const w = (seg.v / maxV) * usedW;
    bars += `<rect x="${x}" y="0" width="${w.toFixed(1)}" height="${barH}" fill="${seg.color}" rx="2"/>`;
    bars += `<text x="${(x + w / 2).toFixed(1)}" y="${(barH + 14).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#555">${safe(seg.label)}</text>`;
    x += w;
  });
  return `<svg viewBox="0 0 ${W} ${H + 20}" width="100%" style="display:block;max-width:${W}px">${bars}</svg>`;
}

// Seasonality bar chart with mean dashed line
function svgSeasonality(buckets: {month: string; normalized: number}[]): string {
  const W = 540, H = 110, PAD = {t:10,b:26,l:8,r:8};
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const n = buckets.length;
  const vals = buckets.map(b => b.normalized);
  const yMax = Math.max(...vals, 1) * 1.2;
  const mean = vals.reduce((a,b) => a+b, 0) / vals.length;
  const bw = plotW / n;

  function py(v: number) { return PAD.t + plotH * (1 - v / yMax); }

  const bars = buckets.map((b, i) => {
    const x = PAD.l + i * bw + bw * 0.1;
    const bw2 = bw * 0.8;
    const h = plotH * (b.normalized / yMax);
    return `<rect x="${x.toFixed(1)}" y="${py(b.normalized).toFixed(1)}" width="${bw2.toFixed(1)}" height="${h.toFixed(1)}" fill="#1A5C3A" opacity="0.7" rx="1"/>
    <text x="${(PAD.l + i * bw + bw/2).toFixed(1)}" y="${(H-4).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#888">${safe(b.month.slice(0,3))}</text>`;
  }).join('');

  const meanY = py(mean);
  const meanLine = `<line x1="${PAD.l}" y1="${meanY.toFixed(1)}" x2="${W-PAD.r}" y2="${meanY.toFixed(1)}" stroke="#888" stroke-width="1" stroke-dasharray="4,3"/>`;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:${W}px">${bars}${meanLine}</svg>`;
}

// Dual-line chart for climate (temp + demand)
function svgClimate(temps: number[], demands: number[], labels: string[]): string {
  const W = 540, H = 130, PAD = {t:12,b:26,l:36,r:36};
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const n = labels.length;
  const tMax = Math.max(...temps) + 5, tMin = Math.min(...temps) - 5;
  const dMax = Math.max(...demands) * 1.15;

  function px(i: number) { return PAD.l + (i / (n - 1)) * plotW; }
  function ptY(v: number) { return PAD.t + plotH * (1 - (v - tMin) / (tMax - tMin)); }
  function pdY(v: number) { return PAD.t + plotH * (1 - v / dMax); }

  const tempPts = temps.map((v,i) => `${px(i).toFixed(1)},${ptY(v).toFixed(1)}`).join(' ');
  const demPts  = demands.map((v,i) => `${px(i).toFixed(1)},${pdY(v).toFixed(1)}`).join(' '  );

  const step = Math.max(1, Math.ceil(n / 7));
  const xlabels = labels.map((lbl,i) => {
    if (i % step !== 0 && i !== n-1) return '';
    return `<text x="${px(i).toFixed(1)}" y="${(H-4).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#888">${safe(lbl)}</text>`;
  }).join('');

  // Y ticks (temperature)
  let axes = '';
  for (let t = 0; t <= 4; t++) {
    const v = tMin + ((tMax - tMin) / 4) * t;
    const y = ptY(v);
    axes += `<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${W-PAD.r}" y2="${y.toFixed(1)}" stroke="#eee" stroke-width="0.5"/>`;
    axes += `<text x="${(PAD.l-3).toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="7" fill="#aaa">${v.toFixed(0)}°</text>`;
  }
  for (let t = 0; t <= 3; t++) {
    const v = (dMax / 3) * t;
    const y = pdY(v);
    axes += `<text x="${(W-PAD.r+3).toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="start" font-size="7" fill="#1A5C3A">${Math.round(v)}</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:${W}px">
    ${axes}
    <polyline points="${tempPts}" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linejoin="round"/>
    <polyline points="${demPts}"  fill="none" stroke="#1A5C3A" stroke-width="1.8" stroke-linejoin="round"/>
    ${xlabels}
    <circle cx="${(W-PAD.r-60).toFixed(1)}" cy="8" r="4" fill="#f59e0b"/><text x="${(W-PAD.r-53).toFixed(1)}" y="11" font-size="7" fill="#888">Temp.</text>
    <circle cx="${(W-PAD.r-20).toFixed(1)}" cy="8" r="4" fill="#1A5C3A"/><text x="${(W-PAD.r-13).toFixed(1)}" y="11" font-size="7" fill="#888">Nachfrage</text>
  </svg>`;
}

// Radar chart (area overview)
function svgRadar(points: {metric:string;target:number;market:number;fullMark:number}[]): string {
  const W = 200, CX = 100, CY = 100, R = 75;
  const n = points.length;
  function pt(i: number, r: number) {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
  }
  const levels = [0.25, 0.5, 0.75, 1.0];
  let grid = levels.map(l => {
    const pts2 = Array.from({length:n},(_,i)=>pt(i,R*l)).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return `<polygon points="${pts2}" fill="none" stroke="#ddd" stroke-width="0.5"/>`;
  }).join('');
  const spokes = Array.from({length:n},(_,i)=>{
    const p = pt(i,R);
    return `<line x1="${CX}" y1="${CY}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#ddd" stroke-width="0.5"/>`;
  }).join('');
  function polyPath(key: 'target'|'market') {
    return points.map((p,i) => {
      const r = R * (p[key] / p.fullMark);
      const {x,y} = pt(i,r);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
  const labels = points.map((p,i) => {
    const {x,y} = pt(i, R+12);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="7" fill="#666">${safe(p.metric.replace(' ','&#10;'))}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${W}" width="100%" style="display:block;max-width:${W}px">
    ${grid}${spokes}
    <polygon points="${polyPath('market')}" fill="rgba(26,92,58,0.1)" stroke="#1A5C3A" stroke-width="1.2"/>
    <polygon points="${polyPath('target')}" fill="rgba(245,158,11,0.1)" stroke="#f59e0b" stroke-width="1.2"/>
    ${labels}
    <circle cx="18" cy="${W-10}" r="4" fill="#f59e0b"/><text x="24" y="${W-7}" font-size="7" fill="#666">Betrieb</text>
    <circle cx="70" cy="${W-10}" r="4" fill="#1A5C3A"/><text x="76" y="${W-7}" font-size="7" fill="#666">Markt</text>
  </svg>`;
}

// ── CSS ────────────────────────────────────────────────────────────────────────
function css(): string { return `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;background:#f5f5f5;color:#111;line-height:1.55;padding:24px}
.wrap{max-width:900px;margin:0 auto}
.pbar{display:flex;justify-content:flex-end;margin-bottom:20px;gap:10px}
.pbtn{background:#1A5C3A;color:#fff;border:none;cursor:pointer;font-family:inherit;font-size:.78rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:10px 24px;border-radius:8px}
.pbtn:hover{background:#155030}
/* cards */
.card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:24px 26px;margin-bottom:18px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
/* section header */
.sec-title{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:14px;margin-top:2px}
/* data grid */
.dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:14px}
.dcell{background:#f8f8f8;border:1px solid rgba(0,0,0,.07);border-radius:6px;padding:10px 12px}
.dcell-l{font-size:.62rem;text-transform:uppercase;letter-spacing:.07em;color:#999;margin-bottom:4px}
.dcell-v{font-size:.88rem;font-weight:700;color:#111;font-variant-numeric:tabular-nums}
/* table */
table.t{width:100%;border-collapse:collapse;font-size:.82rem;font-variant-numeric:tabular-nums;margin-bottom:12px}
table.t th{text-align:right;padding:7px 10px;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:#999;background:#f8f8f8;border-bottom:2px solid rgba(0,0,0,.08)}
table.t th:first-child{text-align:left}
table.t td{padding:7px 10px;text-align:right;color:#666;border-bottom:1px solid rgba(0,0,0,.05)}
table.t td.l{text-align:left;font-weight:600;color:#111}
table.t td.l2{text-align:left;padding-left:20px;color:#888}
table.t td.m{font-weight:700;color:#111}
table.t td.pos{color:#1A5C3A;font-weight:700}
table.t td.neg{color:#dc2626;font-weight:700}
table.t tr.tot td{background:#f0fdf4;font-weight:700;color:#111}
table.t tr.sp td{height:4px;border-bottom:2px solid rgba(0,0,0,.08)}
table.t tr.alt td{background:#f8f8f8}
/* two col */
.tc2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
/* KV row */
.kvr{display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.05);font-size:.82rem}
.kvr:last-child{border-bottom:none}
.kvk{color:#666}.kvv{font-weight:600;color:#111;text-align:right}
/* risk item */
.ri{display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-radius:7px;margin-bottom:6px}
.ri.fail{background:#fef2f2;border:1px solid rgba(220,38,38,.15)}
.ri.pass{background:#f0fdf4;border:1px solid rgba(22,163,74,.15)}
.ri.warn{background:#fffbeb;border:1px solid rgba(245,158,11,.2)}
.ri.info{background:#f8f8f8;border:1px solid rgba(0,0,0,.08)}
.ri-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:4px}
.ri-dot.fail{background:#dc2626}.ri-dot.pass{background:#1A5C3A}.ri-dot.warn{background:#f59e0b}.ri-dot.info{background:#888}
.ri-body .ri-l{font-size:.79rem;font-weight:700;color:#111;margin-bottom:1px}
.ri-body .ri-n{font-size:.75rem;color:#666;line-height:1.5}
/* badge */
.badge{display:inline-flex;align-items:center;gap:6px;font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;border-radius:12px}
.badge.green{background:#e8f5ee;color:#1A5C3A;border:1px solid rgba(26,92,58,.2)}
.badge.red{background:#fef2f2;color:#dc2626;border:1px solid rgba(220,38,38,.2)}
.badge.amber{background:#fffbeb;color:#b45309;border:1px solid rgba(180,83,9,.2)}
/* big number */
.bignum{font-size:2.2rem;font-weight:900;letter-spacing:-.03em;line-height:1;margin-bottom:4px}
/* text prose */
.prose{font-size:.82rem;color:#666;line-height:1.75;margin-bottom:12px}
/* chips */
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.chip{font-size:.72rem;font-weight:600;padding:4px 10px;border-radius:20px}
.chip.ok{background:#e8f5ee;border:1px solid rgba(26,92,58,.2);color:#1A5C3A}
.chip.no{background:#fef2f2;border:1px solid rgba(220,38,38,.15);color:#dc2626}
/* review */
.rev{padding:10px 14px;border-left:3px solid #1A5C3A;background:#f8f8f8;border-radius:0 7px 7px 0;margin-bottom:8px}
.rev-meta{font-size:.75rem;color:#888;margin-bottom:3px}
.rev-stars{color:#f59e0b;font-weight:700;font-size:.8rem;margin-bottom:2px}
.rev-text{font-size:.81rem;color:#555;font-style:italic}
/* header */
.page-header{background:#111;border-radius:14px;padding:28px 32px;margin-bottom:20px;position:relative;overflow:hidden}
.page-header::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(26,92,58,.12) 0%,transparent 60%);pointer-events:none}
.ph-eyebrow{font-size:.65rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#1db954;margin-bottom:8px}
.ph-title{font-size:1.9rem;font-weight:900;letter-spacing:-.04em;color:#fff;margin-bottom:6px}
.ph-title span{color:#1db954}
.ph-sub{font-size:.82rem;color:rgba(255,255,255,.45)}
.ph-meta{display:flex;flex-wrap:wrap;gap:20px;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1)}
.ph-meta-item{font-size:.7rem;color:rgba(255,255,255,.38)}.ph-meta-item strong{color:rgba(255,255,255,.7);font-weight:600}
/* page break */
.pg-break{page-break-after:always;break-after:page}
/* footer */
.pg-footer{text-align:center;margin-top:24px;font-size:.65rem;color:#aaa;letter-spacing:.06em;text-transform:uppercase}
.pg-footer strong{color:#1A5C3A}
/* CTA */
.cta{background:#111;border-radius:14px;padding:30px 36px;text-align:center;margin-top:20px}
.cta h2{font-size:1.1rem;font-weight:900;color:#fff;margin-bottom:6px}
.cta p{font-size:.82rem;color:rgba(255,255,255,.5);margin-bottom:20px;max-width:480px;margin-left:auto;margin-right:auto}
.cta a{display:inline-block;background:#1A5C3A;color:#fff;font-weight:700;font-size:.82rem;padding:12px 30px;border-radius:8px;text-decoration:none;letter-spacing:.03em}
.discl{margin-top:14px;font-size:.67rem;color:#aaa;line-height:1.7;padding:10px 14px;border:1px solid rgba(0,0,0,.08);border-radius:7px;background:#f8f8f8}
@media print{
  body{background:#fff;padding:0}
  .pbar{display:none!important}
  .wrap{max-width:100%}
  .card{break-inside:avoid}
  .pg-break{page-break-after:always}
}
@media(max-width:680px){.tc2{grid-template-columns:1fr}.dgrid{grid-template-columns:repeat(2,1fr)}}
`; }

// ── Render ─────────────────────────────────────────────────────────────────────
function renderReport(r: any, ref: string): string {
  const pl   = r.synthetic_pl;
  const ra   = r.review_analysis;
  const sk   = r.sentiment_keywords;
  const h    = r.opening_hours;
  const mac  = r.macro_data;
  const lf   = r.labor_friction;
  const dv   = r.digital_vulnerability;
  const ev   = r.energy_vulnerability;
  const dem  = r.city_demographics;
  const lm   = r.labor_market;
  const kfw  = r.kfw_eligibility;
  const sp   = r.seasonality_profile;
  const am   = r.area_metrics;
  const pp   = r.pricing_power;
  const eco  = r.industry_economics;
  const sc   = r.spatial_context;
  const cd   = r.climate_data;
  const mt:  any[] = r.market_timeline ?? [];
  const comps: any[] = r.competitors ?? [];
  const revs:  any[] = r.reviews ?? [];
  const radar: any[] = r.radar_data ?? [];

  const types: string[] = r.types ?? [];
  const pt = types.find((t:string) => MULTS[t]) ?? types[0] ?? 'restaurant';
  const mult = MULTS[pt] ?? MD;
  const region = anonRegion(r);
  const subname = `${mult.label} · ${region}`;

  const gm = pl?.gross_margin_pct ?? 12;
  const eLow  = pl?.ebitda?.low  ?? 0;
  const eBase = pl?.ebitda?.mid  ?? 0;
  const eHigh = pl?.ebitda?.high ?? 0;
  const rLow  = pl?.revenue?.low  ?? 0;
  const rBase = pl?.revenue?.mid  ?? 0;
  const rHigh = pl?.revenue?.high ?? 0;
  const isTurnaround = eBase < 0;

  // Anonymised competitors
  const letters = ['A','B','C','D','E','F','G','H'];
  const aComps = comps.slice(0,8).map((c:any, i:number) => ({
    label: `Wettbewerber ${letters[i]}`, rating: c.rating, reviews: c.review_volume,
    website: c.url ? 'Website →' : '—', dist: c.distance, status: c.business_status
  }));

  // ── Section: Industrie-Ökonomie ──────────────────────────────────────────────
  const secIndustry = eco ? `
  <div class="card">
    <div class="sec-title">Industrie-Ökonomie — ${safe(eco.industry_label)}</div>
    <div class="dgrid">
      <div class="dcell"><div class="dcell-l">EBITDA-Multiple</div><div class="dcell-v">${eco.ebitda_multiple.low}× – ${eco.ebitda_multiple.mid}× – ${eco.ebitda_multiple.high}×</div></div>
      ${eco.avg_margin_pct != null ? `<div class="dcell"><div class="dcell-l">Ø EBITDA-Marge</div><div class="dcell-v">${eco.avg_margin_pct}%</div></div>` : ''}
      ${eco.market_size_de_bn != null ? `<div class="dcell"><div class="dcell-l">Marktgröße (DE)</div><div class="dcell-v">—</div></div>` : ''}
      ${eco.cagr_5y_pct != null ? `<div class="dcell"><div class="dcell-l">5J CAGR</div><div class="dcell-v">${eco.cagr_5y_pct}%</div></div>` : ''}
    </div>
    <p class="prose">${safe(eco.trend_summary)}</p>
    <div class="tc2" style="margin-bottom:14px">
      ${eco.structural_margins ? `<div><div style="font-size:.68rem;font-weight:700;color:#1A5C3A;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Strukturelle Margen</div><p class="prose">${safe(eco.structural_margins)}</p></div>` : ''}
      ${eco.model_mechanics ? `<div><div style="font-size:.68rem;font-weight:700;color:#1A5C3A;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Geschäftsmodell-Mechanik</div><p class="prose">${safe(eco.model_mechanics)}</p></div>` : ''}
    </div>
    ${eco.failure_rate_note ? `<div style="font-size:.68rem;font-weight:700;color:#1A5C3A;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Ausfallquote & Risiko</div><p class="prose">${safe(eco.failure_rate_note)}</p>` : ''}
    ${eco.yearly?.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;margin-top:12px">
      ${eco.yearly.map((y:any) => `<div class="dcell"><div class="dcell-l">${y.year}</div><div style="font-size:.75rem;color:#555;line-height:1.4">${safe(y.context)}</div></div>`).join('')}
    </div>` : ''}
  </div>` : '';

  // ── Section: Geschäftsmodell & Kostentreiber ─────────────────────────────────
  const dm = pl?.dependency_matrix;
  const sevColor: Record<string,string> = {critical:'#dc2626',high:'#b45309',medium:'#1A5C3A',low:'#555'};
  const secDrivers = dm ? `
  <div class="card">
    <div class="sec-title">Geschäftsmodell & Kostentreiber</div>
    ${dm.business_model_summary ? `<div class="kvr"><span class="kvk">Geschäftsmodell</span><span class="kvv" style="max-width:65%;text-align:right;font-size:.8rem">${safe(dm.business_model_summary)}</span></div>` : ''}
    ${dm.primary_leverage ? `<div class="kvr"><span class="kvk">Primärer Hebel</span><span class="kvv" style="max-width:65%;text-align:right;font-size:.8rem">${safe(dm.primary_leverage)}</span></div>` : ''}
    <div style="margin-top:14px">
      ${(dm.drivers ?? []).map((d:any) => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:.79rem;font-weight:700;color:#111">${safe(d.name)}</span>
          <span style="display:flex;gap:10px;align-items:center">
            <span style="font-size:.67rem;font-weight:700;text-transform:uppercase;color:${sevColor[d.severity]??'#555'}">${safe(d.severity)}</span>
            <span style="font-size:.79rem;color:#888">${d.trend==='worsening'?'↑ verschlechternd':d.trend==='improving'?'↓ verbessernd':'→ stabil'}</span>
            <span style="font-size:.79rem;font-weight:700;color:#dc2626">${d.ebitda_impact_pct?.toFixed(1)}pp</span>
          </span>
        </div>
        <p style="font-size:.77rem;color:#666;line-height:1.6">${safe(d.description)}</p>
      </div>`).join('')}
      ${dm.net_ebitda_drag_pct != null ? `<div style="margin-top:8px;font-size:.8rem;font-weight:700;color:#555">Gesamte EBITDA-Belastung durch Strukturrisiken: <span style="color:#dc2626">${dm.net_ebitda_drag_pct.toFixed(1)}pp</span></div>` : ''}
    </div>
  </div>` : '';

  // ── Section: Regionale Makroökonomie ────────────────────────────────────────
  const unempHist: any[] = mac?.unemployment_history ?? [];
  const unempBars  = unempHist.map((u:any) => u.rate ?? 0);
  const unempLbls  = unempHist.map((u:any) => (u.month ?? '').replace(' ','&#10;').slice(0,6));
  // Synthetic demand line from market_timeline (normalize to 0-130)
  const demLine = mt.slice(0, unempBars.length).map((p:any) => (p.trends_index ?? 50));
  const unempChart = unempBars.length >= 3 ? svgBarLine({
    bars: unempBars, bLabels: unempLbls, bColor: '#1A5C3A',
    line: demLine.length === unempBars.length ? demLine : undefined,
    lColor: '#f59e0b',
    yMax: Math.max(...unempBars) * 1.4,
    y2Max: 130,
  }) : '';

  // PPP chart
  const pppVal  = mac?.ppp_index ?? 50;
  const pppChart = `
    <div style="position:relative;height:18px;background:#f0f0f0;border-radius:4px;overflow:hidden;margin:8px 0 4px">
      <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(pppVal,100)}%;background:#1A5C3A;border-radius:4px;opacity:.7"></div>
      <div style="position:absolute;left:${Math.min(100,100)}%;top:0;height:100%;width:2px;background:#888"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:.7rem;color:#888;margin-bottom:10px">
      <span>${pppVal}</span><span>Nationalschnitt 100</span>
    </div>`;

  const secMacro = `
  <div class="card">
    <div class="sec-title">Regionale Makroökonomie</div>
    <div class="tc2">
      <div>
        <div style="text-align:center;margin-bottom:14px">
          <div class="bignum" style="color:#1A5C3A">${lf?.index ?? '—'}</div>
          <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:6px">Labor Friction Index</div>
          ${lf?.interpretation ? `<p class="prose" style="font-size:.77rem;text-align:left">${safe(lf.interpretation)}</p>` : ''}
        </div>
        <div class="dgrid">
          ${mac?.unemployment_pct != null ? `<div class="dcell"><div class="dcell-l">Lokale Arbeitslosigkeit</div><div class="dcell-v">${fP(mac.unemployment_pct)}</div></div>` : ''}
          ${mac?.national_avg_unemployment != null ? `<div class="dcell"><div class="dcell-l">National Ø</div><div class="dcell-v">${fP(mac.national_avg_unemployment)}</div></div>` : ''}
          ${lf?.wage_pressure_flag != null ? `<div class="dcell"><div class="dcell-l">Lohndruck</div><div class="dcell-v" style="color:${lf.wage_pressure_flag?'#b45309':'#1A5C3A'}">${lf.wage_pressure_flag?'Erhöht':'Normal'}</div></div>` : ''}
          ${mac?.bundesland ? `<div class="dcell"><div class="dcell-l">Bundesland/Region</div><div class="dcell-v">${safe(mac.bundesland)}</div></div>` : ''}
          ${mac?.median_gross_wage != null ? `<div class="dcell"><div class="dcell-l">Medianlohn brutto</div><div class="dcell-v">${fE(mac.median_gross_wage)} p.a.</div></div>` : ''}
          ${mac?.commercial_rent_per_sqm != null ? `<div class="dcell"><div class="dcell-l">Gewerbermiete</div><div class="dcell-v">${fE(mac.commercial_rent_per_sqm)}/m²/Mo.</div></div>` : ''}
          ${mac?.ppp_index != null ? `<div class="dcell"><div class="dcell-l">PPP-Index</div><div class="dcell-v">${mac.ppp_index.toFixed(1)}</div></div>` : ''}
        </div>
        ${mac?.ppp_index != null ? `<div class="sec-title" style="margin-top:10px">Kaufkraft vs. Nationalschnitt (100)</div>${pppChart}` : ''}
      </div>
      <div>
        ${unempChart ? `<div class="sec-title">Regionale Arbeitslosenquote (Jan 2023 – Dez 2024)</div>${unempChart}<p class="prose" style="font-size:.71rem;margin-top:6px">Nachfrageindex (rechte Achse) — normierter Branchensuchtrend. Quelle: ${safe(mac?.data_source ?? 'ČSÚ / MPO 2024')}.</p>` : ''}
      </div>
    </div>
  </div>`;

  // ── Section: Synthetische GuV ────────────────────────────────────────────────
  const cogsL  = Math.round(rLow  * (1 - gm/100));
  const cogsB  = Math.round(rBase * (1 - gm/100));
  const cogsH  = Math.round(rHigh * (1 - gm/100));
  const gpL    = pl?.gross_profit?.low  ?? Math.round(rLow  * gm/100);
  const gpB    = pl?.gross_profit?.mid  ?? Math.round(rBase * gm/100);
  const gpH    = pl?.gross_profit?.high ?? Math.round(rHigh * gm/100);
  const opL    = pl?.other_opex?.low  ?? Math.round(rLow  * .08);
  const opB    = pl?.other_opex?.mid  ?? Math.round(rBase * .08);
  const opH    = pl?.other_opex?.high ?? Math.round(rHigh * .08);
  const persCost = pl?.personnel_cost ?? 0;
  const facCost  = pl?.facility_cost  ?? 0;
  const facSqm   = pl?.facility_sqm   ?? 0;
  const fte      = pl?.fte_estimate   ?? 0;
  const emL = rLow  > 0 ? (eLow  / rLow  * 100).toFixed(1) : '—';
  const emB = rBase > 0 ? (eBase / rBase * 100).toFixed(1) : '—';
  const emH = rHigh > 0 ? (eHigh / rHigh * 100).toFixed(1) : '—';

  // Revenue trajectory chart (Y0-Y5)
  const growth = {bear: .02, base: .05, bull: .12};
  const trajLabels = ['J0','J+1','J+2','J+3','J+4','J+5'];
  const traj = {
    bear:  trajLabels.map((_,i) => Math.round(rBase * Math.pow(1+growth.bear,i))),
    base:  trajLabels.map((_,i) => Math.round(rBase * Math.pow(1+growth.base,i))),
    bull:  trajLabels.map((_,i) => Math.round(rBase * Math.pow(1+growth.bull,i))),
  };
  const trajChart = svgRevTrajectory({...traj, labels: trajLabels});

  // EBITDA vs benchmark bar
  const benchAvg = eco?.avg_margin_pct ?? 12;
  const emBnum = parseFloat(emB as string) || 0;
  const benchMin = Math.min(-15, emBnum - 2), benchMax = Math.max(15, benchAvg + 2);
  const benchRange = benchMax - benchMin;
  const ebitdaBenchChart = `
  <div style="position:relative;height:24px;background:#f0f0f0;border-radius:4px;overflow:hidden;margin:8px 0 4px">
    <div style="position:absolute;left:${((benchAvg-benchMin)/benchRange*100).toFixed(1)}%;top:0;width:2px;height:100%;background:#888"></div>
    <div style="position:absolute;left:${((Math.max(benchMin,emBnum)-benchMin)/benchRange*100).toFixed(1)}%;top:4px;width:8px;height:16px;background:${emBnum<0?'#dc2626':'#1A5C3A'};border-radius:2px"></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:.69rem;color:#888;margin-bottom:8px">
    <span>${benchMin}%</span><span>Sektor Ø ${benchAvg}%</span><span>${benchMax}%</span>
  </div>`;

  const secPL = `
  <div class="card">
    <div class="sec-title">Synthetische GuV — Probabilistische Schätzung</div>
    <div class="dgrid">
      <div class="dcell"><div class="dcell-l">Est. Alter</div><div class="dcell-v">${pl?.estimated_age_years ?? '—'}J</div></div>
      <div class="dcell"><div class="dcell-l">FTE</div><div class="dcell-v">${fte}</div></div>
      <div class="dcell"><div class="dcell-l">Ø Bon</div><div class="dcell-v">${fE(pl?.adjusted_basket_eur)}</div></div>
      <div class="dcell"><div class="dcell-l">Capture Rate</div><div class="dcell-v" style="font-size:.77rem">${pl?.capture_rate_pessimistic ?? '—'}% – ${pl?.capture_rate_expected ?? '—'}% – ${pl?.capture_rate_optimistic ?? '—'}%</div></div>
      <div class="dcell"><div class="dcell-l">Bruttomarge</div><div class="dcell-v">${gm}%</div></div>
    </div>
    <div class="sec-title">5-Jahres Probabilistische Umsatzentwicklung</div>
    ${trajChart}
    <div style="display:flex;gap:20px;margin:10px 0 16px;font-size:.77rem;color:#888;flex-wrap:wrap">
      <span style="color:#dc2626">Bear ${fE(rLow)}</span>
      <span>|</span>
      <span>Base ${fE(rBase)}</span>
      <span>|</span>
      <span style="color:#1A5C3A">Bull ${fE(rHigh)}</span>
    </div>
    <table class="t">
      <thead><tr><th>Position</th><th>Bear</th><th>Base</th><th>Bull</th></tr></thead>
      <tbody>
        <tr><td class="l">Umsatz</td><td>${fE(rLow)}</td><td class="m">${fE(rBase)}</td><td>${fE(rHigh)}</td></tr>
        <tr><td class="l2">COGS (${(100-gm)}%)</td>
          <td class="neg">${fEraw(-cogsL)}</td><td class="neg m">${fEraw(-cogsB)}</td><td class="neg">${fEraw(-cogsH)}</td></tr>
        <tr class="tot"><td class="l">Rohertrag (${gm}%)</td><td>${fE(gpL)}</td><td class="m">${fE(gpB)}</td><td>${fE(gpH)}</td></tr>
        <tr><td class="l2">Personal — ${fte} FTE</td>
          <td class="neg">${fEraw(-persCost)}</td><td class="neg m">${fEraw(-persCost)}</td><td class="neg">${fEraw(-persCost)}</td></tr>
        <tr><td class="l2">Miete — ${facSqm}m²</td>
          <td class="neg">${fEraw(-facCost)}</td><td class="neg m">${fEraw(-facCost)}</td><td class="neg">${fEraw(-facCost)}</td></tr>
        <tr><td class="l2">Sonstige OpEx (8% var.)</td>
          <td class="neg">${fEraw(-opL)}</td><td class="neg m">${fEraw(-opB)}</td><td class="neg">${fEraw(-opH)}</td></tr>
        <tr class="sp"><td colspan="4"></td></tr>
        <tr class="tot"><td class="l">EBITDA</td>
          <td class="${eLow<0?'neg':'pos'}">${fE(eLow)}</td>
          <td class="${eBase<0?'neg':'pos'} m">${fE(eBase)}</td>
          <td class="${eHigh<0?'neg':'pos'}">${fE(eHigh)}</td></tr>
        <tr><td class="l">Umsatz-Bandbreite</td><td>${fE(rLow)}</td><td class="m">${fE(rBase)}</td><td>${fE(rHigh)}</td></tr>
        <tr><td class="l">EBITDA-Bandbreite</td>
          <td class="${eLow<0?'neg':'pos'}">${fE(eLow)}</td>
          <td class="${eBase<0?'neg':'pos'} m">${fE(eBase)}</td>
          <td class="${eHigh<0?'neg':'pos'}">${fE(eHigh)}</td></tr>
        <tr><td class="l">EBITDA-Marge</td>
          <td class="${parseFloat(emL as string)<0?'neg':'pos'}">${emL}%</td>
          <td class="${parseFloat(emB as string)<0?'neg':'pos'} m">${emB}%</td>
          <td class="${parseFloat(emH as string)<0?'neg':'pos'}">${emH}%</td></tr>
      </tbody>
    </table>
    ${ebitdaBenchChart}
    <div class="dgrid" style="margin-top:12px">
      ${pl?.revenue_per_employee != null ? `<div class="dcell"><div class="dcell-l">Umsatz/MA</div><div class="dcell-v">${fE(pl.revenue_per_employee)}</div></div>` : ''}
      ${pl?.sanity_check?.rev_per_employee_benchmark != null ? `<div class="dcell"><div class="dcell-l">Benchmark FTE</div><div class="dcell-v">${fE(pl.sanity_check.rev_per_employee_benchmark)}</div></div>` : ''}
      ${pl?.sanity_check?.ratio != null ? `<div class="dcell"><div class="dcell-l">Verhältnis</div><div class="dcell-v">${pl.sanity_check.ratio.toFixed(2)}×</div></div>` : ''}
      ${pl?.rent_as_revenue_pct != null ? `<div class="dcell"><div class="dcell-l">Miete/Umsatz</div><div class="dcell-v">${pl.rent_as_revenue_pct.toFixed(1)}%</div></div>` : ''}
      ${pl?.personnel_as_revenue_pct != null ? `<div class="dcell"><div class="dcell-l">Personal/Umsatz</div><div class="dcell-v">${pl.personnel_as_revenue_pct.toFixed(1)}%</div></div>` : ''}
      ${pl?.fixed_cost_ratio != null ? `<div class="dcell"><div class="dcell-l">Fixkostenquote</div><div class="dcell-v" style="color:${pl.fixed_cost_ratio>80?'#dc2626':pl.fixed_cost_ratio>65?'#b45309':'#1A5C3A'}">${pl.fixed_cost_ratio}% des Rohertrags</div></div>` : ''}
      ${pl?.breakeven_revenue != null ? `<div class="dcell"><div class="dcell-l">Break-even</div><div class="dcell-v">${fE(pl.breakeven_revenue)}</div></div>` : ''}
      ${pl?.total_fixed_costs != null ? `<div class="dcell"><div class="dcell-l">Fixkosten gesamt</div><div class="dcell-v">${fE(pl.total_fixed_costs)}</div></div>` : ''}
    </div>
    ${pl?.risk_summary ? `<p class="prose" style="margin-top:12px">${safe(pl.risk_summary)}</p>` : ''}
    ${isTurnaround && pl?.floor_adjustment_note ? `<div class="ri pass"><div class="ri-dot pass"></div><div class="ri-body"><div class="ri-l">Operativer Boden angewendet</div><div class="ri-n">${safe(pl.floor_adjustment_note)}</div></div></div>` : ''}
  </div>`;

  // ── Section: Area Overview ───────────────────────────────────────────────────
  const radarChart2 = radar.length >= 3 ? svgRadar(radar) : '';
  const secArea = am ? `
  <div class="card">
    <div class="sec-title">Umgebungsanalyse — 500m–1km Radius</div>
    <div class="tc2">
      <div>
        <div style="text-align:center;margin-bottom:14px">
          <div class="bignum" style="color:#1A5C3A">${am.quality_index}</div>
          <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888">Area Quality Index</div>
        </div>
        <div class="dgrid">
          ${am.avg_rating_area != null ? `<div class="dcell"><div class="dcell-l">Ø Bewertung Umgebung</div><div class="dcell-v">★ ${am.avg_rating_area.toFixed(1)}</div></div>` : ''}
          ${am.operational_pct != null ? `<div class="dcell"><div class="dcell-l">Betriebsstatus</div><div class="dcell-v">${am.operational_pct}%</div></div>` : ''}
          ${am.businesses_count != null ? `<div class="dcell"><div class="dcell-l">Betriebe (1km)</div><div class="dcell-v">${am.businesses_count}</div></div>` : ''}
          ${am.total_area_reviews != null ? `<div class="dcell"><div class="dcell-l">Reviews gesamt</div><div class="dcell-v">${fN(am.total_area_reviews)}</div></div>` : ''}
        </div>
      </div>
      <div style="display:flex;justify-content:center;align-items:center">${radarChart2}</div>
    </div>
  </div>` : '';

  // ── Section: KfW ────────────────────────────────────────────────────────────
  const kfwRules = kfw ? [
    {label:'Regel A — Geografie: Deutsches Unternehmen (Ländercode DE)', pass: kfw.country_check},
    {label:'Regel B — KMU-Schwellenwerte: Umsatz < €50M · FTE < 250', pass: kfw.sme_check},
    {label:'Regel C — Branche: Keine Einschränkungen (Glücksspiel, Tabak, Rüstung)', pass: kfw.industry_check},
  ] : [];
  const secKfw = kfw ? `
  <div class="card">
    <div class="sec-title">KfW Akquisitionsfinanzierung — Förderfähigkeit</div>
    <div class="tc2">
      <div>
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:2.5rem;margin-bottom:4px">${kfw.eligible ? '✅' : '❌'}</div>
          <div style="font-size:.95rem;font-weight:800;color:${kfw.eligible?'#1A5C3A':'#dc2626'}">${kfw.eligible ? 'Förderfähig' : 'Nicht förderfähig'}</div>
          <div style="font-size:.75rem;color:#888;margin-top:2px">${safe(kfw.program ?? 'KfW-Förderprüfung')}</div>
        </div>
        <div class="dgrid">
          ${kfw.revenue_mid_eur != null ? `<div class="dcell"><div class="dcell-l">Basisumsatz</div><div class="dcell-v">${fE(kfw.revenue_mid_eur)}</div></div>` : ''}
          ${kfw.fte_estimate != null ? `<div class="dcell"><div class="dcell-l">FTE-Schätzung</div><div class="dcell-v">${kfw.fte_estimate}</div></div>` : ''}
          ${kfw.estimated_age_years != null ? `<div class="dcell"><div class="dcell-l">Unternehmensalter</div><div class="dcell-v">${kfw.estimated_age_years} Jahre</div></div>` : ''}
        </div>
      </div>
      <div>
        ${kfwRules.map(rule => `
        <div class="ri ${rule.pass?'pass':'fail'}">
          <div class="ri-dot ${rule.pass?'pass':'fail'}"></div>
          <div class="ri-body">
            <div class="ri-l">${rule.pass?'✓':'✗'} ${safe(rule.label)}</div>
            <div class="ri-n">${rule.pass?'BESTANDEN':'NICHT BESTANDEN'}</div>
          </div>
        </div>`).join('')}
        ${kfw.notes?.map((n:string) => `<div class="ri info" style="margin-top:4px"><div class="ri-dot info"></div><div class="ri-body"><div class="ri-n">${safe(n)}</div></div></div>`).join('') ?? ''}
      </div>
    </div>
  </div>` : '';

  // ── Section: Saisonalität ────────────────────────────────────────────────────
  const spBuckets: any[] = sp?.monthly_buckets ?? [];
  const seasonChart = spBuckets.length >= 6 ? svgSeasonality(spBuckets) : '';
  const secSeason = sp ? `
  <div class="card">
    <div class="sec-title">Saisonalitäts-Volatilitätsanalyse</div>
    <div class="tc2">
      <div>
        <div class="dgrid">
          <div class="dcell"><div class="dcell-l">Saisonalitätskoeffizient</div><div class="dcell-v" style="color:${sp.high_risk_flag?'#b45309':'#1A5C3A'}">${sp.seasonality_coefficient?.toFixed(2) ?? '—'}</div></div>
          <div class="dcell"><div class="dcell-l">Risikostufe</div><div class="dcell-v" style="font-size:.77rem">${safe(sp.risk_label)}</div></div>
          ${sp.peak_month   ? `<div class="dcell"><div class="dcell-l">Spitzenmonat</div><div class="dcell-v">${safe(sp.peak_month)}</div></div>` : ''}
          ${sp.trough_month ? `<div class="dcell"><div class="dcell-l">Schwächster Monat</div><div class="dcell-v">${safe(sp.trough_month)}</div></div>` : ''}
          <div class="dcell"><div class="dcell-l">Datierte Reviews</div><div class="dcell-v">${r.review_volume ?? '—'}</div></div>
          ${sp.high_risk_flag ? `<div class="dcell"><div class="dcell-l">Risikowarnung</div><div class="dcell-v" style="color:#b45309">⚠ Ja</div></div>` : ''}
        </div>
      </div>
      <div>${seasonChart}</div>
    </div>
    <p class="prose" style="margin-top:10px">${safe(sp.interpretation)}</p>
  </div>` : '';

  // ── Section: Energie & Lieferkette ──────────────────────────────────────────
  const scRisks: any[] = ev?.supply_chain_risks ?? [];
  const secEnergy = ev ? `
  <div class="card">
    <div class="sec-title">Energie & Lieferkettenrisiko</div>
    <div class="tc2">
      <div>
        <div class="dgrid">
          <div class="dcell"><div class="dcell-l">Energierisiko</div><div class="dcell-v">${ev.energy_dependency_score}<span style="font-size:.7rem;color:#888">/100</span></div><div style="font-size:.7rem;color:#888">${safe(ev.overall_risk)}</div></div>
          ${ev.estimated_annual_kwh != null ? `<div class="dcell"><div class="dcell-l">Jahresverbrauch (est.)</div><div class="dcell-v">${fN(ev.estimated_annual_kwh)} kWh</div></div>` : ''}
          ${ev.estimated_energy_cost_eur != null ? `<div class="dcell"><div class="dcell-l">Energiekosten</div><div class="dcell-v">${fE(ev.estimated_energy_cost_eur)}/Jahr</div></div>` : ''}
          ${ev.energy_as_opex_pct != null ? `<div class="dcell"><div class="dcell-l">Anteil OpEx</div><div class="dcell-v">${ev.energy_as_opex_pct.toFixed(1)}%</div></div>` : ''}
        </div>
        <p class="prose">${safe(ev.interpretation)}</p>
      </div>
      <div>
        ${scRisks.length ? `
        <div class="sec-title">Lieferketten-Inputs — PPI (DE 2020=100)</div>
        <table class="t"><thead><tr><th style="text-align:left">Input</th><th>PPI</th><th>Trend</th><th>Margin</th></tr></thead><tbody>
          ${scRisks.map((s:any,i:number) => `<tr class="${i%2?'alt':''}">
            <td class="l">${safe(s.category)}</td>
            <td>${s.ppi_index}</td>
            <td>${s.trend==='rising'?'↑ steigend':s.trend==='falling'?'↓ fallend':'→ stabil'}</td>
            <td class="neg">${s.margin_impact_pct?.toFixed(1)}pp</td>
          </tr>`).join('')}
        </tbody></table>` : ''}
      </div>
    </div>
  </div>` : '';

  // ── Section: Marktdynamik ────────────────────────────────────────────────────
  const mtBars = mt.map((p:any) => p.trends_index ?? 0);
  const mtLbls = mt.map((p:any) => p.period ?? '');
  const mtChart = mtBars.length >= 4 ? svgBarLine({
    bars: mtBars, bLabels: mtLbls, bColor: '#1A5C3A',
    yMax: Math.max(...mtBars) * 1.2,
  }) : '';
  const secMarket = mt.length >= 4 ? `
  <div class="card">
    <div class="sec-title">Marktdynamik — 2020–2024</div>
    ${mtChart}
    <p class="prose" style="margin-top:8px">Marktindex — synthetischer Nachfrageindex kombiniert COVID-Erholungspfad, saisonale Muster und Branchenzyklen. Bewertungsaktivität — normiertes Quartalsvolumen.</p>
  </div>` : '';

  // ── Section: Klimasensitivität ───────────────────────────────────────────────
  const cdMonthly: any[] = cd?.monthly ?? [];
  const climTemps   = cdMonthly.map((m:any) => m.avg_temp_c ?? 0);
  const climDemand  = cdMonthly.map((m:any) => m.review_activity_norm ?? 0);
  const climLabels  = cdMonthly.map((m:any) => (m.month ?? '').slice(0,6));
  const climChart   = climTemps.length >= 6 ? svgClimate(climTemps, climDemand, climLabels) : '';
  const secClimate  = cd ? `
  <div class="card">
    <div class="sec-title">Klimasensitivitätsanalyse — 24 Monate</div>
    <div class="tc2">
      <div>
        <div style="text-align:center;margin-bottom:14px">
          <div class="bignum">${cd.climate_sensitivity_score}</div>
          <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888">/100 Klimasensitivität</div>
        </div>
        <p class="prose">${safe(cd.interpretation)}</p>
        <div class="dgrid">
          <div class="dcell"><div class="dcell-l">Wetterkorrelation</div><div class="dcell-v">${cd.weather_correlation_pct}%</div></div>
          ${cd.peak_weather_month ? `<div class="dcell"><div class="dcell-l">Bester Monat</div><div class="dcell-v">${safe(cd.peak_weather_month)}</div></div>` : ''}
          ${cd.worst_weather_month ? `<div class="dcell"><div class="dcell-l">Schlechtester Monat</div><div class="dcell-v">${safe(cd.worst_weather_month)}</div></div>` : ''}
        </div>
      </div>
      <div>${climChart}</div>
    </div>
    ${climChart ? `<p class="prose" style="font-size:.71rem;margin-top:6px">Klimascore — Komfortindex (100 = ideales Wetter, ~18°C). Nachfrageindex — normierte Bewertungsaktivität. Korrelation = Wetterabhängigkeit des Umsatzes. Quelle: Open-Meteo.</p>` : ''}
  </div>` : '';

  // ── Section: Arbeitsmarkt ────────────────────────────────────────────────────
  const secLabor = lm ? `
  <div class="card">
    <div class="sec-title">Arbeitsmarkt-Liquidität & Ersatzkosten</div>
    <div class="tc2">
      <div>
        <div class="dgrid">
          <div class="dcell"><div class="dcell-l">Ø Vakanzdauer</div><div class="dcell-v" style="color:${lm.bottleneck_flag?'#b45309':'#1A5C3A'}">${lm.avg_vacancy_days} Tage${lm.bottleneck_flag?' ⚠':''}</div></div>
          <div class="dcell"><div class="dcell-l">Sektor</div><div class="dcell-v" style="font-size:.78rem">${safe(lm.sector)}</div></div>
          <div class="dcell"><div class="dcell-l">Vakanztrend</div><div class="dcell-v">${lm.vacancy_trend==='worsening'?'↑ schlechter':lm.vacancy_trend==='improving'?'↓ besser':'→ stabil'}</div></div>
          <div class="dcell"><div class="dcell-l">Ersatz/FTE</div><div class="dcell-v">${fE(lm.replacement_cost_per_fte_eur)}</div></div>
          <div class="dcell"><div class="dcell-l">Ersatz gesamt</div><div class="dcell-v">${fE(lm.total_replacement_cost_eur)}</div></div>
          <div class="dcell"><div class="dcell-l">Friction Score</div><div class="dcell-v">${lm.recruitment_friction_score}</div></div>
        </div>
      </div>
      <div>
        <p class="prose">${safe(lm.interpretation)}</p>
        <div style="margin-top:10px">
          ${(lm.risk_signals ?? []).map((s:string) => `<div class="ri warn"><div class="ri-dot warn"></div><div class="ri-body"><div class="ri-n">⚠ ${safe(s)}</div></div></div>`).join('')}
        </div>
      </div>
    </div>
  </div>` : '';

  // ── Section: Pricing Power ───────────────────────────────────────────────────
  const secPricing = pp ? `
  <div class="card">
    <div class="sec-title">Pricing-Power-Signal</div>
    <div class="tc2">
      <div style="text-align:center">
        <div style="font-size:2.5rem;margin-bottom:4px">${pp.confirmed ? '✅' : '❌'}</div>
        <div style="font-size:.9rem;font-weight:800;color:${pp.confirmed?'#1A5C3A':'#dc2626'}">${pp.confirmed ? 'Bestätigt' : 'Nicht bestätigt'}</div>
        <p class="prose" style="margin-top:8px;text-align:left">Unzureichende Moat-Signale für sichere Preiserhöhungen</p>
      </div>
      <div>
        <div class="dgrid">
          <div class="dcell"><div class="dcell-l">Preisaufschlag</div><div class="dcell-v">${pp.price_premium_index != null ? pp.price_premium_index.toFixed(1) : '—'}</div></div>
          <div class="dcell"><div class="dcell-l">Bewertungsaufschlag</div><div class="dcell-v" style="color:${(pp.rating_premium??0)<0?'#dc2626':'#1A5C3A'}">${pp.rating_premium != null ? pp.rating_premium.toFixed(1) : '—'}</div></div>
          <div class="dcell"><div class="dcell-l">Nachfrageanteil</div><div class="dcell-v">${pp.local_demand_share_pct != null ? `${pp.local_demand_share_pct.toFixed(1)}%` : '—'}</div></div>
          <div class="dcell"><div class="dcell-l">Neg. Preissentiment</div><div class="dcell-v">${pp.neg_price_sentiment_ratio != null ? `${(pp.neg_price_sentiment_ratio*100).toFixed(1)}%` : '—'}</div></div>
        </div>
        <div style="margin-top:10px">
          ${(pp.factors_met ?? []).map((f:string) => `<div class="ri pass"><div class="ri-dot pass"></div><div class="ri-body"><div class="ri-n">✓ ${safe(f)}</div></div></div>`).join('')}
          ${(pp.factors_missing ?? []).map((f:string) => `<div class="ri fail"><div class="ri-dot fail"></div><div class="ri-body"><div class="ri-n">✗ ${safe(f)}</div></div></div>`).join('')}
        </div>
      </div>
    </div>
  </div>` : '';

  // ── Section: Stadtdemografie ─────────────────────────────────────────────────
  const secDem = dem ? `
  <div class="card">
    <div class="sec-title">Stadtdemografie & Marktgröße</div>
    <div class="tc2">
      <div>
        <div class="dgrid">
          ${dem.population != null ? `<div class="dcell"><div class="dcell-l">Stadtbevölkerung</div><div class="dcell-v">${fN(dem.population)}</div>${dem.population_density_per_km2 != null ? `<div style="font-size:.7rem;color:#888">${fN(dem.population_density_per_km2)}/km²</div>` : ''}</div>` : ''}
          ${dem.gdp_per_capita_eur != null ? `<div class="dcell"><div class="dcell-l">BIP pro Kopf</div><div class="dcell-v">${fE(dem.gdp_per_capita_eur)}</div></div>` : ''}
          ${dem.demographic_growth_5y_pct != null ? `<div class="dcell"><div class="dcell-l">Bevölkerungstrend (5J)</div><div class="dcell-v" style="color:${dem.demographic_growth_5y_pct<0?'#dc2626':'#1A5C3A'}">${dem.demographic_growth_5y_pct<0?'↓':'↑'} ${Math.abs(dem.demographic_growth_5y_pct).toFixed(1)}%</div></div>` : ''}
          ${dem.market_saturation_index != null ? `<div class="dcell"><div class="dcell-l">Marktsättigung</div><div class="dcell-v">${dem.market_saturation_index.toFixed(1)}</div></div>` : ''}
        </div>
      </div>
      <div><p class="prose">${safe(dem.interpretation)}</p><p class="prose" style="font-size:.71rem;margin-top:6px">Quelle: ${safe(dem.data_source ?? '—')}</p></div>
    </div>
  </div>` : '';

  // ── Section: Digital Risk ────────────────────────────────────────────────────
  const dvRisks: any[] = dv?.risks ?? [];
  const dvSevColor: Record<string,string> = {critical:'#dc2626',high:'#b45309',medium:'#888',low:'#1A5C3A'};
  const secDigital = dv ? `
  <div class="card">
    <div class="sec-title">Digital-Infrastrukturrisiko</div>
    <div class="tc2">
      <div>
        <div style="text-align:center;margin-bottom:14px">
          <div class="bignum" style="color:${dv.overall_risk_score>=80?'#dc2626':dv.overall_risk_score>=50?'#b45309':'#1A5C3A'}">${dv.overall_risk_score}</div>
          <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888">/100 Bedrohungsexposition</div>
          <div class="badge ${dv.risk_level==='critical'||dv.risk_level==='high'?'red':dv.risk_level==='medium'?'amber':'green'}" style="margin-top:8px">${safe(dv.risk_level?.toUpperCase())}</div>
        </div>
        <div class="sec-title">Sicherheitscheckliste</div>
        <div class="ri ${dv.ssl_valid===false?'fail':'pass'}">
          <div class="ri-dot ${dv.ssl_valid===false?'fail':'pass'}"></div>
          <div class="ri-body"><div class="ri-l">${dv.ssl_valid===false?'✗':'✓'} SSL/TLS-Zertifikat</div><div class="ri-n">${dv.ssl_valid===false?'FEHLT':'Aktiv'}</div></div>
        </div>
        <div class="ri ${dv.spf_present===false?'fail':'pass'}">
          <div class="ri-dot ${dv.spf_present===false?'fail':'pass'}"></div>
          <div class="ri-body"><div class="ri-l">${dv.spf_present===false?'✗':'✓'} SPF-Eintrag (E-Mail-Spoofing-Schutz)</div><div class="ri-n">${dv.spf_present===false?'FEHLT':'Vorhanden'}</div></div>
        </div>
        <div class="ri ${dv.dmarc_present===false?'fail':'pass'}">
          <div class="ri-dot ${dv.dmarc_present===false?'fail':'pass'}"></div>
          <div class="ri-body"><div class="ri-l">${dv.dmarc_present===false?'✗':'✓'} DMARC-Richtlinie (Betrugserkennung)</div><div class="ri-n">${dv.dmarc_present===false?'FEHLT':'Konfiguriert'}</div></div>
        </div>
        <div class="ri ${(dv.security_headers_score??0)<50?'warn':'pass'}">
          <div class="ri-dot ${(dv.security_headers_score??0)<50?'warn':'pass'}"></div>
          <div class="ri-body"><div class="ri-l">◉ Security Headers (${dv.security_headers_score ?? 0}%)</div></div>
        </div>
        ${dv.domain ? `<p class="prose" style="margin-top:8px;font-size:.77rem">Domain: ${safe(dv.domain)}</p>` : ''}
      </div>
      <div>
        ${dvRisks.map((risk:any) => `
        <div style="margin-bottom:10px">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
            <span style="font-size:.65rem;font-weight:700;text-transform:uppercase;color:${dvSevColor[risk.severity]??'#888'}">${safe(risk.severity)}</span>
            <span style="font-size:.78rem;font-weight:700;color:#111">${safe(risk.type ?? risk.description?.slice(0,40))}</span>
          </div>
          <p style="font-size:.77rem;color:#666;line-height:1.6">${safe(risk.description)}</p>
        </div>`).join('')}
      </div>
    </div>
  </div>` : '';

  // ── Section: Standortökonomie ────────────────────────────────────────────────
  const secLocation = sc ? `
  <div class="card">
    <div class="sec-title">Standortökonomie</div>
    <div class="dgrid">
      <div class="dcell"><div class="dcell-l">Zone</div><div class="dcell-v">${safe(sc.zone_classification?.replace(/_/g,' '))}</div></div>
      <div class="dcell"><div class="dcell-l">Fußverkehrs-Score</div><div class="dcell-v">${sc.foot_traffic_score}/100</div></div>
      ${sc.nearest_transport ? `<div class="dcell"><div class="dcell-l">Nächster Transport</div><div class="dcell-v" style="font-size:.78rem">${safe(sc.nearest_transport.name)} (${sc.nearest_transport.distance_m}m)</div></div>` : ''}
      ${sc.city_center_distance_m != null ? `<div class="dcell"><div class="dcell-l">Entfernung Zentrum</div><div class="dcell-v">${fN(sc.city_center_distance_m)}m</div></div>` : ''}
    </div>
    <p class="prose">${safe(sc.location_economics)}</p>
  </div>` : '';

  // ── Section: Kontakt & Lage (ANONYMISIERT) ───────────────────────────────────
  const ad = r.address_detail ?? {};
  const secContact = `
  <div class="card">
    <div class="sec-title">Kontakt & Lage (Anonymisiert)</div>
    <div class="tc2">
      <div>
        <div class="kvr"><span class="kvk">Adresse</span><span class="kvv">${safe(region)} [anonymisiert]</span></div>
        <div class="kvr"><span class="kvk">PLZ</span><span class="kvv">${safe(ad.postal_code ?? '—')}</span></div>
        <div class="kvr"><span class="kvk">Landkreis</span><span class="kvv">${safe(ad.landkreis ?? '—')}</span></div>
        <div class="kvr"><span class="kvk">Bundesland/Region</span><span class="kvv">${safe(r.region ?? ad.bundesland ?? '—')}</span></div>
        <div class="kvr"><span class="kvk">Land</span><span class="kvv">${safe(r.country ?? '—')} (${safe(ad.country_code ?? '—')})</span></div>
      </div>
      <div>
        <div class="kvr"><span class="kvk">Name</span><span class="kvv">[anonymisiert]</span></div>
        <div class="kvr"><span class="kvk">Telefon</span><span class="kvv">[anonymisiert]</span></div>
        <div class="kvr"><span class="kvk">Website</span><span class="kvv">[anonymisiert]</span></div>
        <div class="kvr"><span class="kvk">Koordinaten</span><span class="kvv">[anonymisiert]</span></div>
        <div class="kvr"><span class="kvk">Betriebsstatus</span><span class="kvv" style="color:${r.business_status==='OPERATIONAL'?'#1A5C3A':'#b45309'}">${safe(r.business_status ?? '—')}</span></div>
      </div>
    </div>
  </div>`;

  // ── Section: Öffnungszeiten ──────────────────────────────────────────────────
  const hourLines: string[] = h?.weekday_text?.map(localDay) ?? [];
  const secHours = h ? `
  <div class="card">
    <div class="sec-title">Öffnungszeiten</div>
    <div class="tc2">
      <div>
        ${hourLines.length ? `<table class="t"><thead><tr><th style="text-align:left">Wochentag</th><th style="text-align:right">Zeiten</th></tr></thead><tbody>
          ${hourLines.map((line:string, i:number) => {
            const [day,...rest] = line.split(':');
            const time = rest.join(':').trim();
            const closed = /geschlossen|closed/i.test(time);
            return `<tr class="${i%2?'alt':''}"><td class="l">${safe(day)}</td><td style="color:${closed?'#dc2626':'#111'}">${safe(time||'—')}</td></tr>`;
          }).join('')}
        </tbody></table>` : '<p class="prose">Keine Öffnungszeiten verfügbar.</p>'}
      </div>
      <div>
        <div class="dgrid">
          ${h.total_weekly_hours != null ? `<div class="dcell"><div class="dcell-l">Wochenstunden gesamt</div><div class="dcell-v">${h.total_weekly_hours}h</div></div>` : ''}
          ${h.avg_daily_hours    != null ? `<div class="dcell"><div class="dcell-l">Ø/Tag</div><div class="dcell-v">${h.avg_daily_hours}h</div></div>` : ''}
          <div class="dcell"><div class="dcell-l">Wochenende</div><div class="dcell-v">${h.open_on_weekends ? 'Geöffnet' : 'Geschlossen'}</div></div>
        </div>
      </div>
    </div>
  </div>` : '';

  // ── Section: Services & Attribute ───────────────────────────────────────────
  const attrMap: [string, boolean|null][] = [
    ['Lieferung', r.delivery], ['Mitnahme', r.takeout], ['Abholung', r.curbside_pickup],
    ['Vor-Ort-Verzehr', r.dine_in], ['Reservierung', r.reservable],
    ['Frühstück', r.serves_breakfast], ['Abendessen', r.serves_dinner],
    ['Bier', r.serves_beer], ['Wein', r.serves_wine], ['Barrierefrei', r.wheelchair_accessible],
  ].filter(([,v]) => v !== null) as [string, boolean|null][];
  const secServices = attrMap.length ? `
  <div class="card">
    <div class="sec-title">Services & Attribute</div>
    <div class="chips">
      ${attrMap.map(([label,v]) => `<span class="chip ${v?'ok':'no'}">${v?'✓':'✗'} ${label}</span>`).join('')}
    </div>
  </div>` : '';

  // ── Section: Website Intelligence (ANONYMISIERT) ─────────────────────────────
  const wd = r.website_data;
  const secWeb = wd ? `
  <div class="card">
    <div class="sec-title">Website-Intelligence (Anonymisiert)</div>
    <div class="tc2">
      <div>
        ${wd.page_title ? `<div class="kvr"><span class="kvk">Seitentitel</span><span class="kvv" style="font-size:.8rem">[anonymisiert]</span></div>` : ''}
        <div class="kvr"><span class="kvk">E-Mails gefunden</span><span class="kvv">${wd.emails?.length > 0 ? `${wd.emails.length} Adresse(n) [anonymisiert]` : '—'}</span></div>
        <div class="kvr"><span class="kvk">Telefone gefunden</span><span class="kvv">${wd.phones_found?.length > 0 ? `${wd.phones_found.length} [anonymisiert]` : '—'}</span></div>
        ${wd.meta_description ? `<div class="kvr"><span class="kvk">Meta-Beschreibung</span><span class="kvv" style="font-size:.78rem;max-width:60%;text-align:right">${safe(wd.meta_description.slice(0,80))}…</span></div>` : ''}
      </div>
      <div>
        ${Object.keys(wd.socials ?? {}).length ? `<div class="sec-title">Social-Media-Präsenz</div>
        ${Object.keys(wd.socials).map(k => `<div class="kvr"><span class="kvk">${safe(k)}</span><span class="kvv">[anonymisiert]</span></div>`).join('')}` : ''}
        ${wd.keywords?.length ? `<div style="margin-top:10px"><div class="sec-title">Keywords</div><div class="chips">${wd.keywords.slice(0,8).map((k:string) => `<span class="chip ok">${safe(k)}</span>`).join('')}</div></div>` : ''}
      </div>
    </div>
  </div>` : '';

  // ── Section: Bewertungsanalyse ───────────────────────────────────────────────
  const secReviews = `
  <div class="card">
    <div class="sec-title">Bewertungsanalyse — ${r.review_volume ?? '—'} ausgewertet</div>
    <div class="tc2">
      <div>
        <div class="dgrid">
          ${ra?.sentiment_score != null ? `<div class="dcell"><div class="dcell-l">Sentiment-Score</div><div class="dcell-v" style="color:${ra.sentiment_score>=0?'#1A5C3A':'#dc2626'}">${ra.sentiment_score>=0?'+':''}${ra.sentiment_score.toFixed(2)}</div></div>` : ''}
          ${(ra?.positive != null) ? `<div class="dcell"><div class="dcell-l">Pos/Neg/Neutral</div><div class="dcell-v">${ra.positive}↑ / ${ra.negative}↓ / ${ra.neutral}→</div></div>` : ''}
          ${ra?.avg_review_length != null ? `<div class="dcell"><div class="dcell-l">Ø Textlänge</div><div class="dcell-v">${ra.avg_review_length} Zeichen</div></div>` : ''}
          ${ra?.tourist_ratio_pct != null ? `<div class="dcell"><div class="dcell-l">Touristen</div><div class="dcell-v">${ra.tourist_ratio_pct}%</div></div>` : ''}
          ${ra?.languages?.length ? `<div class="dcell"><div class="dcell-l">Sprachen</div><div class="dcell-v">${safe(ra.languages.join(', '))}</div></div>` : ''}
          ${(ra?.oldest_date||ra?.newest_date) ? `<div class="dcell"><div class="dcell-l">Zeitraum</div><div class="dcell-v" style="font-size:.75rem">${safe(ra.oldest_date??'')} → ${safe(ra.newest_date??'')}</div></div>` : ''}
        </div>
        ${sk ? `<div class="tc2" style="margin-top:12px">
          <div><div class="sec-title">Kernlob</div>${(sk.praises??[]).slice(0,4).map((p:any)=>`<div class="kvr"><span class="kvk">${safe(p.theme)}</span><span class="kvv">${p.count}×</span></div>`).join('')||'<p class="prose">—</p>'}</div>
          <div><div class="sec-title">Kritikpunkte</div>${(sk.complaints??[]).slice(0,4).map((c:any)=>`<div class="kvr"><span class="kvk">${safe(c.theme)}</span><span class="kvv">${c.count}×</span></div>`).join('')||'<p class="prose">—</p>'}</div>
        </div>` : ''}
      </div>
      <div>
        ${revs.slice(0,4).map((rv:any) => `
        <div class="rev">
          <div class="rev-meta">[Rezensent] · ${safe(rv.date ?? rv.relative_time ?? '—')} · [${safe(rv.language ?? '?')}]</div>
          <div class="rev-stars">${'★'.repeat(rv.rating??0)}${'☆'.repeat(5-(rv.rating??0))}</div>
          <div class="rev-text">${rv.text ? safe(rv.text.slice(0,200)) : '[Keine Textbewertung]'}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;

  // ── Section: Wettbewerber ────────────────────────────────────────────────────
  const mktRatings = comps.map((c:any) => parseFloat(c.rating??'')).filter(Boolean);
  const mktAvg = mktRatings.length ? (mktRatings.reduce((a:number,b:number)=>a+b,0)/mktRatings.length).toFixed(1) : null;
  const secComps = aComps.length ? `
  <div class="card">
    <div class="sec-title">Wettbewerber — ${aComps.length} im 1km-Radius</div>
    <table class="t">
      <thead><tr><th style="text-align:left">Bezeichnung</th><th>Bewertung</th><th>Rezensionen</th><th>Website</th></tr></thead>
      <tbody>
        ${aComps.map((c,i) => `<tr class="${i%2?'alt':''}">
          <td class="l">${safe(c.label)}</td>
          <td>${c.rating ? `★ ${safe(c.rating)}` : '—'}</td>
          <td>${c.reviews ? `${fN(Number(c.reviews))} Bew.` : '—'}</td>
          <td style="font-size:.75rem">${safe(c.website)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${mktAvg ? `<p class="prose" style="font-size:.77rem">Marktdurchschnitt: ★ ${mktAvg} | Dieser Betrieb: ★ ${r.rating ?? '—'} (${r.rating && mktAvg ? ((parseFloat(r.rating)-parseFloat(mktAvg))>=0?'+':'')+(parseFloat(r.rating)-parseFloat(mktAvg)).toFixed(1) : '—'})</p>` : ''}
  </div>` : '';

  // ── Assemble ─────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ref} — Investorenbericht ${subname}</title>
<style>${css()}</style>
</head>
<body>
<div class="wrap">
  <div class="pbar">
    <button class="pbtn" onclick="window.print()">Als PDF speichern (A4)</button>
  </div>

  <!-- Header -->
  <div class="page-header" style="margin-bottom:20px">
    <div class="ph-eyebrow">Firmadeal · Vertrauliches Dokument · 4. Juni 2026 · ${ref}</div>
    <div class="ph-title">INVESTOREN<span>BERICHT</span></div>
    <div class="ph-sub">${subname} · Anonymisierter Investor-Report · Nur für qualifizierte Investoren</div>
    <div class="ph-meta">
      <div class="ph-meta-item"><strong>Referenz</strong> ${ref}</div>
      <div class="ph-meta-item"><strong>Sektor</strong> ${safe(mult.label)}</div>
      <div class="ph-meta-item"><strong>Region</strong> ${safe(region)}</div>
      <div class="ph-meta-item"><strong>Status</strong> ${r.business_status === 'OPERATIONAL' ? 'Operativ' : safe(r.business_status ?? '—')}</div>
      <div class="ph-meta-item"><strong>Bewertung</strong> ★ ${r.rating ?? '—'} · ${fN(r.review_volume ? Number(r.review_volume) : null)} Rez.</div>
    </div>
  </div>

  ${isTurnaround ? `<div class="card" style="border-color:rgba(220,38,38,.2);background:#fef2f2;margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:1.5rem">⚠️</span>
      <div><div style="font-size:.8rem;font-weight:800;color:#dc2626;margin-bottom:3px">TURNAROUND-PROFIL / SANIERUNGSOBJEKT</div>
      <div style="font-size:.78rem;color:#b91c1c">Negativer Base-Case-EBITDA (${fE(eBase)}). Klassische Multiple-Bewertung nicht anwendbar. Break-even bei ${fE(pl?.breakeven_revenue)}.</div></div>
    </div>
  </div>` : ''}

  ${secIndustry}
  ${secDrivers}
  <div class="pg-break"></div>
  ${secMacro}
  <div class="pg-break"></div>
  ${secPL}
  ${secArea}
  ${secKfw}
  <div class="pg-break"></div>
  ${secSeason}
  ${secEnergy}
  ${secMarket}
  ${secClimate}
  ${secLabor}
  ${secPricing}
  ${secDem}
  ${secDigital}
  ${secLocation}
  <div class="pg-break"></div>
  ${secContact}
  ${secHours}
  ${secServices}
  ${secWeb}
  ${secReviews}
  ${secComps}

  <div class="cta">
    <h2>Interesse an diesem Betrieb?</h2>
    <p>Kontaktieren Sie uns für Zugang zu verifizierten Verkäuferinformationen und vollständigen Due-Diligence-Unterlagen.</p>
    <a href="mailto:investors@firmadeal.de?subject=${encodeURIComponent(`Investorenbericht ${ref} – ${mult.label} – ${region}`)}">investors@firmadeal.de · firmadeal.de</a>
  </div>

  <div class="discl" style="margin-top:16px">
    Dieser Bericht basiert ausschließlich auf öffentlich zugänglichen Daten (Google Maps, Statista, Destatis, Bundesagentur für Arbeit u. a.).
    Alle Finanzkennzahlen sind probabilistische Schätzungen algorithmischer Modelle und stellen keine Gewähr, Zusicherung oder steuerliche/rechtliche Beratung dar.
    Vor jeder Akquisitionsentscheidung ist eine vollständige Due Diligence durch qualifizierte Berater erforderlich.
    Firmadeal GmbH übernimmt keine Haftung für Richtigkeit oder Vollständigkeit der Angaben. Stand: 4. Juni 2026.
  </div>

  <div class="pg-footer">Erstellt mit <strong>Firmadeal</strong> Intelligence Platform · firmadeal.de · 4. Juni 2026</div>
</div>
</body>
</html>`;
}

// ── Route ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body    = await req.json();
  const ref     = genRef();
  const html    = renderReport(body, ref);
  const types: string[] = body.types ?? [];
  const pt      = types.find((t: string) => MULTS[t]) ?? types[0] ?? 'report';
  const sector  = (MULTS[pt] ?? MD).label.replace(/\s+/g, '-');
  const filename = `${ref}-${sector}-Investorenbericht.html`;
  return NextResponse.json({ html, filename });
}
