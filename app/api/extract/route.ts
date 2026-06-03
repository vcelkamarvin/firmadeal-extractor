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

const PRICE_MAP:  Record<string, string> = { PRICE_LEVEL_INEXPENSIVE: '€', PRICE_LEVEL_MODERATE: '€€', PRICE_LEVEL_EXPENSIVE: '€€€', PRICE_LEVEL_VERY_EXPENSIVE: '€€€€' };
const PRICE_NUM:  Record<string, number> = { PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };
const PRICE_LABEL_NUM: Record<string, number> = { '€': 1, '€€': 2, '€€€': 3, '€€€€': 4 };

// ── Core interfaces ────────────────────────────────────────────────────────────

export interface ReviewData { author: string | null; photo_url: string | null; rating: number | null; text: string | null; language: string | null; date: string | null; relative_time: string | null; }
export interface ReviewAnalysis { total: number; positive: number; negative: number; neutral: number; sentiment_score: number | null; avg_review_length: number; oldest_date: string | null; newest_date: string | null; languages: string[]; tourist_ratio_pct: number | null; }
export interface HoursData { weekday_text: string[]; open_now: boolean | null; total_weekly_hours: number | null; open_on_weekends: boolean; avg_daily_hours: number | null; }
export interface AddressDetail { street_number: string | null; street: string | null; sublocality: string | null; city: string | null; bundesland: string | null; landkreis: string | null; postal_code: string | null; country: string | null; country_code: string | null; }
export interface WebsiteData { page_title: string | null; meta_description: string | null; emails: string[]; socials: Record<string, string>; phones_found: string[]; keywords: string[]; }
export interface SentimentTheme { theme: string; examples: string[]; count: number; }
export interface SentimentKeywords { praises: SentimentTheme[]; complaints: SentimentTheme[]; pricing_keywords_positive: number; pricing_keywords_negative: number; }
export interface PointOfInterest { id: number; name: string; category: string; subtype: string; lat: number; lng: number; }
export interface AreaMetrics { quality_index: number; businesses_count: number; avg_rating_area: number | null; operational_pct: number | null; total_area_reviews: number; avg_price_level_area: number | null; }
export interface PricingPower { price_premium_index: number | null; rating_premium: number | null; local_demand_share_pct: number | null; neg_price_sentiment_ratio: number | null; confirmed: boolean; factors_met: string[]; factors_missing: string[]; }
export interface RadarPoint { metric: string; target: number; market: number; fullMark: number; }
export interface IndustryYearData { year: number; context: string; }
export interface IndustryEconomics { industry_label: string; ebitda_multiple: { low: number; mid: number; high: number }; avg_margin_pct: number | null; market_size_de_bn: number | null; cagr_5y_pct: number | null; trend_summary: string; yearly: IndustryYearData[]; structural_margins: string; failure_rate_note: string; model_mechanics: string; }
export interface CompetitorData { name: string | null; url: string | null; address: string | null; rating: string | null; review_volume: string | null; category: string | null; price_level: string | null; phone: string | null; business_status: string | null; distance: string | null; }
export interface TimelinePoint { period: string; reviews: number; trends_index: number; }
export interface MacroData { unemployment_pct: number; national_avg_unemployment: number; ppp_index: number; median_gross_wage: number; commercial_rent_per_sqm: number; bundesland: string | null; city: string | null; data_source: string; }
export interface LaborFriction { index: number; unemployment_pct: number; national_avg_unemployment: number; wage_pressure_flag: boolean; interpretation: string; }

// ── Probabilistic finance interfaces ──────────────────────────────────────────

export interface FinancialRange { low: number; mid: number; high: number; }

export interface CostDriver {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trend: 'improving' | 'stable' | 'worsening';
  description: string;
  ebitda_impact_pct: number;
}

export interface DependencyMatrix {
  business_model_summary: string;
  primary_leverage: string;
  drivers: CostDriver[];
  net_ebitda_drag_pct: number;
}

export interface SanityCheck {
  rev_per_employee_synthetic: number;
  rev_per_employee_benchmark: number;
  ratio: number;
  overheated: boolean;
  compression_note: string | null;
}

export interface SyntheticPL {
  estimated_age_years: number;
  capture_rate_expected: number;
  capture_rate_pessimistic: number;
  capture_rate_optimistic: number;
  revenue: FinancialRange;
  annual_transactions: FinancialRange;
  adjusted_basket_eur: number;
  cogs: FinancialRange;
  gross_profit: FinancialRange;
  gross_margin_pct: number;
  fte_estimate: number;
  personnel_cost: number;
  facility_sqm: number;
  facility_cost: number;
  other_opex: FinancialRange;
  total_fixed_costs: number;
  ebitda: FinancialRange;
  ebitda_margin_pct: FinancialRange | null;
  industry_avg_ebitda_margin: number | null;
  fixed_cost_ratio: number;
  breakeven_revenue: number;
  revenue_per_employee: number;
  rent_as_revenue_pct: number | null;
  personnel_as_revenue_pct: number | null;
  high_fixed_cost_risk: boolean;
  sanity_check: SanityCheck;
  dependency_matrix: DependencyMatrix;
  risk_summary: string;
}

// ── Spatial context interface ──────────────────────────────────────────────────

export interface SpatialContext {
  nearest_transport: { name: string; type: string; distance_m: number; walking_min: number; } | null;
  city_center_distance_m: number | null;
  zone_classification: 'prime_commercial' | 'secondary_commercial' | 'mixed_use' | 'residential' | 'peripheral' | 'unknown';
  foot_traffic_score: number;
  location_economics: string;
}

// ── Payload ────────────────────────────────────────────────────────────────────

export interface ExtractionPayload {
  place_id: string | null; name: string | null; types: string[]; category: string | null;
  business_status: string | null; summary: string | null;
  address: string | null; vicinity: string | null; phone: string | null; phone_intl: string | null;
  website: string | null; google_maps_url: string | null; resolved_url: string | null;
  latitude: number | null; longitude: number | null; plus_code: string | null;
  address_detail: AddressDetail;
  city: string | null; region: string | null; country: string | null;
  rating: string | null; review_volume: string | null; price_level: string | null; price_level_num: number | null;
  reviews: ReviewData[]; review_analysis: ReviewAnalysis | null; sentiment_keywords: SentimentKeywords | null;
  opening_hours: HoursData | null; is_open: boolean | null;
  delivery: boolean | null; dine_in: boolean | null; takeout: boolean | null; reservable: boolean | null;
  serves_beer: boolean | null; serves_breakfast: boolean | null; serves_brunch: boolean | null;
  serves_dinner: boolean | null; serves_lunch: boolean | null; serves_wine: boolean | null;
  wheelchair_accessible: boolean | null; curbside_pickup: boolean | null;
  photos: string[]; photos_count: number;
  website_data: WebsiteData | null;
  competitor_count: number | null; competitors: CompetitorData[];
  area_metrics: AreaMetrics | null; radar_data: RadarPoint[]; pricing_power: PricingPower | null;
  points_of_interest: PointOfInterest[];
  macro_data: MacroData | null;
  labor_friction: LaborFriction | null;
  synthetic_pl: SyntheticPL | null;
  market_timeline: TimelinePoint[];
  industry_economics: IndustryEconomics | null;
  spatial_context: SpatialContext | null;
  search_interest: string | null; spot_category: string | null;
}

// ── Industry economics (expanded) ─────────────────────────────────────────────

