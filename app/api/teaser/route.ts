import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

// Real DACH SME M&A EBITDA multiples (2024 market data)
const GERMAN_MULTIPLES: Record<string, { low: number; high: number; label: string }> = {
  restaurant:   { low: 2.5, high: 4.0, label: 'Gastronomie' },
  cafe:         { low: 2.0, high: 3.5, label: 'Café / Kaffeebetrieb' },
  bakery:       { low: 1.5, high: 3.0, label: 'Bäckereibetrieb' },
  bar:          { low: 2.0, high: 3.5, label: 'Bar / Barbetrieb' },
  lodging:      { low: 4.0, high: 7.0, label: 'Beherbergungsgewerbe' },
  hair_care:    { low: 1.5, high: 2.5, label: 'Friseurbetrieb' },
  beauty_salon: { low: 1.5, high: 2.5, label: 'Kosmetikstudio' },
  car_repair:   { low: 2.5, high: 4.0, label: 'Kfz-Werkstatt' },
  car_dealer:   { low: 3.0, high: 5.0, label: 'Kraftfahrzeughandel' },
  dentist:      { low: 3.0, high: 5.0, label: 'Zahnarztpraxis' },
  pharmacy:     { low: 3.5, high: 5.5, label: 'Apotheke' },
  supermarket:  { low: 1.5, high: 3.0, label: 'Lebensmitteleinzelhandel' },
  hardware_store: { low: 2.0, high: 3.5, label: 'Fachhandel' },
};
const MULTIPLES_DEFAULT = { low: 2.5, high: 4.5, label: 'Gewerbebetrieb' };

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)} Mio.`;
  if (n >= 1_000) return `€${Math.round(n / 1_000).toLocaleString('de-DE')}k`;
  return `€${n.toLocaleString('de-DE')}`;
}

// Anonymise: drop name, exact address, phone, website, coordinates
// Keep only: region/Bundesland, business type, financial metrics, hours, services, reviews
function buildTeaserContext(r: any) {
  const types: string[] = r.types ?? [];
  const primaryType = types.find((t: string) => GERMAN_MULTIPLES[t]) ?? types[0] ?? 'restaurant';
  const mult = GERMAN_MULTIPLES[primaryType] ?? MULTIPLES_DEFAULT;

  const pl = r.synthetic_pl;
  const ra = r.review_analysis;
  const hours = r.opening_hours;
  const pp = r.pricing_power;
  const macro = r.macro_data;

  const revenue = pl?.revenue?.mid ?? null;
  const ebitda  = pl?.ebitda?.mid  ?? null;
  const kaufpreisMin = ebitda ? Math.round(ebitda * mult.low)  : null;
  const kaufpreisMax = ebitda ? Math.round(ebitda * mult.high) : null;

  // Anonymised region: Bundesland or general area descriptor — never city/street
  const region  = r.region ?? r.country ?? 'DACH-Region';
  const country = r.address_detail?.country_code ?? 'DE';

  const weeklyHours = hours?.weekly_total_hours ?? null;
  const dailyAvg    = hours?.daily_average_hours ?? null;
  const schedule    = hours?.text_summary ?? null;

  const services = [
    r.delivery       ? 'Lieferservice'    : null,
    r.dine_in        ? 'Vor-Ort-Verzehr'  : null,
    r.takeout        ? 'Außer-Haus-Verkauf' : null,
    r.reservable     ? 'Reservierung'     : null,
    r.serves_beer    ? 'Bierausschank'    : null,
    r.serves_wine    ? 'Weinausschank'    : null,
    r.serves_breakfast ? 'Frühstück'      : null,
    r.serves_dinner  ? 'Abendessen'       : null,
    r.wheelchair_accessible ? 'Rollstuhlgerecht' : null,
  ].filter(Boolean).join(', ');

  const sentiment = ra ? {
    score:    ra.net_sentiment_score,
    positive: ra.positive_count,
    negative: ra.negative_count,
    neutral:  ra.neutral_count,
    total:    ra.total_reviews_analysed,
    range:    ra.date_range_covered,
    avgLen:   ra.avg_review_length_chars,
    languages: ra.languages_detected?.join(', ') ?? '—',
    tourists:  ra.tourist_percentage != null ? `${ra.tourist_percentage}%` : '—',
    praises:  ra.key_praises?.slice(0, 5).join(' | ') ?? '—',
  } : null;

  const rating = r.rating ?? '—';
  const reviewCount = r.review_volume ?? '—';

  const pppIndex = macro?.ppp_index ?? 100;
  const countryLabel = country === 'DE' ? 'Deutschland' : country === 'AT' ? 'Österreich' : country === 'CH' ? 'Schweiz' : country === 'CZ' ? 'Tschechien' : 'DACH-Region';

  return {
    sectorLabel: mult.label,
    region,
    countryLabel,
    pppIndex,
    revenue:      revenue  ? fmtEur(revenue)  : 'k. A.',
    ebitda:       ebitda   ? fmtEur(ebitda)   : 'k. A.',
    ebitdaRaw:    ebitda,
    revenueRaw:   revenue,
    multLow:      mult.low,
    multHigh:     mult.high,
    kaufpreisMin: kaufpreisMin ? fmtEur(kaufpreisMin) : 'k. A.',
    kaufpreisMax: kaufpreisMax ? fmtEur(kaufpreisMax) : 'k. A.',
    weeklyHours:  weeklyHours ?? '—',
    dailyAvg:     dailyAvg   ?? '—',
    schedule:     schedule   ?? '—',
    services:     services   || '—',
    rating,
    reviewCount,
    sentiment,
    floorApplied: pl?.operational_floor_applied ?? false,
    grossMargin:  pl?.gross_margin_pct ?? null,
    fte:          pl?.fte_estimate ?? null,
    breakeven:    pl?.breakeven_revenue ? fmtEur(pl.breakeven_revenue) : null,
  };
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const ctx  = buildTeaserContext(body);

  const sentimentBlock = ctx.sentiment
    ? `Sentiment-Analyse:
