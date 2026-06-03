import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

const KEY        = process.env.GOOGLE_MAPS_API_KEY ?? '';
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const PHOTO_BASE = 'https://places.googleapis.com/v1';

const SEARCH_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.shortFormattedAddress',
  'places.nationalPhoneNumber', 'places.internationalPhoneNumber', 'places.websiteUri',
  'places.googleMapsUri', 'places.businessStatus', 'places.location', 'places.plusCode',
  'places.addressComponents', 'places.rating', 'places.userRatingCount', 'places.reviews',
  'places.currentOpeningHours', 'places.regularOpeningHours', 'places.priceLevel', 'places.types',
  'places.editorialSummary', 'places.delivery', 'places.dineIn', 'places.takeout',
  'places.reservable', 'places.servesBeer', 'places.servesBreakfast', 'places.servesBrunch',
  'places.servesDinner', 'places.servesLunch', 'places.servesWine', 'places.accessibilityOptions',
  'places.curbsidePickup', 'places.photos', 'places.utcOffsetMinutes',
].join(',');

const NEARBY_MASK = [
  'places.id', 'places.displayName', 'places.rating', 'places.userRatingCount',
  'places.websiteUri', 'places.formattedAddress', 'places.types',
  'places.nationalPhoneNumber', 'places.businessStatus', 'places.priceLevel',
].join(',');

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE:    '€',
  PRICE_LEVEL_MODERATE:       '€€',
  PRICE_LEVEL_EXPENSIVE:      '€€€',
  PRICE_LEVEL_VERY_EXPENSIVE: '€€€€',
};
const PRICE_NUM: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
const PRICE_LABEL_NUM: Record<string, number> = { '€': 1, '€€': 2, '€€€': 3, '€€€€': 4 };

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface ReviewData {
  author: string | null;
  photo_url: string | null;
  rating: number | null;
  text: string | null;
  language: string | null;
  date: string | null;
  relative_time: string | null;
}

export interface ReviewAnalysis {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  sentiment_score: number | null;
  avg_review_length: number;
  oldest_date: string | null;
  newest_date: string | null;
  languages: string[];
  tourist_ratio_pct: number | null;
}

export interface HoursData {
  weekday_text: string[];
  open_now: boolean | null;
  total_weekly_hours: number | null;
  open_on_weekends: boolean;
  avg_daily_hours: number | null;
}

export interface AddressDetail {
  street_number: string | null;
  street: string | null;
  sublocality: string | null;
  city: string | null;
  bundesland: string | null;
  landkreis: string | null;
  postal_code: string | null;
  country: string | null;
  country_code: string | null;
}

export interface WebsiteData {
  page_title: string | null;
  meta_description: string | null;
  emails: string[];
  socials: Record<string, string>;
  phones_found: string[];
  keywords: string[];
}

export interface SentimentTheme {
  theme: string;
  examples: string[];
  count: number;
}

export interface SentimentKeywords {
  praises: SentimentTheme[];
  complaints: SentimentTheme[];
  pricing_keywords_positive: number;
  pricing_keywords_negative: number;
}

export interface PointOfInterest {
  id: number;
  name: string;
  category: string;
  subtype: string;
  lat: number;
  lng: number;
}

export interface AreaMetrics {
  quality_index: number;
  businesses_count: number;
  avg_rating_area: number | null;
  operational_pct: number | null;
  total_area_reviews: number;
  avg_price_level_area: number | null;
}

export interface PricingPower {
  price_premium_index: number | null;
  rating_premium: number | null;
  local_demand_share_pct: number | null;
  neg_price_sentiment_ratio: number | null;
  confirmed: boolean;
  factors_met: string[];
  factors_missing: string[];
}

export interface RadarPoint {
  metric: string;
  target: number;
  market: number;
  fullMark: number;
}

export interface IndustryYearData { year: number; context: string; }

export interface IndustryEconomics {
  industry_label: string;
  ebitda_multiple: { low: number; mid: number; high: number };
  avg_margin_pct: number | null;
  market_size_de_bn: number | null;
  cagr_5y_pct: number | null;
  trend_summary: string;
  yearly: IndustryYearData[];
}

export interface CompetitorData {
  name: string | null;
  url: string | null;
  address: string | null;
  rating: string | null;
  review_volume: string | null;
  category: string | null;
  price_level: string | null;
  phone: string | null;
  business_status: string | null;
  distance: string | null;
}

export interface ExtractionPayload {
  place_id: string | null;
  name: string | null;
  types: string[];
  category: string | null;
  business_status: string | null;
  summary: string | null;
  address: string | null;
  vicinity: string | null;
  phone: string | null;
  phone_intl: string | null;
  website: string | null;
  google_maps_url: string | null;
  resolved_url: string | null;
  latitude: number | null;
  longitude: number | null;
  plus_code: string | null;
  address_detail: AddressDetail;
  city: string | null;
  region: string | null;
  country: string | null;
  rating: string | null;
  review_volume: string | null;
  price_level: string | null;
  price_level_num: number | null;
  reviews: ReviewData[];
  review_analysis: ReviewAnalysis | null;
  sentiment_keywords: SentimentKeywords | null;
  opening_hours: HoursData | null;
  is_open: boolean | null;
  delivery: boolean | null;
  dine_in: boolean | null;
  takeout: boolean | null;
  reservable: boolean | null;
  serves_beer: boolean | null;
  serves_breakfast: boolean | null;
  serves_brunch: boolean | null;
  serves_dinner: boolean | null;
  serves_lunch: boolean | null;
  serves_wine: boolean | null;
  wheelchair_accessible: boolean | null;
  curbside_pickup: boolean | null;
  photos: string[];
  photos_count: number;
  website_data: WebsiteData | null;
  competitor_count: number | null;
  competitors: CompetitorData[];
  area_metrics: AreaMetrics | null;
  radar_data: RadarPoint[];
  pricing_power: PricingPower | null;
  points_of_interest: PointOfInterest[];
  industry_economics: IndustryEconomics | null;
  search_interest: string | null;
  spot_category: string | null;
}