const INDUSTRY_ECONOMICS: Record<string, IndustryEconomics> = {
  restaurant: {
    industry_label: 'Gastronomie & Restaurants (DE)',
    ebitda_multiple: { low: 2.5, mid: 3.5, high: 5.0 },
    avg_margin_pct: 8, market_size_de_bn: 52.0, cagr_5y_pct: 1.8,
    trend_summary: 'Delivery-Anteil dauerhaft auf 18%. Premiumisierung: seltener, aber mehr Ausgaben. Strukturelle Marktbereinigung 2022–2024.',
    structural_margins: 'Gross margins 68–74% (food cost 26–32%). Personnel typically 32–38% of revenue. Facility 10–15%. Net EBITDA 6–12% for well-run operations, under 4% for average. The model is low-margin with high operating leverage — each additional cover above breakeven contributes ~80% to bottom line.',
    failure_rate_note: '~30% of new restaurants close within year 1, ~60% within year 3. The primary driver is inadequate working capital buffer relative to fixed cost exposure during ramp-up phase.',
    model_mechanics: 'Revenue is a function of covers × ticket × frequency. Breakfast/lunch covers are volume-led (low ticket, high turnover); dinner is ticket-led (higher margin, lower throughput). A kitchen running below 65% capacity utilisation is structurally loss-making due to labour and facility fixed costs.',
    yearly: [{ year: 2020, context: 'Lockdowns; −40% Umsatz; ~35.000 Schließungen' }, { year: 2021, context: 'Yo-yo-Lockdowns; Außengastronomie dominant' }, { year: 2022, context: 'Vollöffnung; Energiekosten explodieren' }, { year: 2023, context: 'Umsatz 52 Mrd. € nominal; real unter 2019' }, { year: 2024, context: 'Marktbereinigung; Fine Dining wächst' }],
  },
  lodging: {
    industry_label: 'Hotel & Beherbergung (DE)',
    ebitda_multiple: { low: 7.0, mid: 9.5, high: 13.0 },
    avg_margin_pct: 22, market_size_de_bn: 28.5, cagr_5y_pct: 3.2,
    trend_summary: 'RevPAR 2023 +8% über 2019. Leisure-Segment führend. M&A hoch, Konsolidierung im Mittelstand.',
    structural_margins: 'Room gross margin 75–85% (variable cost per room is minimal). F&B margin 30–40%, dragging blended EBITDA to 18–28%. Occupancy below 60% creates structural losses in most German hotel models due to high fixed staff and facility costs.',
    failure_rate_note: 'Hotel failures are less frequent (3–5% p.a.) but restructuring is common. Primary risk: debt-heavy capital structure unable to service during low-occupancy periods.',
    model_mechanics: 'Revenue per Available Room (RevPAR) is the critical KPI. ADR × Occupancy. Small independent hotels below 30 rooms struggle with distribution costs (OTA commissions 15–25%) unless relying on direct booking.',
    yearly: [{ year: 2020, context: 'RevPAR −55%; 35.000 Betriebe bedroht' }, { year: 2021, context: 'Teilöffnung; Umsatz ~42% unter 2019' }, { year: 2022, context: 'Aufholjagd; Leisure übertrifft 2019; ADR +18%' }, { year: 2023, context: 'RevPAR +8% über 2019; Belegung ~72%' }, { year: 2024, context: 'Stabiles Wachstum; Boutique & Lifestyle im Trend' }],
  },
  cafe: {
    industry_label: 'Café & Kaffeehäuser (DE)',
    ebitda_multiple: { low: 2.0, mid: 3.2, high: 4.5 },
    avg_margin_pct: 11, market_size_de_bn: 8.2, cagr_5y_pct: 4.1,
    trend_summary: 'Specialty Coffee +zweistellig. Plant-based Milk Mainstream (28%). Franchise vs. Independent polarisiert.',
    structural_margins: 'Coffee beverage gross margin 78–88% (input cost €0.30–0.60 per cup). Food attachment adds volume at 40–55% margin. Blended gross margin 68–76%. Key risk: personnel intensity for staffing peaks during short morning/afternoon windows creates high effective labour cost per transaction.',
    failure_rate_note: '~25% close within year 2. Prime location dependence means rent is often the terminal risk factor — lease renewal at market rates can destroy the unit economics.',
    model_mechanics: 'Revenue density per m² is the primary KPI. A specialty café needs ≥€4,500/m²/year to achieve healthy EBITDA. Dwell time management is critical — high-dwell customers reduce seat turnover below the breakeven threshold during peak hours.',
    yearly: [{ year: 2020, context: 'Take-away rettete viele; Kaffee zuhause +23%' }, { year: 2021, context: 'Outdoor-Saison entscheidend' }, { year: 2022, context: 'Arabica-Preise 10-Jahres-Hoch' }, { year: 2023, context: 'Umsatz +31% ggü. 2019 auf 8,2 Mrd. €' }, { year: 2024, context: 'Concept Stores als Differenzierung' }],
  },
  bakery: {
    industry_label: 'Bäckerei & Konditorei (DE)',
    ebitda_multiple: { low: 3.0, mid: 4.5, high: 6.5 },
    avg_margin_pct: 7, market_size_de_bn: 15.8, cagr_5y_pct: 0.9,
    trend_summary: 'Betriebe −48% seit 2000. Energie/Rohstoffe kritisch. Handwerk vs. Backshop-Ketten.',
    structural_margins: 'Raw material margin (flour, butter, eggs) 45–60%. Energy is 8–12% of revenue (ovens run 6–16h daily). Blended EBITDA 5–10% for independent operators, up to 15% for multi-unit chains with central production.',
    failure_rate_note: 'Germany lost 1,500 bakeries in 2022 alone. Energy cost shock wiped out operating buffers. Multi-unit operators survived through central production scale; solo operators were most vulnerable.',
    model_mechanics: 'Morning revenue concentration (6–10am) is extreme — often 60%+ of daily sales. Low average transaction makes volume critical. Café integration (coffee, seating) is now a strategic necessity for margin improvement.',
    yearly: [{ year: 2020, context: 'Systemrelevant; kaum Einbußen' }, { year: 2021, context: 'Weizenpreise beginnen zu steigen' }, { year: 2022, context: 'Mehl +65%, Energie +200%; 1.500 Schließungen' }, { year: 2023, context: 'Preiserhöhungen +18% durchgesetzt' }, { year: 2024, context: 'Fachkräftemangel kritischster Faktor' }],
  },
  bar: {
    industry_label: 'Bar & Nachtgastronomie (DE)',
    ebitda_multiple: { low: 2.0, mid: 3.0, high: 4.5 },
    avg_margin_pct: 13, market_size_de_bn: 6.5, cagr_5y_pct: 1.2,
    trend_summary: 'No/Low-Alcohol +35% p.a. Craft-Cocktail stark. Nachtclubs strukturell unter Druck.',
    structural_margins: 'Beverage gross margin 75–85% (spirits markup 3–5×, beer 2.5–3.5×). Revenue is highly time-concentrated (Thu–Sat). High security/staffing costs during late hours erode EBITDA significantly.',
    failure_rate_note: 'High seasonality and operating-hours concentration create extreme vulnerability to regulatory changes (closing time restrictions, smoking bans, noise complaints). ~35% close within 3 years.',
    model_mechanics: 'Revenue per operating hour and capacity utilisation are key metrics. A 60-seat bar that fills Thursday–Saturday generates the same revenue as a 200-seat bar with poor weekend utilisation. Weekend dependence creates catastrophic exposure to single bad months.',
    yearly: [{ year: 2020, context: 'Härteste Branche: komplette Schließung' }, { year: 2021, context: 'Weitgehend Verlustjahr' }, { year: 2022, context: 'Euphorie-Effekt; Nachfrage-Boom' }, { year: 2023, context: 'Craft-Cocktail +24%; Non-Alc Standard' }, { year: 2024, context: 'Premium stabil; Volumen unter Druck' }],
  },
  hair_care: {
    industry_label: 'Friseur & Haarpflege (DE)',
    ebitda_multiple: { low: 2.5, mid: 3.8, high: 5.5 },
    avg_margin_pct: 14, market_size_de_bn: 9.1, cagr_5y_pct: 2.3,
    trend_summary: '80.000 Salons; Barbershop-Trend +überproportional. Mindestlohn treibt Preise. Social Media entscheidend.',
    structural_margins: 'Service gross margin 65–75% (product/colour cost 25–35%). Product retail adds 40–55% margin. Personnel is the dominant cost at 45–60% of revenue. A productive senior stylist generates €100–160k revenue/year; juniors €50–70k.',
    failure_rate_note: 'The key risk is stylist attrition — losing a senior stylist can mean 15–30% revenue loss overnight. Non-compete enforceability is limited in Germany. Customer loyalty follows the stylist, not the salon.',
    model_mechanics: 'Revenue is seats × utilisation × average ticket. A 4-chair salon with 65% utilisation at €55 avg ticket running 6 days, 8 slots/chair/day generates ~€275k. Adding retail and colour treatments is the primary margin lever.',
    yearly: [{ year: 2020, context: 'Lockdowns; Heimfärbe-Boom' }, { year: 2021, context: 'Fachkräftemangel verschärft sich' }, { year: 2022, context: 'Preiserhöhungen +12%' }, { year: 2023, context: 'Umsatz 9,1 Mrd. €; Barbershops +8%' }, { year: 2024, context: 'Franchise wächst; Social-Media entscheidend' }],
  },
  car_repair: {
    industry_label: 'Kfz-Werkstatt (DE)',
    ebitda_multiple: { low: 4.0, mid: 6.0, high: 8.5 },
    avg_margin_pct: 18, market_size_de_bn: 38.0, cagr_5y_pct: 3.8,
    trend_summary: 'E-Mobilität verändert Servicebedarf. Fahrzeugalter 10,2 J. (Rekord) → Reparaturbedarf wächst.',
    structural_margins: 'Labour margin 65–75% (technician cost €28–45/hr, billing rate €90–130/hr). Parts margin 25–40% depending on OEM/aftermarket mix. Blended EBITDA 15–22% for authorised dealers, 12–18% for independents.',
    failure_rate_note: 'EV transition is a structural risk for workshops without EV certification. High-voltage battery work requires €50k+ tooling investment. Workshops without EV readiness face growing revenue attrition as fleet electrifies.',
    model_mechanics: 'Revenue is billed hours × labour rate + parts. Throughput (jobs/day) and average job value are the key variables. HU/AU (main inspection) services are high-frequency low-margin commodities; complex repair work is high-margin but variable.',
    yearly: [{ year: 2020, context: 'Systemrelevant; Gebrauchtmarkt steigt' }, { year: 2021, context: 'Halbleitermangel; Auslastung steigt' }, { year: 2022, context: 'E-Auto-Zertifizierungen boomen' }, { year: 2023, context: 'Markt 38 Mrd. €; Alter 10,2 J.' }, { year: 2024, context: 'E-Mobility-Readiness entscheidend' }],
  },
  dentist: {
    industry_label: 'Zahnarzt & Dentalpraxis (DE)',
    ebitda_multiple: { low: 4.5, mid: 7.0, high: 10.0 },
    avg_margin_pct: 25, market_size_de_bn: 14.5, cagr_5y_pct: 4.2,
    trend_summary: 'PE-Konsolidierung: 200+ MVZ-Transaktionen p.a. Aligners/Implantologie treiben Premium.',
    structural_margins: 'Kassenpatienten EBITDA ~8–12% (regulated fees, high volume). Privatpatienten/Selbstzahler EBITDA 28–40% (Implantate, Ästhetik, Aligners). Mixed practices average 20–28%. Laboratory costs 8–15% of revenue.',
    failure_rate_note: 'Very low failure rate (<3%). Primary risk is PE buyout pressure — owner-operated practices face aggressive acquirer multiples but post-acquisition EBITDA compression from central management overhead.',
    model_mechanics: 'Revenue is patient visits × average treatment value. KPIs: new patient acquisition, treatment acceptance rate for high-value services (Implantate, Zahnersatz), recall rate. A single implant case (€1,500–4,000) equals 10–20 routine cleaning visits.',
    yearly: [{ year: 2020, context: 'COVID: Behandlungsrückstau; −15%' }, { year: 2021, context: 'Aufholjagd; Wartezeiten 3-6 Monate' }, { year: 2022, context: 'PE-Konsolidierung beschleunigt' }, { year: 2023, context: 'Markt 14,5 Mrd. €; PE 8-12x EBITDA' }, { year: 2024, context: 'MVZ-Regulierung verschärft' }],
  },
  pharmacy: {
    industry_label: 'Apotheke (DE)',
    ebitda_multiple: { low: 3.5, mid: 5.5, high: 7.5 },
    avg_margin_pct: 6, market_size_de_bn: 58.0, cagr_5y_pct: 2.1,
    trend_summary: 'E-Rezept revolutioniert Markt. Apothekenzahl unter 17.500. Online-Versand wächst.',
    structural_margins: 'Rx margin ~3% (highly regulated, fixed markup). OTC margin 25–35%. Specialty/high-value products 15–25%. Revenue per m² is critical — pharmacies require €8,000+/m²/year to be viable.',
    failure_rate_note: 'E-Rezept disruption is accelerating market share loss to online pharmacies (DocMorris, Redcare). Independent pharmacies without strong doctor relationships face structural revenue attrition of 3–8% annually.',
    model_mechanics: 'Rx volume drives traffic; OTC cross-selling drives margin. The primary growth lever is cosmetics/nutritional supplements with 35–50% gross margin. A pharmacy with 200+ prescriptions/day has defensible economics; below 100/day is structurally at risk.',
    yearly: [{ year: 2020, context: 'COVID: Masken-Boom; Markt +12%' }, { year: 2021, context: 'Impfzentren; 52 Mrd. €' }, { year: 2022, context: 'E-Rezept-Piloten; Generika-Engpässe' }, { year: 2023, context: 'E-Rezept-Rollout; 58 Mrd. €' }, { year: 2024, context: 'Apothekenzahl unter 17.500' }],
  },
};

