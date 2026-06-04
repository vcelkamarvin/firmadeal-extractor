import { NextRequest, NextResponse } from 'next/server';

// Real DACH SME M&A EBITDA multiples — 2024 market data
const GERMAN_MULTIPLES: Record<string, { low: number; high: number; label: string; sector_de: string }> = {
  restaurant:     { low: 2.5, high: 4.0, label: 'Gastronomie',              sector_de: 'Gastronomie & Restaurantbetrieb' },
  cafe:           { low: 2.0, high: 3.5, label: 'Café / Kaffeebetrieb',     sector_de: 'Café & Kaffeehausbetrieb' },
  bakery:         { low: 1.5, high: 3.0, label: 'Bäckereibetrieb',          sector_de: 'Bäckerei & Konditorei' },
  bar:            { low: 2.0, high: 3.5, label: 'Bar / Barbetrieb',         sector_de: 'Bar & Getränkegastronomie' },
  lodging:        { low: 4.0, high: 7.0, label: 'Beherbergungsgewerbe',     sector_de: 'Hotel & Beherbergungsgewerbe' },
  hair_care:      { low: 1.5, high: 2.5, label: 'Friseurbetrieb',           sector_de: 'Friseursalon & Haarpflege' },
  beauty_salon:   { low: 1.5, high: 2.5, label: 'Kosmetikstudio',           sector_de: 'Kosmetik & Beauty-Dienstleistungen' },
  car_repair:     { low: 2.5, high: 4.0, label: 'Kfz-Werkstatt',            sector_de: 'Kfz-Service & Reparatur' },
  car_dealer:     { low: 3.0, high: 5.0, label: 'Kraftfahrzeughandel',      sector_de: 'Kraftfahrzeughandel' },
  dentist:        { low: 3.0, high: 5.0, label: 'Zahnarztpraxis',           sector_de: 'Zahnmedizinische Praxis' },
  pharmacy:       { low: 3.5, high: 5.5, label: 'Apotheke',                 sector_de: 'Apotheke & Pharmadistribution' },
  supermarket:    { low: 1.5, high: 3.0, label: 'Lebensmitteleinzelhandel', sector_de: 'Lebensmitteleinzelhandel' },
  hardware_store: { low: 2.0, high: 3.5, label: 'Fachhandel',               sector_de: 'Fachhandel & Einzelhandel' },
};
const MULTIPLES_DEFAULT = { low: 2.5, high: 4.5, label: 'Gewerbebetrieb', sector_de: 'Gewerblicher Betrieb' };

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `€\u202f${(n / 1_000_000).toFixed(2)}\u202fMio.`;
  if (n >= 1_000)     return `€\u202f${Math.round(n / 1_000).toLocaleString('de-DE')}k`;
  return `€\u202f${n.toLocaleString('de-DE')}`;
}

function sentimentSynthesis(ctx: ReturnType<typeof buildContext>): string {
  const { sentiment, rating, reviewCount } = ctx;
  const ratingNum = parseFloat(String(rating)) || 0;
  const sentences: string[] = [];

  if (ratingNum >= 4.5) {
    sentences.push(`Das Unternehmen verfügt über eine außerordentlich starke Marktwahrnehmung mit einer Google-Bewertung von ${rating}/5,0 bei ${Number(reviewCount).toLocaleString('de-DE')} verifizierten Kundenbewertungen — ein Indikator für nachhaltige Kundenbindung und überdurchschnittliche Servicequalität.`);
  } else if (ratingNum >= 4.0) {
    sentences.push(`Mit einer Google-Gesamtbewertung von ${rating}/5,0 (${Number(reviewCount).toLocaleString('de-DE')} Bewertungen) positioniert sich der Betrieb klar im oberen Qualitätssegment seines lokalen Wettbewerbsumfeldes.`);
  } else {
    sentences.push(`Die Kundenbewertungen (${rating}/5,0, n=${Number(reviewCount).toLocaleString('de-DE')}) zeigen ein solides operatives Niveau mit Verbesserungspotenzial in ausgewählten Servicebereichen.`);
  }

  if (sentiment) {
    const score = sentiment.score ?? 0;
    if (score > 0.7) {
      sentences.push(`Die Sentiment-Analyse der jüngsten Bewertungen ergibt einen Netto-Score von +${score.toFixed(1)}: ${sentiment.positive ?? '—'} positive gegenüber ${sentiment.negative ?? '—'} negativen Rückmeldungen, was auf eine konsistent positive Kundenerfahrung hinweist.`);
    } else if (score >= 0) {
      sentences.push(`Die Sentiment-Auswertung (Netto: ${score >= 0 ? '+' : ''}${score.toFixed(1)}) zeigt ein ausgeglichenes bis positives Kundenfeedback-Profil mit konstruktivem Optimierungspotenzial.`);
    }
    if (sentiment.tourists && sentiment.tourists !== '—') {
      sentences.push(`Der demografische Einzugsbereich der Kundschaft umfasst zu ${sentiment.tourists} auswärtige Gäste und Touristen — ein Hinweis auf überregionale Relevanz und Markenbekanntheit über den unmittelbaren Standort hinaus.`);
    }
    if (sentiment.languages && sentiment.languages !== '—' && sentiment.languages.includes(',')) {
      sentences.push(`Die mehrsprachige Bewertungsstruktur (${sentiment.languages}) unterstreicht die internationale Reichweite und die Attraktivität für ein diversifiziertes Kundensegment.`);
    }
  }

  return sentences.join(' ');
}