// ── Industry economics ─────────────────────────────────────────────────────────

const INDUSTRY_ECONOMICS: Record<string, IndustryEconomics> = {
  lodging: {
    industry_label: 'Hotel & Beherbergung (Deutschland)',
    ebitda_multiple: { low: 7.0, mid: 9.5, high: 13.0 },
    avg_margin_pct: 22, market_size_de_bn: 28.5, cagr_5y_pct: 3.2,
    trend_summary: 'RevPAR 2023 erstmals +8% über Vor-Pandemie-Niveau. Leisure-Segment führend; Business-Reisen noch unter 2019. M&A-Aktivität 2024 hoch; Konsolidierung im Mittelstand.',
    yearly: [
      { year: 2020, context: 'RevPAR −55%; 35.000 Betriebe bedroht; staatliche Überbrückungshilfen' },
      { year: 2021, context: 'Teilöffnung; Umsatz ~42% unter 2019; Städtehotels am härtesten betroffen' },
      { year: 2022, context: 'Starke Aufholjagd; Leisure übertrifft 2019; ADR +18%; Energiekosten steigen' },
      { year: 2023, context: 'RevPAR +8% über 2019; Branchenumsatz 28,5 Mrd. €; Belegung ~72%' },
      { year: 2024, context: 'Stabiles Wachstum; ESG-Anforderungen steigen; Boutique & Lifestyle im Trend' },
    ],
  },
  restaurant: {
    industry_label: 'Gastronomie & Restaurants (Deutschland)',
    ebitda_multiple: { low: 2.5, mid: 3.5, high: 5.0 },
    avg_margin_pct: 8, market_size_de_bn: 52.0, cagr_5y_pct: 1.8,
    trend_summary: 'Delivery-Anteil dauerhaft auf 18%. Personalkosten und Mindestlohn kritisch. Premiumisierung: Gäste gehen seltener, geben aber mehr aus.',
    yearly: [
      { year: 2020, context: 'Lockdowns; Lieferservice +65%; ~35.000 Dauerschließungen; Umsatzminus 40%' },
      { year: 2021, context: 'Yo-yo-Lockdowns; Außengastronomie Hauptumsatzträger; Fachkräftemangel beginnt' },
      { year: 2022, context: 'Vollöffnung; starker Nachholeffekt; Energiekosten explodieren; Insolvenzwelle' },
      { year: 2023, context: 'Umsatz nominal 52 Mrd. € (über 2019); real noch unter Vorkrisen-Niveau' },
      { year: 2024, context: 'Marktbereinigung; Fast-Casual unter Druck; Fine Dining und ethnische Küchen wachsen' },
    ],
  },
  cafe: {
    industry_label: 'Café & Kaffeehäuser (Deutschland)',
    ebitda_multiple: { low: 2.0, mid: 3.2, high: 4.5 },
    avg_margin_pct: 11, market_size_de_bn: 8.2, cagr_5y_pct: 4.1,
    trend_summary: 'Specialty Coffee wächst zweistellig. Third-Wave-Konzepte treiben Premiumisierung. Plant-based Milk Mainstream (28%). Franchise-Expansion vs. Independent-Szene.',
    yearly: [
      { year: 2020, context: 'Take-away rettete viele Konzepte; Kaffeegenuss zuhause stieg +23%' },
      { year: 2021, context: 'Outdoor-Saison entscheidend; starke regionale Unterschiede' },
      { year: 2022, context: 'Arabica-Preise auf 10-Jahres-Hoch; Flat White ~4,50 €' },
      { year: 2023, context: 'Umsatz +31% ggü. 2019 auf 8,2 Mrd. €; Specialty-Segment +67%' },
      { year: 2024, context: 'Real-Estate-Kosten steigen; Concept Stores als Differenzierung' },
    ],
  },
  bakery: {
    industry_label: 'Bäckerei & Konditorei (Deutschland)',
    ebitda_multiple: { low: 3.0, mid: 4.5, high: 6.5 },
    avg_margin_pct: 7, market_size_de_bn: 15.8, cagr_5y_pct: 0.9,
    trend_summary: 'Betriebe −48% seit 2000. Energie- und Rohstoffkosten kritisch. Handwerksbäcker unter Druck von Backshop-Ketten. Premiumisierung als Ausweg.',
    yearly: [
      { year: 2020, context: 'Systemrelevant; kaum Einbußen; Hamsterkäufe; Lieferketten gestört' },
      { year: 2021, context: 'Stabiles Geschäft; Weizenpreise beginnen zu steigen' },
      { year: 2022, context: 'Mehlpreise +65%, Energie +200%; 1.500 Betriebe schließen' },
      { year: 2023, context: 'Preiserhöhungen durchgesetzt (+18%); Volumen leicht rückläufig' },
      { year: 2024, context: 'Normalisierung Rohstoffpreise; Fachkräftemangel kritischster Faktor' },
    ],
  },
  bar: {
    industry_label: 'Bar & Nachtgastronomie (Deutschland)',
    ebitda_multiple: { low: 2.0, mid: 3.0, high: 4.5 },
    avg_margin_pct: 13, market_size_de_bn: 6.5, cagr_5y_pct: 1.2,
    trend_summary: 'No/Low-Alcohol-Trend +35% p.a. Craft-Cocktail-Bars mit Premium-Positionierung stark. Nachtclubs strukturell unter Druck.',
    yearly: [
      { year: 2020, context: 'Härteste Branche: komplette Schließung; keine Take-away-Alternative' },
      { year: 2021, context: 'Weitgehend Verlustjahr; Outdoor-Konzepte halfen im Sommer' },
      { year: 2022, context: 'Euphorie-Effekt; Übernachfrage im Sommer; ADR auf Rekordhoch' },
      { year: 2023, context: 'Normalisierung; Craft-Cocktail +24%; Non-Alc-Menüs Standard' },
      { year: 2024, context: 'Premium stabil; Volumenkonzepte unter Druck; Late Night Economy wächst' },
    ],
  },
  hair_care: {
    industry_label: 'Friseur & Haarpflege (Deutschland)',
    ebitda_multiple: { low: 2.5, mid: 3.8, high: 5.5 },
    avg_margin_pct: 14, market_size_de_bn: 9.1, cagr_5y_pct: 2.3,
    trend_summary: '80.000 Salons in DE. Barbershop-Trend und Premium-Colorist-Studios wachsen überproportional. Mindestlohnerhöhungen treiben Preisanpassungen.',
    yearly: [
      { year: 2020, context: 'Lockdowns; Heimfärbe-Boom; nach Öffnung massive Nachholnachfrage' },
      { year: 2021, context: 'Yo-yo-Schließungen; Fachkräftemangel verschärft sich' },
      { year: 2022, context: 'Preiserhöhungen +12%; Energie- und Produktkosten steigen' },
      { year: 2023, context: 'Umsatz 9,1 Mrd. €; Premiumisierung; Barbershops +8%' },
      { year: 2024, context: 'Franchise-Modelle wachsen; Social-Media-Marketing entscheidend' },
    ],
  },
  car_repair: {
    industry_label: 'Kfz-Werkstatt & Autoreparatur (Deutschland)',
    ebitda_multiple: { low: 4.0, mid: 6.0, high: 8.5 },
    avg_margin_pct: 18, market_size_de_bn: 38.0, cagr_5y_pct: 3.8,
    trend_summary: 'E-Mobilität verändert Servicebedarf strukturell. Fahrzeugalter auf Rekordhoch (10,2 J.) → Reparaturbedarf wächst. Fachkräftemangel kritisch.',
    yearly: [
      { year: 2020, context: 'Systemrelevant; Neuwagen-Mangel treibt Gebraucht- und Reparaturmarkt' },
      { year: 2021, context: 'Halbleitermangel; Lieferzeiten 12+ Monate; Werkstattauslastung steigt' },
      { year: 2022, context: 'Starkes Jahr; Preise +8%; E-Auto-Zertifizierungen boomen' },
      { year: 2023, context: 'Markt 38 Mrd. €; Fahrzeugalter 10,2 Jahre (Rekord)' },
      { year: 2024, context: 'E-Mobility-Readiness entscheidend für Wettbewerbsfähigkeit' },
    ],
  },
  dentist: {
    industry_label: 'Zahnarzt & Dentalpraxis (Deutschland)',
    ebitda_multiple: { low: 4.5, mid: 7.0, high: 10.0 },
    avg_margin_pct: 25, market_size_de_bn: 14.5, cagr_5y_pct: 4.2,
    trend_summary: 'PE-Konsolidierung: 200+ MVZ-Transaktionen p.a. IGel-Leistungen wachsen. Digitale Implantologie und Aligners treiben Premium-Umsatz.',
    yearly: [
      { year: 2020, context: 'COVID: Behandlungsrückstau; Schutzkonzepte teuer; Umsatz −15%' },
      { year: 2021, context: 'Aufholjagd; Wartezeiten 3-6 Monate' },
      { year: 2022, context: 'Normalisierung; PE-Konsolidierung beschleunigt' },
      { year: 2023, context: 'Markt 14,5 Mrd. €; PE-Multiple 8-12x EBITDA für Premium-Praxen' },
      { year: 2024, context: 'Regulatorische Verschärfung MVZ; Digital-Praxis Standard' },
    ],
  },
  pharmacy: {
    industry_label: 'Apotheke (Deutschland)',
    ebitda_multiple: { low: 3.5, mid: 5.5, high: 7.5 },
    avg_margin_pct: 6, market_size_de_bn: 58.0, cagr_5y_pct: 2.1,
    trend_summary: 'E-Rezept revolutioniert den Markt. Apothekenzahl sinkt (unter 17.500). Online-Versandapotheken gewinnen Marktanteile. Kooperationsapotheken auf dem Vormarsch.',
    yearly: [
      { year: 2020, context: 'COVID: Masken- und Testmaterial-Boom; Markt +12%' },
      { year: 2021, context: 'Impfzentren; Markt 52 Mrd. €; Apothekenzahl 18.800' },
      { year: 2022, context: 'E-Rezept-Piloten; Lieferengpässe bei Generika' },
      { year: 2023, context: 'E-Rezept-Rollout; Markt 58 Mrd. €; Online-Versand wächst' },
      { year: 2024, context: 'Strukturwandel; Apothekenzahl unter 17.500; Honorarreform in Diskussion' },
    ],
  },
};