const ECONOMICS_DEFAULT: IndustryEconomics = {
  industry_label: 'Dienstleistungsgewerbe (DE)',
  ebitda_multiple: { low: 3.0, mid: 5.0, high: 8.0 },
  avg_margin_pct: 12, market_size_de_bn: null, cagr_5y_pct: 2.5,
  trend_summary: 'Wirtschaft stagniert 2023/24 (−0,3%/+0,2%). Dienstleistungssektor robuster als Industrie.',
  structural_margins: 'Variable by sub-sector. Service businesses with high labour intensity operate at 8–18% EBITDA. Asset-light models (consulting, software) at 20–35%.',
  failure_rate_note: 'SME failure rate ~2–4% p.a. in Germany. Primary causes: undercapitalisation, founder dependency, inability to scale beyond founder capacity.',
  model_mechanics: 'Service businesses are capacity-constrained — revenue ceiling is determined by billable hours or service slots. Growth requires either price increases or headcount addition, both of which compress margins initially.',
  yearly: [{ year: 2020, context: 'COVID: BIP −4,9%' }, { year: 2021, context: 'Erholung +2,6%' }, { year: 2022, context: 'Energiekrise; Inflation 7,9%' }, { year: 2023, context: 'BIP −0,3%' }, { year: 2024, context: 'Verhaltene Erholung +0,2%' }],
};

function getIndustryEconomics(types: string[]): IndustryEconomics {
  for (const t of types) { if (INDUSTRY_ECONOMICS[t]) return INDUSTRY_ECONOMICS[t]; }
  return ECONOMICS_DEFAULT;
}

// ── Industry financial parameters ─────────────────────────────────────────────

interface IndustryParams {
  capture_rate_expected: number;    // % of transactions leaving a review — expected (realistic mid)
  capture_rate_pessimistic: number; // higher % → fewer implied transactions → lower revenue bound
  capture_rate_optimistic: number;  // lower % → more implied transactions → upper revenue bound
  avg_basket_eur: number;
  gross_margin_pct: number;
  revenue_per_fte: number;
  typical_sqm: number;
  sector_wage_multiplier: number;
}

const INDUSTRY_PARAMS: Record<string, IndustryParams> = {
  lodging:      { capture_rate_expected: 3.0, capture_rate_pessimistic: 5.0, capture_rate_optimistic: 1.2, avg_basket_eur: 120, gross_margin_pct: 65, revenue_per_fte: 65000,  typical_sqm: 800, sector_wage_multiplier: 0.72 },
  restaurant:   { capture_rate_expected: 4.0, capture_rate_pessimistic: 6.5, capture_rate_optimistic: 2.0, avg_basket_eur: 28,  gross_margin_pct: 70, revenue_per_fte: 85000,  typical_sqm: 120, sector_wage_multiplier: 0.65 },
  cafe:         { capture_rate_expected: 2.5, capture_rate_pessimistic: 4.0, capture_rate_optimistic: 1.0, avg_basket_eur: 11,  gross_margin_pct: 72, revenue_per_fte: 95000,  typical_sqm: 65,  sector_wage_multiplier: 0.62 },
  bakery:       { capture_rate_expected: 1.5, capture_rate_pessimistic: 2.5, capture_rate_optimistic: 0.6, avg_basket_eur: 8,   gross_margin_pct: 55, revenue_per_fte: 70000,  typical_sqm: 80,  sector_wage_multiplier: 0.68 },
  bar:          { capture_rate_expected: 4.0, capture_rate_pessimistic: 6.5, capture_rate_optimistic: 2.0, avg_basket_eur: 22,  gross_margin_pct: 75, revenue_per_fte: 90000,  typical_sqm: 80,  sector_wage_multiplier: 0.63 },
  hair_care:    { capture_rate_expected: 5.0, capture_rate_pessimistic: 8.0, capture_rate_optimistic: 2.0, avg_basket_eur: 45,  gross_margin_pct: 55, revenue_per_fte: 80000,  typical_sqm: 50,  sector_wage_multiplier: 0.70 },
  beauty_salon: { capture_rate_expected: 5.0, capture_rate_pessimistic: 8.0, capture_rate_optimistic: 2.0, avg_basket_eur: 55,  gross_margin_pct: 55, revenue_per_fte: 85000,  typical_sqm: 50,  sector_wage_multiplier: 0.70 },
  car_repair:   { capture_rate_expected: 3.0, capture_rate_pessimistic: 5.0, capture_rate_optimistic: 1.2, avg_basket_eur: 180, gross_margin_pct: 45, revenue_per_fte: 120000, typical_sqm: 200, sector_wage_multiplier: 1.05 },
  dentist:      { capture_rate_expected: 6.0, capture_rate_pessimistic: 9.0, capture_rate_optimistic: 2.5, avg_basket_eur: 250, gross_margin_pct: 62, revenue_per_fte: 150000, typical_sqm: 120, sector_wage_multiplier: 1.35 },
  pharmacy:     { capture_rate_expected: 0.8, capture_rate_pessimistic: 1.4, capture_rate_optimistic: 0.3, avg_basket_eur: 35,  gross_margin_pct: 22, revenue_per_fte: 200000, typical_sqm: 80,  sector_wage_multiplier: 1.15 },
  supermarket:  { capture_rate_expected: 0.3, capture_rate_pessimistic: 0.5, capture_rate_optimistic: 0.1, avg_basket_eur: 42,  gross_margin_pct: 24, revenue_per_fte: 280000, typical_sqm: 400, sector_wage_multiplier: 0.85 },
};
const INDUSTRY_PARAMS_DEFAULT: IndustryParams = {
  capture_rate_expected: 2.5, capture_rate_pessimistic: 4.0, capture_rate_optimistic: 1.0,
  avg_basket_eur: 40, gross_margin_pct: 55, revenue_per_fte: 100000, typical_sqm: 100, sector_wage_multiplier: 0.85,
};

// ── Cost driver dependency definitions ────────────────────────────────────────