- Historischer Zeitraum: ${ctx.sentiment.range ?? '—'}
- Stichprobengröße: ${ctx.sentiment.total ?? ctx.reviewCount} Bewertungen
- Google-Bewertung: ${ctx.rating} / 5.0
- Netto-Sentimentscore: ${ctx.sentiment.score != null ? (ctx.sentiment.score > 0 ? '+' : '') + ctx.sentiment.score.toFixed(1) : '—'}
- Aufschlüsselung: ${ctx.sentiment.positive ?? '—'} positiv | ${ctx.sentiment.negative ?? '—'} negativ | ${ctx.sentiment.neutral ?? '—'} neutral
- Durchschnittliche Textlänge: ${ctx.sentiment.avgLen ?? '—'} Zeichen
- Demografieprofil: ${ctx.sentiment.tourists} Touristen / auswärtige Gäste
- Sprachen: ${ctx.sentiment.languages}
- Kernlob / Zitate: ${ctx.sentiment.praises}`
    : `Google-Bewertung: ${ctx.rating} / 5.0 (${ctx.reviewCount} Bewertungen)`;

  const financialBlock = `
- Geschätzter Jahresumsatz: ${ctx.revenue}
- Geschätztes EBITDA: ${ctx.ebitda}${ctx.grossMargin ? ` (Rohertragsmarge: ${ctx.grossMargin}%)` : ''}
- Branchen-Multiple (EBITDA-Basis, DACH-Markt 2024): ${ctx.multLow}x – ${ctx.multHigh}x
- Indikativer Kaufpreis: ${ctx.kaufpreisMin} – ${ctx.kaufpreisMax}
- Break-even-Umsatz: ${ctx.breakeven ?? 'k. A.'}
- Geschätzte FTE: ${ctx.fte ?? '—'}`;

  const systemPrompt = `Du bist ein erfahrener M&A-Analyst und Corporate-Finance-Designer, spezialisiert auf den DACH-Markt. Du erstellst vollständig anonymisierte, institutionell formulierte Investitions-Teaser auf Deutsch. Das Dokument darf keinerlei Hinweise auf den Namen des Unternehmens, die genaue Adresse, Telefonnummer, Website-URL oder präzise Koordinaten enthalten. Verwende stattdessen allgemeine Regionsbeschreibungen und Sektor-Klassifizierungen. Schreibe in professionellem Deutsch, präzise und ohne Marketing-Klischees.`;

  const userPrompt = `Erstelle einen vollständig anonymisierten deutschen Investment-Teaser als einzelne HTML-Seite mit eingebettetem CSS. Das HTML muss druckfertig sein (A4, Hochformat).