const ECONOMICS_DEFAULT: IndustryEconomics = {
  industry_label: 'Dienstleistungsgewerbe (Deutschland)',
  ebitda_multiple: { low: 3.0, mid: 5.0, high: 8.0 },
  avg_margin_pct: 12, market_size_de_bn: null, cagr_5y_pct: 2.5,
  trend_summary: 'Wirtschaft stagniert 2023/24 (−0,3% / +0,2% BIP). Dienstleistungssektor robuster als Industrie. Zinswende belastet Investitionen und M&A.',
  yearly: [
    { year: 2020, context: 'COVID-19: BIP −4,9%; Kurzarbeit für 6 Mio. Beschäftigte' },
    { year: 2021, context: 'Erholung +2,6%; Lieferketten gestört; Inflation beginnt zu steigen' },
    { year: 2022, context: 'Energiekrise; Inflation 7,9%; Zinswende' },
    { year: 2023, context: 'BIP −0,3%; Rezession; Investitionen rückläufig' },
    { year: 2024, context: 'Verhaltene Erholung +0,2%; Strukturwandel beschleunigt' },
  ],
};

function getIndustryEconomics(types: string[]): IndustryEconomics {
  for (const t of types) {
    if (INDUSTRY_ECONOMICS[t]) return INDUSTRY_ECONOMICS[t];
  }
  return ECONOMICS_DEFAULT;
}