const DEPENDENCY_DEFS: Record<string, { summary: string; leverage: string; drivers: CostDriver[] }> = {
  restaurant: {
    summary: 'High-throughput perishable goods retail with thin EBITDA and extreme operating leverage. Every cover above breakeven contributes ~80% to the bottom line; every cover below erodes at the same rate.',
    leverage: 'Table turnover rate and average ticket. A 10% increase in covers yields ~15–20% EBITDA uplift at typical margin structures. Weekend and evening dinner service are the high-margin engines.',
    drivers: [
      { name: 'Raw Material Inflation', severity: 'critical', trend: 'worsening', description: 'Food CPI DE +6.2% (2023) → +3.1% (2024). Protein costs remain structurally elevated. Menu repricing lag creates compression windows of 3–6 months per cost spike.', ebitda_impact_pct: -4.5 },
      { name: 'Minimum Wage Pressure', severity: 'critical', trend: 'worsening', description: 'Mindestlohn €12.41 (2024). Proposed increase to €15 would add €18–35k/year per FTE at minimum wage. Kitchen/service staff are predominantly at or near the floor.', ebitda_impact_pct: -3.8 },
      { name: 'Energy Cost Volatility', severity: 'high', trend: 'stable', description: 'Gas and electricity 3–5% of restaurant revenue. 2022 energy crisis stress-tested operators; partial normalisation but hedging remains complex for SMEs.', ebitda_impact_pct: -1.5 },
      { name: 'Consumer Spending Sensitivity', severity: 'high', trend: 'stable', description: 'Eating-out frequency declined 8% in 2022–2023 inflation shock. Recovery correlates with real wage growth — currently +1.2% YoY in DE, providing modest tailwind.', ebitda_impact_pct: -2.0 },
      { name: 'Delivery Platform Commission', severity: 'medium', trend: 'worsening', description: 'Lieferando/UberEats 25–35% commission. Businesses reliant on delivery structurally sacrifice 8–12pp of gross margin per transaction. Own-delivery mitigates but adds logistics cost.', ebitda_impact_pct: -1.5 },
    ],
  },
  cafe: {
    summary: 'Specialty beverage retail with high unit margins on consumables, but extreme fixed-cost exposure in premium locations. Revenue density per m² is the survival metric.',
    leverage: 'Beverage-to-food attachment rate and morning/afternoon peak utilisation. Coffee margins 75–85%; food attachment adds 2–4% to avg ticket at lower margin. Subscription and loyalty programme adoption directly impacts revenue predictability.',
    drivers: [
      { name: 'Coffee & Dairy Input Costs', severity: 'high', trend: 'worsening', description: 'Arabica futures +45% (2023–2024) due to Brazil drought. Oat/plant-based milk premium persists at 2–3× dairy cost. Price passthrough partially viable but limits volume growth.', ebitda_impact_pct: -3.5 },
      { name: 'Minimum Wage Pressure', severity: 'critical', trend: 'worsening', description: 'Part-time barista workforce heavily exposed to Mindestlohn floor. Morning/afternoon peak scheduling creates high effective labour cost per transaction hour.', ebitda_impact_pct: -4.0 },
      { name: 'Prime Location Rent', severity: 'high', trend: 'stable', description: 'A-location cafés require high-footfall sites at €25–40/m². CPI-indexed leases compound facility cost annually. Lease renewal risk is the primary terminal threat.', ebitda_impact_pct: -2.5 },
    ],
  },
  lodging: {
    summary: 'Asset-heavy hospitality with high fixed cost base and RevPAR as the critical operational metric. Leisure and business segments have structurally different risk profiles.',
    leverage: 'Occupancy × ADR (Average Daily Rate). Above ~65% occupancy, EBITDA scales significantly due to near-zero variable cost per room. Distribution mix (direct vs OTA) determines effective ADR.',
    drivers: [
      { name: 'OTA Distribution Dependency', severity: 'high', trend: 'worsening', description: 'Booking.com/Expedia commissions 15–25%. High OTA dependency suppresses effective ADR by 18–22%. Direct booking programmes can improve EBITDA by 3–5pp.', ebitda_impact_pct: -3.0 },
      { name: 'Labour Scarcity (F&B)', severity: 'high', trend: 'worsening', description: 'Hospitality labour shortages force reduced F&B operating hours, lowering ancillary revenue. Housekeeping staff costs rose 18% in 2022–2024 due to minimum wage and scarcity premium.', ebitda_impact_pct: -2.5 },
      { name: 'Energy Intensity', severity: 'medium', trend: 'improving', description: 'Hotels consume 200–400 kWh/room/year. Energy is 6–10% of operating costs. Post-2022 normalisation and solar/insulation upgrades offer partial offset.', ebitda_impact_pct: -1.5 },
    ],
  },
  bakery: {
    summary: 'High-volume perishables production with extreme energy and raw material exposure. The structural decline of independent bakeries is driven by inability to absorb input cost volatility at low margin.',
    leverage: 'Production efficiency and product mix upgrade (café integration, specialty items). Each additional café seat adds high-margin beverage revenue that cross-subsidises low-margin bread production.',
    drivers: [
      { name: 'Grain & Butter Costs', severity: 'critical', trend: 'improving', description: 'Wheat +65% peak (2022), now partially retracing. Butter remains 40% above 2020 levels. Input cost volatility makes forward planning difficult without futures hedging — unavailable to most SME bakeries.', ebitda_impact_pct: -5.0 },
      { name: 'Energy Intensity (Ovens)', severity: 'critical', trend: 'stable', description: 'Baking ovens run 6–16h daily. Energy is 8–12% of revenue. During 2022 energy spike, this rose to 18–22% for many operators — directly causing insolvencies.', ebitda_impact_pct: -4.0 },
      { name: 'Skilled Labour Scarcity', severity: 'high', trend: 'worsening', description: 'Baker Ausbildung completions fell 40% since 2010. Qualified Bäckermeister commands significant wage premium. Many bakeries operate with under-qualified staff, affecting product quality and certification.', ebitda_impact_pct: -2.0 },
    ],
  },
  bar: {
    summary: 'High-margin beverage retail with extreme temporal concentration. Revenue is structurally dependent on 3 operating days per week. Regulatory and landlord risk is disproportionate.',
    leverage: 'Weekend peak utilisation and average spend per visit. Cocktail attachment rate is the primary margin lever — a drink upgrade from beer to cocktail doubles margin per transaction.',
    drivers: [
      { name: 'Weekend Revenue Concentration', severity: 'critical', trend: 'stable', description: '70–80% of weekly revenue generated Thursday–Saturday. A single operational disruption (bad weather, event cancellation, structural maintenance) has outsized impact. No buffer trading days to compensate.', ebitda_impact_pct: -3.0 },
      { name: 'Late-Night Staffing Costs', severity: 'high', trend: 'worsening', description: 'Security (Türsteher) €15–25/hr, bartenders with late-night premium. Weekend night staffing often 40% more expensive per hour than comparable daytime operations.', ebitda_impact_pct: -2.5 },
      { name: 'Spirits & Beverage Input Inflation', severity: 'medium', trend: 'stable', description: 'Premium spirits prices +8–15% (2022–2024). Craft beer input costs +12%. Consumer perception limits price passthrough beyond a threshold, compressing margin.', ebitda_impact_pct: -1.5 },
    ],
  },
  hair_care: {
    summary: 'Labour-intensive personal service with strong repeat-customer dependency. Stylist attrition is the primary operational risk — customer loyalty follows the stylist, not the brand.',
    leverage: 'Seat utilisation rate and average ticket upgrade (colour treatments, product retail). A productive senior stylist generates €100–160k revenue; maximising this throughput is the key value driver.',
    drivers: [
      { name: 'Stylist Attrition Risk', severity: 'critical', trend: 'worsening', description: 'Losing a senior stylist typically means 15–30% immediate revenue loss. Non-compete agreements are difficult to enforce in Germany. Referral business follows the individual, not the salon location.', ebitda_impact_pct: -5.0 },
      { name: 'Minimum Wage Pressure', severity: 'high', trend: 'worsening', description: 'Junior stylists and apprentices near Mindestlohn floor. Wage pressure from Barbershop competition compressing recruitment economics. Many independent salons cannot offer competitive packages.', ebitda_impact_pct: -3.0 },
      { name: 'Consumable Cost Inflation', severity: 'medium', trend: 'stable', description: 'Colour, bleach, and chemical treatment costs +15–20% (2022–2024). Can be partially offset through premium service pricing but risk client churn at price-sensitive tier.', ebitda_impact_pct: -1.5 },
    ],
  },
  car_repair: {
    summary: 'Skilled-labour and capital-intensive auto service. Revenue per billed hour is the core metric. EV transition represents both a structural risk (reduced ICE maintenance needs long-term) and opportunity (certification premium).',
    leverage: 'Labour utilisation rate and job value mix. Complex repair work (Motorschäden, Getriebearbeit) generates 3–5× the margin of routine service. Spare parts margin is significant upside.',
    drivers: [
      { name: 'EV Transition Disruption', severity: 'high', trend: 'worsening', description: 'EVs require 40% less scheduled maintenance than ICE vehicles (no oil changes, fewer brake replacements). Long-term revenue risk as fleet electrifies, though current EV share is still <10% of repair volume.', ebitda_impact_pct: -2.0 },
      { name: 'Technician Shortage', severity: 'critical', trend: 'worsening', description: 'Kfz-Mechatroniker shortage acute in Germany. Qualified EV technicians command 20–35% wage premium. Inability to hire limits throughput capacity — revenue ceiling imposed by headcount scarcity.', ebitda_impact_pct: -3.0 },
      { name: 'Parts Supply Chain Risk', severity: 'medium', trend: 'improving', description: 'Chip shortage (2021–2022) caused parts delays and customer wait times. Now largely resolved, but ongoing geopolitical risk. Parts margin pressure from online comparison platforms.', ebitda_impact_pct: -1.0 },
    ],
  },
  dentist: {
    summary: 'Regulated healthcare with predictable recurring revenue (recalls, hygiene). Private-pay and cosmetic treatments provide the high-margin growth layer above GKV baseline.',
    leverage: 'Treatment acceptance rate for high-value private services (Implantate, Aligners, Zahnersatz). A single implant case generates margin equivalent to 10–20 routine appointments.',
    drivers: [
      { name: 'GKV Fee Compression', severity: 'high', trend: 'worsening', description: 'Kassenpatienten procedures have frozen reimbursement rates while cost inflation continues. GKV revenue per patient declining in real terms. Private insurance and Selbstzahler mix is critical for margin maintenance.', ebitda_impact_pct: -2.5 },
      { name: 'PE Acquisition Competition', severity: 'medium', trend: 'worsening', description: 'MVZ chains (Dental21, Zahnarztpraxis) aggressively acquiring solo practices. Dentist recruitment increasingly diverted to employed positions, making solo practice hiring harder and more expensive.', ebitda_impact_pct: -1.5 },
      { name: 'Lab & Material Cost Inflation', severity: 'medium', trend: 'stable', description: 'Zahntechnik laboratory costs +12–18% (2022–2024). Digital dentistry (CAD/CAM in-house) offers cost reduction but requires €80–150k capital investment.', ebitda_impact_pct: -2.0 },
    ],
  },
  pharmacy: {
    summary: 'Regulated distribution business with thin margins on core Rx revenue and moderate margins on OTC and beauty. Structural disruption from e-prescriptions is accelerating.',
    leverage: 'OTC and beauty product attachment rate on prescription visits. A customer who picks up Rx and buys €25 in OTC/cosmetics generates 3× the margin of Rx-only visits.',
    drivers: [
      { name: 'E-Rezept Market Share Erosion', severity: 'critical', trend: 'worsening', description: 'Digital prescriptions enable seamless online pharmacy ordering (DocMorris, Redcare). Independent pharmacies without strong doctor referral relationships face structural attrition of Rx volume.', ebitda_impact_pct: -4.0 },
      { name: 'Generika Margin Compression', severity: 'high', trend: 'stable', description: 'GKV Festbeträge force dispensing of lowest-cost generika. Retroactive rebate claims from GKV are administratively burdensome and create cash flow uncertainty.', ebitda_impact_pct: -2.0 },
      { name: 'Pharmacist Shortage', severity: 'high', trend: 'worsening', description: 'Pharmacist vacancy rate rising. Locum rates +25–40% since 2021. Operating hours may need reduction without adequate staffing, directly limiting revenue.', ebitda_impact_pct: -2.5 },
    ],
  },
};

const DEPENDENCY_DEFAULT = {
  summary: 'Service business with standard SME cost structure. Personnel and facility are the primary fixed cost drivers.',
  leverage: 'Service quality and repeat customer rate. Referral-driven businesses have lowest customer acquisition cost.',
  drivers: [
    { name: 'Labour Cost Inflation', severity: 'high' as const, trend: 'worsening' as const, description: 'German Mindestlohn trajectory and sector-specific wage pressure creating multi-year cost escalation in labour-intensive services.', ebitda_impact_pct: -3.0 },
    { name: 'Consumer Confidence', severity: 'medium' as const, trend: 'stable' as const, description: 'German consumer confidence recovering from 2022–2023 inflation shock. GfK consumer climate index improving but remains below pre-pandemic levels.', ebitda_impact_pct: -1.5 },
  ],
};

function buildDependencyMatrix(type: string, drivers?: CostDriver[]): DependencyMatrix {
  const def = DEPENDENCY_DEFS[type] ?? DEPENDENCY_DEFAULT;
  const d = drivers ?? def.drivers;
  const drag = d.reduce((s, dr) => s + dr.ebitda_impact_pct, 0);
  return {
    business_model_summary: def.summary,
    primary_leverage: def.leverage,
    drivers: d,
    net_ebitda_drag_pct: Math.round(drag * 10) / 10,
  };
}

// ── Bundesland macro data ──────────────────────────────────────────────────────

interface BLMacro { unemployment_pct: number; ppp_index: number; median_gross_wage: number; }

const BUNDESLAND_MACRO: Record<string, BLMacro> = {
  'Bayern':                  { unemployment_pct: 3.4, ppp_index: 108.5, median_gross_wage: 46200 },
  'Baden-Württemberg':       { unemployment_pct: 3.5, ppp_index: 106.8, median_gross_wage: 47100 },
  'Hamburg':                 { unemployment_pct: 5.8, ppp_index: 112.3, median_gross_wage: 50200 },
  'Berlin':                  { unemployment_pct: 9.1, ppp_index: 98.5,  median_gross_wage: 42100 },
  'Nordrhein-Westfalen':     { unemployment_pct: 7.2, ppp_index: 100.5, median_gross_wage: 44100 },
  'Hessen':                  { unemployment_pct: 5.4, ppp_index: 107.2, median_gross_wage: 47800 },
  'Niedersachsen':           { unemployment_pct: 5.8, ppp_index: 96.2,  median_gross_wage: 40800 },
  'Sachsen':                 { unemployment_pct: 5.9, ppp_index: 87.5,  median_gross_wage: 36200 },
  'Thüringen':               { unemployment_pct: 5.9, ppp_index: 83.2,  median_gross_wage: 34800 },
  'Sachsen-Anhalt':          { unemployment_pct: 7.3, ppp_index: 81.5,  median_gross_wage: 33900 },
  'Brandenburg':             { unemployment_pct: 6.1, ppp_index: 85.3,  median_gross_wage: 35200 },
  'Mecklenburg-Vorpommern':  { unemployment_pct: 7.4, ppp_index: 82.1,  median_gross_wage: 33100 },
  'Schleswig-Holstein':      { unemployment_pct: 5.6, ppp_index: 97.8,  median_gross_wage: 39800 },
  'Rheinland-Pfalz':         { unemployment_pct: 5.3, ppp_index: 98.3,  median_gross_wage: 41200 },
  'Saarland':                { unemployment_pct: 6.5, ppp_index: 96.4,  median_gross_wage: 40100 },
  'Bremen':                  { unemployment_pct: 9.9, ppp_index: 97.5,  median_gross_wage: 43500 },
};
const BL_DEFAULT: BLMacro = { unemployment_pct: 5.5, ppp_index: 100, median_gross_wage: 43000 };

const CITY_RENT_MAP: [string[], number][] = [
  [['münchen', 'munich'], 35],
  [['frankfurt'], 32],
  [['hamburg'], 30],
  [['berlin'], 27],
  [['köln', 'cologne', 'düsseldorf', 'stuttgart', 'nürnberg', 'nuremberg', 'leipzig', 'hannover', 'dresden'], 21],
  [['dortmund', 'essen', 'bochum', 'wuppertal', 'duisburg', 'bonn', 'mannheim', 'karlsruhe', 'augsburg'], 16],
];
const RENT_DEFAULT = 12;