### Rohdaten (vertraulich – nicht direkt verwenden, nur verarbeiten)

Sektor: ${ctx.sectorLabel}
Region: ${ctx.region}, ${ctx.countryLabel}
PPP-Index vs. DE=100: ${ctx.pppIndex}

Finanzielle Kennzahlen:
${financialBlock}

Betrieb:
- Wöchentliche Gesamtstunden: ${ctx.weeklyHours}h
- Tages-Durchschnitt: ${ctx.dailyAvg}h
- Öffnungszeiten-Profil: ${ctx.schedule}
- Attribute & Services: ${ctx.services}

${sentimentBlock}

---

### Pflichtstruktur des HTML-Dokuments

1. **Executive Header** — dunkler Balken (#1a2332), Haupttitel "INVESTMENT TEASER" in Weiß, Serifenlos, Großbuchstaben, darunter eine anonymisierte Subtitle-Zeile: Sektor + allgemeine Regionsbezeichnung (z. B. "Gastronomiebetrieb · Süddeutschland · DACH-Markt")

2. **Finanzielle Kennzahlen** — 4 nebeneinander angeordnete Karten (#f8f8f8 Hintergrund, grüner Akzent #1db954): Jahresumsatz, EBITDA, Branchen-Multiple, Indikativer Kaufpreis. Jede Karte: Label oben klein grau, Wert groß fett schwarz.

3. **Betriebsparameter / Attribute** — 2-spaltige Tabelle: links Betriebszeiten-Profil, rechts Attribute & Services. Professionelle deutsche Formulierungen, keine rohen englischen Begriffe.

4. **Marktwahrnehmung** — strukturierter Block mit Sentiment-Kennzahlen und 3–4 professionell umformulierten deutschen Synthese-Sätzen, die Qualität, Kundenbindung und Betriebsstärke hervorheben. Keine direkten Zitate, keine Eigennamen.

5. **Disclaimer + CTA** — grauer Fußzeilen-Bereich mit Button "Vollständiges Exposé anfragen" (#1db954), darunter: "Dieses Dokument ist vollständig anonymisiert und ausschließlich für die institutionelle Investorenprüfung bestimmt. Alle Finanzkennzahlen sind Schätzwerte auf Basis öffentlich zugänglicher Daten."

### Technische Anforderungen
- Vollständiges \`<!DOCTYPE html>\` Dokument mit \`<head>\` und eingebettetem \`<style>\`
- Schriftart: system-ui, -apple-system, 'Helvetica Neue', sans-serif
- Farben: Hintergrund #f5f5f5, Karten #ffffff, Akzent #1db954, Text #111111
- Druckoptimierung: \`@media print { body { background: white; } .no-print { display: none; } }\`
- Drucken-Button oben rechts (no-print Klasse): onclick="window.print()"
- Maximale Breite: 900px, zentriert, Padding 32px
- Kein JavaScript außer dem Print-Button
- Gib NUR das vollständige HTML aus, ohne Markdown-Codeblöcke oder Erklärungstext`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const html = message.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    return NextResponse.json({ html });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Generation failed' }, { status: 500 });
  }
}