// ── Sentiment themes ───────────────────────────────────────────────────────────

const PRAISE_THEMES_DEF = [
  { theme: 'Service & Staff', keywords: ['freundlich', 'nett', 'aufmerksam', 'hilfsbereit', 'kompetent', 'zuvorkommend', 'super service', 'friendly', 'helpful', 'great staff'] },
  { theme: 'Quality', keywords: ['lecker', 'frisch', 'köstlich', 'exzellent', 'hervorragend', 'hochwertig', 'delicious', 'excellent', 'amazing', 'top qualität'] },
  { theme: 'Atmosphere', keywords: ['gemütlich', 'schön', 'sauber', 'angenehm', 'einladend', 'cozy', 'clean', 'beautiful', 'nice atmosphere'] },
  { theme: 'Value for Money', keywords: ['preiswert', 'günstig', 'fair', 'angemessen', 'gutes preis', 'preis-leistung', 'reasonable', 'worth it'] },
  { theme: 'Would Recommend', keywords: ['empfehlen', 'empfehlenswert', 'immer wieder', 'recommend', 'highly recommend', 'definitiv', 'unbedingt'] },
];

const COMPLAINT_THEMES_DEF = [
  { theme: 'Poor Service', keywords: ['unfreundlich', 'arrogant', 'ignoriert', 'kein service', 'unhelpful', 'rude', 'ignored', 'schlechter service'] },
  { theme: 'Wait Times', keywords: ['warten', 'wartezeit', 'zu lange', 'ewig gewartet', 'slow', 'waited long', 'zu langsam', 'lange wartezeit'] },
  { theme: 'Quality Issues', keywords: ['kalt', 'schlecht', 'enttäuschend', 'alt', 'disappointing', 'bad quality', 'terrible', 'geschmacklos'] },
  { theme: 'Overpriced', keywords: ['teuer', 'überteuert', 'wucher', 'zu teuer', 'overpriced', 'expensive', 'not worth', 'abzocke'] },
  { theme: 'Cleanliness', keywords: ['dreckig', 'schmutzig', 'dirty', 'unclean', 'unhygienic', 'unhygienisch'] },
  { theme: 'Would Not Return', keywords: ['nie wieder', 'never again', 'worst', 'awful', 'avoid', 'nicht empfehlen'] },
];

function analyzeSentimentKeywords(reviews: ReviewData[]): SentimentKeywords {
  const texts = reviews.map(r => (r.text ?? '').toLowerCase());

  const matchThemes = (defs: { theme: string; keywords: string[] }[]): SentimentTheme[] =>
    defs.map(def => {
      const examples: string[] = [];
      let count = 0;
      for (const text of texts) {
        for (const kw of def.keywords) {
          if (text.includes(kw)) {
            count++;
            const sentence = text.split(/[.!?]+/).find(s => s.includes(kw));
            if (sentence && sentence.trim().length > 8 && !examples.some(e => e.includes(kw))) {
              examples.push(sentence.trim().slice(0, 110));
            }
            break;
          }
        }
      }
      return { theme: def.theme, examples: examples.slice(0, 3), count };
    }).filter(t => t.count > 0);

  const allText = texts.join(' ');
  const posKws = ['preiswert', 'günstig', 'fair', 'angemessen', 'reasonable', 'worth it', 'gutes preis'];
  const negKws = ['teuer', 'überteuert', 'wucher', 'zu teuer', 'overpriced', 'expensive', 'not worth', 'abzocke'];

  return {
    praises:    matchThemes(PRAISE_THEMES_DEF),
    complaints: matchThemes(COMPLAINT_THEMES_DEF),
    pricing_keywords_positive: posKws.filter(kw => allText.includes(kw)).length,
    pricing_keywords_negative: negKws.filter(kw => allText.includes(kw)).length,
  };
}

// ── Pricing Power Engine ───────────────────────────────────────────────────────

function calcPricingPower(
  targetRating: number | null,
  targetReviewCount: number,
  targetPriceLevelNum: number | null,
  competitors: CompetitorData[],
  sk: SentimentKeywords,
  totalAreaReviews: number,
): PricingPower {
  // 1. Price Premium Index = target / avg(competitors)
  const compPrices = competitors.map(c => c.price_level ? (PRICE_LABEL_NUM[c.price_level] ?? null) : null).filter((v): v is number => v !== null);
  const avgCompPrice = compPrices.length > 0 ? compPrices.reduce((a, b) => a + b, 0) / compPrices.length : null;
  const pricePremiumIndex = (targetPriceLevelNum != null && avgCompPrice != null && avgCompPrice > 0)
    ? Math.round(targetPriceLevelNum / avgCompPrice * 100) / 100 : null;

  // 2. Rating Premium = target - avg(competitors)
  const compRatings = competitors.map(c => c.rating ? parseFloat(c.rating) : null).filter((v): v is number => v !== null);
  const avgCompRating = compRatings.length > 0 ? compRatings.reduce((a, b) => a + b, 0) / compRatings.length : null;
  const ratingPremium = (targetRating != null && avgCompRating != null)
    ? Math.round((targetRating - avgCompRating) * 100) / 100 : null;

  // 3. Local Demand Share = target / total area reviews
  const localDemandShare = totalAreaReviews > 0
    ? Math.round(targetReviewCount / totalAreaReviews * 100 * 10) / 10 : null;

  // 4. Negative Price Sentiment Ratio = neg_price_kw_count / total_reviews
  const totalReviews = Math.max(1, targetReviewCount);
  const negPriceSentimentRatio = Math.round(sk.pricing_keywords_negative / totalReviews * 100) / 100;

  const factors_met: string[] = [];
  const factors_missing: string[] = [];

  if (pricePremiumIndex !== null) {
    if (pricePremiumIndex > 1) factors_met.push(`Price Premium Index ${pricePremiumIndex} > 1.0 ✓`);
    else factors_missing.push(`Price Premium Index ${pricePremiumIndex} ≤ 1.0`);
  } else { factors_missing.push('Price Premium Index: insufficient price data'); }

  if (ratingPremium !== null) {
    if (ratingPremium >= 0) factors_met.push(`Rating Premium +${ratingPremium} above market ✓`);
    else factors_missing.push(`Rating Premium ${ratingPremium} below market`);
  } else { factors_missing.push('Rating Premium: no competitor ratings'); }

  if (localDemandShare !== null) {
    if (localDemandShare >= 10) factors_met.push(`Local Demand Share ${localDemandShare}% ≥ 10% ✓`);
    else factors_missing.push(`Local Demand Share ${localDemandShare}% < 10%`);
  } else { factors_missing.push('Local Demand Share: no review data'); }

  if (negPriceSentimentRatio < 0.05) factors_met.push(`Negative Price Sentiment ${(negPriceSentimentRatio * 100).toFixed(1)}% < 5% ✓`);
  else factors_missing.push(`Negative Price Sentiment ${(negPriceSentimentRatio * 100).toFixed(1)}% ≥ 5%`);

  const confirmed = (
    (pricePremiumIndex ?? 0) > 1 &&
    (ratingPremium ?? -1) >= 0 &&
    (localDemandShare ?? 0) >= 10 &&
    negPriceSentimentRatio < 0.05
  );

  return { price_premium_index: pricePremiumIndex, rating_premium: ratingPremium, local_demand_share_pct: localDemandShare, neg_price_sentiment_ratio: negPriceSentimentRatio, confirmed, factors_met, factors_missing };
}