// ── Calculation helpers ────────────────────────────────────────────────────────

function getCommercialRent(city: string | null): number {
  if (!city) return RENT_DEFAULT;
  const c = city.toLowerCase();
  for (const [patterns, rent] of CITY_RENT_MAP) {
    if (patterns.some(p => c.includes(p))) return rent;
  }
  return RENT_DEFAULT;
}

function calcMacroData(bundesland: string | null, city: string | null): MacroData {
  let bl: BLMacro | null = null;
  if (bundesland) {
    for (const [k, v] of Object.entries(BUNDESLAND_MACRO)) {
      if (bundesland.includes(k) || k.includes(bundesland.split(' ')[0])) { bl = v; break; }
    }
  }
  const m = bl ?? BL_DEFAULT;
  return {
    unemployment_pct: m.unemployment_pct,
    national_avg_unemployment: 5.5,
    ppp_index: m.ppp_index,
    median_gross_wage: m.median_gross_wage,
    commercial_rent_per_sqm: getCommercialRent(city),
    bundesland, city,
    data_source: 'Bundesagentur für Arbeit / Destatis / IHK / Prognos 2024',
  };
}

function calcLaborFriction(macroData: MacroData, types: string[], competitors: CompetitorData[]): LaborFriction {
  const unemploymentRatio = macroData.unemployment_pct / macroData.national_avg_unemployment;
  const frictionFromUnemployment = Math.max(0, 100 - unemploymentRatio * 55);
  const frictionFromCompetition  = Math.min(20, competitors.length * 3);
  const hospitalityTypes = ['lodging', 'restaurant', 'cafe', 'bar', 'bakery'];
  const industryBonus = types.some(t => hospitalityTypes.includes(t)) ? 18 : 6;
  const index = Math.min(100, Math.max(0, Math.round(frictionFromUnemployment + frictionFromCompetition + industryBonus)));
  const wagePressure = macroData.unemployment_pct < 4.5;
  const interpretation = index >= 70
    ? 'Severe hiring difficulty — significant wage pressure and high turnover risk. Budgeting 15–20% above posted rates required.'
    : index >= 50 ? 'Moderate friction — competitive labor market, proactive retention needed. Wage increments above CPI necessary.'
    : index >= 30 ? 'Manageable friction — adequate labor supply at standard sector wages. Normal recruitment timelines.'
    : 'Low friction — favorable hiring conditions. Below-average wage pressure in this region.';
  return { index, unemployment_pct: macroData.unemployment_pct, national_avg_unemployment: macroData.national_avg_unemployment, wage_pressure_flag: wagePressure, interpretation };
}