function buildContext(r: any) {
  const types: string[] = r.types ?? [];
  const primaryType = types.find((t: string) => GERMAN_MULTIPLES[t]) ?? types[0] ?? 'restaurant';
  const mult = GERMAN_MULTIPLES[primaryType] ?? MULTIPLES_DEFAULT;

  const pl    = r.synthetic_pl;
  const ra    = r.review_analysis;
  const hours = r.opening_hours;
  const macro = r.macro_data;

  const revenue  = pl?.revenue?.mid  ?? null;
  const revLow   = pl?.revenue?.low  ?? null;
  const revHigh  = pl?.revenue?.high ?? null;
  const ebitda   = pl?.ebitda?.mid   ?? null;
  const ebitdaLow  = pl?.ebitda?.low  ?? null;
  const ebitdaHigh = pl?.ebitda?.high ?? null;

  const kaufpreisMin = ebitda ? Math.round(ebitda * mult.low)  : null;
  const kaufpreisMax = ebitda ? Math.round(ebitda * mult.high) : null;

  const country      = r.address_detail?.country_code ?? 'DE';
  const region       = r.region ?? r.country ?? 'DACH-Region';
  const countryLabel = country === 'DE' ? 'Deutschland' : country === 'AT' ? 'Österreich' : country === 'CH' ? 'Schweiz' : country === 'CZ' ? 'Tschechien' : 'DACH-Region';

  const services = [
    r.delivery             ? 'Lieferservice'          : null,
    r.dine_in              ? 'Vor-Ort-Verzehr'        : null,
    r.takeout              ? 'Außer-Haus-Verkauf'     : null,
    r.reservable           ? 'Tischreservierung'      : null,
    r.serves_beer          ? 'Bierausschank'          : null,
    r.serves_wine          ? 'Weinausschank'          : null,
    r.serves_breakfast     ? 'Frühstücksservice'      : null,
    r.serves_dinner        ? 'Abendessen'             : null,
    r.wheelchair_accessible ? 'Barrierefreiheit'      : null,
    r.curbside_pickup      ? 'Abholung am Fahrzeug'   : null,
  ].filter(Boolean) as string[];

  const sentiment = ra ? {
    score:     ra.net_sentiment_score,
    positive:  ra.positive_count,
    negative:  ra.negative_count,
    neutral:   ra.neutral_count,
    total:     ra.total_reviews_analysed,
    range:     ra.date_range_covered,
    avgLen:    ra.avg_review_length_chars,
    languages: ra.languages_detected?.join(', ') ?? null,
    tourists:  ra.tourist_percentage != null ? `${ra.tourist_percentage}%` : null,
    praises:   ra.key_praises?.slice(0, 4) ?? [],
  } : null;

  return {
    sectorLabel:  mult.label,
    sectorDe:     mult.sector_de,
    region,
    countryLabel,
    pppIndex:     macro?.ppp_index ?? 100,
    revenue:      revenue   ? fmtEur(revenue)   : 'k.\u202fA.',
    revLow:       revLow    ? fmtEur(revLow)    : null,
    revHigh:      revHigh   ? fmtEur(revHigh)   : null,
    ebitda:       ebitda    ? fmtEur(ebitda)    : 'k.\u202fA.',
    ebitdaLow:    ebitdaLow  ? fmtEur(ebitdaLow)  : null,
    ebitdaHigh:   ebitdaHigh ? fmtEur(ebitdaHigh) : null,
    ebitdaRaw:    ebitda,
    grossMargin:  pl?.gross_margin_pct ?? null,
    multLow:      mult.low,
    multHigh:     mult.high,
    kaufpreisMin: kaufpreisMin ? fmtEur(kaufpreisMin) : 'k.\u202fA.',
    kaufpreisMax: kaufpreisMax ? fmtEur(kaufpreisMax) : 'k.\u202fA.',
    weeklyHours:  hours?.weekly_total_hours ?? null,
    dailyAvg:     hours?.daily_average_hours ?? null,
    schedule:     hours?.text_summary ?? null,
    services,
    rating:       r.rating ?? '—',
    reviewCount:  r.review_volume ?? '—',
    sentiment,
    fte:          pl?.fte_estimate ?? null,
    breakeven:    pl?.breakeven_revenue ? fmtEur(pl.breakeven_revenue) : null,
    fixedCostRatio: pl?.fixed_cost_ratio ?? null,
    floorApplied: pl?.operational_floor_applied ?? false,
    pricing_power: r.pricing_power?.signal ?? null,
  };
}