// ── Area Metrics & Radar ───────────────────────────────────────────────────────

function calcAreaMetrics(competitors: CompetitorData[], pois: PointOfInterest[], targetReviews: number): AreaMetrics {
  const ratings = competitors.map(c => c.rating ? parseFloat(c.rating) : null).filter((v): v is number => v !== null);
  const avgRating = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 : null;

  const operational = competitors.filter(c => !c.business_status || c.business_status === 'OPERATIONAL').length;
  const operationalPct = competitors.length > 0 ? Math.round(operational / competitors.length * 100) : null;

  const totalAreaReviews = competitors.reduce((s, c) => s + (c.review_volume ? parseInt(c.review_volume) : 0), 0) + targetReviews;
  const avgReviews = competitors.length > 0 ? totalAreaReviews / (competitors.length + 1) : 0;

  const prices = competitors.map(c => c.price_level ? (PRICE_LABEL_NUM[c.price_level] ?? null) : null).filter((v): v is number => v !== null);
  const avgPriceLevel = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 10) / 10 : null;

  // Quality Index components
  const ratingScore    = Math.min(35, avgRating ? ((avgRating - 3.0) / 2.0) * 35 : 15);
  const opScore        = Math.min(20, operationalPct ? (operationalPct / 100) * 20 : 10);
  const reviewScore    = Math.min(20, (avgReviews / 300) * 20);
  const poiScore       = Math.min(25, pois.length * 4);
  const qualityIndex   = Math.max(0, Math.round(ratingScore + opScore + reviewScore + poiScore));

  return { quality_index: qualityIndex, businesses_count: competitors.length, avg_rating_area: avgRating, operational_pct: operationalPct, total_area_reviews: totalAreaReviews, avg_price_level_area: avgPriceLevel };
}

function buildRadarData(
  targetRating: number | null,
  targetReviews: number,
  targetPriceNum: number | null,
  targetSentimentScore: number | null,
  hasWebsite: boolean,
  hasSocials: boolean,
  competitors: CompetitorData[],
): RadarPoint[] {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const compRatings = competitors.map(c => c.rating ? parseFloat(c.rating) : null).filter((v): v is number => v !== null);
  const avgRating = compRatings.length > 0 ? compRatings.reduce((a, b) => a + b, 0) / compRatings.length : 3.5;

  const compReviews = competitors.map(c => c.review_volume ? parseInt(c.review_volume) : 0);
  const maxReviews = Math.max(targetReviews, ...compReviews, 1);
  const avgCompReviews = compReviews.length > 0 ? compReviews.reduce((a, b) => a + b, 0) / compReviews.length : 50;

  const compPrices = competitors.map(c => c.price_level ? (PRICE_LABEL_NUM[c.price_level] ?? null) : null).filter((v): v is number => v !== null);
  const avgPrice = compPrices.length > 0 ? compPrices.reduce((a, b) => a + b, 0) / compPrices.length : 2;

  const compWebsites = competitors.filter(c => c.url).length;
  const avgDigital = competitors.length > 0 ? (compWebsites / competitors.length) * 80 + 10 : 50;

  return [
    {
      metric: 'Rating',
      target: clamp(((targetRating ?? 3) - 1) / 4 * 100),
      market: clamp((avgRating - 1) / 4 * 100),
      fullMark: 100,
    },
    {
      metric: 'Reviews',
      target: clamp(Math.log1p(targetReviews) / Math.log1p(maxReviews) * 100),
      market: clamp(Math.log1p(avgCompReviews) / Math.log1p(maxReviews) * 100),
      fullMark: 100,
    },
    {
      metric: 'Sentiment',
      target: clamp(((targetSentimentScore ?? 0) + 1) / 2 * 100),
      market: 62,
      fullMark: 100,
    },
    {
      metric: 'Digital',
      target: hasWebsite ? (hasSocials ? 95 : 60) : 15,
      market: clamp(avgDigital),
      fullMark: 100,
    },
    {
      metric: 'Price Access',
      target: clamp((5 - (targetPriceNum ?? 2)) / 4 * 100),
      market: clamp((5 - avgPrice) / 4 * 100),
      fullMark: 100,
    },
  ];
}

// ── Overpass POIs ──────────────────────────────────────────────────────────────