function fmtEurRoute(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`;
  return `€${n}`;
}

function calcSyntheticPL(
  types: string[],
  reviewCount: number,
  rawReviews: any[],
  macroData: MacroData,
): SyntheticPL {
  const primaryType = types.find(t => INDUSTRY_PARAMS[t]) ?? types[0] ?? 'restaurant';
  const params = INDUSTRY_PARAMS[primaryType] ?? INDUSTRY_PARAMS_DEFAULT;
  const eco = INDUSTRY_ECONOMICS[primaryType] ?? ECONOMICS_DEFAULT;

  // Age from oldest known review
  const years = rawReviews
    .map((r: any) => r.publishTime ? new Date(r.publishTime).getFullYear() : 0)
    .filter((y: number) => y > 2005);
  const oldestYear = years.length > 0 ? Math.min(...years) : 2019;
  const estimatedAge = Math.max(3, 2025 - oldestYear + 1);

  const annualReviews = reviewCount / estimatedAge;
  const pppFactor = macroData.ppp_index / 100;
  const adjustedBasket = params.avg_basket_eur * pppFactor;

  // Three capture-rate scenarios
  const txnMid  = annualReviews / (params.capture_rate_expected    / 100);
  const txnLow  = annualReviews / (params.capture_rate_pessimistic / 100); // higher rate → fewer txn
  const txnHigh = annualReviews / (params.capture_rate_optimistic  / 100); // lower rate  → more txn

  const revMid  = Math.max(15000, Math.round(txnMid  * adjustedBasket));
  const revLow  = Math.max(8000,  Math.round(txnLow  * adjustedBasket));
  const revHigh =                 Math.round(txnHigh * adjustedBasket);

  // Fixed costs — anchored to mid-scenario revenue for FTE estimation
  const fte = Math.max(0.5, Math.round((revMid / params.revenue_per_fte) * 10) / 10);
  const sectorWage = macroData.median_gross_wage * params.sector_wage_multiplier;
  const personnelCost = Math.round(fte * sectorWage * 1.21); // +21% employer social contributions
  const facilityCost  = Math.round(params.typical_sqm * macroData.commercial_rent_per_sqm * 12);
  const totalFixedCosts = personnelCost + facilityCost;

  // Scenario-dependent gross profit and variable opex
  const gpMid  = Math.round(revMid  * (params.gross_margin_pct / 100));
  const gpLow  = Math.round(revLow  * (params.gross_margin_pct / 100));
  const gpHigh = Math.round(revHigh * (params.gross_margin_pct / 100));

  const varOpexMid  = Math.round(revMid  * 0.08);
  const varOpexLow  = Math.round(revLow  * 0.08);
  const varOpexHigh = Math.round(revHigh * 0.08);

  const ebitdaMid  = gpMid  - totalFixedCosts - varOpexMid;
  const ebitdaLow  = gpLow  - totalFixedCosts - varOpexLow;
  let   ebitdaHigh = gpHigh - totalFixedCosts - varOpexHigh;

  // ── Sanity check: synthetic Rev/FTE vs benchmark ──────────────────────────
  const revPerEmpSynthetic  = Math.round(revMid / fte);
  const revPerEmpBenchmark  = params.revenue_per_fte;
  const ratio = revPerEmpSynthetic / revPerEmpBenchmark;
  const overheated = ratio > 1.30;
  let compressionNote: string | null = null;
  let finalRevHigh = revHigh;

  if (overheated) {
    // Compress upper bound so implied Rev/FTE does not exceed benchmark × 1.30
    finalRevHigh = Math.round(revPerEmpBenchmark * fte * 1.30);
    const gpHighCompressed = Math.round(finalRevHigh * (params.gross_margin_pct / 100));
    ebitdaHigh = gpHighCompressed - totalFixedCosts - Math.round(finalRevHigh * 0.08);
    compressionNote = `Upper bound compressed from ${fmtEurRoute(revHigh)} → ${fmtEurRoute(finalRevHigh)}: synthetic Rev/FTE ${fmtEurRoute(revPerEmpSynthetic)} exceeded benchmark ${fmtEurRoute(revPerEmpBenchmark)} by ${((ratio - 1) * 100).toFixed(0)}%.`;
  }

  // Fixed cost ratio: total fixed costs ÷ gross profit × 100 (corrected formula)
  const fixedCostRatio = gpMid > 0 ? Math.round((totalFixedCosts / gpMid) * 100) : 999;
  const highFixedCostRisk = fixedCostRatio > 80;

  // Breakeven revenue
  const variableCostRatio = (1 - params.gross_margin_pct / 100) + 0.08; // COGS% + var opex%
  const contributionMarginRatio = 1 - variableCostRatio;
  const breakevenRevenue = contributionMarginRatio > 0
    ? Math.round(totalFixedCosts / contributionMarginRatio)
    : revMid * 2;

  const ebitdaMarginMid  = revMid > 0 ? Math.round(ebitdaMid  / revMid  * 1000) / 10 : 0;
  const ebitdaMarginLow  = revLow > 0 ? Math.round(ebitdaLow  / revLow  * 1000) / 10 : 0;
  const ebitdaMarginHigh = finalRevHigh > 0 ? Math.round(ebitdaHigh / finalRevHigh * 1000) / 10 : 0;

  const rentPct      = revMid > 0 ? Math.round(facilityCost  / revMid * 1000) / 10 : null;
  const personnelPct = revMid > 0 ? Math.round(personnelCost / revMid * 1000) / 10 : null;

  const depMatrix = buildDependencyMatrix(primaryType);

  // Risk summary
  const dominant = personnelCost >= facilityCost ? 'personnel-heavy' : 'facility-heavy';
  const marginVsBenchmark = ebitdaMarginMid >= (eco.avg_margin_pct ?? 10) * 0.85 ? 'at or above' : 'below';
  const riskLevel = highFixedCostRisk ? 'HIGH' : fixedCostRatio > 65 ? 'MEDIUM' : 'LOW';
  const riskSummary =
    `Estimated as ${dominant} business model. Fixed costs (personnel ${fmtEurRoute(personnelCost)} + facility ${fmtEurRoute(facilityCost)}) ` +
    `consume ${fixedCostRatio}% of gross profit. ` +
    `Mid-case EBITDA margin ${ebitdaMarginMid}% is ${marginVsBenchmark} the ${eco.industry_label} sector benchmark of ${eco.avg_margin_pct ?? '—'}%. ` +
    `Break-even at ${fmtEurRoute(breakevenRevenue)}. Operating leverage risk: ${riskLevel}.` +
    (highFixedCostRisk ? ' A 20% revenue decline eliminates EBITDA — proceed with caution.' : '');

  return {
    estimated_age_years: estimatedAge,
    capture_rate_expected: params.capture_rate_expected,
    capture_rate_pessimistic: params.capture_rate_pessimistic,
    capture_rate_optimistic: params.capture_rate_optimistic,
    revenue: { low: revLow, mid: revMid, high: finalRevHigh },
    annual_transactions: { low: Math.round(txnLow), mid: Math.round(txnMid), high: Math.round(txnHigh) },
    adjusted_basket_eur: Math.round(adjustedBasket * 100) / 100,
    cogs: {
      low:  Math.round(revLow       * (1 - params.gross_margin_pct / 100)),
      mid:  Math.round(revMid       * (1 - params.gross_margin_pct / 100)),
      high: Math.round(finalRevHigh * (1 - params.gross_margin_pct / 100)),
    },
    gross_profit: {
      low:  gpLow,
      mid:  gpMid,
      high: Math.round(finalRevHigh * (params.gross_margin_pct / 100)),
    },
    gross_margin_pct: params.gross_margin_pct,
    fte_estimate: fte,
    personnel_cost: personnelCost,
    facility_sqm: params.typical_sqm,
    facility_cost: facilityCost,
    other_opex: { low: varOpexLow, mid: varOpexMid, high: Math.round(finalRevHigh * 0.08) },
    total_fixed_costs: totalFixedCosts,
    ebitda: { low: ebitdaLow, mid: ebitdaMid, high: ebitdaHigh },
    ebitda_margin_pct: { low: ebitdaMarginLow, mid: ebitdaMarginMid, high: ebitdaMarginHigh },
    industry_avg_ebitda_margin: eco.avg_margin_pct,
    fixed_cost_ratio: fixedCostRatio,
    breakeven_revenue: breakevenRevenue,
    revenue_per_employee: revPerEmpSynthetic,
    rent_as_revenue_pct: rentPct,
    personnel_as_revenue_pct: personnelPct,
    high_fixed_cost_risk: highFixedCostRisk,
    sanity_check: {
      rev_per_employee_synthetic: revPerEmpSynthetic,
      rev_per_employee_benchmark: revPerEmpBenchmark,
      ratio: Math.round(ratio * 100) / 100,
      overheated,
      compression_note: compressionNote,
    },
    dependency_matrix: depMatrix,
    risk_summary: riskSummary,
  };
}

function buildMarketTimeline(types: string[], totalReviewCount: number, rawReviews: any[]): TimelinePoint[] {
  const quarters = ['Q1 2020','Q2 2020','Q3 2020','Q4 2020','Q1 2021','Q2 2021','Q3 2021','Q4 2021','Q1 2022','Q2 2022','Q3 2022','Q4 2022','Q1 2023','Q2 2023','Q3 2023','Q4 2023','Q1 2024','Q2 2024','Q3 2024','Q4 2024'];
  const SEASONAL: Record<string, number[]> = {
    lodging: [0.65, 1.10, 1.45, 0.80], restaurant: [0.85, 1.05, 1.15, 0.95],
    cafe: [0.92, 0.95, 1.02, 1.11], bakery: [0.95, 0.95, 0.95, 1.15], bar: [0.80, 1.00, 1.25, 0.95],
  };
  const seasonal = SEASONAL[types.find(t => SEASONAL[t]) ?? ''] ?? [1, 1, 1, 1];
  const isHospitality = types.some(t => ['lodging', 'restaurant', 'cafe', 'bar', 'bakery'].includes(t));
  const covid = isHospitality
    ? [0.90, 0.18, 0.42, 0.62, 0.58, 0.80, 0.98, 1.00, 1.05, 1.15, 1.20, 1.10, 1.08, 1.14, 1.18, 1.08, 1.08, 1.12, 1.12, 1.06]
    : [1.00, 0.88, 0.95, 0.98, 0.95, 0.98, 1.02, 1.00, 1.00, 1.04, 1.07, 1.04, 1.04, 1.08, 1.08, 1.04, 1.04, 1.07, 1.07, 1.04];
  const realByQ: Record<string, number> = {};
  for (const r of rawReviews) {
    if (!r.publishTime) continue;
    const d = new Date(r.publishTime);
    const key = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    realByQ[key] = (realByQ[key] ?? 0) + 1;
  }
  const base = totalReviewCount / 20;
  const trendBase = [38,40,42,45,43,47,50,52,52,55,57,58,59,61,62,63,64,65,66,67];
  return quarters.map((q, i) => {
    const adj = covid[i] * seasonal[i % 4];
    const reviews = realByQ[q] !== undefined ? realByQ[q] : Math.max(0, Math.round(base * adj));
    return { period: q, reviews, trends_index: Math.max(5, Math.round(trendBase[i] * adj)) };
  });
}

// ── Spatial context ───────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function calcSpatialContext(lat: number, lng: number): Promise<SpatialContext> {
  const query = `[out:json][timeout:12];(node["railway"="station"](around:3000,${lat},${lng});node["railway"="halt"](around:3000,${lat},${lng});node["public_transport"="station"]["train"="yes"](around:3000,${lat},${lng});node["amenity"="bus_station"](around:3000,${lat},${lng});node["amenity"="townhall"](around:8000,${lat},${lng});node["place"="city"](around:15000,${lat},${lng});node["place"="town"](around:8000,${lat},${lng}););out body 30;`;
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(13000),
    });
    if (!r.ok) throw new Error('overpass error');
    const data = await r.json();
    const elements: any[] = data.elements ?? [];

    // Nearest transport hub
    const transportEls = elements.filter(e => e.tags?.railway === 'station' || e.tags?.railway === 'halt' || e.tags?.public_transport === 'station' || e.tags?.amenity === 'bus_station');
    let nearestTransport: SpatialContext['nearest_transport'] = null;
    for (const el of transportEls) {
      if (el.lat == null || el.lon == null) continue;
      const dist = haversineDistance(lat, lng, el.lat, el.lon);
      if (!nearestTransport || dist < nearestTransport.distance_m) {
        nearestTransport = {
          name: el.tags.name ?? (el.tags.railway === 'station' ? 'Bahnhof' : 'Haltestelle'),
          type: el.tags.railway === 'station' ? 'Bahnhof' : el.tags.amenity === 'bus_station' ? 'Busbahnhof' : 'Haltestelle',
          distance_m: Math.round(dist),
          walking_min: Math.round(dist / 80),
        };
      }
    }

    // City center
    const townhall = elements.find(e => e.tags?.amenity === 'townhall' && e.lat != null);
    const cityNode = elements.find(e => e.tags?.place === 'city' && e.lat != null);
    const townNode = elements.find(e => e.tags?.place === 'town' && e.lat != null);
    const center = townhall ?? cityNode ?? townNode;
    const cityCenterDistM = center ? Math.round(haversineDistance(lat, lng, center.lat, center.lon)) : null;

    // Zone classification
    const transportDist = nearestTransport?.distance_m ?? 9999;
    const ccDist = cityCenterDistM ?? 9999;
    let zone: SpatialContext['zone_classification'];
    if (transportDist < 250 && ccDist < 1500) zone = 'prime_commercial';
    else if (transportDist < 600 || ccDist < 1200) zone = 'secondary_commercial';
    else if (ccDist < 3500) zone = 'mixed_use';
    else if (ccDist < 7000) zone = 'residential';
    else zone = 'peripheral';

    // Foot traffic score
    let ftScore = 40;
    if (transportDist < 150) ftScore += 32;
    else if (transportDist < 300) ftScore += 24;
    else if (transportDist < 600) ftScore += 14;
    else if (transportDist < 1200) ftScore += 6;
    else if (transportDist > 2500) ftScore -= 10;
    if (ccDist < 500) ftScore += 22;
    else if (ccDist < 1200) ftScore += 14;
    else if (ccDist < 2500) ftScore += 6;
    else if (ccDist > 6000) ftScore -= 10;
    const footTrafficScore = Math.max(5, Math.min(100, ftScore));

    // Location economics text
    const zoneDescriptions: Record<string, string> = {
      prime_commercial: 'Prime commercial zone — maximum organic foot traffic, high spontaneous discovery rate. Premium rents are structurally justified by transaction volume.',
      secondary_commercial: 'Secondary commercial zone — good foot traffic supported by transit proximity. Strong repeat-customer dependency with solid walk-in base.',
      mixed_use: 'Mixed-use urban zone — moderate organic discovery. Benefits from residential density. Active marketing and strong signage are necessary to maximise visibility.',
      residential: 'Residential neighbourhood — organic foot traffic is minimal. Business viability depends almost entirely on repeat customers and word-of-mouth referrals. High customer lifetime value is essential.',
      peripheral: 'Peripheral location — structurally limited foot traffic. Business relies on destination-specific demand: strong brand, active customer acquisition, or B2B/delivery orientation.',
      unknown: 'Zone classification unavailable.',
    };

    const transportNote = nearestTransport
      ? `Nearest public transport hub: ${nearestTransport.name} (${nearestTransport.type}), ${nearestTransport.distance_m}m away — approximately ${nearestTransport.walking_min} min walk.`
      : 'No major transport hub found within 3km — this is a car-dependent location with limited transit-driven footfall.';
    const centerNote = cityCenterDistM != null
      ? `Distance to city center: ${cityCenterDistM.toLocaleString()}m (${cityCenterDistM < 600 ? 'core center' : cityCenterDistM < 1500 ? 'near center, walkable' : cityCenterDistM < 3500 ? 'inner periphery' : 'outer district'}).`
      : '';
    const footNote = footTrafficScore >= 75
      ? 'Foot traffic fundamentals are strong — structural demand generators support consistent organic customer flow.'
      : footTrafficScore >= 50
      ? 'Foot traffic is adequate but not exceptional. Brand reputation and active marketing are necessary to fully realise the location\'s potential.'
      : 'Foot traffic fundamentals are weak. Revenue resilience depends heavily on loyal repeat customers and aggressive outbound marketing.';

    return {
      nearest_transport: nearestTransport,
      city_center_distance_m: cityCenterDistM,
      zone_classification: zone,
      foot_traffic_score: footTrafficScore,
      location_economics: [transportNote, centerNote, zoneDescriptions[zone], footNote].filter(Boolean).join(' '),
    };
  } catch {
    return {
      nearest_transport: null,
      city_center_distance_m: null,
      zone_classification: 'unknown',
      foot_traffic_score: 50,
      location_economics: 'Spatial analysis unavailable — Overpass API timeout or missing coordinates.',
    };
  }
}

// ── Sentiment helpers ──────────────────────────────────────────────────────────

const PRAISE_THEMES_DEF = [
  { theme: 'Service & Staff',    keywords: ['freundlich', 'nett', 'aufmerksam', 'hilfsbereit', 'kompetent', 'zuvorkommend', 'super service', 'friendly', 'helpful', 'great staff'] },
  { theme: 'Quality',            keywords: ['lecker', 'frisch', 'köstlich', 'exzellent', 'hervorragend', 'hochwertig', 'delicious', 'excellent', 'amazing', 'top qualität'] },
  { theme: 'Atmosphere',         keywords: ['gemütlich', 'schön', 'sauber', 'angenehm', 'einladend', 'cozy', 'clean', 'beautiful', 'nice atmosphere'] },
  { theme: 'Value for Money',    keywords: ['preiswert', 'günstig', 'fair', 'angemessen', 'gutes preis', 'preis-leistung', 'reasonable', 'worth it'] },
  { theme: 'Would Recommend',    keywords: ['empfehlen', 'empfehlenswert', 'immer wieder', 'recommend', 'highly recommend', 'definitiv', 'unbedingt'] },
];
const COMPLAINT_THEMES_DEF = [
  { theme: 'Poor Service',       keywords: ['unfreundlich', 'arrogant', 'ignoriert', 'kein service', 'unhelpful', 'rude', 'ignored', 'schlechter service'] },
  { theme: 'Wait Times',         keywords: ['warten', 'wartezeit', 'zu lange', 'ewig gewartet', 'slow', 'waited long', 'zu langsam', 'lange wartezeit'] },
  { theme: 'Quality Issues',     keywords: ['kalt', 'schlecht', 'enttäuschend', 'alt', 'disappointing', 'bad quality', 'terrible', 'geschmacklos'] },
  { theme: 'Overpriced',         keywords: ['teuer', 'überteuert', 'wucher', 'zu teuer', 'overpriced', 'expensive', 'not worth', 'abzocke'] },
  { theme: 'Cleanliness',        keywords: ['dreckig', 'schmutzig', 'dirty', 'unclean', 'unhygienic', 'unhygienisch'] },
  { theme: 'Would Not Return',   keywords: ['nie wieder', 'never again', 'worst', 'awful', 'avoid', 'nicht empfehlen'] },
];

function analyzeSentimentKeywords(reviews: ReviewData[]): SentimentKeywords {
  const texts = reviews.map(r => (r.text ?? '').toLowerCase());
  const matchThemes = (defs: { theme: string; keywords: string[] }[]): SentimentTheme[] =>
    defs.map(def => {
      const examples: string[] = []; let count = 0;
      for (const text of texts) {
        for (const kw of def.keywords) {
          if (text.includes(kw)) {
            count++;
            const s = text.split(/[.!?]+/).find(s => s.includes(kw));
            if (s && s.trim().length > 8 && !examples.some(e => e.includes(kw))) examples.push(s.trim().slice(0, 110));
            break;
          }
        }
      }
      return { theme: def.theme, examples: examples.slice(0, 3), count };
    }).filter(t => t.count > 0);
  const allText = texts.join(' ');
  const posKws = ['preiswert', 'günstig', 'fair', 'angemessen', 'reasonable', 'worth it', 'gutes preis'];
  const negKws = ['teuer', 'überteuert', 'wucher', 'zu teuer', 'overpriced', 'expensive', 'not worth', 'abzocke'];
  return { praises: matchThemes(PRAISE_THEMES_DEF), complaints: matchThemes(COMPLAINT_THEMES_DEF), pricing_keywords_positive: posKws.filter(kw => allText.includes(kw)).length, pricing_keywords_negative: negKws.filter(kw => allText.includes(kw)).length };
}

// ── Area/Radar/PricingPower helpers ───────────────────────────────────────────

function calcPricingPower(targetRating: number | null, targetReviewCount: number, targetPriceLevelNum: number | null, competitors: CompetitorData[], sk: SentimentKeywords, totalAreaReviews: number): PricingPower {
  const compPrices = competitors.map(c => c.price_level ? (PRICE_LABEL_NUM[c.price_level] ?? null) : null).filter((v): v is number => v !== null);
  const avgCompPrice = compPrices.length > 0 ? compPrices.reduce((a, b) => a + b, 0) / compPrices.length : null;
  const pricePremiumIndex = (targetPriceLevelNum != null && avgCompPrice != null && avgCompPrice > 0) ? Math.round(targetPriceLevelNum / avgCompPrice * 100) / 100 : null;
  const compRatings = competitors.map(c => c.rating ? parseFloat(c.rating) : null).filter((v): v is number => v !== null);
  const avgCompRating = compRatings.length > 0 ? compRatings.reduce((a, b) => a + b, 0) / compRatings.length : null;
  const ratingPremium = (targetRating != null && avgCompRating != null) ? Math.round((targetRating - avgCompRating) * 100) / 100 : null;
  const localDemandShare = totalAreaReviews > 0 ? Math.round(targetReviewCount / totalAreaReviews * 100 * 10) / 10 : null;
  const negPriceSentimentRatio = Math.round(sk.pricing_keywords_negative / Math.max(1, targetReviewCount) * 100) / 100;
  const factors_met: string[] = []; const factors_missing: string[] = [];
  if (pricePremiumIndex !== null) { if (pricePremiumIndex > 1) factors_met.push(`Price Premium Index ${pricePremiumIndex}x > 1.0 ✓`); else factors_missing.push(`Price Premium Index ${pricePremiumIndex}x ≤ 1.0`); } else { factors_missing.push('Price Premium: no competitor price data'); }
  if (ratingPremium !== null) { if (ratingPremium >= 0) factors_met.push(`Rating Premium +${ratingPremium} above market avg ✓`); else factors_missing.push(`Rating Premium ${ratingPremium} below market`); } else { factors_missing.push('Rating Premium: no competitor ratings'); }
  if (localDemandShare !== null) { if (localDemandShare >= 10) factors_met.push(`Local Demand Share ${localDemandShare}% ≥ 10% ✓`); else factors_missing.push(`Local Demand Share ${localDemandShare}% < 10%`); } else { factors_missing.push('Local Demand Share: no data'); }
  if (negPriceSentimentRatio < 0.05) factors_met.push(`Neg. Price Sentiment ${(negPriceSentimentRatio * 100).toFixed(1)}% < 5% ✓`); else factors_missing.push(`Neg. Price Sentiment ${(negPriceSentimentRatio * 100).toFixed(1)}% ≥ 5%`);
  return { price_premium_index: pricePremiumIndex, rating_premium: ratingPremium, local_demand_share_pct: localDemandShare, neg_price_sentiment_ratio: negPriceSentimentRatio, confirmed: (pricePremiumIndex ?? 0) > 1 && (ratingPremium ?? -1) >= 0 && (localDemandShare ?? 0) >= 10 && negPriceSentimentRatio < 0.05, factors_met, factors_missing };
}

function calcAreaMetrics(competitors: CompetitorData[], pois: PointOfInterest[], targetReviews: number): AreaMetrics {
  const ratings = competitors.map(c => c.rating ? parseFloat(c.rating) : null).filter((v): v is number => v !== null);
  const avgRating = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 : null;
  const operational = competitors.filter(c => !c.business_status || c.business_status === 'OPERATIONAL').length;
  const operationalPct = competitors.length > 0 ? Math.round(operational / competitors.length * 100) : null;
  const totalAreaReviews = competitors.reduce((s, c) => s + (c.review_volume ? parseInt(c.review_volume) : 0), 0) + targetReviews;
  const avgReviews = totalAreaReviews / (competitors.length + 1);
  const prices = competitors.map(c => c.price_level ? (PRICE_LABEL_NUM[c.price_level] ?? null) : null).filter((v): v is number => v !== null);
  const avgPriceLevel = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 10) / 10 : null;
  const ratingScore = Math.min(35, avgRating ? ((avgRating - 3.0) / 2.0) * 35 : 15);
  const opScore = Math.min(20, operationalPct ? (operationalPct / 100) * 20 : 10);
  const reviewScore = Math.min(20, (avgReviews / 300) * 20);
  const poiScore = Math.min(25, pois.length * 4);
  return { quality_index: Math.max(0, Math.round(ratingScore + opScore + reviewScore + poiScore)), businesses_count: competitors.length, avg_rating_area: avgRating, operational_pct: operationalPct, total_area_reviews: totalAreaReviews, avg_price_level_area: avgPriceLevel };
}

function buildRadarData(targetRating: number | null, targetReviews: number, targetPriceNum: number | null, targetSentimentScore: number | null, hasWebsite: boolean, hasSocials: boolean, competitors: CompetitorData[]): RadarPoint[] {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const compRatings = competitors.map(c => c.rating ? parseFloat(c.rating) : null).filter((v): v is number => v !== null);
  const avgRating = compRatings.length > 0 ? compRatings.reduce((a, b) => a + b, 0) / compRatings.length : 3.5;
  const compReviews = competitors.map(c => c.review_volume ? parseInt(c.review_volume) : 0);
  const maxReviews = Math.max(targetReviews, ...compReviews, 1);
  const avgCompReviews = compReviews.length > 0 ? compReviews.reduce((a, b) => a + b, 0) / compReviews.length : 50;
  const compPrices = competitors.map(c => c.price_level ? (PRICE_LABEL_NUM[c.price_level] ?? null) : null).filter((v): v is number => v !== null);
  const avgPrice = compPrices.length > 0 ? compPrices.reduce((a, b) => a + b, 0) / compPrices.length : 2;
  const avgDigital = competitors.length > 0 ? (competitors.filter(c => c.url).length / competitors.length) * 80 + 10 : 50;
  return [
    { metric: 'Rating',       target: clamp(((targetRating ?? 3) - 1) / 4 * 100), market: clamp((avgRating - 1) / 4 * 100), fullMark: 100 },
    { metric: 'Reviews',      target: clamp(Math.log1p(targetReviews) / Math.log1p(maxReviews) * 100), market: clamp(Math.log1p(avgCompReviews) / Math.log1p(maxReviews) * 100), fullMark: 100 },
    { metric: 'Sentiment',    target: clamp(((targetSentimentScore ?? 0) + 1) / 2 * 100), market: 62, fullMark: 100 },
    { metric: 'Digital',      target: hasWebsite ? (hasSocials ? 95 : 60) : 15, market: clamp(avgDigital), fullMark: 100 },
    { metric: 'Price Access', target: clamp((5 - (targetPriceNum ?? 2)) / 4 * 100), market: clamp((5 - avgPrice) / 4 * 100), fullMark: 100 },
  ];
}

// ── Overpass POIs ──────────────────────────────────────────────────────────────

async function fetchOverpassPOIs(lat: number, lng: number): Promise<PointOfInterest[]> {
  const q = `[out:json][timeout:8];(node["tourism"~"attraction|museum|gallery|viewpoint|artwork|zoo|theme_park"](around:800,${lat},${lng});node["amenity"~"theatre|cinema|library|arts_centre|university|college"](around:800,${lat},${lng});node["historic"~"monument|memorial|castle|ruins|building"](around:800,${lat},${lng});node["leisure"~"park|stadium|sports_centre"](around:800,${lat},${lng}););out 20;`;
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(q)}`, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.elements ?? []).filter((e: any) => e.tags?.name).map((e: any) => ({ id: e.id, name: e.tags.name, category: e.tags.tourism ? 'tourism' : e.tags.amenity ? 'amenity' : e.tags.historic ? 'historic' : 'leisure', subtype: (e.tags.tourism ?? e.tags.amenity ?? e.tags.historic ?? e.tags.leisure ?? 'place').replace(/_/g, ' '), lat: e.lat ?? 0, lng: e.lon ?? 0 })).slice(0, 15) as PointOfInterest[];
  } catch { return []; }
}

