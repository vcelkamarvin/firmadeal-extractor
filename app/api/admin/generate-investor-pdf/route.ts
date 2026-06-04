import { NextRequest, NextResponse } from 'next/server';

// ── Helpers ────────────────────────────────────────────────────────────────────
function genRef(): string {
  return `FD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
}
function fE(n: number | null | undefined, d = 0): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '–\u202f' : '';
  if (abs >= 1_000_000) return `${sign}EUR\u202f${(abs / 1_000_000).toFixed(2)}\u202fMio.`;
  if (abs >= 1_000)     return `${sign}EUR\u202f${Math.round(abs / 1000).toLocaleString('de-DE')}k`;
  return `${sign}EUR\u202f${abs.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
function fP(n: number | null | undefined, d = 1): string {
  return n != null ? `${n >= 0 ? '' : ''}${n.toFixed(d)}\u202f%` : '—';
}
function fN(n: number | null | undefined): string { return n != null ? n.toLocaleString('de-DE') : '—'; }
function s(n: number | null | undefined): string { return n != null ? (n >= 0 ? '+' : '') + n.toFixed(1) : '—'; }
function col(n: number | null | undefined, good = true): string {
  if (n == null) return '#1a1a1a';
  return n < 0 ? '#B91C1C' : good ? '#1A5C3A' : '#B8730A';
}
function safe(v: string | null | undefined): string {
  return (v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Day-name localisation (English→German)
const DAY_DE: Record<string, string> = {
  Monday: 'Montag', Tuesday: 'Dienstag', Wednesday: 'Mittwoch',
  Thursday: 'Donnerstag', Friday: 'Freitag', Saturday: 'Samstag', Sunday: 'Sonntag',
};
function localiseDay(line: string): string {
  return line.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/,
    (m) => DAY_DE[m] ?? m);
}

// ── DACH EBITDA multiples ──────────────────────────────────────────────────────
const MULTS: Record<string, { low: number; mid: number; high: number; label: string }> = {
  restaurant:     { low: 2.5, mid: 3.5, high: 4.5, label: 'Gastronomie' },
  cafe:           { low: 2.0, mid: 2.8, high: 3.5, label: 'Café' },
  bakery:         { low: 1.5, mid: 2.2, high: 3.0, label: 'Bäckerei' },
  bar:            { low: 2.0, mid: 2.8, high: 3.5, label: 'Bar' },
  lodging:        { low: 4.0, mid: 5.5, high: 7.0, label: 'Beherbergung' },
  hair_care:      { low: 1.5, mid: 2.0, high: 2.5, label: 'Friseur' },
  beauty_salon:   { low: 1.5, mid: 2.0, high: 2.5, label: 'Kosmetik' },
  car_repair:     { low: 2.5, mid: 3.2, high: 4.0, label: 'Kfz-Service' },
  car_dealer:     { low: 3.0, mid: 4.0, high: 5.0, label: 'Kfz-Handel' },
  dentist:        { low: 3.0, mid: 4.0, high: 5.0, label: 'Zahnarzt' },
  pharmacy:       { low: 3.5, mid: 4.5, high: 5.5, label: 'Apotheke' },
  supermarket:    { low: 1.5, mid: 2.2, high: 3.0, label: 'Lebensmittel' },
  hardware_store: { low: 2.0, mid: 2.8, high: 3.5, label: 'Fachhandel' },
};
const MULT_DEF = { low: 2.5, mid: 3.5, high: 4.5, label: 'Gewerbebetrieb' };

// ── Anonymise region ───────────────────────────────────────────────────────────
function anonRegion(r: any): string {
  const cc  = r.address_detail?.country_code ?? r.country ?? 'DE';
  const reg = r.region ?? r.address_detail?.bundesland ?? null;
  if (reg) return `${reg}, ${cc}`;
  return cc === 'CZ' ? 'Tschechien' : cc === 'AT' ? 'Österreich' : cc === 'CH' ? 'Schweiz' : 'Deutschland';
}

// ── CSS ────────────────────────────────────────────────────────────────────────
function css(): string { return `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --g:#1A5C3A;--gl:#E8F5EE;--amb:#B8730A;--red:#B91C1C;
  --bg:#F9F8F5;--wh:#FFFFFF;--tx:#1a1a1a;--mu:#555;--su:#888;
  --br:rgba(26,92,58,.18);
}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:var(--bg);color:var(--tx);font-size:10pt;line-height:1.5}
.wrap{max-width:860px;margin:0 auto}
/* print bar */
.pbar{display:flex;justify-content:flex-end;padding:14px 28px 8px;gap:10px;background:var(--bg)}
.pbtn{background:var(--g);color:#fff;border:none;cursor:pointer;font-family:inherit;font-size:8pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:9px 22px;border-radius:6px}
.pbtn:hover{background:#155030}
/* page section */
.pg{padding:28px 36px;background:var(--bg);page-break-after:always;break-after:page}
.pg:last-of-type{page-break-after:auto;break-after:auto}
/* page header */
.ph{display:flex;justify-content:space-between;align-items:center;background:var(--g);color:#fff;padding:8px 16px;border-radius:8px;margin-bottom:20px;font-size:7.5pt}
.ph-l{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:.06em}
.ph-logo{width:18px;height:18px;background:#fff;border-radius:3px;display:flex;align-items:center;justify-content:center;color:var(--g);font-weight:900;font-size:7pt}
.ph-c{font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.ph-r{text-align:right;font-size:7pt;color:rgba(255,255,255,.7)}
/* cover title */
.cover-sub{text-align:center;padding:18px 0 22px;border-bottom:2px solid var(--g);margin-bottom:22px}
.cover-sub h1{font-size:15pt;font-weight:900;letter-spacing:-.02em;color:var(--g);margin-bottom:4px}
.cover-sub p{font-size:8.5pt;color:var(--mu)}
/* valuation box */
.vbox{border:2px solid var(--g);border-radius:10px;padding:18px 20px;margin-bottom:20px;background:var(--wh)}
.vbox-title{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--g);margin-bottom:14px}
.vbox-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}
.vc{border:1px solid var(--br);border-radius:8px;padding:14px 12px;text-align:center}
.vc.bear{border-color:rgba(185,28,28,.25);background:#fff8f8}
.vc.base{border-color:rgba(26,92,58,.3);background:var(--gl)}
.vc.bull{border-color:rgba(26,92,58,.4);background:#d4edda}
.vc-label{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--mu);margin-bottom:6px}
.vc-val{font-size:13pt;font-weight:900;letter-spacing:-.02em;margin-bottom:4px}
.vc-mult{font-size:7.5pt;font-weight:700;color:var(--mu)}
.vc-sub{font-size:7pt;color:var(--su);margin-top:3px}
.vbox-footer{display:flex;justify-content:space-between;align-items:center;font-size:7.5pt;padding-top:10px;border-top:1px solid var(--br)}
.vbox-footer .mult-ref{color:var(--g);font-weight:700}
.vbox-footer .discl{color:var(--su);font-style:italic}
/* snapshot */
.snap-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
.snap-panel{background:var(--wh);border:1px solid var(--br);border-radius:8px;overflow:hidden}
.snap-panel table{width:100%;border-collapse:collapse}
.snap-panel td{padding:6px 12px;font-size:8pt;border-bottom:1px solid rgba(0,0,0,.05)}
.snap-panel tr:last-child td{border-bottom:none}
.snap-panel td:first-child{color:var(--mu);width:52%}
.snap-panel td:last-child{font-weight:600;color:var(--tx)}
.snap-panel tr:nth-child(even){background:var(--bg)}
/* section header */
.sh{background:var(--g);color:#fff;padding:9px 16px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.sh h2{font-size:9.5pt;font-weight:800;letter-spacing:-.01em}
.sh .pg-tag{font-size:6.5pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.65)}
/* section label */
.sl{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--su);margin-bottom:8px;margin-top:14px}
/* tables */
table.dt{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:14px}
table.dt th{text-align:right;padding:7px 10px;font-size:6.5pt;text-transform:uppercase;letter-spacing:.08em;color:var(--su);background:var(--bg);border-bottom:2px solid var(--br)}
table.dt th:first-child{text-align:left}
table.dt td{padding:7px 10px;text-align:right;color:var(--mu);border-bottom:1px solid rgba(0,0,0,.06)}
table.dt td.l{text-align:left;font-weight:600;color:var(--tx)}
table.dt td.l2{text-align:left;padding-left:20px;color:var(--mu)}
table.dt td.m{font-weight:700;color:var(--tx)}
table.dt td.pos{color:#1A5C3A;font-weight:700}
table.dt td.neg{color:#B91C1C;font-weight:700}
table.dt tr.tot td{background:var(--gl);font-weight:700;color:var(--tx)}
table.dt tr.space td{height:4px;border-bottom:2px solid var(--br)}
table.dt tr:last-child td{border-bottom:none}
table.dt tr.alt{background:var(--bg)}
/* KV panel */
.kv-panel{background:var(--wh);border:1px solid var(--br);border-radius:8px;padding:14px 16px;margin-bottom:12px}
.kv-panel h3{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--su);margin-bottom:10px}
.kv-row{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(0,0,0,.05);font-size:8pt}
.kv-row:last-child{border-bottom:none}
.kv-k{color:var(--mu)}
.kv-v{font-weight:600;color:var(--tx);text-align:right}
/* two col */
.tc{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
/* chips */
.chips{display:flex;flex-wrap:wrap;gap:5px;padding:10px 0}
.chip{font-size:7pt;padding:3px 9px;border-radius:12px;font-weight:600}
.chip.ok{background:var(--gl);border:1px solid rgba(26,92,58,.25);color:var(--g)}
.chip.no{background:#fef2f2;border:1px solid rgba(185,28,28,.2);color:#B91C1C}
/* risk items */
.ri{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:6px;margin-bottom:6px}
.ri.fail{background:#fef2f2;border:1px solid rgba(185,28,28,.15)}
.ri.pass{background:var(--gl);border:1px solid rgba(26,92,58,.15)}
.ri.warn{background:#fffbeb;border:1px solid rgba(184,115,10,.2)}
.ri-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:4px}
.ri-dot.fail{background:#B91C1C}.ri-dot.pass{background:#1A5C3A}.ri-dot.warn{background:#B8730A}
.ri-label{font-size:7.5pt;font-weight:700;color:var(--tx);margin-bottom:1px}
.ri-note{font-size:7pt;color:var(--mu);line-height:1.5}
/* text block */
.tb{font-size:8pt;color:var(--mu);line-height:1.7;padding:12px 14px;background:var(--wh);border-radius:7px;border:1px solid var(--br);margin-bottom:12px}
/* metrics grid */
.mg{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:14px}
.mc{background:var(--wh);border:1px solid var(--br);border-radius:7px;padding:10px 12px}
.mc-l{font-size:6pt;text-transform:uppercase;letter-spacing:.07em;color:var(--su);margin-bottom:4px}
.mc-v{font-size:10pt;font-weight:800;color:var(--tx);letter-spacing:-.01em}
.mc-s{font-size:6.5pt;color:var(--mu);margin-top:2px}
/* review snippet */
.rev{padding:8px 12px;border-left:3px solid var(--g);background:var(--wh);border-radius:0 6px 6px 0;margin-bottom:6px;font-size:7.5pt}
.rev-stars{color:#B8730A;font-weight:700;margin-bottom:2px}
.rev-text{color:var(--mu);font-style:italic}
/* CTA */
.cta{background:var(--g);border-radius:10px;padding:26px 32px;text-align:center;margin-top:20px}
.cta h2{font-size:12pt;font-weight:900;color:#fff;margin-bottom:6px}
.cta p{font-size:8pt;color:rgba(255,255,255,.65);margin-bottom:18px;max-width:480px;margin-left:auto;margin-right:auto}
.cta a{display:inline-block;background:#fff;color:var(--g);font-weight:800;font-size:8.5pt;padding:10px 28px;border-radius:6px;text-decoration:none;letter-spacing:.03em}
.cta-meta{margin-top:10px;font-size:7.5pt;color:rgba(255,255,255,.5)}
/* footer */
.pg-footer{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:10px;border-top:1px solid var(--br);font-size:6.5pt;color:var(--su)}
.disclaimer{margin-top:14px;font-size:6.5pt;color:var(--su);line-height:1.7;padding:10px 14px;border:1px solid var(--br);border-radius:6px;background:var(--wh)}
/* fd footer */
.fd-foot{text-align:center;padding:12px;font-size:6.5pt;color:var(--su);letter-spacing:.06em;text-transform:uppercase}
.fd-foot strong{color:var(--g)}
/* print */
@media print{
  body{background:#fff;font-size:9pt}
  .pbar{display:none!important}
  .wrap{max-width:100%}
  .pg{padding:20px 28px}
}
`; }

// ── Mini page header ───────────────────────────────────────────────────────────
function ph(ref: string, page: number): string {
  return `<div class="ph">
    <div class="ph-l"><div class="ph-logo">F</div>Firmadeal.de</div>
    <div class="ph-c">Investorenbericht — Vertraulich</div>
    <div class="ph-r">${ref} | 4. Juni 2026 | Seite ${page} von 4</div>
  </div>`;
}
function pgFooter(ref: string, page: number): string {
  return `<div class="pg-footer">
    <span>Firmadeal.de · Investorenplattform</span>
    <span>${ref} · VERTRAULICH · Seite ${page} von 4</span>
    <span>Erstellt: 4. Juni 2026</span>
  </div>`;
}

// ── HTML ───────────────────────────────────────────────────────────────────────
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
  const comps: any[] = r.competitors ?? [];
  const reviews: any[] = r.reviews ?? [];
  const mt: any[]  = r.market_timeline ?? [];

  // Sector
  const types: string[] = r.types ?? [];
  const pt    = types.find((t: string) => MULTS[t]) ?? types[0] ?? 'restaurant';
  const mult  = MULTS[pt] ?? MULT_DEF;
  const sectorDe = mult.label;
  const region   = anonRegion(r);
  const subname  = `${sectorDe} · ${region}`;

  // P&L core
  const eLow  = pl?.ebitda?.low  ?? null;
  const eBase = pl?.ebitda?.mid  ?? null;
  const eHigh = pl?.ebitda?.high ?? null;
  const rLow  = pl?.revenue?.low  ?? null;
  const rBase = pl?.revenue?.mid  ?? null;
  const rHigh = pl?.revenue?.high ?? null;

  const isTurnaround = eBase !== null && eBase < 0;

  // Valuation cards
  const vBear = eLow  != null ? eLow  * mult.low  : null;
  const vBase = eBase != null ? eBase * mult.mid  : null;
  const vBull = eHigh != null ? eHigh * mult.high : null;
  function vColor(v: number | null): string {
    if (v == null) return '#888';
    return v < 0 ? '#B91C1C' : '#1A5C3A';
  }

  // Hours
  const hourLines: string[] = h?.weekday_text?.map(localiseDay) ?? [];

  // Competitors (anonymised)
  const letters = ['A','B','C','D','E','F','G','H'];
  const anonComps = comps.slice(0, 8).map((c: any, i: number) => ({
    label:   `Wettbewerber ${letters[i]}`,
    rating:  c.rating,
    reviews: c.review_volume,
    website: c.url ? 'Vorhanden' : '—',
    dist:    c.distance,
    status:  c.business_status,
  }));

  // Market avg rating
  const mktRatings = comps.map((c: any) => parseFloat(c.rating ?? '')).filter(Boolean);
  const mktAvg = mktRatings.length ? (mktRatings.reduce((a: number, b: number) => a + b, 0) / mktRatings.length).toFixed(1) : null;
  const myRating = r.rating ? parseFloat(r.rating) : null;
  const ratingDiff = (myRating && mktAvg) ? (myRating - parseFloat(mktAvg)).toFixed(1) : null;

  // Attributes
  const attrs: { label: string; v: boolean | null }[] = [
    { label: 'Lieferung',          v: r.delivery },
    { label: 'Mitnahme',           v: r.takeout },
    { label: 'Abholung',           v: r.curbside_pickup },
    { label: 'Vor-Ort-Verzehr',    v: r.dine_in },
    { label: 'Reservierung',       v: r.reservable },
    { label: 'Frühstück',          v: r.serves_breakfast },
    { label: 'Abendessen',         v: r.serves_dinner },
    { label: 'Bierausschank',      v: r.serves_beer },
    { label: 'Weinausschank',      v: r.serves_wine },
    { label: 'Barrierefreiheit',   v: r.wheelchair_accessible },
  ].filter(a => a.v !== null);

  // P&L table values
  const gm   = pl?.gross_margin_pct ?? 12;
  const cogsP = (100 - gm).toFixed(0);
  const cLow  = rLow  ? Math.round(rLow  * (1 - gm / 100)) : null;
  const cBase = rBase ? Math.round(rBase * (1 - gm / 100)) : null;
  const cHigh = rHigh ? Math.round(rHigh * (1 - gm / 100)) : null;
  const gpLow  = pl?.gross_profit?.low  ?? null;
  const gpBase = pl?.gross_profit?.mid  ?? null;
  const gpHigh = pl?.gross_profit?.high ?? null;
  const opLow  = pl?.other_opex?.low  ?? null;
  const opBase = pl?.other_opex?.mid  ?? null;
  const opHigh = pl?.other_opex?.high ?? null;
  const persCost = pl?.personnel_cost ?? null;
  const facCost  = pl?.facility_cost  ?? null;
  const facSqm   = pl?.facility_sqm   ?? null;
  const fte      = pl?.fte_estimate   ?? null;

  const emL  = (eLow  != null && rLow  && rLow  > 0) ? (eLow  / rLow  * 100).toFixed(1) : null;
  const emB  = (eBase != null && rBase && rBase > 0) ? (eBase / rBase * 100).toFixed(1) : null;
  const emH  = (eHigh != null && rHigh && rHigh > 0) ? (eHigh / rHigh * 100).toFixed(1) : null;

  // Cost drivers
  const drivers: any[] = pl?.dependency_matrix?.drivers ?? [];
  const sevColor: Record<string, string> = { critical: '#B91C1C', high: '#B8730A', medium: '#1A5C3A', low: '#555' };

  // KfW rules
  const kfwRules = [
    { label: 'Geografische Voraussetzung',  pass: kfw?.country_check  ?? null },
    { label: 'KMU-Schwellenwerte',          pass: kfw?.sme_check      ?? null },
    { label: 'Branche nicht eingeschränkt', pass: kfw?.industry_check ?? null },
  ];

  // Digital risk items
  const dvItems = [
    { label: 'SSL/TLS-Zertifikat',    pass: dv?.ssl_valid,      note: dv?.ssl_valid === false   ? 'FEHLT — Browser-Sicherheitswarnung, DSGVO-Risiko'     : 'Aktiv' },
    { label: 'SPF-Eintrag',           pass: dv?.spf_present,    note: dv?.spf_present === false  ? 'FEHLT — Domain-Spoofing möglich'                      : 'Konfiguriert' },
    { label: 'DMARC-Richtlinie',      pass: dv?.dmarc_present,  note: dv?.dmarc_present === false ? 'FEHLT — Keine Sichtbarkeit auf Phishing-Versuche'    : 'Konfiguriert' },
    { label: 'Security Headers',      pass: (dv?.security_headers_score ?? 0) > 50, note: `Score: ${dv?.security_headers_score ?? 0}%` },
  ];
  const dvRiskColor = (dv?.overall_risk_score ?? 0) >= 80 ? '#B91C1C' : (dv?.overall_risk_score ?? 0) >= 50 ? '#B8730A' : '#1A5C3A';

  // Supply chain
  const scRisks: any[] = ev?.supply_chain_risks ?? [];

  // Unemployment history
  const unempHist: any[] = mac?.unemployment_history ?? [];

  // ── PAGE 1 ───────────────────────────────────────────────────────────────────
  const p1 = `
  <div class="pg">
    ${ph(ref, 1)}

    <div class="cover-sub">
      <h1>${subname}</h1>
      <p>Anonymisierter Investoren-Teaser &nbsp;|&nbsp; Nur für qualifizierte Investoren</p>
    </div>

    <!-- VALUATION BOX -->
    <div class="vbox">
      <div class="vbox-title">Indikative Bewertung — Vor Due Diligence</div>
      <div class="vbox-grid">
        <div class="vc bear">
          <div class="vc-label">Konservativ</div>
          <div class="vc-val" style="color:${vColor(vBear)}">${fE(vBear)}</div>
          <div class="vc-mult">${mult.low}× EBITDA</div>
          <div class="vc-sub">Bear Case</div>
        </div>
        <div class="vc base">
          <div class="vc-label">Realistisch</div>
          <div class="vc-val" style="color:${vColor(vBase)}">${fE(vBase)}</div>
          <div class="vc-mult">${mult.mid}× EBITDA</div>
          <div class="vc-sub">Base Case</div>
        </div>
        <div class="vc bull">
          <div class="vc-label">Optimistisch</div>
          <div class="vc-val" style="color:${vColor(vBull)}">${fE(vBull)}</div>
          <div class="vc-mult">${mult.high}× EBITDA</div>
          <div class="vc-sub">Bull Case</div>
        </div>
      </div>
      <div class="vbox-footer">
        <span class="mult-ref">EBITDA-Multiple: ${mult.low}× – ${mult.mid}× – ${mult.high}× (Branchenstandard ${sectorDe})</span>
        <span class="discl">Indikative Schätzung. Keine Gewähr.</span>
      </div>
      ${isTurnaround ? `<div style="margin-top:10px;padding:8px 12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;font-size:7.5pt;color:#92400e">
        <strong>⚠ Turnaround-Profil:</strong> Negativer Base-Case-EBITDA (${fE(eBase)}). Eine klassische Multiple-Bewertung ist nicht anwendbar.
        Der Transaktionswert basiert auf einem Restrukturierungsrahmen mit gesonderter Eigenkapital-/Fremdkapitalanpassung.
        Break-even-Umsatz: <strong>${fE(pl?.breakeven_revenue)}</strong>.
      </div>` : ''}
    </div>

    <!-- BUSINESS SNAPSHOT -->
    <div class="sl">Business Snapshot</div>
    <div class="snap-grid">
      <div class="snap-panel"><table>
        <tr><td>Branche</td><td>${safe(sectorDe)}</td></tr>
        <tr><td>Region</td><td>${safe(region)}</td></tr>
        <tr><td>Betriebsalter (est.)</td><td>~${pl?.estimated_age_years ?? '—'} Jahre</td></tr>
        <tr><td>Mitarbeiter (FTE)</td><td>${fN(fte)}</td></tr>
        <tr><td>Fläche</td><td>${facSqm ? `${fN(facSqm)}\u202fm²` : '—'}</td></tr>
        <tr><td>Öffnungszeiten/Woche</td><td>${h?.total_weekly_hours ? `${h.total_weekly_hours}h` : '—'}</td></tr>
        <tr><td>Bruttomargen</td><td>${gm}\u202f%</td></tr>
        <tr><td>Ø Transaktionswert</td><td>${fE(pl?.adjusted_basket_eur)}</td></tr>
        <tr><td>Betriebsstatus</td><td style="color:${r.business_status==='OPERATIONAL'?'#1A5C3A':'#B8730A'}">${safe(r.business_status ?? '—')}</td></tr>
      </table></div>
      <div class="snap-panel"><table>
        <tr><td>Google-Bewertung</td><td>★ ${safe(r.rating ?? '—')} / 5,0</td></tr>
        <tr><td>Anzahl Bewertungen</td><td>${fN(r.review_volume ? Number(r.review_volume) : null)}</td></tr>
        <tr><td>Sentiment Score</td><td style="color:${(ra?.sentiment_score??0)>=0?'#1A5C3A':'#B91C1C'}">${s(ra?.sentiment_score)}</td></tr>
        <tr><td>Wettbewerber (1\u202fkm)</td><td>${fN(r.competitor_count)}</td></tr>
        <tr><td>Area Quality Index</td><td>${am?.quality_index != null ? `${am.quality_index}/100` : '—'}</td></tr>
        <tr><td>Digital Risk Score</td><td style="color:${dvRiskColor}">${dv?.overall_risk_score != null ? `${dv.overall_risk_score}/100${dv.overall_risk_score>=80?' ⚠':''}` : '—'}</td></tr>
        <tr><td>Saisonalitätskoeff.</td><td style="color:${(sp?.seasonality_coefficient??0)>0.35?'#B8730A':'#1A5C3A'}">${sp?.seasonality_coefficient != null ? `${sp.seasonality_coefficient.toFixed(2)}${sp.high_risk_flag?' ⚠':''}` : '—'}</td></tr>
        <tr><td>KfW-Förderung</td><td style="color:${kfw?.eligible?'#1A5C3A':'#B91C1C'}">${kfw != null ? (kfw.eligible ? '✓ Förderfähig' : '✗ Nicht förderfähig') : '—'}</td></tr>
      </table></div>
    </div>

    ${pgFooter(ref, 1)}
  </div>`;

  // ── PAGE 2 ───────────────────────────────────────────────────────────────────
  const p2 = `
  <div class="pg">
    ${ph(ref, 2)}
    <div class="sh"><h2>Betriebszeiten · Attribute · Wettbewerber · Kundenbewertungen</h2><span class="pg-tag">Seite 2 / 4</span></div>

    <!-- HOURS -->
    <div class="sl">Öffnungszeiten</div>
    ${hourLines.length ? `
    <table class="dt" style="margin-bottom:10px">
      <thead><tr><th style="text-align:left">Wochentag</th><th style="text-align:right">Zeiten</th></tr></thead>
      <tbody>
        ${hourLines.map((line, i) => {
          const [day, ...rest] = line.split(':');
          const time = rest.join(':').trim();
          const closed = /geschlossen|closed/i.test(time);
          return `<tr class="${i%2===1?'alt':''}">
            <td class="l">${safe(day)}</td>
            <td style="color:${closed?'#B91C1C':'#1a1a1a'}">${safe(time || '—')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="font-size:7.5pt;color:var(--mu);margin-bottom:14px">
      Wöchentlich: ${h?.total_weekly_hours ?? '—'}h &nbsp;|&nbsp; Ø ${h?.avg_daily_hours ?? '—'}h/Tag &nbsp;|&nbsp; Wochenende: ${h?.open_on_weekends ? 'Geöffnet' : 'Geschlossen'}
    </div>` : '<div class="tb">Keine Öffnungszeiten verfügbar.</div>'}

    <!-- ATTRIBUTES -->
    <div class="sl">Services & Attribute</div>
    <div class="chips">
      ${attrs.map(a => `<span class="chip ${a.v?'ok':'no'}">${a.v?'✓':'✗'} ${a.label}</span>`).join('')}
      ${attrs.length === 0 ? '<span style="font-size:7.5pt;color:var(--su)">Keine Attribute verfügbar</span>' : ''}
    </div>

    <!-- COMPETITORS -->
    <div class="sl" style="margin-top:14px">Wettbewerber im Umkreis (1\u202fkm) — Anonymisiert</div>
    ${anonComps.length ? `
    <table class="dt">
      <thead><tr><th style="text-align:left">Bezeichnung</th><th>Bewertung</th><th>Rezensionen</th><th>Website</th><th>Entfernung</th></tr></thead>
      <tbody>
        ${anonComps.map((c, i) => `<tr class="${i%2===1?'alt':''}">
          <td class="l">${safe(c.label)}</td>
          <td>${c.rating ? `★ ${safe(c.rating)}` : '—'}</td>
          <td>${c.reviews ? `${fN(Number(c.reviews))}\u202fBew.` : '—'}</td>
          <td>${safe(c.website)}</td>
          <td style="font-size:7pt">${safe(c.dist ?? '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="font-size:7.5pt;color:var(--mu);margin-bottom:14px">
      Marktdurchschnitt: ${mktAvg ? `★ ${mktAvg}` : '—'} &nbsp;|&nbsp; Dieser Betrieb: ${r.rating ? `★ ${r.rating}` : '—'}${ratingDiff ? ` (${parseFloat(ratingDiff)>=0?'+':''}${ratingDiff})` : ''}
    </div>` : '<div class="tb">Keine Wettbewerbsdaten verfügbar.</div>'}

    <!-- REVIEWS -->
    <div class="sl">Sentiment-Analyse</div>
    <div class="mg">
      <div class="mc"><div class="mc-l">Sentiment Score</div><div class="mc-v" style="color:${(ra?.sentiment_score??0)>=0?'#1A5C3A':'#B91C1C'}">${s(ra?.sentiment_score)}</div></div>
      ${ra?.positive != null ? `<div class="mc"><div class="mc-l">Pos / Neg / Neutral</div><div class="mc-v">${ra.positive}↑ ${ra.negative}↓ ${ra.neutral}→</div></div>` : ''}
      ${ra?.avg_review_length != null ? `<div class="mc"><div class="mc-l">Ø Textlänge</div><div class="mc-v">${ra.avg_review_length}\u202fZeichen</div></div>` : ''}
      ${ra?.tourist_ratio_pct != null ? `<div class="mc"><div class="mc-l">Touristen-Anteil</div><div class="mc-v">${ra.tourist_ratio_pct}\u202f%</div></div>` : ''}
      ${ra?.languages?.length ? `<div class="mc"><div class="mc-l">Sprachen</div><div class="mc-v" style="font-size:8pt">${safe(ra.languages.join(', '))}</div></div>` : ''}
      ${(ra?.oldest_date || ra?.newest_date) ? `<div class="mc"><div class="mc-l">Zeitraum</div><div class="mc-v" style="font-size:7pt">${safe(ra?.oldest_date??'')} – ${safe(ra?.newest_date??'')}</div></div>` : ''}
    </div>

    ${(sk?.praises?.length || sk?.complaints?.length) ? `
    <div class="tc">
      <div class="kv-panel">
        <h3>Kernlob (Praises)</h3>
        ${sk?.praises?.slice(0,4).map((p: any) => `<div class="kv-row"><span class="kv-k">📍 ${safe(p.theme)}</span><span class="kv-v">${p.count}×</span></div>`).join('') || '<span style="font-size:7.5pt;color:var(--su)">Keine Daten</span>'}
      </div>
      <div class="kv-panel">
        <h3>Kritikpunkte (Complaints)</h3>
        ${sk?.complaints?.slice(0,4).map((c: any) => `<div class="kv-row"><span class="kv-k">⚠ ${safe(c.theme)}</span><span class="kv-v">${c.count}×</span></div>`).join('') || '<span style="font-size:7.5pt;color:var(--su)">Keine Beschwerden</span>'}
      </div>
    </div>` : ''}

    <div class="sl">Bewertungsauszüge (Anonymisiert)</div>
    ${reviews.slice(0,4).map((rv: any) => `
    <div class="rev">
      <div class="rev-stars">${'★'.repeat(rv.rating ?? 0)}${'☆'.repeat(5 - (rv.rating ?? 0))} (${rv.rating ?? '?'}/5)</div>
      <div class="rev-text">${rv.text ? safe(rv.text.slice(0, 200)) : '[Keine Textbewertung]'}</div>
    </div>`).join('') || '<div class="tb">Keine Bewertungsdetails verfügbar.</div>'}

    ${pgFooter(ref, 2)}
  </div>`;

  // ── PAGE 3 ───────────────────────────────────────────────────────────────────
  const p3 = `
  <div class="pg">
    ${ph(ref, 3)}
    <div class="sh"><h2>Synthetische GuV — Probabilistische Szenarioanalyse</h2><span class="pg-tag">Seite 3 / 4</span></div>

    <div style="font-size:7.5pt;color:var(--mu);margin-bottom:12px">
      Est. Alter: ${pl?.estimated_age_years ?? '—'}\u202fJahre &nbsp;|&nbsp; FTE: ${fte ?? '—'} &nbsp;|&nbsp; Ø\u202fBon: ${fE(pl?.adjusted_basket_eur)} &nbsp;|&nbsp;
      Capture Rate: ${pl?.capture_rate_pessimistic ?? '—'}\u202f% – ${pl?.capture_rate_expected ?? '—'}\u202f% – ${pl?.capture_rate_optimistic ?? '—'}\u202f% &nbsp;|&nbsp; Bruttomarge: ${gm}\u202f%
    </div>

    <table class="dt">
      <thead><tr><th>Position</th><th>Bear Case</th><th>Base Case</th><th>Bull Case</th></tr></thead>
      <tbody>
        <tr>
          <td class="l">Umsatz</td>
          <td>${fE(rLow)}</td><td class="m">${fE(rBase)}</td><td>${fE(rHigh)}</td>
        </tr>
        <tr>
          <td class="l2">./. COGS (${cogsP}\u202f%)</td>
          <td class="neg">${cLow  != null ? `–\u202f${fE(cLow)}`  : '—'}</td>
          <td class="neg m">${cBase != null ? `–\u202f${fE(cBase)}` : '—'}</td>
          <td class="neg">${cHigh != null ? `–\u202f${fE(cHigh)}` : '—'}</td>
        </tr>
        <tr class="tot">
          <td class="l">Rohertrag (${gm}\u202f%)</td>
          <td>${fE(gpLow)}</td><td class="m">${fE(gpBase)}</td><td>${fE(gpHigh)}</td>
        </tr>
        <tr><td colspan="4" class="l2" style="padding:7px 10px 3px;font-size:6pt;text-transform:uppercase;letter-spacing:.08em;color:var(--su)">Fixkosten</td></tr>
        <tr>
          <td class="l2">Personal (${fte ?? '—'}\u202fFTE)</td>
          <td class="neg">${persCost != null ? `–\u202f${fE(persCost)}` : '—'}</td>
          <td class="neg m">${persCost != null ? `–\u202f${fE(persCost)}` : '—'}</td>
          <td class="neg">${persCost != null ? `–\u202f${fE(persCost)}` : '—'}</td>
        </tr>
        <tr>
          <td class="l2">Miete (${facSqm ?? '—'}\u202fm²)</td>
          <td class="neg">${facCost != null ? `–\u202f${fE(facCost)}` : '—'}</td>
          <td class="neg m">${facCost != null ? `–\u202f${fE(facCost)}` : '—'}</td>
          <td class="neg">${facCost != null ? `–\u202f${fE(facCost)}` : '—'}</td>
        </tr>
        <tr>
          <td class="l2">Sonst. OpEx (8\u202f%)</td>
          <td class="neg">${opLow  != null ? `–\u202f${fE(opLow)}`  : '—'}</td>
          <td class="neg m">${opBase != null ? `–\u202f${fE(opBase)}` : '—'}</td>
          <td class="neg">${opHigh != null ? `–\u202f${fE(opHigh)}` : '—'}</td>
        </tr>
        <tr class="space"><td colspan="4"></td></tr>
        <tr class="tot">
          <td class="l">EBITDA</td>
          <td class="${(eLow??0)<0?'neg':'pos'}">${fE(eLow)}</td>
          <td class="${(eBase??0)<0?'neg':'pos'} m">${fE(eBase)}</td>
          <td class="${(eHigh??0)<0?'neg':'pos'}">${fE(eHigh)}</td>
        </tr>
        <tr>
          <td class="l">EBITDA-Marge</td>
          <td class="${emL&&parseFloat(emL)<0?'neg':'pos'}">${emL ? `${emL}\u202f%` : '—'}</td>
          <td class="${emB&&parseFloat(emB)<0?'neg':'pos'} m">${emB ? `${emB}\u202f%` : '—'}</td>
          <td class="${emH&&parseFloat(emH)<0?'neg':'pos'}">${emH ? `${emH}\u202f%` : '—'}</td>
        </tr>
      </tbody>
    </table>

    <!-- Key metrics -->
    <div class="mg">
      ${pl?.revenue_per_employee != null ? `<div class="mc"><div class="mc-l">Umsatz/MA</div><div class="mc-v">${fE(pl.revenue_per_employee)}</div>${pl.sanity_check?.rev_per_employee_benchmark != null ? `<div class="mc-s">Benchmark: ${fE(pl.sanity_check.rev_per_employee_benchmark)}</div>` : ''}</div>` : ''}
      ${pl?.rent_as_revenue_pct != null ? `<div class="mc"><div class="mc-l">Miete / Umsatz</div><div class="mc-v">${pl.rent_as_revenue_pct.toFixed(1)}\u202f%</div></div>` : ''}
      ${pl?.personnel_as_revenue_pct != null ? `<div class="mc"><div class="mc-l">Personal / Umsatz</div><div class="mc-v">${pl.personnel_as_revenue_pct.toFixed(1)}\u202f%</div></div>` : ''}
      ${pl?.fixed_cost_ratio != null ? `<div class="mc"><div class="mc-l">Fixkostenquote (GP)</div><div class="mc-v" style="color:${pl.fixed_cost_ratio>80?'#B91C1C':pl.fixed_cost_ratio>65?'#B8730A':'#1A5C3A'}">${pl.fixed_cost_ratio}\u202f%</div></div>` : ''}
      ${pl?.breakeven_revenue != null ? `<div class="mc"><div class="mc-l">Break-even</div><div class="mc-v">${fE(pl.breakeven_revenue)}</div></div>` : ''}
      ${pl?.total_fixed_costs != null ? `<div class="mc"><div class="mc-l">Fixkosten gesamt</div><div class="mc-v">${fE(pl.total_fixed_costs)}</div></div>` : ''}
    </div>

    ${pl?.industry_avg_ebitda_margin != null ? `<div class="tb">
      <strong>Branchen-EBITDA-Benchmark: ${pl.industry_avg_ebitda_margin}\u202f%</strong>${emB ? ` &nbsp;|&nbsp; Mid-Case EBITDA ${emB}\u202f%${parseFloat(emB)<pl.industry_avg_ebitda_margin?' <span style="color:#B91C1C">⚠ unter Benchmark</span>':' ✓ am Benchmark'}` : ''}
      ${pl.risk_summary ? `<br><br>${safe(pl.risk_summary)}` : ''}
    </div>` : ''}

    <!-- Industry Economics -->
    ${eco ? `
    <div class="sh" style="margin-top:18px"><h2>Branchenwirtschaft — ${safe(eco.industry_label)}</h2></div>
    <div class="tc">
      <div>
        <div class="mg">
          <div class="mc"><div class="mc-l">EBITDA-Multiple</div><div class="mc-v">${eco.ebitda_multiple.low}× – ${eco.ebitda_multiple.mid}× – ${eco.ebitda_multiple.high}×</div></div>
          ${eco.avg_margin_pct != null ? `<div class="mc"><div class="mc-l">Ø EBITDA-Marge</div><div class="mc-v">${eco.avg_margin_pct}\u202f%</div></div>` : ''}
          ${eco.cagr_5y_pct != null ? `<div class="mc"><div class="mc-l">5J CAGR</div><div class="mc-v">${eco.cagr_5y_pct}\u202f%</div></div>` : ''}
          ${eco.market_size_de_bn != null ? `<div class="mc"><div class="mc-l">Marktgröße (DE)</div><div class="mc-v">${eco.market_size_de_bn}\u202fMrd.</div></div>` : ''}
        </div>
        ${eco.trend_summary ? `<div class="tb">${safe(eco.trend_summary)}</div>` : ''}
      </div>
      <div>
        ${eco.yearly?.length ? `
        <div class="kv-panel"><h3>Markt-Timeline</h3>
          ${eco.yearly.slice(0,6).map((y: any) => `<div class="kv-row"><span class="kv-k">${y.year}</span><span class="kv-v" style="font-size:7pt;text-align:right;max-width:200px">${safe(y.context)}</span></div>`).join('')}
        </div>` : ''}
      </div>
    </div>
    ${drivers.length ? `
    <div class="sl">Strukturelle Risikofaktoren</div>
    <table class="dt">
      <thead><tr><th style="text-align:left">Risikofaktor</th><th>Schwere</th><th>Trend</th><th>EBITDA-Impact</th></tr></thead>
      <tbody>
        ${drivers.map((d: any, i: number) => `<tr class="${i%2===1?'alt':''}">
          <td class="l">${safe(d.name)}</td>
          <td style="color:${sevColor[d.severity]??'#555'};font-weight:700;text-transform:uppercase;font-size:7pt">${safe(d.severity?.toUpperCase())}</td>
          <td>${d.trend==='worsening'?'↑ steigend':d.trend==='improving'?'↓ sinkend':'→ stabil'}</td>
          <td class="neg">${d.ebitda_impact_pct?.toFixed(1)}\u202fpp</td>
        </tr>`).join('')}
        ${pl?.dependency_matrix?.net_ebitda_drag_pct != null ? `<tr class="tot"><td class="l">Gesamt EBITDA-Belastung</td><td colspan="2"></td><td class="neg">${pl.dependency_matrix.net_ebitda_drag_pct.toFixed(1)}\u202fpp</td></tr>` : ''}
      </tbody>
    </table>` : ''}` : ''}

    ${pgFooter(ref, 3)}
  </div>`;

  // ── PAGE 4 ───────────────────────────────────────────────────────────────────
  const p4 = `
  <div class="pg">
    ${ph(ref, 4)}
    <div class="sh"><h2>Regionale Daten · Risikoprofil · Finanzierungsrahmen</h2><span class="pg-tag">Seite 4 / 4</span></div>

    <div class="tc">
      <!-- MACRO -->
      <div>
        <div class="sl">Regionale Makroökonomie</div>
        <div class="kv-panel">
          <h3>${safe(mac?.bundesland ?? mac?.city ?? region)}</h3>
          ${mac?.unemployment_pct != null ? `<div class="kv-row"><span class="kv-k">Lokale Arbeitslosigkeit</span><span class="kv-v">${fP(mac.unemployment_pct)}</span></div>` : ''}
          ${mac?.national_avg_unemployment != null ? `<div class="kv-row"><span class="kv-k">Nationale Arbeitslosigkeit</span><span class="kv-v">${fP(mac.national_avg_unemployment)}</span></div>` : ''}
          ${mac?.median_gross_wage != null ? `<div class="kv-row"><span class="kv-k">Medianlohn brutto</span><span class="kv-v">${fE(mac.median_gross_wage)}/Jahr</span></div>` : ''}
          ${mac?.commercial_rent_per_sqm != null ? `<div class="kv-row"><span class="kv-k">Gewerbemiete</span><span class="kv-v">${fE(mac.commercial_rent_per_sqm)}/m²/Monat</span></div>` : ''}
          ${mac?.ppp_index != null ? `<div class="kv-row"><span class="kv-k">PPP-Index (DE=100)</span><span class="kv-v" style="color:${mac.ppp_index<70?'#B8730A':'#1A5C3A'}">${mac.ppp_index.toFixed(1)}</span></div>` : ''}
          ${lf?.index != null ? `<div class="kv-row"><span class="kv-k">Labor Friction Index</span><span class="kv-v" style="color:${lf.index>=70?'#B91C1C':lf.index>=40?'#B8730A':'#1A5C3A'}">${lf.index}/100</span></div>` : ''}
          ${lf?.wage_pressure_flag != null ? `<div class="kv-row"><span class="kv-k">Lohndruck</span><span class="kv-v" style="color:${lf.wage_pressure_flag?'#B8730A':'#1A5C3A'}">${lf.wage_pressure_flag?'Erhöht':'Normal'}</span></div>` : ''}
        </div>
        ${unempHist.length >= 3 ? `
        <div class="sl">Arbeitslosigkeit — Monatsverlauf</div>
        <table class="dt" style="font-size:7pt">
          <thead><tr><th style="text-align:left">Monat</th><th>Quote</th><th style="text-align:left">Monat</th><th>Quote</th></tr></thead>
          <tbody>
            ${Array.from({length: Math.ceil(unempHist.length/2)}, (_,i) => {
              const a = unempHist[i*2];
              const b = unempHist[i*2+1];
              return `<tr class="${i%2===1?'alt':''}">
                <td class="l">${safe(a?.month??'')}</td><td>${a?.rate != null ? `${a.rate.toFixed(1)}\u202f%` : '—'}</td>
                <td class="l">${safe(b?.month??'')}</td><td>${b?.rate != null ? `${b.rate.toFixed(1)}\u202f%` : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>` : ''}
      </div>

      <!-- CITY + AREA -->
      <div>
        <div class="sl">Stadtprofil & Standortqualität</div>
        <div class="kv-panel">
          <h3>Stadtdemografie</h3>
          ${dem?.population != null ? `<div class="kv-row"><span class="kv-k">Stadtbevölkerung</span><span class="kv-v">${fN(dem.population)}</span></div>` : ''}
          ${dem?.population_density_per_km2 != null ? `<div class="kv-row"><span class="kv-k">Dichte</span><span class="kv-v">${fN(dem.population_density_per_km2)}/km²</span></div>` : ''}
          ${dem?.gdp_per_capita_eur != null ? `<div class="kv-row"><span class="kv-k">BIP pro Kopf</span><span class="kv-v">${fE(dem.gdp_per_capita_eur)}</span></div>` : ''}
          ${dem?.demographic_growth_5y_pct != null ? `<div class="kv-row"><span class="kv-k">Bevölkerungstrend (5J)</span><span class="kv-v" style="color:${dem.demographic_growth_5y_pct<0?'#B91C1C':'#1A5C3A'}">${dem.demographic_growth_5y_pct>=0?'+':''}${dem.demographic_growth_5y_pct.toFixed(1)}\u202f%</span></div>` : ''}
          ${dem?.market_saturation_index != null ? `<div class="kv-row"><span class="kv-k">Marktsättigung</span><span class="kv-v">${dem.market_saturation_index.toFixed(1)}\u202fWBW/10k Einw.</span></div>` : ''}
        </div>
        ${am ? `<div class="kv-panel" style="margin-top:8px">
          <h3>Area Overview (1\u202fkm)</h3>
          <div class="kv-row"><span class="kv-k">Area Quality Index</span><span class="kv-v">${am.quality_index}/100</span></div>
          ${am.avg_rating_area != null ? `<div class="kv-row"><span class="kv-k">Ø Bewertung Umgebung</span><span class="kv-v">★ ${am.avg_rating_area.toFixed(1)}</span></div>` : ''}
          ${am.businesses_count != null ? `<div class="kv-row"><span class="kv-k">Betriebe (1\u202fkm)</span><span class="kv-v">${am.businesses_count}</span></div>` : ''}
          ${am.operational_pct != null ? `<div class="kv-row"><span class="kv-k">Betriebsstatus</span><span class="kv-v">${am.operational_pct}\u202f% operational</span></div>` : ''}
          ${am.total_area_reviews != null ? `<div class="kv-row"><span class="kv-k">Bewertungen gesamt</span><span class="kv-v">${fN(am.total_area_reviews)}</span></div>` : ''}
        </div>` : ''}
      </div>
    </div>

    <!-- SEASONALITY -->
    ${sp ? `
    <div class="sl">Saisonalitätsanalyse</div>
    <div class="tc">
      <div class="kv-panel">
        <h3>Saisonalitätsprofil</h3>
        <div class="kv-row"><span class="kv-k">Koeffizient</span><span class="kv-v" style="color:${sp.high_risk_flag?'#B8730A':'#1A5C3A'}">${sp.seasonality_coefficient.toFixed(2)}${sp.high_risk_flag?' ⚠':''}</span></div>
        <div class="kv-row"><span class="kv-k">Risikostufe</span><span class="kv-v">${safe(sp.risk_label)}</span></div>
        ${sp.peak_month   ? `<div class="kv-row"><span class="kv-k">Spitzenmonat</span><span class="kv-v">${safe(sp.peak_month)}</span></div>` : ''}
        ${sp.trough_month ? `<div class="kv-row"><span class="kv-k">Schwächster Monat</span><span class="kv-v">${safe(sp.trough_month)}</span></div>` : ''}
      </div>
      <div class="tb" style="align-self:start">${safe(sp.interpretation)}<br><br><strong>Empfehlung:</strong> ${sp.high_risk_flag?'Mindestens 3 Monate Fixkostenreserve einplanen.':'Saisonales Risiko gering — keine Sonderrücklage erforderlich.'}</div>
    </div>` : ''}

    <!-- KFW -->
    ${kfw ? `
    <div class="sl">KfW-Förderungsprüfung</div>
    <div class="tc">
      <div>
        ${kfwRules.map(r => `
        <div class="ri ${r.pass===null?'warn':r.pass?'pass':'fail'}">
          <div class="ri-dot ${r.pass===null?'warn':r.pass?'pass':'fail'}"></div>
          <div><div class="ri-label">${r.pass===null?'—':r.pass?'✓':' ✗'} ${safe(r.label)}</div></div>
        </div>`).join('')}
        <div style="margin-top:10px;font-size:7.5pt;color:${kfw.eligible?'#1A5C3A':'#B91C1C'};font-weight:700">
          ${kfw.eligible ? `✓ Förderfähig — ${safe(kfw.program ?? '')}` : `✗ Nicht förderfähig`}
        </div>
        ${kfw.failed_rules?.length ? `<div style="font-size:7pt;color:#B91C1C;margin-top:4px">${kfw.failed_rules.map(safe).join(' · ')}</div>` : ''}
        ${kfw.notes?.length ? `<div style="font-size:7pt;color:var(--mu);margin-top:6px">${kfw.notes.map(safe).join(' &nbsp;|&nbsp; ')}</div>` : ''}
      </div>
      ${kfw.program_description ? `<div class="tb" style="align-self:start;font-size:7.5pt">${safe(kfw.program_description)}</div>` : '<div></div>'}
    </div>` : ''}

    <!-- DIGITAL RISK -->
    ${dv ? `
    <div class="sl">IT-Infrastrukturrisiko</div>
    <div class="tc">
      <div>
        <div class="mg">
          <div class="mc"><div class="mc-l">Risiko-Score</div><div class="mc-v" style="color:${dvRiskColor}">${dv.overall_risk_score}/100</div><div class="mc-s">${dv.risk_level?.toUpperCase()}</div></div>
          <div class="mc"><div class="mc-l">Security Headers</div><div class="mc-v">${dv.security_headers_score}\u202f%</div></div>
        </div>
        ${dvItems.map(item => `
        <div class="ri ${item.pass===null?'warn':item.pass?'pass':'fail'}">
          <div class="ri-dot ${item.pass===null?'warn':item.pass?'pass':'fail'}"></div>
          <div><div class="ri-label">${safe(item.label)}</div><div class="ri-note">${safe(item.note)}</div></div>
        </div>`).join('')}
      </div>
      <div>
        ${dv.risks?.slice(0,4).map((risk: any) => `
        <div class="ri ${risk.severity==='critical'||risk.severity==='high'?'fail':risk.severity==='medium'?'warn':'pass'}">
          <div class="ri-dot ${risk.severity==='critical'||risk.severity==='high'?'fail':risk.severity==='medium'?'warn':'pass'}"></div>
          <div><div class="ri-label" style="text-transform:uppercase;font-size:6.5pt">${safe(risk.severity)}</div><div class="ri-note">${safe(risk.description)}</div></div>
        </div>`).join('') ?? ''}
      </div>
    </div>` : ''}

    <!-- ENERGY -->
    ${ev ? `
    <div class="sl">Energie & Supply Chain</div>
    <div class="tc">
      <div class="kv-panel">
        <h3>Energieprofil</h3>
        <div class="kv-row"><span class="kv-k">Energierisiko-Score</span><span class="kv-v">${ev.energy_dependency_score}/100</span></div>
        ${ev.estimated_annual_kwh != null ? `<div class="kv-row"><span class="kv-k">Jahresverbrauch (est.)</span><span class="kv-v">${fN(ev.estimated_annual_kwh)}\u202fkWh</span></div>` : ''}
        ${ev.estimated_energy_cost_eur != null ? `<div class="kv-row"><span class="kv-k">Energiekosten/Jahr</span><span class="kv-v">${fE(ev.estimated_energy_cost_eur)}</span></div>` : ''}
        ${ev.energy_as_opex_pct != null ? `<div class="kv-row"><span class="kv-k">Anteil OpEx</span><span class="kv-v">${ev.energy_as_opex_pct.toFixed(1)}\u202f%</span></div>` : ''}
      </div>
      ${scRisks.length ? `
      <div>
        <table class="dt" style="font-size:7.5pt">
          <thead><tr><th style="text-align:left">Input</th><th>PPI</th><th>Trend</th><th>Margin</th></tr></thead>
          <tbody>
            ${scRisks.map((s: any, i: number) => `<tr class="${i%2===1?'alt':''}">
              <td class="l">${safe(s.category)}</td>
              <td>${s.ppi_index}</td>
              <td>${s.trend==='rising'?'↑':s.trend==='falling'?'↓':'→'}</td>
              <td class="neg">${s.margin_impact_pct?.toFixed(1)}\u202fpp</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div></div>'}
    </div>` : ''}

    <!-- LABOR MARKET -->
    ${lm ? `
    <div class="sl">Arbeitsmarkt-Liquidität</div>
    <div class="tc">
      <div class="kv-panel">
        <h3>Rekrutierungsparameter</h3>
        <div class="kv-row"><span class="kv-k">Ø Vakanzzeit</span><span class="kv-v" style="color:${lm.bottleneck_flag?'#B91C1C':'#1A5C3A'}">${lm.avg_vacancy_days}\u202fTage${lm.bottleneck_flag?' ⚠ ENGPASS':''}</span></div>
        <div class="kv-row"><span class="kv-k">Sektor</span><span class="kv-v">${safe(lm.sector)}</span></div>
        <div class="kv-row"><span class="kv-k">Vakanztrend</span><span class="kv-v">${lm.vacancy_trend==='worsening'?'↑ Verschlechternd':lm.vacancy_trend==='improving'?'↓ Verbessernd':'→ Stabil'}</span></div>
        <div class="kv-row"><span class="kv-k">Ersatzkosten/FTE</span><span class="kv-v">${fE(lm.replacement_cost_per_fte_eur)}</span></div>
        <div class="kv-row"><span class="kv-k">Gesamte Ersatzkosten</span><span class="kv-v">${fE(lm.total_replacement_cost_eur)}</span></div>
        <div class="kv-row"><span class="kv-k">Friction Score</span><span class="kv-v">${lm.recruitment_friction_score}/100</span></div>
      </div>
      <div class="tb" style="align-self:start;font-size:7.5pt">${safe(lm.interpretation)}
        ${lm.risk_signals?.length ? `<br><br>${lm.risk_signals.map((s: string) => `⚠ ${safe(s)}`).join('<br>')}` : ''}
      </div>
    </div>` : ''}

    <!-- CTA -->
    <div class="cta">
      <h2>Interesse an diesem Betrieb?</h2>
      <p>Kontaktieren Sie uns für Zugang zu verifizierten Verkäuferinformationen und vollständige Due-Diligence-Unterlagen.</p>
      <a href="mailto:investors@firmadeal.de?subject=${encodeURIComponent(`Investorenbericht ${ref} – ${sectorDe} – ${region}`)}">investors@firmadeal.de · firmadeal.de</a>
      <div class="cta-meta">Vertraulich · Nur für qualifizierte Investoren · ${ref}</div>
    </div>

    <div class="disclaimer">
      Dieser Bericht basiert ausschließlich auf öffentlich zugänglichen Daten (Google Maps, Statista, Destatis, Bundesagentur für Arbeit u.\u202fa.).
      Alle Finanzkennzahlen sind probabilistische Schätzungen auf Basis algorithmusbasierter Modelle und stellen weder eine Gewähr noch eine steuerliche oder rechtliche Beratung dar.
      Vor jeder Akquisitionsentscheidung ist eine vollständige Due Diligence durch qualifizierte Berater, Wirtschaftsprüfer und Rechtsanwälte erforderlich.
      Firmadeal GmbH übernimmt keine Haftung für die Richtigkeit, Vollständigkeit oder Aktualität der Angaben. Stand: 4. Juni 2026.
    </div>

    ${pgFooter(ref, 4)}
  </div>`;

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
  ${p1}${p2}${p3}${p4}
  <div class="fd-foot">Erstellt mit <strong>Firmadeal</strong> Intelligence Platform &nbsp;·&nbsp; firmadeal.de &nbsp;·&nbsp; 4. Juni 2026</div>
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
  const sector  = (MULTS[pt] ?? MULT_DEF).label.replace(/\s/g, '-');
  const filename = `${ref}-${sector}-Investorenbericht.html`;
  return NextResponse.json({ html, filename });
}