async function fetchOverpassPOIs(lat: number, lng: number): Promise<PointOfInterest[]> {
  const query = `[out:json][timeout:8];(node["tourism"~"attraction|museum|gallery|viewpoint|artwork|zoo|theme_park"](around:800,${lat},${lng});node["amenity"~"theatre|cinema|library|arts_centre|university|college"](around:800,${lat},${lng});node["historic"~"monument|memorial|castle|ruins|building"](around:800,${lat},${lng});node["leisure"~"park|stadium|sports_centre"](around:800,${lat},${lng}););out 20;`;

  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return [];
    const data = await r.json();

    return (data.elements ?? [])
      .filter((e: any) => e.tags?.name)
      .map((e: any) => ({
        id: e.id,
        name: e.tags.name,
        category: e.tags.tourism ? 'tourism' : e.tags.amenity ? 'amenity' : e.tags.historic ? 'historic' : 'leisure',
        subtype: (e.tags.tourism ?? e.tags.amenity ?? e.tags.historic ?? e.tags.leisure ?? 'place').replace(/_/g, ' '),
        lat: e.lat ?? 0,
        lng: e.lon ?? 0,
      }))
      .slice(0, 15) as PointOfInterest[];
  } catch {
    return [];
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function resolveUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Firmadeal/1.0)' } });
    return r.url || url;
  } catch { return url; }
}

function parseMapUrl(url: string): { name: string | null; lat: number | null; lng: number | null } {
  const nameMatch = url.match(/\/maps\/place\/([^/@?]+)/);
  let name: string | null = null;
  if (nameMatch) {
    try {
      name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).replace(/\s+/g, ' ').trim() || null;
    } catch {
      // malformed percent-encoding — strip encoded segments
      name = nameMatch[1].replace(/\+/g, ' ').replace(/%[0-9A-Fa-f]{2}/g, '').replace(/\s+/g, ' ').trim() || null;
    }
  }
  // Prefer precise business coords from data param (!3d...!4d...)
  const biz = url.match(/!3d(-?[0-9.]+)!4d(-?[0-9.]+)/);
  if (biz) return { name, lat: parseFloat(biz[1]), lng: parseFloat(biz[2]) };
  // Fall back to map-centre coords after @
  const ctr = url.match(/@(-?[0-9.]+),(-?[0-9.]+)/);
  return { name, lat: ctr ? parseFloat(ctr[1]) : null, lng: ctr ? parseFloat(ctr[2]) : null };
}

function parseAddressComponents(components: any[]): AddressDetail {
  const get = (type: string, short = false) => {
    const c = components.find((c: any) => c.types?.includes(type));
    return c ? (short ? c.shortText : c.longText) ?? null : null;
  };
  return {
    street_number: get('street_number'), street: get('route'),
    sublocality: get('sublocality') ?? get('sublocality_level_1'),
    city: get('locality') ?? get('postal_town'),
    bundesland: get('administrative_area_level_1'),
    landkreis: get('administrative_area_level_2') ?? get('administrative_area_level_3'),
    postal_code: get('postal_code'), country: get('country'), country_code: get('country', true),
  };
}

function calcOpeningHours(periods: any[], weekdayText: string[], openNow: boolean | null): HoursData {
  let totalMinutes = 0;
  let openOnWeekends = false;
  for (const period of (periods ?? [])) {
    const open = period.open; const close = period.close;
    if (!open || !close) continue;
    const day = open.day ?? 0;
    if (day === 0 || day === 6) openOnWeekends = true;
    const openMins = (open.hour ?? 0) * 60 + (open.minute ?? 0);
    let closeMins = (close.hour ?? 0) * 60 + (close.minute ?? 0);
    if (closeMins <= openMins) closeMins += 24 * 60;
    totalMinutes += closeMins - openMins;
  }
  const totalHours = totalMinutes / 60;
  const daysOpen = (periods ?? []).length;
  return {
    weekday_text: weekdayText ?? [], open_now: openNow,
    total_weekly_hours: totalHours > 0 ? Math.round(totalHours * 10) / 10 : null,
    open_on_weekends: openOnWeekends,
    avg_daily_hours: daysOpen > 0 ? Math.round(totalHours / daysOpen * 10) / 10 : null,
  };
}

function analyzeReviews(reviews: any[]): ReviewAnalysis {
  if (!reviews.length) return { total: 0, positive: 0, negative: 0, neutral: 0, sentiment_score: null, avg_review_length: 0, oldest_date: null, newest_date: null, languages: [], tourist_ratio_pct: null };
  const positive = reviews.filter(r => (r.rating ?? 0) >= 4).length;
  const negative = reviews.filter(r => (r.rating ?? 0) <= 2).length;
  const neutral  = reviews.length - positive - negative;
  const sentimentScore = Math.round((positive - negative) / reviews.length * 100) / 100;
  const texts = reviews.map(r => (r.text?.text ?? r.text ?? '') as string);
  const avgLength = Math.round(texts.reduce((s, t) => s + t.length, 0) / reviews.length);
  const times = reviews.map(r => r.publishTime).filter(Boolean).map((t: string) => new Date(t).getTime()).sort((a: number, b: number) => a - b);
  const oldest = times[0] ? new Date(times[0]).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' }) : null;
  const newest = times[times.length - 1] ? new Date(times[times.length - 1]).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' }) : null;
  const langs = [...new Set(reviews.map(r => r.originalText?.languageCode ?? r.text?.languageCode ?? 'de').filter(Boolean))] as string[];
  const nonDe = reviews.filter(r => { const l = r.originalText?.languageCode ?? r.text?.languageCode ?? 'de'; return l !== 'de'; }).length;
  return { total: reviews.length, positive, negative, neutral, sentiment_score: sentimentScore, avg_review_length: avgLength, oldest_date: oldest, newest_date: newest, languages: langs, tourist_ratio_pct: Math.round(nonDe / reviews.length * 100) };
}

function buildPhotoUrls(photos: any[]): string[] {
  return (photos ?? []).slice(0, 10).map((p: any) => `${PHOTO_BASE}/${p.name}/media?maxWidthPx=600&key=${KEY}`);
}