// ── URL helpers ────────────────────────────────────────────────────────────────

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
    try { name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).replace(/\s+/g, ' ').trim() || null; }
    catch { name = nameMatch[1].replace(/\+/g, ' ').replace(/%[0-9A-Fa-f]{2}/g, '').replace(/\s+/g, ' ').trim() || null; }
  }
  const biz = url.match(/!3d(-?[0-9.]+)!4d(-?[0-9.]+)/);
  if (biz) return { name, lat: parseFloat(biz[1]), lng: parseFloat(biz[2]) };
  const ctr = url.match(/@(-?[0-9.]+),(-?[0-9.]+)/);
  return { name, lat: ctr ? parseFloat(ctr[1]) : null, lng: ctr ? parseFloat(ctr[2]) : null };
}

function parseAddressComponents(components: any[]): AddressDetail {
  const get = (type: string, short = false) => { const c = components.find((c: any) => c.types?.includes(type)); return c ? (short ? c.shortText : c.longText) ?? null : null; };
  return { street_number: get('street_number'), street: get('route'), sublocality: get('sublocality') ?? get('sublocality_level_1'), city: get('locality') ?? get('postal_town'), bundesland: get('administrative_area_level_1'), landkreis: get('administrative_area_level_2') ?? get('administrative_area_level_3'), postal_code: get('postal_code'), country: get('country'), country_code: get('country', true) };
}

function calcOpeningHours(periods: any[], weekdayText: string[], openNow: boolean | null): HoursData {
  let totalMinutes = 0; let openOnWeekends = false;
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
  const totalHours = totalMinutes / 60; const daysOpen = (periods ?? []).length;
  return { weekday_text: weekdayText ?? [], open_now: openNow, total_weekly_hours: totalHours > 0 ? Math.round(totalHours * 10) / 10 : null, open_on_weekends: openOnWeekends, avg_daily_hours: daysOpen > 0 ? Math.round(totalHours / daysOpen * 10) / 10 : null };
}