function renderHtml(ctx: ReturnType<typeof buildContext>): string {
  const today = new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
  const synthesis = sentimentSynthesis(ctx);

  const scenarioRows = (ctx.revLow || ctx.revHigh) ? `
    <table class="scenario-table">
      <thead>
        <tr><th></th><th>Bear</th><th>Base</th><th>Bull</th></tr>
      </thead>
      <tbody>
        <tr>
          <td class="row-label">Umsatz (p.a.)</td>
          <td>${ctx.revLow ?? '—'}</td>
          <td class="mid">${ctx.revenue}</td>
          <td>${ctx.revHigh ?? '—'}</td>
        </tr>
        <tr>
          <td class="row-label">EBITDA</td>
          <td>${ctx.ebitdaLow ?? '—'}</td>
          <td class="mid">${ctx.ebitda}</td>
          <td>${ctx.ebitdaHigh ?? '—'}</td>
        </tr>
      </tbody>
    </table>` : '';

  const serviceChips = ctx.services.map(s =>
    `<span class="chip">${s}</span>`
  ).join('');

  const praisesHtml = ctx.sentiment?.praises?.length
    ? ctx.sentiment.praises.map((p: string) => `<li>${p}</li>`).join('')
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Investment Teaser — ${ctx.sectorLabel}</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #f5f5f5;
    color: #111111;
    line-height: 1.55;
    padding: 32px 24px;
  }

  .page { max-width: 900px; margin: 0 auto; }

  /* ── print button ── */
  .print-bar {
    display: flex; justify-content: flex-end; margin-bottom: 20px;
  }
  .print-btn {
    background: #111111; color: #ffffff; border: none; cursor: pointer;
    font-family: inherit; font-size: 0.8rem; font-weight: 700;
    letter-spacing: 0.05em; padding: 10px 22px; border-radius: 8px;
    transition: background 0.15s;
  }
  .print-btn:hover { background: #1db954; }

  /* ── header ── */
  .header {
    background: #111111;
    border-radius: 16px;
    padding: 36px 40px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(135deg, rgba(29,185,84,0.08) 0%, transparent 60%);
    pointer-events: none;
  }
  .header-eyebrow {
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: #1db954; margin-bottom: 10px;
  }
  .header h1 {
    font-size: 2.2rem; font-weight: 900; letter-spacing: -0.04em;
    color: #ffffff; margin-bottom: 8px;
  }
  .header h1 span { color: #1db954; }
  .header-subtitle {
    font-size: 0.88rem; color: rgba(255,255,255,0.55); font-weight: 400;
  }
  .header-meta {
    display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap;
  }
  .header-meta-item {
    font-size: 0.75rem; color: rgba(255,255,255,0.4); letter-spacing: 0.03em;
  }
  .header-meta-item strong { color: rgba(255,255,255,0.75); font-weight: 600; }

  /* ── section label ── */
  .section-label {
    font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: #999999; margin-bottom: 12px; margin-top: 2px;
  }

  /* ── financial cards ── */
  .fin-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    margin-bottom: 24px;
  }
  .fin-card {
    background: #ffffff; border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px; padding: 18px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .fin-card-label {
    font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: #999999; margin-bottom: 8px;
  }
  .fin-card-value {
    font-size: 1.25rem; font-weight: 800; color: #111111;
    letter-spacing: -0.02em; line-height: 1.2;
  }
  .fin-card-value.accent { color: #1db954; }
  .fin-card-sub {
    font-size: 0.72rem; color: #888888; margin-top: 4px;
  }

  /* ── scenario table ── */
  .scenario-wrap {
    background: #ffffff; border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px; padding: 20px 22px; margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .scenario-table {
    width: 100%; border-collapse: collapse; font-size: 0.83rem;
    font-variant-numeric: tabular-nums;
  }
  .scenario-table th {
    text-align: right; padding: 6px 10px; font-size: 0.66rem;
    text-transform: uppercase; letter-spacing: 0.08em; color: #999999;
    border-bottom: 1px solid rgba(0,0,0,0.07);
  }
  .scenario-table th:first-child { text-align: left; }
  .scenario-table td {
    padding: 8px 10px; text-align: right; color: #555555;
    border-bottom: 1px solid rgba(0,0,0,0.04);
  }
  .scenario-table td.row-label { text-align: left; font-weight: 600; color: #111111; }
  .scenario-table td.mid { font-weight: 700; color: #111111; }
  .scenario-table tr:last-child td { border-bottom: none; }

  /* ── two-col ops ── */
  .ops-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    margin-bottom: 24px;
  }
  .ops-card {
    background: #ffffff; border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px; padding: 20px 22px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .ops-card h3 {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.09em; color: #999999; margin-bottom: 14px;
  }
  .ops-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05);
    font-size: 0.83rem;
  }
  .ops-row:last-child { border-bottom: none; }
  .ops-key { color: #777777; }
  .ops-val { font-weight: 600; color: #111111; text-align: right; }

  /* ── service chips ── */
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    font-size: 0.73rem; font-weight: 600; padding: 4px 10px;
    border-radius: 20px; background: rgba(29,185,84,0.08);
    border: 1px solid rgba(29,185,84,0.2); color: #17a349;
  }

  /* ── sentiment ── */
  .sentiment-card {
    background: #ffffff; border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px; padding: 22px 24px; margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .sentiment-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px; margin-bottom: 18px;
  }
  .sentiment-cell {
    background: #f8f8f8; border: 1px solid rgba(0,0,0,0.07);
    border-radius: 8px; padding: 10px 12px;
  }
  .sentiment-cell-label {
    font-size: 0.63rem; text-transform: uppercase; letter-spacing: 0.07em;
    color: #aaaaaa; margin-bottom: 4px;
  }
  .sentiment-cell-value {
    font-size: 0.9rem; font-weight: 700; color: #111111;
    font-variant-numeric: tabular-nums;
  }
  .sentiment-synthesis {
    font-size: 0.84rem; color: #555555; line-height: 1.7;
    padding-top: 14px; border-top: 1px solid rgba(0,0,0,0.06);
  }
  .praises-list {
    margin: 10px 0 0 0; padding-left: 18px; font-size: 0.8rem;
    color: #777777; line-height: 1.6;
  }

  /* ── footer / cta ── */
  .cta-block {
    background: #ffffff; border: 1px solid rgba(0,0,0,0.08);
    border-radius: 16px; padding: 32px 36px; text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .cta-block h2 {
    font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em;
    color: #111111; margin-bottom: 8px;
  }
  .cta-block p {
    font-size: 0.84rem; color: #777777; margin-bottom: 22px;
  }
  .cta-btn {
    display: inline-block; background: #1db954; color: #ffffff;
    font-family: inherit; font-size: 0.83rem; font-weight: 700;
    letter-spacing: 0.04em; padding: 13px 32px; border-radius: 10px;
    border: none; cursor: pointer; text-decoration: none;
    transition: background 0.15s;
  }
  .cta-btn:hover { background: #17a349; }
  .disclaimer {
    margin-top: 20px; font-size: 0.71rem; color: #aaaaaa; line-height: 1.6;
    border-top: 1px solid rgba(0,0,0,0.06); padding-top: 16px;
  }

  /* ── firmadeal watermark ── */
  .fd-brand {
    text-align: center; margin-top: 24px; font-size: 0.7rem;
    color: #cccccc; letter-spacing: 0.06em; text-transform: uppercase;
  }
  .fd-brand strong { color: #1db954; }

  /* ── print ── */
  @media print {
    body { background: #ffffff; padding: 0; }
    .print-bar { display: none !important; }
    .header { border-radius: 0; }
    .page { max-width: 100%; }
  }

  @media (max-width: 680px) {
    .fin-grid { grid-template-columns: repeat(2, 1fr); }
    .ops-grid  { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- print button -->
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">Als PDF speichern</button>
  </div>

  <!-- header -->
  <div class="header">
    <div class="header-eyebrow">Firmadeal — Vertrauliches Dokument</div>
    <h1>INVESTMENT <span>TEASER</span></h1>
    <div class="header-subtitle">${ctx.sectorDe} &nbsp;·&nbsp; ${ctx.region}, ${ctx.countryLabel} &nbsp;·&nbsp; DACH-Markt</div>
    <div class="header-meta">
      <div class="header-meta-item"><strong>Dokumenttyp</strong>&nbsp; Anonymisierter Investoren-Teaser</div>
      <div class="header-meta-item"><strong>Erstellt</strong>&nbsp; ${today}</div>
      <div class="header-meta-item"><strong>Vertraulichkeit</strong>&nbsp; Nur für interne Investorenprüfung</div>
    </div>
  </div>

  <!-- financial cards -->
  <div class="section-label">Finanzielle Kennzahlen — Schätzwerte (Base-Case)</div>
  <div class="fin-grid">
    <div class="fin-card">
      <div class="fin-card-label">Jahresumsatz (est.)</div>
      <div class="fin-card-value">${ctx.revenue}</div>
      ${ctx.grossMargin ? `<div class="fin-card-sub">Rohertragsmarge ${ctx.grossMargin}%</div>` : ''}
    </div>
    <div class="fin-card">
      <div class="fin-card-label">EBITDA (est.)</div>
      <div class="fin-card-value">${ctx.ebitda}</div>
      ${ctx.breakeven ? `<div class="fin-card-sub">Break-even ${ctx.breakeven}</div>` : ''}
    </div>
    <div class="fin-card">
      <div class="fin-card-label">Branchen-Multiple</div>
      <div class="fin-card-value">${ctx.multLow}× – ${ctx.multHigh}×</div>
      <div class="fin-card-sub">EBITDA-Basis, DACH 2024</div>
    </div>
    <div class="fin-card">
      <div class="fin-card-label">Indikativer Kaufpreis</div>
      <div class="fin-card-value accent">${ctx.kaufpreisMin} – ${ctx.kaufpreisMax}</div>
      <div class="fin-card-sub">Indikativ, vor Due Diligence</div>
    </div>
  </div>

  <!-- scenario table -->
  ${scenarioRows ? `
  <div class="scenario-wrap">
    <div class="section-label" style="margin-bottom:14px">Szenario-Analyse — Bear / Base / Bull</div>
    ${scenarioRows}
  </div>` : ''}

  <!-- operations -->
  <div class="section-label">Betrieb & Leistungsprofil</div>
  <div class="ops-grid">
    <div class="ops-card">
      <h3>Betriebszeiten & Parameter</h3>
      ${ctx.weeklyHours ? `<div class="ops-row"><span class="ops-key">Wochenstunden gesamt</span><span class="ops-val">${ctx.weeklyHours}h</span></div>` : ''}
      ${ctx.dailyAvg    ? `<div class="ops-row"><span class="ops-key">Ø Stunden pro Tag</span><span class="ops-val">${ctx.dailyAvg}h</span></div>` : ''}
      ${ctx.fte         ? `<div class="ops-row"><span class="ops-key">Geschätzte Mitarbeiter (FTE)</span><span class="ops-val">${ctx.fte}</span></div>` : ''}
      ${ctx.fixedCostRatio ? `<div class="ops-row"><span class="ops-key">Fixkostenquote</span><span class="ops-val">${ctx.fixedCostRatio}%</span></div>` : ''}
      ${ctx.schedule ? `<div style="margin-top:12px; font-size:0.77rem; color:#888888; line-height:1.6;">${ctx.schedule}</div>` : ''}
    </div>
    <div class="ops-card">
      <h3>Attribute & Services</h3>
      ${ctx.services.length
        ? `<div class="chips">${serviceChips}</div>`
        : '<span style="font-size:0.82rem;color:#aaaaaa">Keine Angaben verfügbar</span>'
      }
      ${ctx.pricing_power ? `<div style="margin-top:14px;"><div class="ops-row"><span class="ops-key">Pricing-Power-Signal</span><span class="ops-val" style="color:${ctx.pricing_power === 'STRONG' ? '#1db954' : ctx.pricing_power === 'WEAK' ? '#ef4444' : '#f59e0b'}">${ctx.pricing_power === 'STRONG' ? 'Stark' : ctx.pricing_power === 'MODERATE' ? 'Moderat' : 'Schwach'}</span></div></div>` : ''}
    </div>
  </div>

  <!-- sentiment -->
  <div class="section-label">Marktwahrnehmung & Kundenfeedback</div>
  <div class="sentiment-card">
    <div class="sentiment-grid">
      <div class="sentiment-cell">
        <div class="sentiment-cell-label">Google-Bewertung</div>
        <div class="sentiment-cell-value">★ ${ctx.rating} / 5,0</div>
      </div>
      <div class="sentiment-cell">
        <div class="sentiment-cell-label">Anzahl Bewertungen</div>
        <div class="sentiment-cell-value">${Number(ctx.reviewCount).toLocaleString('de-DE')}</div>
      </div>
      ${ctx.sentiment?.score != null ? `
      <div class="sentiment-cell">
        <div class="sentiment-cell-label">Netto-Sentiment</div>
        <div class="sentiment-cell-value">${ctx.sentiment.score >= 0 ? '+' : ''}${ctx.sentiment.score.toFixed(1)}</div>
      </div>` : ''}
      ${ctx.sentiment?.positive != null ? `
      <div class="sentiment-cell">
        <div class="sentiment-cell-label">Positiv / Negativ</div>
        <div class="sentiment-cell-value">${ctx.sentiment.positive} / ${ctx.sentiment.negative}</div>
      </div>` : ''}
      ${ctx.sentiment?.tourists ? `
      <div class="sentiment-cell">
        <div class="sentiment-cell-label">Tourismus-Anteil</div>
        <div class="sentiment-cell-value">${ctx.sentiment.tourists}</div>
      </div>` : ''}
      ${ctx.sentiment?.languages ? `
      <div class="sentiment-cell">
        <div class="sentiment-cell-label">Sprachen</div>
        <div class="sentiment-cell-value" style="font-size:0.78rem">${ctx.sentiment.languages}</div>
      </div>` : ''}
    </div>
    <div class="sentiment-synthesis">
      <p>${synthesis}</p>
      ${praisesHtml ? `<ul class="praises-list">${praisesHtml}</ul>` : ''}
    </div>
  </div>

  <!-- cta -->
  <div class="cta-block">
    <h2>Vollständiges Exposé anfragen</h2>
    <p>Qualifizierte Investoren erhalten auf Anfrage das vollständige Informationsmemorandum inkl. detaillierter Finanzmodelle, Standortanalyse und Due-Diligence-Unterlagen.</p>
    <a class="cta-btn" href="mailto:deals@firmadeal.com?subject=Exposé-Anfrage: ${encodeURIComponent(ctx.sectorLabel + ' – ' + ctx.region)}">Vollständiges Exposé anfragen</a>
    <div class="disclaimer">
      Dieses Dokument ist vollständig anonymisiert und ausschließlich für die institutionelle Investorenprüfung bestimmt. Alle Finanzkennzahlen sind Schätzwerte auf Basis öffentlich zugänglicher Daten und stellen keine Gewähr oder Zusicherung dar. Eine Investitionsentscheidung darf ausschließlich auf Basis geprüfter Jahresabschlüsse und vollständiger Due-Diligence-Unterlagen getroffen werden. Firmadeal GmbH übernimmt keinerlei Haftung für die Richtigkeit der Angaben.
    </div>
  </div>

  <div class="fd-brand">Erstellt mit <strong>Firmadeal</strong> Intelligence Platform &nbsp;·&nbsp; firmadeal.com</div>

</div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ctx  = buildContext(body);
  const html = renderHtml(ctx);
  return NextResponse.json({ html });
}