async function scrapeWebsite(url: string): Promise<WebsiteData | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html', 'Accept-Language': 'de-DE,de;q=0.9' },
      signal: AbortSignal.timeout(9000), redirect: 'follow',
    });
    if (!r.ok) return null;
    const html = await r.text();

    const titleMatch = html.match(/<title[^>]*>([^<]{1,160})<\/title>/i);
    const page_title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : null;

    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']{1,400})["'][^>]+name=["']description["']/i)
      ?? html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,400})["']/i);
    const meta_description = metaMatch ? metaMatch[1].replace(/\s+/g, ' ').trim() : null;

    const emailRaw = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
    const emails = [...new Set(emailRaw.filter(e => !e.match(/\.(png|jpg|gif|svg|webp|woff|css|js)$/i) && !e.includes('example.')))].slice(0, 5);

    const socials: Record<string, string> = {};
    const socialPatterns: [string, RegExp][] = [
      ['instagram', /(?:href|src)=["'][^"']*instagram\.com\/([a-zA-Z0-9._]{2,30})/i],
      ['facebook',  /(?:href|src)=["'][^"']*facebook\.com\/([a-zA-Z0-9._\-]{2,60})/i],
      ['linkedin',  /(?:href|src)=["'][^"']*linkedin\.com\/(?:company|in)\/([a-zA-Z0-9._\-]{2,60})/i],
      ['twitter',   /(?:href|src)=["'][^"']*(?:twitter|x)\.com\/([a-zA-Z0-9._]{2,30})/i],
      ['tiktok',    /(?:href|src)=["'][^"']*tiktok\.com\/@([a-zA-Z0-9._]{2,30})/i],
      ['youtube',   /(?:href|src)=["'][^"']*youtube\.com\/(?:channel|@|c\/)([a-zA-Z0-9._\-]{2,60})/i],
    ];
    for (const [platform, pattern] of socialPatterns) {
      const m = html.match(pattern);
      if (m && !m[1].match(/^(share|sharer|intent|dialog|login|signin)$/i)) {
        const base = platform === 'twitter' ? 'x' : platform;
        const prefix = platform === 'tiktok' ? '@' : platform === 'linkedin' ? 'company/' : '';
        socials[platform] = `https://www.${base}.com/${prefix}${m[1]}`;
      }
    }

    const phoneRaw = html.match(/(?:\+49|0049|\b0)[1-9][0-9][\s\-\/]?[0-9]{2,5}[\s\-\/]?[0-9]{2,}/g) ?? [];
    const phones_found = [...new Set(phoneRaw.map(p => p.replace(/\s+/g, ' ').trim()))].slice(0, 4);

    const kwMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']{1,400})["']/i);
    const keywords = kwMatch ? kwMatch[1].split(',').map(k => k.trim()).filter(k => k.length > 1).slice(0, 10) : [];

    return { page_title, meta_description, emails, socials, phones_found, keywords };
  } catch { return null; }
}

// ── Places API ─────────────────────────────────────────────────────────────────

async function placesTextSearch(query: string, lat: number | null, lng: number | null): Promise<any | null> {
  const body: any = { textQuery: query, maxResultCount: 1 };
  if (lat !== null && lng !== null) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 2000.0 } };

  const r = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': SEARCH_MASK },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Places API error ${r.status}: ${await r.text()}`);
  return (await r.json()).places?.[0] ?? null;
}

async function nearbyCompetitors(lat: number, lng: number, types: string[]): Promise<CompetitorData[]> {
  const primaryType = types.find(t => ['lodging', 'restaurant', 'cafe', 'bar', 'bakery', 'car_repair', 'car_dealer', 'dentist', 'pharmacy', 'hair_care', 'beauty_salon', 'gym', 'supermarket', 'clothing_store', 'hotel'].includes(t)) ?? types[0] ?? 'establishment';

  const r = await fetch(NEARBY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': NEARBY_MASK },
    body: JSON.stringify({ locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 1000.0 } }, includedTypes: [primaryType], maxResultCount: 10, languageCode: 'de', rankPreference: 'POPULARITY' }),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.places ?? []).map((p: any) => ({
    name: p.displayName?.text ?? null, url: p.websiteUri ?? null, address: p.formattedAddress ?? null,
    rating: p.rating != null ? String(p.rating) : null, review_volume: p.userRatingCount != null ? String(p.userRatingCount) : null,
    category: (p.types?.[0] ?? '').replace(/_/g, ' ') || null, price_level: PRICE_MAP[p.priceLevel ?? ''] ?? null,
    phone: p.nationalPhoneNumber ?? null, business_status: p.businessStatus ?? null, distance: null,
  }));
}

// ── Main extraction ────────────────────────────────────────────────────────────

async function extractFromUrl(inputUrl: string): Promise<ExtractionPayload> {
  if (!KEY) throw new Error('GOOGLE_MAPS_API_KEY is not configured');

  const blank: AddressDetail = { street_number: null, street: null, sublocality: null, city: null, bundesland: null, landkreis: null, postal_code: null, country: null, country_code: null };

  const payload: ExtractionPayload = {
    place_id: null, name: null, types: [], category: null, business_status: null, summary: null,
    address: null, vicinity: null, phone: null, phone_intl: null, website: null, google_maps_url: null, resolved_url: inputUrl,
    latitude: null, longitude: null, plus_code: null, address_detail: blank,
    city: null, region: null, country: null,
    rating: null, review_volume: null, price_level: null, price_level_num: null,
    reviews: [], review_analysis: null, sentiment_keywords: null,
    opening_hours: null, is_open: null,
    delivery: null, dine_in: null, takeout: null, reservable: null, serves_beer: null,
    serves_breakfast: null, serves_brunch: null, serves_dinner: null, serves_lunch: null,
    serves_wine: null, wheelchair_accessible: null, curbside_pickup: null,
    photos: [], photos_count: 0, website_data: null,
    competitor_count: null, competitors: [], area_metrics: null, radar_data: [],
    pricing_power: null, points_of_interest: [], industry_economics: null,
    search_interest: null, spot_category: null,
  };

  const fullUrl = await resolveUrl(inputUrl);
  payload.resolved_url = fullUrl;
  const { name: urlName, lat: urlLat, lng: urlLng } = parseMapUrl(fullUrl);
  const place = await placesTextSearch(urlName ?? fullUrl, urlLat, urlLng);

  if (!place) { payload.name = urlName; payload.latitude = urlLat; payload.longitude = urlLng; return payload; }

  payload.place_id        = place.id ?? null;
  payload.name            = place.displayName?.text ?? null;
  payload.types           = place.types ?? [];
  payload.category        = (place.types?.[0] ?? '').replace(/_/g, ' ') || null;
  payload.business_status = place.businessStatus ?? null;
  payload.summary         = place.editorialSummary?.text ?? null;
  payload.address         = place.formattedAddress ?? null;
  payload.vicinity        = place.shortFormattedAddress ?? null;
  payload.phone           = place.nationalPhoneNumber ?? null;
  payload.phone_intl      = place.internationalPhoneNumber ?? null;
  payload.website         = place.websiteUri ?? null;
  payload.google_maps_url = place.googleMapsUri ?? null;
  payload.latitude        = place.location?.latitude  ?? urlLat;
  payload.longitude       = place.location?.longitude ?? urlLng;
  payload.plus_code       = place.plusCode?.compoundCode ?? place.plusCode?.globalCode ?? null;

  if (place.addressComponents?.length) {
    const ad = parseAddressComponents(place.addressComponents);
    payload.address_detail = ad;
    payload.city = ad.city; payload.region = ad.bundesland; payload.country = ad.country;
  }

  payload.rating          = place.rating != null ? String(place.rating) : null;
  payload.review_volume   = place.userRatingCount != null ? String(place.userRatingCount) : null;
  payload.price_level     = PRICE_MAP[place.priceLevel ?? ''] ?? null;
  payload.price_level_num = place.priceLevel ? (PRICE_NUM[place.priceLevel] ?? null) : null;

  const rawReviews: any[] = place.reviews ?? [];
  payload.reviews = rawReviews.map((r: any) => ({
    author: r.authorAttribution?.displayName ?? null, photo_url: r.authorAttribution?.photoUri ?? null,
    rating: r.rating ?? null, text: r.text?.text ?? null,
    language: r.originalText?.languageCode ?? r.text?.languageCode ?? null,
    date: r.publishTime ? new Date(r.publishTime).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' }) : null,
    relative_time: r.relativePublishTimeDescription ?? null,
  }));
  payload.review_analysis   = analyzeReviews(rawReviews);
  payload.sentiment_keywords = analyzeSentimentKeywords(payload.reviews);

  const hours = place.currentOpeningHours ?? place.regularOpeningHours;
  if (hours) { payload.is_open = hours.openNow ?? null; payload.opening_hours = calcOpeningHours(hours.periods, hours.weekdayDescriptions, hours.openNow ?? null); }

  payload.delivery         = place.delivery         ?? null;
  payload.dine_in          = place.dineIn           ?? null;
  payload.takeout          = place.takeout          ?? null;
  payload.reservable       = place.reservable       ?? null;
  payload.serves_beer      = place.servesBeer       ?? null;
  payload.serves_breakfast = place.servesBreakfast  ?? null;
  payload.serves_brunch    = place.servesBrunch     ?? null;
  payload.serves_dinner    = place.servesDinner     ?? null;
  payload.serves_lunch     = place.servesLunch      ?? null;
  payload.serves_wine      = place.servesWine       ?? null;
  payload.wheelchair_accessible = place.accessibilityOptions?.wheelchairAccessibleEntrance ?? null;
  payload.curbside_pickup  = place.curbsidePickup   ?? null;

  payload.photos       = buildPhotoUrls(place.photos ?? []);
  payload.photos_count = (place.photos ?? []).length;

  if (payload.category) { payload.search_interest = payload.city ? `${payload.category} in ${payload.city}` : payload.category; payload.spot_category = payload.category; }

  // ── Parallel: website, competitors, POIs ─────────────────────────────────────
  const lat = payload.latitude; const lng = payload.longitude;
  const [websiteData, competitorList, pois] = await Promise.all([
    payload.website ? scrapeWebsite(payload.website) : Promise.resolve(null),
    (lat !== null && lng !== null && payload.types.length) ? nearbyCompetitors(lat, lng, payload.types) : Promise.resolve([]),
    (lat !== null && lng !== null) ? fetchOverpassPOIs(lat, lng) : Promise.resolve([]),
  ]);

  payload.website_data     = websiteData;
  payload.competitors      = competitorList.filter(c => c.name !== payload.name).slice(0, 8);
  payload.competitor_count = payload.competitors.length;
  payload.points_of_interest = pois;

  const targetReviewCount = payload.review_volume ? parseInt(payload.review_volume) : payload.reviews.length;
  const targetRatingNum   = payload.rating ? parseFloat(payload.rating) : null;

  payload.area_metrics = calcAreaMetrics(payload.competitors, pois, targetReviewCount);

  payload.radar_data = buildRadarData(
    targetRatingNum, targetReviewCount, payload.price_level_num,
    payload.review_analysis?.sentiment_score ?? null,
    !!payload.website,
    !!(websiteData && Object.keys(websiteData.socials).length > 0),
    payload.competitors,
  );

  payload.pricing_power = calcPricingPower(
    targetRatingNum, targetReviewCount, payload.price_level_num,
    payload.competitors, payload.sentiment_keywords!,
    payload.area_metrics.total_area_reviews,
  );

  payload.industry_economics = getIndustryEconomics(payload.types);

  return payload;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    const data = await extractFromUrl(url);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed', details: String(error) }, { status: 500 });
  }
}