function analyzeReviews(reviews: any[]): ReviewAnalysis {
  if (!reviews.length) return { total: 0, positive: 0, negative: 0, neutral: 0, sentiment_score: null, avg_review_length: 0, oldest_date: null, newest_date: null, languages: [], tourist_ratio_pct: null };
  const positive = reviews.filter(r => (r.rating ?? 0) >= 4).length;
  const negative = reviews.filter(r => (r.rating ?? 0) <= 2).length;
  const neutral = reviews.length - positive - negative;
  const texts = reviews.map(r => (r.text?.text ?? r.text ?? '') as string);
  const avgLength = Math.round(texts.reduce((s, t) => s + t.length, 0) / reviews.length);
  const times = reviews.map(r => r.publishTime).filter(Boolean).map((t: string) => new Date(t).getTime()).sort((a: number, b: number) => a - b);
  const oldest = times[0] ? new Date(times[0]).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' }) : null;
  const newest = times[times.length - 1] ? new Date(times[times.length - 1]).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' }) : null;
  const langs = [...new Set(reviews.map(r => r.originalText?.languageCode ?? r.text?.languageCode ?? 'de').filter(Boolean))] as string[];
  const nonDe = reviews.filter(r => { const l = r.originalText?.languageCode ?? r.text?.languageCode ?? 'de'; return l !== 'de'; }).length;
  return { total: reviews.length, positive, negative, neutral, sentiment_score: Math.round((positive - negative) / reviews.length * 100) / 100, avg_review_length: avgLength, oldest_date: oldest, newest_date: newest, languages: langs, tourist_ratio_pct: Math.round(nonDe / reviews.length * 100) };
}

function buildPhotoUrls(photos: any[]): string[] {
  return (photos ?? []).slice(0, 10).map((p: any) => `${PHOTO_BASE}/${p.name}/media?maxWidthPx=600&key=${KEY}`);
}

async function scrapeWebsite(url: string): Promise<WebsiteData | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html', 'Accept-Language': 'de-DE,de;q=0.9' }, signal: AbortSignal.timeout(9000), redirect: 'follow' });
    if (!r.ok) return null;
    const html = await r.text();
    const titleM = html.match(/<title[^>]*>([^<]{1,160})<\/title>/i);
    const page_title = titleM ? titleM[1].replace(/\s+/g, ' ').trim() : null;
    const metaM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i) ?? html.match(/<meta[^>]+content=["']([^"']{1,400})["'][^>]+name=["']description["']/i) ?? html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,400})["']/i);
    const meta_description = metaM ? metaM[1].replace(/\s+/g, ' ').trim() : null;
    const emailRaw = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
    const emails = [...new Set(emailRaw.filter(e => !e.match(/\.(png|jpg|gif|svg|webp|woff|css|js)$/i) && !e.includes('example.')))].slice(0, 5);
    const socials: Record<string, string> = {};
    const socialPatterns: [string, RegExp][] = [['instagram', /(?:href|src)=["'][^"']*instagram\.com\/([a-zA-Z0-9._]{2,30})/i], ['facebook', /(?:href|src)=["'][^"']*facebook\.com\/([a-zA-Z0-9._\-]{2,60})/i], ['linkedin', /(?:href|src)=["'][^"']*linkedin\.com\/(?:company|in)\/([a-zA-Z0-9._\-]{2,60})/i], ['twitter', /(?:href|src)=["'][^"']*(?:twitter|x)\.com\/([a-zA-Z0-9._]{2,30})/i], ['tiktok', /(?:href|src)=["'][^"']*tiktok\.com\/@([a-zA-Z0-9._]{2,30})/i], ['youtube', /(?:href|src)=["'][^"']*youtube\.com\/(?:channel|@|c\/)([a-zA-Z0-9._\-]{2,60})/i]];
    for (const [pl, pat] of socialPatterns) { const m = html.match(pat); if (m && !m[1].match(/^(share|sharer|intent|dialog|login|signin)$/i)) { const base = pl === 'twitter' ? 'x' : pl; socials[pl] = `https://www.${base}.com/${pl === 'tiktok' ? '@' : pl === 'linkedin' ? 'company/' : ''}${m[1]}`; } }
    const phoneRaw = html.match(/(?:\+49|0049|\b0)[1-9][0-9][\s\-\/]?[0-9]{2,5}[\s\-\/]?[0-9]{2,}/g) ?? [];
    const phones_found = [...new Set(phoneRaw.map(p => p.replace(/\s+/g, ' ').trim()))].slice(0, 4);
    const kwM = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']{1,400})["']/i);
    const keywords = kwM ? kwM[1].split(',').map(k => k.trim()).filter(k => k.length > 1).slice(0, 10) : [];
    return { page_title, meta_description, emails, socials, phones_found, keywords };
  } catch { return null; }
}

// ── Places API ─────────────────────────────────────────────────────────────────

async function placesTextSearch(query: string, lat: number | null, lng: number | null): Promise<any | null> {
  const body: any = { textQuery: query, maxResultCount: 1 };
  if (lat !== null && lng !== null) body.locationRestriction = { circle: { center: { latitude: lat, longitude: lng }, radius: 3000.0 } };
  const r = await fetch(SEARCH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': SEARCH_MASK }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Places API ${r.status}: ${await r.text()}`);
  return (await r.json()).places?.[0] ?? null;
}

async function nearbyCompetitors(lat: number, lng: number, types: string[]): Promise<CompetitorData[]> {
  const primaryType = types.find(t => ['lodging', 'restaurant', 'cafe', 'bar', 'bakery', 'car_repair', 'car_dealer', 'dentist', 'pharmacy', 'hair_care', 'beauty_salon', 'gym', 'supermarket', 'hotel'].includes(t)) ?? types[0] ?? 'establishment';
  const r = await fetch(NEARBY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': NEARBY_MASK }, body: JSON.stringify({ locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 1000.0 } }, includedTypes: [primaryType], maxResultCount: 10, languageCode: 'de', rankPreference: 'POPULARITY' }) });
  if (!r.ok) return [];
  return (await r.json()).places?.map((p: any) => ({ name: p.displayName?.text ?? null, url: p.websiteUri ?? null, address: p.formattedAddress ?? null, rating: p.rating != null ? String(p.rating) : null, review_volume: p.userRatingCount != null ? String(p.userRatingCount) : null, category: (p.types?.[0] ?? '').replace(/_/g, ' ') || null, price_level: PRICE_MAP[p.priceLevel ?? ''] ?? null, phone: p.nationalPhoneNumber ?? null, business_status: p.businessStatus ?? null, distance: null })) ?? [];
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
    competitor_count: null, competitors: [], area_metrics: null, radar_data: [], pricing_power: null,
    points_of_interest: [],
    macro_data: null, labor_friction: null, synthetic_pl: null, market_timeline: [],
    industry_economics: null, spatial_context: null,
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
  payload.reviews = rawReviews.map((r: any) => ({ author: r.authorAttribution?.displayName ?? null, photo_url: r.authorAttribution?.photoUri ?? null, rating: r.rating ?? null, text: r.text?.text ?? null, language: r.originalText?.languageCode ?? r.text?.languageCode ?? null, date: r.publishTime ? new Date(r.publishTime).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' }) : null, relative_time: r.relativePublishTimeDescription ?? null }));
  payload.review_analysis = analyzeReviews(rawReviews);
  payload.sentiment_keywords = analyzeSentimentKeywords(payload.reviews);

  const hours = place.currentOpeningHours ?? place.regularOpeningHours;
  if (hours) { payload.is_open = hours.openNow ?? null; payload.opening_hours = calcOpeningHours(hours.periods, hours.weekdayDescriptions, hours.openNow ?? null); }

  payload.delivery = place.delivery ?? null; payload.dine_in = place.dineIn ?? null; payload.takeout = place.takeout ?? null; payload.reservable = place.reservable ?? null;
  payload.serves_beer = place.servesBeer ?? null; payload.serves_breakfast = place.servesBreakfast ?? null; payload.serves_brunch = place.servesBrunch ?? null; payload.serves_dinner = place.servesDinner ?? null; payload.serves_lunch = place.servesLunch ?? null; payload.serves_wine = place.servesWine ?? null;
  payload.wheelchair_accessible = place.accessibilityOptions?.wheelchairAccessibleEntrance ?? null;
  payload.curbside_pickup = place.curbsidePickup ?? null;
  payload.photos = buildPhotoUrls(place.photos ?? []);
  payload.photos_count = (place.photos ?? []).length;
  if (payload.category) { payload.search_interest = payload.city ? `${payload.category} in ${payload.city}` : payload.category; payload.spot_category = payload.category; }

  const lat = payload.latitude; const lng = payload.longitude;
  const [websiteData, competitorList, pois, spatialCtx] = await Promise.all([
    payload.website ? scrapeWebsite(payload.website) : Promise.resolve(null),
    (lat !== null && lng !== null && payload.types.length) ? nearbyCompetitors(lat, lng, payload.types) : Promise.resolve([]),
    (lat !== null && lng !== null) ? fetchOverpassPOIs(lat, lng) : Promise.resolve([]),
    (lat !== null && lng !== null) ? calcSpatialContext(lat, lng) : Promise.resolve(null),
  ]);

  payload.website_data = websiteData;
  payload.competitors  = competitorList.filter(c => c.name !== payload.name).slice(0, 8);
  payload.competitor_count = payload.competitors.length;
  payload.points_of_interest = pois;
  payload.spatial_context = spatialCtx;

  const targetReviewCount = payload.review_volume ? parseInt(payload.review_volume) : payload.reviews.length;
  const targetRatingNum   = payload.rating ? parseFloat(payload.rating) : null;

  payload.area_metrics = calcAreaMetrics(payload.competitors, pois, targetReviewCount);
  payload.radar_data = buildRadarData(targetRatingNum, targetReviewCount, payload.price_level_num, payload.review_analysis?.sentiment_score ?? null, !!payload.website, !!(websiteData && Object.keys(websiteData.socials).length > 0), payload.competitors);
  payload.pricing_power = calcPricingPower(targetRatingNum, targetReviewCount, payload.price_level_num, payload.competitors, payload.sentiment_keywords!, payload.area_metrics.total_area_reviews);

  const macroData = calcMacroData(payload.region, payload.city);
  payload.macro_data      = macroData;
  payload.labor_friction  = calcLaborFriction(macroData, payload.types, payload.competitors);
  payload.synthetic_pl    = calcSyntheticPL(payload.types, targetReviewCount, rawReviews, macroData);
  payload.market_timeline = buildMarketTimeline(payload.types, targetReviewCount, rawReviews);
  payload.industry_economics = getIndustryEconomics(payload.types);

  return payload;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    return NextResponse.json(await extractFromUrl(url));
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed', details: String(error) }, { status: 500 });
  }
}
