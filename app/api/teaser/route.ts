import { NextRequest, NextResponse } from 'next/server';

// ── DACH SME M&A EBITDA multiples 2024 ────────────────────────────────────────
const MULTIPLES: Record<string, { low: number; high: number; label: string; sector_de: string }> = {
  restaurant:     { low: 2.5, high: 4.0, label: 'Gastronomie',               sector_de: 'Gastronomie & Restaurantbetrieb' },
  cafe:           { low: 2.0, high: 3.5, label: 'Café',                       sector_de: 'Café & Kaffeehausbetrieb' },
  bakery:         { low: 1.5, high: 3.0, label: 'Bäckerei',                   sector_de: 'Bäckerei & Konditorei' },
  bar:            { low: 2.0, high: 3.5, label: 'Bar',                         sector_de: 'Bar & Getränkegastronomie' },
  lodging:        { low: 4.0, high: 7.0, label: 'Hotel',                       sector_de: 'Hotel & Beherbergungsgewerbe' },
  hair_care:      { low: 1.5, high: 2.5, label: 'Friseur',                     sector_de: 'Friseursalon & Haarpflege' },
  beauty_salon:   { low: 1.5, high: 2.5, label: 'Kosmetik',                    sector_de: 'Kosmetik & Beauty' },
  car_repair:     { low: 2.5, high: 4.0, label: 'Kfz-Werkstatt',               sector_de: 'Kfz-Service & Reparatur' },
  car_dealer:     { low: 3.0, high: 5.0, label: 'Kraftfahrzeughandel',         sector_de: 'Kraftfahrzeughandel' },
  dentist:        { low: 3.0, high: 5.0, label: 'Zahnarztpraxis',              sector_de: 'Zahnmedizinische Praxis' },
  pharmacy:       { low: 3.5, high: 5.5, label: 'Apotheke',                    sector_de: 'Apotheke & Pharmaeinzelhandel' },
  supermarket:    { low: 1.5, high: 3.0, label: 'Lebensmittelhandel',          sector_de: 'Lebensmitteleinzelhandel' },
  hardware_store: { low: 2.0, high: 3.5, label: 'Fachhandel',                  sector_de: 'Fachhandel & Einzelhandel' },
};
const MULT_DEFAULT = { low: 2.5, high: 4.5, label: 'Gewerbebetrieb', sector_de: 'Gewerblicher Betrieb' };

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtEur(n: number, decimals = 0): string {
  if (Math.abs(n) >= 1_000_000) return `€\u202f${(n / 1_000_000).toFixed(2)}\u202fMio.`;
  if (Math.abs(n) >= 1_000)     return `€\u202f${Math.round(n / 1_000).toLocaleString('de-DE')}k`;
  return `€\u202f${n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
function fmtPct(n: number | null | undefined): string {
  return n != null ? `${n.toFixed(1)}\u202f%` : '—';
}
function sign(n: number): string { return n >= 0 ? '+' : ''; }

// ── Context builder ────────────────────────────────────────────────────────────
function buildContext(r: any) {
  const types: string[]  = r.types ?? [];
  const pt    = types.find((t: string) => MULTIPLES[t]) ?? types[0] ?? 'restaurant';
  const mult  = MULTIPLES[pt] ?? MULT_DEFAULT;

  const pl  = r.synthetic_pl;
  const ra  = r.review_analysis;
  const h   = r.opening_hours;
  const mac = r.macro_data;
  const dem = r.city_demographics;
  const lm  = r.labor_market;
  const dv  = r.digital_vulnerability;
  const pp  = r.pricing_power;
  const ev  = r.energy_vulnerability;

  // Revenue / EBITDA scenarios
  const revBase  = pl?.revenue?.mid  ?? null;
  const revLow   = pl?.revenue?.low  ?? null;
  const revHigh  = pl?.revenue?.high ?? null;
  const eBase    = pl?.ebitda?.mid   ?? null;
  const eLow     = pl?.ebitda?.low   ?? null;
  const eHigh    = pl?.ebitda?.high  ?? null;
  const isNegativeEBITDA = eBase !== null && eBase < 0;

  // Purchase price — only if EBITDA is positive
  const kaufMin = (!isNegativeEBITDA && eBase) ? Math.round(eBase * mult.low)  : null;
  const kaufMax = (!isNegativeEBITDA && eBase) ? Math.round(eBase * mult.high) : null;

  // Country / Region
  const cc     = r.address_detail?.country_code ?? 'DE';
  const region = r.region ?? r.country ?? 'DACH-Region';
  const ccLabel: Record<string, string> = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', CZ: 'Tschechien', PL: 'Polen' };

  // Services
  const services = [
    r.delivery              ? 'Lieferservice'         : null,
    r.dine_in               ? 'Vor-Ort-Verzehr'       : null,
    r.takeout               ? 'Außer-Haus-Verkauf'    : null,
    r.reservable            ? 'Tischreservierung'     : null,
    r.serves_beer           ? 'Bierausschank'         : null,
    r.serves_wine           ? 'Weinausschank'         : null,
    r.serves_breakfast      ? 'Frühstücksservice'     : null,
    r.serves_dinner         ? 'Abendessen'            : null,
    r.wheelchair_accessible ? 'Barrierefreiheit'      : null,
  ].filter(Boolean) as string[];

  return {
    // Identity
    sectorLabel:     mult.label,
    sectorDe:        mult.sector_de,
    region,
    countryCode:     cc,
    countryLabel:    ccLabel[cc] ?? 'DACH-Region',
    rating:          r.rating     ?? null,
    reviewCount:     r.review_volume ?? null,
    businessStatus:  r.business_status ?? null,

    // P&L
    revBase, revLow, revHigh,
    eBase, eLow, eHigh,
    isNegativeEBITDA,
    grossMargin:     pl?.gross_margin_pct  ?? null,
    fte:             pl?.fte_estimate      ?? null,
    personnelCost:   pl?.personnel_cost    ?? null,
    facilityCost:    pl?.facility_cost     ?? null,
    facilitySqm:     pl?.facility_sqm      ?? null,
    totalFixed:      pl?.total_fixed_costs ?? null,
    fixedCostRatio:  pl?.fixed_cost_ratio  ?? null,
    breakeven:       pl?.breakeven_revenue ?? null,
    floorApplied:    pl?.operational_floor_applied ?? false,
    kaufMin, kaufMax,
    multLow: mult.low, multHigh: mult.high,

    // Macro
    ppp:             mac?.ppp_index              ?? null,
    wage:            mac?.median_gross_wage       ?? null,
    rent:            mac?.commercial_rent_per_sqm ?? null,
    unemployment:    mac?.unemployment_rate       ?? null,

    // Demographics
    population:      dem?.city_population         ?? null,
    popTrend:        dem?.population_trend_5y_pct ?? null,
    cityName:        dem?.city_name               ?? region,

    // Labor market
    laborFriction:   lm?.labor_friction_index  ?? null,
    laborNote:       lm?.interpretation         ?? null,

    // Digital vulnerability
    dvScore:         dv?.overall_risk_score     ?? null,
    dvSsl:           dv?.ssl_valid              ?? null,
    dvSpf:           dv?.spf_record             ?? null,
    dvDmarc:         dv?.dmarc_record           ?? null,
    dvNotes:         dv?.risk_notes             ?? null,

    // Competition / pricing power
    competitorCount: r.competitor_count          ?? null,
    competitors:     r.competitors               ?? [],
    demandShare:     pp?.demand_share_pct        ?? null,
    ratingVsMarket:  pp?.rating_vs_market        ?? null,
    pricingSignal:   pp?.signal                  ?? null,

    // Ops
    weeklyHours:     h?.weekly_total_hours        ?? null,
    dailyAvg:        h?.daily_average_hours       ?? null,
    schedule:        h?.text_summary              ?? null,
    services,

    // Sentiment
    sentiment: ra ? {
      score:    ra.net_sentiment_score,
      positive: ra.positive_count,
      negative: ra.negative_count,
      neutral:  ra.neutral_count,
      total:    ra.total_reviews_analysed,
      range:    ra.date_range_covered,
      languages: ra.languages_detected?.join(', ') ?? null,
      tourists: ra.tourist_percentage,
      praises:  ra.key_praises?.slice(0, 4) ?? [],
    } : null,
  };
}

// ── HTML renderer ──────────────────────────────────────────────────────────────
function render(c: ReturnType<typeof buildContext>): string {
  const today = '4. Juni 2026';

  // EBITDA display helpers
  const eBaseStr  = c.eBase  != null ? fmtEur(c.eBase)  : 'k.\u202fA.';
  const eLowStr   = c.eLow   != null ? fmtEur(c.eLow)   : '—';
  const eHighStr  = c.eHigh  != null ? fmtEur(c.eHigh)  : '—';
  const revBaseStr = c.revBase ? fmtEur(c.revBase) : 'k.\u202fA.';
  const revLowStr  = c.revLow  ? fmtEur(c.revLow)  : '—';
  const revHighStr = c.revHigh ? fmtEur(c.revHigh) : '—';

  // Turnaround vs normal valuation card
  const valuationHtml = c.isNegativeEBITDA
    ? `<div class="fin-card turnaround-card" style="grid-column:span 2">
        <div class="fin-card-label">Transaktionswert</div>
        <div class="fin-card-value" style="font-size:1rem;color:#b45309;">Turnaround / Sanierungsobjekt</div>
        <div class="fin-card-sub" style="margin-top:6px;line-height:1.5;">
          Das negative Base-Case-EBITDA von ${eBaseStr} schließt eine klassische Multiple-Bewertung aus.
          Der Transaktionswert basiert auf einem Restrukturierungsrahmen und erfordert gesonderte
          Eigenkapital- oder Fremdkapitalanpassungen im Rahmen einer individuellen Due-Diligence-Prüfung.
        </div>
      </div>`
    : `<div class="fin-card">
        <div class="fin-card-label">Indikativer Kaufpreis</div>
        <div class="fin-card-value accent">${c.kaufMin ? fmtEur(c.kaufMin) : '—'} – ${c.kaufMax ? fmtEur(c.kaufMax) : '—'}</div>
        <div class="fin-card-sub">Vor Due Diligence · ${c.multLow}× – ${c.multHigh}× EBITDA</div>
      </div>`;

  // EBITDA card color
  const ebitdaColor = c.isNegativeEBITDA ? '#dc2626' : '#111111';
  const ebitdaSubLabel = c.isNegativeEBITDA
    ? '<div class="fin-card-sub" style="color:#dc2626">Turnaround — negativer EBITDA</div>'
    : `<div class="fin-card-sub">Branchen-Ø ${c.multLow}× – ${c.multHigh}× EBITDA</div>`;

  // Page 3: scenario table rows
  const cogsBase  = c.revBase  ? Math.round(c.revBase  * ((100 - (c.grossMargin ?? 12)) / 100)) : null;
  const cogsLow   = c.revLow   ? Math.round(c.revLow   * ((100 - (c.grossMargin ?? 12)) / 100)) : null;
  const cogsHigh  = c.revHigh  ? Math.round(c.revHigh  * ((100 - (c.grossMargin ?? 12)) / 100)) : null;
  const gpBase    = c.revBase  ? Math.round(c.revBase  * ((c.grossMargin ?? 12) / 100)) : null;
  const gpLow     = c.revLow   ? Math.round(c.revLow   * ((c.grossMargin ?? 12) / 100)) : null;
  const gpHigh    = c.revHigh  ? Math.round(c.revHigh  * ((c.grossMargin ?? 12) / 100)) : null;
  const varBase   = c.revBase  ? Math.round(c.revBase  * 0.08) : null;
  const varLow    = c.revLow   ? Math.round(c.revLow   * 0.08) : null;
  const varHigh   = c.revHigh  ? Math.round(c.revHigh  * 0.08) : null;

  // Page 4: digital risk chips
  const dvItems = [
    { label: 'SSL/TLS', ok: c.dvSsl !== false, note: c.dvSsl === false ? 'Fehlt — kritisches Sicherheitsrisiko' : 'Aktiv' },
    { label: 'SPF-Eintrag', ok: c.dvSpf !== false, note: c.dvSpf === false ? 'Fehlt — E-Mail-Spoofing möglich' : 'Vorhanden' },
    { label: 'DMARC-Richtlinie', ok: c.dvDmarc !== false, note: c.dvDmarc === false ? 'Fehlt — keine Betrugsabwehr' : 'Konfiguriert' },
  ];

  const dvRiskColor = (c.dvScore ?? 0) >= 80 ? '#dc2626' : (c.dvScore ?? 0) >= 50 ? '#d97706' : '#16a34a';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Investment Teaser — ${c.sectorLabel} · Firmadeal</title>
<style>
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

:root {
  --espresso:   #2C1A0E;
  --espresso2:  #3D2410;
  --cream:      #FAF7F2;
  --cream2:     #F3EDE3;
  --white:      #FFFFFF;
  --green:      #1db954;
  --green-d:    #17a349;
  --amber:      #b45309;
  --red:        #dc2626;
  --text:       #1a1a1a;
  --muted:      #6b6b6b;
  --subtle:     #999999;
  --border:     rgba(0,0,0,0.09);
}

body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  background: var(--cream);
  color: var(--text);
  line-height: 1.55;
}

/* ── page wrapper ── */
.page-wrap {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 0 40px;
}

/* ── print bar ── */
.print-bar {
  display: flex; justify-content: flex-end; padding: 20px 32px 12px;
  background: var(--cream);
}
.print-btn {
  background: var(--espresso); color: #fff; border: none; cursor: pointer;
  font-family: inherit; font-size: 0.78rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  padding: 10px 24px; border-radius: 8px; transition: background .15s;
}
.print-btn:hover { background: var(--green); }

/* ── page section (triggers page break) ── */
.page-section {
  padding: 36px 40px;
  page-break-after: always;
  break-after: page;
  background: var(--cream);
}
.page-section:last-of-type { page-break-after: auto; break-after: auto; }

/* ── header banner ── */
.header-banner {
  background: var(--espresso);
  border-radius: 14px;
  padding: 36px 40px;
  margin-bottom: 28px;
  position: relative;
  overflow: hidden;
}
.header-banner::after {
  content: '';
  position: absolute; top:0; left:0; right:0; bottom:0;
  background: linear-gradient(135deg, rgba(29,185,84,.07) 0%, transparent 55%);
  pointer-events: none;
}
.banner-eyebrow {
  font-size: .66rem; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: var(--green); margin-bottom: 10px;
}
.banner-title {
  font-size: 2.4rem; font-weight: 900; letter-spacing: -.04em;
  color: #fff; margin-bottom: 6px;
}
.banner-title span { color: var(--green); }
.banner-sub {
  font-size: .87rem; color: rgba(255,255,255,.5); margin-bottom: 20px;
}
.banner-meta {
  display: flex; flex-wrap: wrap; gap: 22px;
  border-top: 1px solid rgba(255,255,255,.1); padding-top: 16px;
}
.banner-meta-item { font-size: .73rem; color: rgba(255,255,255,.38); }
.banner-meta-item strong { color: rgba(255,255,255,.72); font-weight:600; }

/* ── section header ── */
.section-banner {
  background: var(--espresso2);
  border-radius: 10px;
  padding: 20px 28px;
  margin-bottom: 22px;
  display: flex; align-items: center; justify-content: space-between;
}
.section-banner h2 {
  font-size: 1rem; font-weight: 800; letter-spacing: -.01em; color: #fff;
}
.section-banner .page-tag {
  font-size: .64rem; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--green);
  background: rgba(29,185,84,.12); border: 1px solid rgba(29,185,84,.2);
  padding: 4px 10px; border-radius: 20px;
}

/* ── section label ── */
.slabel {
  font-size: .65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .1em; color: var(--subtle); margin-bottom: 12px;
}

/* ── financial cards ── */
.fin-grid {
  display: grid; grid-template-columns: repeat(4,1fr); gap: 12px;
  margin-bottom: 24px;
}
.fin-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: 12px; padding: 18px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.05);
  page-break-inside: avoid; break-inside: avoid;
}
.fin-card-label { font-size:.63rem; text-transform:uppercase; letter-spacing:.08em; color:var(--subtle); margin-bottom:8px; }
.fin-card-value { font-size:1.2rem; font-weight:800; letter-spacing:-.02em; color:var(--text); line-height:1.2; }
.fin-card-value.accent { color: var(--green); }
.fin-card-value.warn   { color: var(--red); }
.fin-card-value.amber  { color: var(--amber); }
.fin-card-sub { font-size:.71rem; color:var(--muted); margin-top:5px; }
.turnaround-card { border-color: rgba(180,83,9,.25); background: #fffbf5; }

/* ── turnaround badge ── */
.turnaround-badge {
  display:inline-flex; align-items:center; gap:8px;
  background:#fef3c7; border:1px solid #fcd34d;
  color:#92400e; font-size:.75rem; font-weight:700;
  padding:8px 16px; border-radius:8px; margin-bottom:20px;
}

/* ── data table ── */
.data-table {
  width:100%; border-collapse:collapse; font-size:.82rem;
  font-variant-numeric:tabular-nums; margin-bottom:20px;
  page-break-inside: avoid; break-inside: avoid;
}
.data-table th {
  text-align:right; padding:8px 12px; font-size:.63rem;
  text-transform:uppercase; letter-spacing:.09em; color:var(--subtle);
  background:var(--cream2); border-bottom:2px solid var(--border);
}
.data-table th:first-child { text-align:left; }
.data-table td {
  padding:9px 12px; text-align:right; color:var(--muted);
  border-bottom:1px solid var(--border);
}
.data-table td.row-label { text-align:left; font-weight:600; color:var(--text); }
.data-table td.mid { font-weight:700; color:var(--text); }
.data-table td.pos { color:#16a34a; font-weight:700; }
.data-table td.neg { color:var(--red); font-weight:700; }
.data-table tr.total-row td { background:var(--cream2); font-weight:700; color:var(--text); }
.data-table tr.spacer td { border-bottom:2px solid var(--border); padding:2px; }
.data-table tr:last-child td { border-bottom:none; }

/* ── macro grid ── */
.macro-grid {
  display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
  gap:10px; margin-bottom:20px;
}
.macro-cell {
  background:var(--white); border:1px solid var(--border);
  border-radius:10px; padding:14px 16px;
  page-break-inside:avoid; break-inside:avoid;
}
.macro-cell-label { font-size:.62rem; text-transform:uppercase; letter-spacing:.07em; color:var(--subtle); margin-bottom:5px; }
.macro-cell-value { font-size:.95rem; font-weight:700; color:var(--text); }
.macro-cell-sub   { font-size:.7rem; color:var(--muted); margin-top:3px; }

/* ── two-col layout ── */
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
.panel {
  background:var(--white); border:1px solid var(--border);
  border-radius:12px; padding:20px 22px;
  page-break-inside:avoid; break-inside:avoid;
}
.panel h3 { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:var(--subtle); margin-bottom:14px; }
.kv-row { display:flex; justify-content:space-between; align-items:baseline; padding:6px 0; border-bottom:1px solid rgba(0,0,0,.04); font-size:.82rem; }
.kv-row:last-child { border-bottom:none; }
.kv-key { color:var(--muted); }
.kv-val { font-weight:600; color:var(--text); text-align:right; }

/* ── risk items ── */
.risk-item {
  display:flex; align-items:flex-start; gap:12px;
  padding:12px 14px; border-radius:8px; margin-bottom:8px;
  page-break-inside:avoid; break-inside:avoid;
}
.risk-item.fail { background:#fef2f2; border:1px solid rgba(220,38,38,.15); }
.risk-item.pass { background:#f0fdf4; border:1px solid rgba(22,163,74,.15); }
.risk-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:5px; }
.risk-dot.fail { background:var(--red); }
.risk-dot.pass { background:#16a34a; }
.risk-label { font-size:.8rem; font-weight:700; color:var(--text); margin-bottom:2px; }
.risk-note  { font-size:.74rem; color:var(--muted); line-height:1.5; }

/* ── chips ── */
.chips { display:flex; flex-wrap:wrap; gap:6px; }
.chip  { font-size:.72rem; font-weight:600; padding:4px 10px; border-radius:20px; background:rgba(29,185,84,.07); border:1px solid rgba(29,185,84,.2); color:#17a349; }

/* ── text block ── */
.text-block { font-size:.82rem; color:var(--muted); line-height:1.75; margin-bottom:18px; padding:18px 20px; background:var(--white); border-radius:10px; border:1px solid var(--border); }
.text-block strong { color:var(--text); }

/* ── CTA ── */
.cta-block { background:var(--espresso); border-radius:14px; padding:36px 40px; text-align:center; margin-top:8px; }
.cta-block h2 { font-size:1.2rem; font-weight:800; color:#fff; margin-bottom:8px; }
.cta-block p  { font-size:.84rem; color:rgba(255,255,255,.5); margin-bottom:24px; max-width:520px; margin-left:auto; margin-right:auto; }
.cta-btn { display:inline-block; background:var(--green); color:#fff; font-family:inherit; font-size:.84rem; font-weight:700; letter-spacing:.04em; padding:14px 36px; border-radius:10px; border:none; cursor:pointer; text-decoration:none; }
.cta-btn:hover { background:var(--green-d); }
.disclaimer { margin-top:20px; font-size:.68rem; color:rgba(255,255,255,.3); line-height:1.7; border-top:1px solid rgba(255,255,255,.1); padding-top:16px; }

/* ── footer ── */
.fd-footer { text-align:center; padding:20px; font-size:.68rem; color:var(--subtle); letter-spacing:.06em; text-transform:uppercase; }
.fd-footer strong { color:var(--green); }

/* ── print ── */
@media print {
  body { background:#fff; }
  .print-bar { display:none !important; }
  .page-section { padding:28px 36px; }
  .header-banner, .section-banner { border-radius:0; }
  .page-wrap { max-width:100%; }
}

@media (max-width:680px) {
  .fin-grid { grid-template-columns:repeat(2,1fr); }
  .two-col  { grid-template-columns:1fr; }
  .page-section { padding:24px 20px; }
}
</style>
</head>
<body>
<div class="page-wrap">

  <!-- print bar -->
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">Als PDF speichern</button>
  </div>

  <!-- ════════════════════════════════════════════════════════════ PAGE 1 ══ -->
  <div class="page-section">

    <div class="header-banner">
      <div class="banner-eyebrow">Firmadeal · Vertrauliches Dokument · ${today}</div>
      <div class="banner-title">INVESTMENT <span>TEASER</span></div>
      <div class="banner-sub">${c.sectorDe} &nbsp;·&nbsp; ${c.region}, ${c.countryLabel} &nbsp;·&nbsp; DACH-Markt</div>
      <div class="banner-meta">
        <div class="banner-meta-item"><strong>Dokumenttyp</strong>&nbsp; Anonymisierter Investoren-Teaser</div>
        <div class="banner-meta-item"><strong>Erstellt</strong>&nbsp; ${today}</div>
        <div class="banner-meta-item"><strong>Sektor</strong>&nbsp; ${c.sectorLabel}</div>
        <div class="banner-meta-item"><strong>Status</strong>&nbsp; ${c.businessStatus === 'OPERATIONAL' ? 'Operativ' : c.businessStatus ?? '—'}</div>
        <div class="banner-meta-item"><strong>Vertraulichkeit</strong>&nbsp; Nur für interne Investorenprüfung</div>
      </div>
    </div>

    ${c.isNegativeEBITDA ? `<div class="turnaround-badge">⚠ Turnaround-Profil / Sanierungsobjekt — Negativer Base-Case-EBITDA</div>` : ''}

    <div class="slabel">Transaktionskennzahlen — Schätzwerte Base Case</div>
    <div class="fin-grid">
      <div class="fin-card">
        <div class="fin-card-label">Jahresumsatz (est.)</div>
        <div class="fin-card-value">${revBaseStr}</div>
        ${c.grossMargin != null ? `<div class="fin-card-sub">Rohertragsmarge ${c.grossMargin}\u202f%</div>` : ''}
      </div>
      <div class="fin-card">
        <div class="fin-card-label">EBITDA (Base Case)</div>
        <div class="fin-card-value ${c.isNegativeEBITDA ? 'warn' : ''}" style="color:${ebitdaColor}">${eBaseStr}</div>
        ${ebitdaSubLabel}
      </div>
      <div class="fin-card">
        <div class="fin-card-label">Break-even-Umsatz</div>
        <div class="fin-card-value ${c.isNegativeEBITDA ? 'amber' : ''}">${c.breakeven ? fmtEur(c.breakeven) : '—'}</div>
        <div class="fin-card-sub">Minimaler Umsatzschwellenwert</div>
      </div>
      ${valuationHtml}
    </div>

    ${c.isNegativeEBITDA ? `
    <div class="text-block">
      <strong>Transaktionsstruktur — Restrukturierungsrahmen:</strong> Das vorliegende Objekt weist im Base Case ein negatives EBITDA von ${eBaseStr} auf.
      Eine klassische Unternehmensbewertung auf Multiple-Basis ist unter diesen Voraussetzungen nicht anwendbar.
      Der indikative Kaufpreis ist von einer vollständigen Restrukturierungsplanung, dem Volumen notwendiger Kapitalzuführungen
      sowie der Verhandlungsbereitschaft des Veräußerers abhängig. Investoren sollten eine Asset-Deal-Struktur mit
      Schuldenübernahme oder eine Kapitalzuführung von mindestens ${c.breakeven ? fmtEur(Math.round(c.breakeven * 0.20)) : '—'} in Betracht ziehen,
      um das operative Defizit zu überbrücken und den Break-even-Umsatz von ${c.breakeven ? fmtEur(c.breakeven) : '—'} zu erreichen.
    </div>` : ''}

    <div class="slabel">Betrieb & Kapazität</div>
    <div class="two-col">
      <div class="panel">
        <h3>Betriebsparameter</h3>
        ${c.weeklyHours != null ? `<div class="kv-row"><span class="kv-key">Wochenstunden gesamt</span><span class="kv-val">${c.weeklyHours}\u202fh</span></div>` : ''}
        ${c.dailyAvg    != null ? `<div class="kv-row"><span class="kv-key">Ø Stunden pro Tag</span><span class="kv-val">${c.dailyAvg}\u202fh</span></div>` : ''}
        ${c.fte         != null ? `<div class="kv-row"><span class="kv-key">Mitarbeiter (FTE)</span><span class="kv-val">${c.fte}</span></div>` : ''}
        ${c.facilitySqm != null ? `<div class="kv-row"><span class="kv-key">Gewerbefläche</span><span class="kv-val">${c.facilitySqm.toLocaleString('de-DE')}\u202fm²</span></div>` : ''}
        ${c.fixedCostRatio != null ? `<div class="kv-row"><span class="kv-key">Fixkostenquote (GP)</span><span class="kv-val">${c.fixedCostRatio}\u202f%</span></div>` : ''}
        ${c.rating != null ? `<div class="kv-row"><span class="kv-key">Google-Bewertung</span><span class="kv-val">★ ${c.rating} / 5,0 (${Number(c.reviewCount).toLocaleString('de-DE')} Rez.)</span></div>` : ''}
        ${c.schedule ? `<div style="margin-top:12px;font-size:.75rem;color:var(--muted);line-height:1.6;">${c.schedule}</div>` : ''}
      </div>
      <div class="panel">
        <h3>Attribute & Services</h3>
        ${c.services.length ? `<div class="chips">${c.services.map(s => `<span class="chip">${s}</span>`).join('')}</div>` : '<span style="font-size:.8rem;color:var(--subtle)">Keine Angaben</span>'}
        ${c.pricingSignal ? `<div style="margin-top:16px" class="kv-row"><span class="kv-key">Pricing-Power-Signal</span><span class="kv-val" style="color:${c.pricingSignal==='STRONG'?'#16a34a':c.pricingSignal==='WEAK'?'var(--red)':'var(--amber)'}">${c.pricingSignal==='STRONG'?'Stark':c.pricingSignal==='MODERATE'?'Moderat':'Schwach'}</span></div>` : ''}
      </div>
    </div>

  </div>

  <!-- ════════════════════════════════════════════════════════════ PAGE 2 ══ -->
  <div class="page-section">

    <div class="section-banner">
      <h2>Makroökonomie & Regionale Standortanalyse</h2>
      <span class="page-tag">Seite 2 / 4</span>
    </div>

    <div class="slabel">Wirtschafts- und Bevölkerungsprofil — ${c.cityName ?? c.region}</div>
    <div class="macro-grid">
      ${c.population    != null ? `<div class="macro-cell"><div class="macro-cell-label">Stadtbevölkerung</div><div class="macro-cell-value">${Number(c.population).toLocaleString('de-DE')}</div></div>` : ''}
      ${c.popTrend      != null ? `<div class="macro-cell"><div class="macro-cell-label">Bevölkerungstrend (5J)</div><div class="macro-cell-value" style="color:${c.popTrend < 0 ? 'var(--red)' : '#16a34a'}">${sign(c.popTrend)}${c.popTrend.toFixed(1)}\u202f%</div><div class="macro-cell-sub">${c.popTrend < 0 ? 'Rückläufige Tendenz' : 'Wachsende Tendenz'}</div></div>` : ''}
      ${c.unemployment  != null ? `<div class="macro-cell"><div class="macro-cell-label">Arbeitslosenquote</div><div class="macro-cell-value">${fmtPct(c.unemployment)}</div><div class="macro-cell-sub">Lokaler Wert</div></div>` : ''}
      ${c.wage          != null ? `<div class="macro-cell"><div class="macro-cell-label">Medianlohn (brutto)</div><div class="macro-cell-value">${fmtEur(c.wage)}\u202fp.a.</div></div>` : ''}
      ${c.ppp           != null ? `<div class="macro-cell"><div class="macro-cell-label">Kaufkraftindex (DE=100)</div><div class="macro-cell-value" style="color:${c.ppp < 70 ? 'var(--amber)' : 'var(--text)'}">${c.ppp.toFixed(1)}</div><div class="macro-cell-sub">${c.ppp < 70 ? 'Deutlich unter DE-Ø' : 'Vergleichbar mit DE-Ø'}</div></div>` : ''}
      ${c.rent          != null ? `<div class="macro-cell"><div class="macro-cell-label">Gewerbermiete (est.)</div><div class="macro-cell-value">${fmtEur(c.rent, 0)}\u202f/m²/Monat</div></div>` : ''}
    </div>

    <div class="slabel">Arbeitsmarktanalyse</div>
    <div class="text-block">
      ${c.laborFriction != null
        ? `<strong>Labor Friction Index: ${c.laborFriction}/100.</strong> ${c.laborNote ?? (c.laborFriction >= 70 ? 'Ein hoher Friction-Score deutet auf erhebliche Rekrutierungsengpässe hin. Die Verfügbarkeit qualifizierter Fachkräfte ist strukturell eingeschränkt, was die Personalplanung und Lohnkostenentwicklung des Zielunternehmens direkt beeinflusst.' : c.laborFriction >= 40 ? 'Moderate Rekrutierungsengpässe. Die regionale Arbeitskräftenachfrage übersteigt das Angebot in spezifischen Qualifikationsprofilen, was zu Lohnprämiendruck in einzelnen Segmenten führen kann.' : 'Entspannter Arbeitsmarkt mit ausreichend verfügbaren Fachkräften für den betreffenden Sektor.')}`
        : 'Keine Arbeitsmarktdaten verfügbar.'
      }
      ${c.unemployment != null ? ` Die lokale Arbeitslosenquote von ${fmtPct(c.unemployment)} liegt ${(c.unemployment ?? 0) < 3 ? 'deutlich unter dem nationalen Durchschnitt, was auf einen angespannten lokalen Arbeitsmarkt hindeutet' : 'im nationalen Durchschnittssegment'}.` : ''}
      ${c.wage != null ? ` Der Medianlohn von ${fmtEur(c.wage)} p.a. definiert die regionale Lohnkostenbasis für die Personalplanung.` : ''}
    </div>

    ${c.ppp != null && c.ppp < 75 ? `
    <div class="slabel">Kaufkraft & Konsumdynamik</div>
    <div class="text-block">
      <strong>Kaufkraftindex: ${c.ppp?.toFixed(1)} (DE = 100).</strong> Die lokale Kaufkraft liegt signifikant unterhalb des deutschen Referenzwertes.
      Dies hat direkte Auswirkungen auf die erzielbaren Durchschnittspreise, die Konsumbereitschaft der Kundschaft sowie auf realistische Umsatzprojektionen.
      Investoren sollten Preisstrategien auf Basis der lokalen Zahlungsbereitschaft kalibrieren und die PPP-Diskrepanz bei der Bewertungsmodellierung berücksichtigen.
      ${c.countryLabel === 'Tschechien' ? 'Im tschechischen Markt sind lokale Kaufkraftindizes typischerweise 40–60% unter dem deutschen Niveau, was sich strukturell in niedrigeren absoluten Umsatzzahlen widerspiegelt.' : ''}
    </div>` : ''}

    <div class="slabel">Gewerbeimmobilienmarkt</div>
    <div class="two-col">
      <div class="panel">
        <h3>Mietkostenstruktur</h3>
        ${c.rent        != null ? `<div class="kv-row"><span class="kv-key">Gewerbermiete (Markt)</span><span class="kv-val">${fmtEur(c.rent, 0)}\u202f€/m²/Monat</span></div>` : ''}
        ${c.facilitySqm != null && c.facilityCost != null ? `<div class="kv-row"><span class="kv-key">Objektfläche (est.)</span><span class="kv-val">${c.facilitySqm.toLocaleString('de-DE')}\u202fm²</span></div>` : ''}
        ${c.facilityCost!= null ? `<div class="kv-row"><span class="kv-key">Jährl. Mietkosten (est.)</span><span class="kv-val">${fmtEur(c.facilityCost)}</span></div>` : ''}
        ${c.rent != null && c.facilitySqm != null ? `<div class="kv-row"><span class="kv-key">Monatliche Mietlast</span><span class="kv-val">${fmtEur(Math.round(c.rent * (c.facilitySqm ?? 0)))}/Monat</span></div>` : ''}
      </div>
      <div class="panel">
        <h3>Standortprofil</h3>
        <div class="kv-row"><span class="kv-key">Region</span><span class="kv-val">${c.region}</span></div>
        <div class="kv-row"><span class="kv-key">Land</span><span class="kv-val">${c.countryLabel}</span></div>
        ${c.ppp != null ? `<div class="kv-row"><span class="kv-key">Kaufkraftindex</span><span class="kv-val">${c.ppp.toFixed(1)} (DE=100)</span></div>` : ''}
        <div class="kv-row"><span class="kv-key">Zielmarkt</span><span class="kv-val">DACH</span></div>
      </div>
    </div>

  </div>

  <!-- ════════════════════════════════════════════════════════════ PAGE 3 ══ -->
  <div class="page-section">

    <div class="section-banner">
      <h2>Probabilistische GuV-Szenarioanalyse</h2>
      <span class="page-tag">Seite 3 / 4</span>
    </div>

    <div class="slabel">Szenario-Vergleich — Bear / Base / Bull</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:42%">Position</th>
          <th>Bear Case</th>
          <th>Base Case</th>
          <th>Bull Case</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="row-label">Umsatz</td>
          <td>${revLowStr}</td>
          <td class="mid">${revBaseStr}</td>
          <td>${revHighStr}</td>
        </tr>
        <tr>
          <td class="row-label" style="padding-left:22px;font-weight:400;color:var(--muted)">./. COGS (${100-(c.grossMargin??12)}\u202f%)</td>
          <td class="neg">${cogsLow  ? `–\u202f${fmtEur(cogsLow)}`  : '—'}</td>
          <td class="neg mid">${cogsBase ? `–\u202f${fmtEur(cogsBase)}` : '—'}</td>
          <td class="neg">${cogsHigh ? `–\u202f${fmtEur(cogsHigh)}` : '—'}</td>
        </tr>
        <tr class="total-row">
          <td class="row-label">Rohertrag (${c.grossMargin ?? 12}\u202f%)</td>
          <td>${gpLow  ? fmtEur(gpLow)  : '—'}</td>
          <td class="mid">${gpBase ? fmtEur(gpBase) : '—'}</td>
          <td>${gpHigh ? fmtEur(gpHigh) : '—'}</td>
        </tr>
        <tr><td colspan="4" class="row-label" style="padding:10px 12px 4px;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:var(--subtle)">Fixkosten</td></tr>
        <tr>
          <td class="row-label" style="padding-left:22px;font-weight:400">Personal (${c.fte ?? '—'}\u202fFTE)</td>
          <td class="neg">${c.personnelCost ? `–\u202f${fmtEur(c.personnelCost)}` : '—'}</td>
          <td class="neg mid">${c.personnelCost ? `–\u202f${fmtEur(c.personnelCost)}` : '—'}</td>
          <td class="neg">${c.personnelCost ? `–\u202f${fmtEur(c.personnelCost)}` : '—'}</td>
        </tr>
        <tr>
          <td class="row-label" style="padding-left:22px;font-weight:400">Miete (${c.facilitySqm ?? '—'}\u202fm²)</td>
          <td class="neg">${c.facilityCost ? `–\u202f${fmtEur(c.facilityCost)}` : '—'}</td>
          <td class="neg mid">${c.facilityCost ? `–\u202f${fmtEur(c.facilityCost)}` : '—'}</td>
          <td class="neg">${c.facilityCost ? `–\u202f${fmtEur(c.facilityCost)}` : '—'}</td>
        </tr>
        <tr>
          <td class="row-label" style="padding-left:22px;font-weight:400">Sonst. OpEx (8\u202f%)</td>
          <td class="neg">${varLow  ? `–\u202f${fmtEur(varLow)}`  : '—'}</td>
          <td class="neg mid">${varBase ? `–\u202f${fmtEur(varBase)}` : '—'}</td>
          <td class="neg">${varHigh ? `–\u202f${fmtEur(varHigh)}` : '—'}</td>
        </tr>
        <tr class="spacer"><td colspan="4"></td></tr>
        <tr class="total-row">
          <td class="row-label">EBITDA</td>
          <td class="${(c.eLow ?? 0) < 0 ? 'neg' : 'pos'}">${eLowStr}</td>
          <td class="${(c.eBase ?? 0) < 0 ? 'neg' : 'pos'} mid">${eBaseStr}</td>
          <td class="${(c.eHigh ?? 0) < 0 ? 'neg' : 'pos'}">${eHighStr}</td>
        </tr>
        ${c.revBase && c.eBase != null ? `
        <tr>
          <td class="row-label">EBITDA-Marge</td>
          <td>${c.revLow  && c.eLow  != null ? (c.eLow/c.revLow*100).toFixed(1)+'\u202f%' : '—'}</td>
          <td class="mid">${(c.eBase/c.revBase*100).toFixed(1)}\u202f%</td>
          <td>${c.revHigh && c.eHigh != null ? (c.eHigh/c.revHigh*100).toFixed(1)+'\u202f%' : '—'}</td>
        </tr>` : ''}
      </tbody>
    </table>

    ${c.fixedCostRatio != null ? `
    <div class="text-block">
      <strong>Strukturelle Analyse:</strong> Die Fixkostenstruktur absorbiert ${c.fixedCostRatio}\u202f% des Rohertrags im Base Case.
      ${c.fixedCostRatio > 80 ? `Dies entspricht einem kritischen Fixkostenverhältnis — der Betrieb ist im Base Case nicht profitabel und benötigt einen Umsatz von mindestens ${c.breakeven ? fmtEur(c.breakeven) : '—'} um die Gewinnschwelle zu erreichen.
      Jeder Euro Umsatz unterhalb dieses Schwellenwerts vertieft das operative Defizit linear.` :
      c.fixedCostRatio > 65 ? `Die Fixkosten erzeugen erheblichen operativen Hebel — eine Umsatzreduktion von 20\u202f% würde das EBITDA überproportional belasten.` :
      `Die Fixkostenbasis ist für den Sektor akzeptabel, bietet jedoch begrenzten Puffer gegen Umsatzrückgänge.`}
      ${c.isNegativeEBITDA ? ` Das Zielunternehmen ist als <strong>Turnaround-Objekt</strong> zu klassifizieren: erst im Bull Case wird ein positives EBITDA von ${eHighStr} erzielt.` : ''}
    </div>` : ''}

    <div class="slabel">Kundenbewertung & Marktwahrnehmung</div>
    ${c.sentiment ? `
    <div class="two-col">
      <div class="panel">
        <h3>Bewertungsmetriken</h3>
        ${c.rating != null ? `<div class="kv-row"><span class="kv-key">Google-Gesamtbewertung</span><span class="kv-val">★ ${c.rating} / 5,0</span></div>` : ''}
        ${c.reviewCount != null ? `<div class="kv-row"><span class="kv-key">Bewertungsvolumen</span><span class="kv-val">${Number(c.reviewCount).toLocaleString('de-DE')}</span></div>` : ''}
        ${c.sentiment.score != null ? `<div class="kv-row"><span class="kv-key">Netto-Sentiment</span><span class="kv-val">${c.sentiment.score >= 0 ? '+' : ''}${c.sentiment.score.toFixed(1)}</span></div>` : ''}
        ${c.sentiment.positive != null ? `<div class="kv-row"><span class="kv-key">Positiv / Negativ</span><span class="kv-val">${c.sentiment.positive} / ${c.sentiment.negative}</span></div>` : ''}
        ${c.sentiment.tourists != null ? `<div class="kv-row"><span class="kv-key">Tourismus-Anteil</span><span class="kv-val">${c.sentiment.tourists}\u202f%</span></div>` : ''}
        ${c.sentiment.languages ? `<div class="kv-row"><span class="kv-key">Sprachen</span><span class="kv-val" style="font-size:.75rem">${c.sentiment.languages}</span></div>` : ''}
      </div>
      <div class="panel">
        <h3>Wettbewerb & Marktposition</h3>
        ${c.competitorCount != null ? `<div class="kv-row"><span class="kv-key">Direkte Wettbewerber (1\u202fkm)</span><span class="kv-val">${c.competitorCount}</span></div>` : ''}
        ${c.demandShare != null ? `<div class="kv-row"><span class="kv-key">Lokaler Nachfrageanteil</span><span class="kv-val">${c.demandShare.toFixed(1)}\u202f%</span></div>` : ''}
        ${c.ratingVsMarket != null ? `<div class="kv-row"><span class="kv-key">Bewertung vs. Marktø</span><span class="kv-val" style="color:${c.ratingVsMarket>0?'#16a34a':'var(--red)'}">${c.ratingVsMarket>0?'+':''}${c.ratingVsMarket.toFixed(2)}</span></div>` : ''}
        ${c.pricingSignal ? `<div class="kv-row"><span class="kv-key">Pricing-Power</span><span class="kv-val" style="color:${c.pricingSignal==='STRONG'?'#16a34a':c.pricingSignal==='WEAK'?'var(--red)':'var(--amber)'}">${c.pricingSignal==='STRONG'?'Stark':c.pricingSignal==='MODERATE'?'Moderat':'Schwach'}</span></div>` : ''}
      </div>
    </div>` : `
    <div class="two-col">
      <div class="panel">
        <h3>Bewertungsmetriken</h3>
        ${c.rating != null ? `<div class="kv-row"><span class="kv-key">Google-Gesamtbewertung</span><span class="kv-val">★ ${c.rating} / 5,0 (${Number(c.reviewCount).toLocaleString('de-DE')} Rez.)</span></div>` : ''}
      </div>
      <div class="panel">
        <h3>Wettbewerb</h3>
        ${c.competitorCount != null ? `<div class="kv-row"><span class="kv-key">Direkte Wettbewerber</span><span class="kv-val">${c.competitorCount}</span></div>` : ''}
      </div>
    </div>`}

  </div>

  <!-- ════════════════════════════════════════════════════════════ PAGE 4 ══ -->
  <div class="page-section">

    <div class="section-banner">
      <h2>IT-Infrastrukturrisiko & Marktumfeld</h2>
      <span class="page-tag">Seite 4 / 4</span>
    </div>

    <div class="slabel">Cybersecurity & Digitale Infrastruktur</div>
    ${c.dvScore != null ? `
    <div class="fin-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="fin-card">
        <div class="fin-card-label">Digital-Risiko-Score</div>
        <div class="fin-card-value" style="color:${dvRiskColor}">${c.dvScore} / 100</div>
        <div class="fin-card-sub">${c.dvScore >= 80 ? 'Kritisch' : c.dvScore >= 50 ? 'Erhöht' : 'Moderat'}</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-label">SSL/TLS-Verschlüsselung</div>
        <div class="fin-card-value" style="color:${c.dvSsl===false?'var(--red)':'#16a34a'}">${c.dvSsl===false?'Fehlt':'Aktiv'}</div>
        <div class="fin-card-sub">${c.dvSsl===false?'Kritisches Datenschutzrisiko':'Verbindung gesichert'}</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-label">E-Mail-Authentifizierung</div>
        <div class="fin-card-value" style="color:${(c.dvSpf===false||c.dvDmarc===false)?'var(--red)':'#16a34a'}">${(c.dvSpf===false||c.dvDmarc===false)?'Unvollständig':'Konfiguriert'}</div>
        <div class="fin-card-sub">${c.dvSpf===false?'SPF fehlt':''} ${c.dvDmarc===false?'· DMARC fehlt':''}</div>
      </div>
    </div>` : ''}

    ${dvItems.map(item => `
    <div class="risk-item ${item.ok ? 'pass' : 'fail'}">
      <div class="risk-dot ${item.ok ? 'pass' : 'fail'}"></div>
      <div>
        <div class="risk-label">${item.label}</div>
        <div class="risk-note">${item.note}</div>
      </div>
    </div>`).join('')}

    ${(c.dvSsl === false || c.dvSpf === false || c.dvDmarc === false) ? `
    <div class="text-block" style="margin-top:16px">
      <strong>Risikobewertung:</strong> Das vorliegende Zielunternehmen weist kritische Sicherheitslücken in der digitalen Infrastruktur auf.
      ${c.dvSsl === false ? 'Das Fehlen einer gültigen SSL/TLS-Verschlüsselung gefährdet die Datenintegrität aller Kundeninteraktionen und verletzt aktuelle DSGVO-Anforderungen. ' : ''}
      ${c.dvSpf === false ? 'Fehlende SPF-Einträge ermöglichen E-Mail-Spoofing im Namen des Unternehmens — ein erhebliches Phishing- und Reputationsrisiko. ' : ''}
      ${c.dvDmarc === false ? 'Die Abwesenheit einer DMARC-Richtlinie bedeutet vollständige Transparenz für betrügerische Akteure, die die Unternehmensdomäne missbrauchen. ' : ''}
      Ein qualifizierter IT-Auditor sollte vor Transaktionsabschluss eine vollständige Sicherheitsprüfung durchführen. Die Kosten der Nachbesserung sind in der Kaufpreisverhandlung zu berücksichtigen.
    </div>` : ''}

    <div class="slabel" style="margin-top:24px">Wettbewerbslandschaft & Marktdynamik</div>
    ${c.competitors?.length > 0 ? `
    <table class="data-table">
      <thead>
        <tr>
          <th style="text-align:left">Wettbewerber</th>
          <th>Bewertung</th>
          <th>Anz. Bewertungen</th>
          <th>Entfernung</th>
        </tr>
      </thead>
      <tbody>
        ${c.competitors.slice(0, 5).map((comp: any) => `
        <tr>
          <td class="row-label">${comp.name ?? '—'}</td>
          <td>${comp.rating ? `★ ${comp.rating}` : '—'}</td>
          <td>${comp.review_count ? Number(comp.review_count).toLocaleString('de-DE') : '—'}</td>
          <td>${comp.distance_m ? `${comp.distance_m}\u202fm` : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : `
    <div class="two-col">
      <div class="panel">
        <h3>Marktumfeld</h3>
        ${c.competitorCount != null ? `<div class="kv-row"><span class="kv-key">Direktwettbewerber (1\u202fkm)</span><span class="kv-val">${c.competitorCount}</span></div>` : ''}
        ${c.demandShare    != null ? `<div class="kv-row"><span class="kv-key">Lokaler Nachfrageanteil</span><span class="kv-val">${c.demandShare.toFixed(1)}\u202f%</span></div>` : ''}
        ${c.ratingVsMarket != null ? `<div class="kv-row"><span class="kv-key">Bewertungsdifferenz zum Marktø</span><span class="kv-val" style="color:${c.ratingVsMarket>0?'#16a34a':'var(--red)'}">${c.ratingVsMarket>0?'+':''}${c.ratingVsMarket.toFixed(2)}</span></div>` : ''}
      </div>
      <div class="panel">
        <h3>Standortbewertung</h3>
        <div class="kv-row"><span class="kv-key">Sektor</span><span class="kv-val">${c.sectorLabel}</span></div>
        <div class="kv-row"><span class="kv-key">Region</span><span class="kv-val">${c.region}</span></div>
        <div class="kv-row"><span class="kv-key">Zielmarkt</span><span class="kv-val">DACH</span></div>
      </div>
    </div>`}

    <!-- CTA -->
    <div class="cta-block" style="margin-top:28px">
      <h2>Vollständiges Exposé anfragen</h2>
      <p>Qualifizierte Investoren und strategische Käufer erhalten auf Anfrage das vollständige Informationsmemorandum inkl. Finanzmodellen, Standortanalyse und Due-Diligence-Unterlagen.</p>
      <a class="cta-btn" href="mailto:deals@firmadeal.de?subject=${encodeURIComponent('Exposé-Anfrage: ' + c.sectorLabel + ' – ' + c.region)}">Vollständiges Exposé anfragen</a>
      <div class="disclaimer">
        Dieses Dokument ist vollständig anonymisiert und ausschließlich für die institutionelle Investorenprüfung bestimmt. Alle Finanzkennzahlen sind probabilistische Schätzwerte, abgeleitet aus Open-Source-Intelligence-Plattformen. Sie stellen keine Gewähr, Zusicherung oder steuerliche bzw. rechtliche Beratung dar. Eine Investitionsentscheidung darf ausschließlich auf Basis geprüfter Jahresabschlüsse, physischer Due Diligence sowie vollständiger Transaktionsdokumentation getroffen werden. Firmadeal GmbH übernimmt keinerlei Haftung für die Richtigkeit oder Vollständigkeit der Angaben. Stand: ${today}.
      </div>
    </div>

  </div>

  <div class="fd-footer">Erstellt mit <strong>Firmadeal</strong> Intelligence Platform &nbsp;·&nbsp; firmadeal.de &nbsp;·&nbsp; ${today}</div>

</div>
</body>
</html>`;
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const ctx  = buildContext(body);
  const html = render(ctx);
  return NextResponse.json({ html });
}
