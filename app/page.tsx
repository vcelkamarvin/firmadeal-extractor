'use client';

import { useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, RadialBarChart, RadialBar, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ReferenceLine,
  LineChart, Line, ComposedChart, Area,
} from 'recharts';

// ── Type definitions ───────────────────────────────────────────────────────────

interface ReviewData { author: string | null; photo_url: string | null; rating: number | null; text: string | null; language: string | null; date: string | null; relative_time: string | null; }
interface ReviewAnalysis { total: number; positive: number; negative: number; neutral: number; sentiment_score: number | null; avg_review_length: number; oldest_date: string | null; newest_date: string | null; languages: string[]; tourist_ratio_pct: number | null; }
interface HoursData { weekday_text: string[]; open_now: boolean | null; total_weekly_hours: number | null; open_on_weekends: boolean; avg_daily_hours: number | null; }
interface AddressDetail { street_number: string | null; street: string | null; sublocality: string | null; city: string | null; bundesland: string | null; landkreis: string | null; postal_code: string | null; country: string | null; country_code: string | null; }
interface WebsiteData { page_title: string | null; meta_description: string | null; emails: string[]; socials: Record<string, string>; phones_found: string[]; keywords: string[]; }
interface SentimentTheme { theme: string; examples: string[]; count: number; }
interface SentimentKeywords { praises: SentimentTheme[]; complaints: SentimentTheme[]; pricing_keywords_positive: number; pricing_keywords_negative: number; }
interface PointOfInterest { id: number; name: string; category: string; subtype: string; lat: number; lng: number; }
interface AreaMetrics { quality_index: number; businesses_count: number; avg_rating_area: number | null; operational_pct: number | null; total_area_reviews: number; avg_price_level_area: number | null; }
interface PricingPower { price_premium_index: number | null; rating_premium: number | null; local_demand_share_pct: number | null; neg_price_sentiment_ratio: number | null; confirmed: boolean; factors_met: string[]; factors_missing: string[]; }
interface RadarPoint { metric: string; target: number; market: number; fullMark: number; }
interface IndustryYearData { year: number; context: string; }
interface IndustryEconomics { industry_label: string; ebitda_multiple: { low: number; mid: number; high: number }; avg_margin_pct: number | null; market_size_de_bn: number | null; cagr_5y_pct: number | null; trend_summary: string; structural_margins: string; failure_rate_note: string; model_mechanics: string; yearly: IndustryYearData[]; }
interface CompetitorData { name: string | null; url: string | null; address: string | null; rating: string | null; review_volume: string | null; category: string | null; price_level: string | null; phone: string | null; business_status: string | null; }
interface TimelinePoint { period: string; reviews: number; trends_index: number; }
interface MacroData { unemployment_pct: number; national_avg_unemployment: number; ppp_index: number; median_gross_wage: number; commercial_rent_per_sqm: number; bundesland: string | null; city: string | null; data_source: string; country_code: string | null; unemployment_history: { month: string; rate: number }[]; }
interface LaborFriction { index: number; unemployment_pct: number; national_avg_unemployment: number; wage_pressure_flag: boolean; interpretation: string; }
interface CityDemographics { population: number | null; population_density_per_km2: number | null; market_saturation_index: number | null; gdp_per_capita_eur: number | null; demographic_growth_5y_pct: number | null; trend: 'growing' | 'stable' | 'declining'; data_source: string; interpretation: string; }
interface SupplyChainRisk { category: string; ppi_index: number; trend: 'rising' | 'stable' | 'falling'; margin_impact_pct: number; }
interface EnergyVulnerability { energy_dependency_score: number; estimated_annual_kwh: number; estimated_energy_cost_eur: number; energy_as_opex_pct: number; ppi_sensitivity: 'low' | 'medium' | 'high' | 'critical'; supply_chain_risks: SupplyChainRisk[]; high_risk_flag: boolean; overall_risk: 'low' | 'medium' | 'high' | 'critical'; interpretation: string; }
interface DigitalRiskItem { type: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string; }
interface DigitalVulnerability { domain: string | null; ssl_valid: boolean | null; spf_present: boolean | null; dmarc_present: boolean | null; dkim_present: boolean | null; security_headers_score: number; missing_headers: string[]; risk_level: 'low' | 'medium' | 'high' | 'critical'; risks: DigitalRiskItem[]; overall_risk_score: number; }
interface LaborMarketLiquidity { sector: string; avg_vacancy_days: number; bottleneck_flag: boolean; vacancy_trend: 'improving' | 'stable' | 'worsening'; replacement_cost_per_fte_eur: number; total_replacement_cost_eur: number; fte_count: number; recruitment_friction_score: number; interpretation: string; risk_signals: string[]; }
interface KfwEligibility { eligible: boolean; country_check: boolean; sme_check: boolean; industry_check: boolean; program: 'ERP-Gründerkredit Universell' | 'KfW Unternehmerkredit' | null; program_description: string | null; failed_rules: string[]; revenue_mid_eur: number | null; fte_estimate: number | null; estimated_age_years: number | null; notes: string[]; }
interface MonthlyReviewBucket { month: string; count: number; normalized: number; }
interface SeasonalityProfile { monthly_buckets: MonthlyReviewBucket[]; seasonality_coefficient: number; high_risk_flag: boolean; peak_month: string | null; trough_month: string | null; interpretation: string; risk_label: 'Low Seasonality' | 'Moderate Seasonality' | 'High Seasonality Risk'; }
interface FinancialRange { low: number; mid: number; high: number; }
interface CostDriver { name: string; severity: 'low' | 'medium' | 'high' | 'critical'; trend: 'improving' | 'stable' | 'worsening'; description: string; ebitda_impact_pct: number; }
interface DependencyMatrix { business_model_summary: string; primary_leverage: string; drivers: CostDriver[]; net_ebitda_drag_pct: number; }
interface SanityCheck { rev_per_employee_synthetic: number; rev_per_employee_benchmark: number; ratio: number; overheated: boolean; compression_note: string | null; }
interface SyntheticPL {
  estimated_age_years: number; capture_rate_expected: number; capture_rate_pessimistic: number; capture_rate_optimistic: number;
  revenue: FinancialRange; annual_transactions: FinancialRange; adjusted_basket_eur: number;
  cogs: FinancialRange; gross_profit: FinancialRange; gross_margin_pct: number;
  fte_estimate: number; personnel_cost: number; facility_sqm: number; facility_cost: number;
  other_opex: FinancialRange; total_fixed_costs: number;
  ebitda: FinancialRange; ebitda_margin_pct: FinancialRange | null;
  industry_avg_ebitda_margin: number | null; fixed_cost_ratio: number; breakeven_revenue: number;
  revenue_per_employee: number; rent_as_revenue_pct: number | null; personnel_as_revenue_pct: number | null;
  high_fixed_cost_risk: boolean; sanity_check: SanityCheck; dependency_matrix: DependencyMatrix; risk_summary: string;
  operational_floor_applied: boolean; floor_adjustment_note: string | null;
}
interface SpatialContext {
  nearest_transport: { name: string; type: string; distance_m: number; walking_min: number; } | null;
  city_center_distance_m: number | null;
  zone_classification: string;
  foot_traffic_score: number;
  location_economics: string;
}
interface WeatherMonth { month: string; avg_temp_c: number; precipitation_mm: number; review_activity_norm: number; climate_score: number; }
interface ClimateData { climate_sensitivity_score: number; weather_correlation_pct: number; peak_weather_month: string; worst_weather_month: string; interpretation: string; monthly: WeatherMonth[]; }

interface ExtractionData {
  place_id: string | null; name: string | null; types: string[]; category: string | null; business_status: string | null; summary: string | null;
  address: string | null; vicinity: string | null; phone: string | null; phone_intl: string | null; website: string | null; google_maps_url: string | null;
  latitude: number | null; longitude: number | null; plus_code: string | null; address_detail: AddressDetail;
  city: string | null; region: string | null; country: string | null;
  rating: string | null; review_volume: string | null; price_level: string | null;
  reviews: ReviewData[]; review_analysis: ReviewAnalysis | null; sentiment_keywords: SentimentKeywords | null;
  opening_hours: HoursData | null; is_open: boolean | null;
  delivery: boolean | null; dine_in: boolean | null; takeout: boolean | null; reservable: boolean | null;
  serves_beer: boolean | null; serves_breakfast: boolean | null; serves_brunch: boolean | null;
  serves_dinner: boolean | null; serves_lunch: boolean | null; serves_wine: boolean | null;
  wheelchair_accessible: boolean | null; curbside_pickup: boolean | null;
  photos: string[]; photos_count: number; website_data: WebsiteData | null;
  competitor_count: number | null; competitors: CompetitorData[];
  area_metrics: AreaMetrics | null; radar_data: RadarPoint[]; pricing_power: PricingPower | null;
  points_of_interest: PointOfInterest[]; industry_economics: IndustryEconomics | null;
  macro_data: MacroData | null; labor_friction: LaborFriction | null;
  synthetic_pl: SyntheticPL | null; market_timeline: TimelinePoint[];
  spatial_context: SpatialContext | null;
  search_interest: string | null; spot_category: string | null;
  climate_data: ClimateData | null;
  city_demographics: CityDemographics | null;
  energy_vulnerability: EnergyVulnerability | null;
  digital_vulnerability: DigitalVulnerability | null;
  labor_market: LaborMarketLiquidity | null;
  kfw_eligibility: KfwEligibility | null;
  seasonality_profile: SeasonalityProfile | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseUrls(raw: string) {
  return raw.split(/[\n,\s]+/).map(u => u.trim()).filter(u => u.startsWith('http') || u.startsWith('maps.'));
}

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`;
  return `€${n}`;
}

function CopyBtn({ value, display }: { value: string; display?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="copy-btn" style={{ color: copied ? '#1db954' : '#4e9a66' }}>
      {copied ? '✓ copied' : (display ?? (value || '—'))}
    </button>
  );
}

// ── Design system primitives ───────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '28px 0' }} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label">{children}</div>;
}

function DataGrid({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="data-grid" style={style}>{children}</div>;
}

function DataCell({ label, value, accent }: { label: string; value: React.ReactNode; accent?: 'green' | 'red' | 'yellow' | 'blue' }) {
  const colors = { green: '#4ade80', red: '#f87171', yellow: '#fbbf24', blue: '#4e9a66' };
  return (
    <div className="data-cell">
      <div className="data-cell-label">{label}</div>
      <div className="data-cell-value" style={accent ? { color: colors[accent] } : undefined}>{value}</div>
    </div>
  );
}

function ProseBlock({ text }: { text: string }) {
  return <p style={{ margin: '10px 0 0', fontSize: '0.82rem', color: '#888888', lineHeight: 1.65 }}>{text}</p>;
}

// ── Recharts components ────────────────────────────────────────────────────────

function AQIGauge({ index }: { index: number }) {
  const color = index >= 70 ? '#4ade80' : index >= 45 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ textAlign: 'center' }}>
      <ResponsiveContainer width="100%" height={140}>
        <RadialBarChart cx="50%" cy="76%" innerRadius="60%" outerRadius="100%" startAngle={180} endAngle={0} data={[{ name: 'AQI', value: index, fill: color }]} barSize={20}>
          <RadialBar background dataKey="value" cornerRadius={5} />
          <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', color: '#666666', fontSize: 11 }} formatter={(v: number) => [`${v}/100`, 'AQI']} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: -24, fontSize: '1.7rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{index}</div>
      <div style={{ fontSize: '0.72rem', color: '#666666', marginTop: 2, letterSpacing: '0.05em' }}>AREA QUALITY INDEX</div>
    </div>
  );
}

function LFIGauge({ index }: { index: number }) {
  const color = index >= 65 ? '#f87171' : index >= 40 ? '#fbbf24' : '#4ade80';
  return (
    <div style={{ textAlign: 'center' }}>
      <ResponsiveContainer width="100%" height={140}>
        <RadialBarChart cx="50%" cy="76%" innerRadius="60%" outerRadius="100%" startAngle={180} endAngle={0} data={[{ name: 'LFI', value: index, fill: color }]} barSize={20}>
          <RadialBar background dataKey="value" cornerRadius={5} />
          <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', color: '#666666', fontSize: 11 }} formatter={(v: number) => [`${v}/100`, 'LFI']} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: -24, fontSize: '1.7rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{index}</div>
      <div style={{ fontSize: '0.72rem', color: '#666666', marginTop: 2, letterSpacing: '0.05em' }}>LABOR FRICTION INDEX</div>
    </div>
  );
}

function CompetitorRadar({ data }: { data: RadarPoint[] }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <PolarGrid stroke="rgba(0,0,0,0.08)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#666666', fontSize: 10 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="This business" dataKey="target" stroke="#4e9a66" fill="#4e9a66" fillOpacity={0.2} strokeWidth={1.5} />
        <Radar name="Market avg" dataKey="market" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.08} strokeWidth={1} strokeDasharray="4 3" />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 10, color: '#666666' }} />
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', color: '#666666', fontSize: 11 }} formatter={(v: number, n: string) => [`${v}/100`, n]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function MarketTimeline({ points }: { points: TimelinePoint[] }) {
  if (!points.length) return null;
  const maxRev = Math.max(...points.map(p => p.reviews), 1);
  const data = points.map(p => ({ ...p, reviews_norm: Math.round((p.reviews / maxRev) * 100) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 20, left: 8 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
        <XAxis dataKey="period" tick={{ fill: '#444444', fontSize: 9 }} interval={4} angle={-30} textAnchor="end" axisLine={false} tickLine={false} />
        <YAxis domain={[0, 130]} tick={{ fill: '#444444', fontSize: 9 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', color: '#666666', fontSize: 11 }}
          formatter={(v: number, name: string) => [name === 'trends_index' ? `${v} market idx` : `${v}/100 review act.`, name === 'trends_index' ? 'Market Index' : 'Review Activity']} />
        <Line type="monotone" dataKey="trends_index" name="Market Index" stroke="#4e9a66" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="reviews_norm" name="Review Activity" stroke="#fbbf24" strokeWidth={1} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Range display ──────────────────────────────────────────────────────────────

function RangeBar({ range, formatter = fmtEur, label }: { range: FinancialRange; formatter?: (n: number) => string; label?: string }) {
  const total = range.high - range.low;
  const midPct = total > 0 ? ((range.mid - range.low) / total) * 100 : 50;
  const isNegative = range.mid < 0;
  return (
    <div style={{ marginBottom: 2 }}>
      {label && <div style={{ fontSize: '0.72rem', color: '#666666', marginBottom: 4 }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '0.77rem', color: '#444444', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatter(range.low)}</span>
        <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: 'rgba(78,154,102,0.12)', borderRadius: 3 }} />
          <div style={{ position: 'absolute', left: `${midPct}%`, transform: 'translateX(-50%)', top: -2, width: 10, height: 10, borderRadius: '50%', background: isNegative ? '#f87171' : '#4e9a66', border: '2px solid #0f172a' }} />
        </div>
        <span style={{ fontSize: '0.77rem', color: '#666666', minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>{formatter(range.high)}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isNegative ? '#f87171' : '#666666', minWidth: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatter(range.mid)}</span>
      </div>
    </div>
  );
}

// ── Task 1: Probabilistic Revenue Chart ───────────────────────────────────────

function ProbabilisticRevChart({ pl }: { pl: SyntheticPL }) {
  const g = (base: number, rate: number, y: number) => Math.round(base * Math.pow(1 + rate, y));
  const data = [0, 1, 2, 3, 4, 5].map(y => ({
    year: y === 0 ? 'Y0' : `Y+${y}`,
    bear: g(pl.revenue.low,  0.01, y),
    base: g(pl.revenue.mid,  0.04, y),
    bull: g(pl.revenue.high, 0.08, y),
  }));
  const tip = { background: '#ffffff', border: '1px solid #e5e5e5', color: '#888', fontSize: 11 };
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: '0.7rem', color: '#666666', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
        5-Year Probabilistic Revenue Trajectory
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.04)" vertical={false} />
          <XAxis dataKey="year" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtEur} tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} width={54} />
          <Tooltip contentStyle={tip} formatter={(v: number, name: string) => [fmtEur(v as number), name === 'bear' ? 'Bear' : name === 'base' ? 'Base' : 'Bull']} />
          {/* Confidence band: bull area then bear area masks below */}
          <Area type="monotone" dataKey="bull" stroke="none" fill="#4e9a66" fillOpacity={0.14} legendType="none" />
          <Area type="monotone" dataKey="bear" stroke="none" fill="#f5f5f5" fillOpacity={1} legendType="none" />
          {/* Scenario lines */}
          <Line type="monotone" dataKey="bear" stroke="#f87171" strokeWidth={1.5} dot={false} name="Bear" strokeDasharray="4 3" />
          <Line type="monotone" dataKey="base" stroke="#1db954" strokeWidth={2.5} dot={{ fill: '#1db954', r: 3 }} name="Base" />
          <Line type="monotone" dataKey="bull" stroke="#6dbf87" strokeWidth={1.5} dot={false} name="Bull" strokeDasharray="4 3" />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 10, color: '#888', paddingTop: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 4, fontSize: '0.72rem', color: '#666' }}>
        <span>Bear <span style={{ color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(data[0].bear)}</span></span>
        <span style={{ color: '#2a2a2a' }}>|</span>
        <span>Base <span style={{ color: '#1db954', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(data[0].base)}</span></span>
        <span style={{ color: '#2a2a2a' }}>|</span>
        <span>Bull <span style={{ color: '#6dbf87', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(data[0].bull)}</span></span>
      </div>
    </div>
  );
}

// ── Task 4: Abstract Spatial Map ───────────────────────────────────────────────

function AbstractSpatialMap({ sc, pois, r }: { sc: SpatialContext; pois: PointOfInterest[]; r: { latitude: number; longitude: number } }) {
  const W = 340, H = 300, CX = W / 2, CY = H / 2;
  // Scale: 1000m → 120px radius
  const scale = 120 / 1000;
  const toXY = (lat: number, lng: number) => {
    const dx = (lng - r.longitude) * 111320 * Math.cos(r.latitude * Math.PI / 180);
    const dy = -(lat - r.latitude) * 110540;
    return { x: CX + dx * scale, y: CY + dy * scale };
  };
  const catColor: Record<string, string> = { tourism: '#4e9a66', amenity: '#a78bfa', historic: '#fbbf24', leisure: '#6dbf87' };
  const transportPos = sc.nearest_transport ? (() => {
    // Estimate direction from distance (we don't have actual lat/lng for transport, use angle 45°)
    const dist = sc.nearest_transport.distance_m * scale;
    return { x: CX + dist * 0.707, y: CY - dist * 0.707 };
  })() : null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: '0.7rem', color: '#666666', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
        Abstract Spatial Context
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <svg width={W} height={H} style={{ background: '#f8f8f8', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          {/* Distance rings */}
          {[200, 500, 1000].map(m => (
            <circle key={m} cx={CX} cy={CY} r={m * scale}
              fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={1}
              strokeDasharray={m === 1000 ? '4 4' : 'none'} />
          ))}
          {/* Ring labels */}
          {[200, 500, 1000].map(m => (
            <text key={m} x={CX + m * scale + 4} y={CY + 4} fontSize={8} fill="rgba(0,0,0,0.25)" fontFamily="Helvetica Neue, sans-serif">{m}m</text>
          ))}
          {/* POI dots */}
          {pois.slice(0, 40).map(poi => {
            const { x, y } = toXY(poi.lat, poi.lng);
            if (x < 0 || x > W || y < 0 || y > H) return null;
            const c = catColor[poi.category] ?? '#666';
            return <circle key={poi.id} cx={x} cy={y} r={4} fill={c} fillOpacity={0.7} stroke={c} strokeWidth={0.5} strokeOpacity={0.4} />;
          })}
          {/* Vector line to transport hub */}
          {transportPos && (
            <>
              <line x1={CX} y1={CY} x2={transportPos.x} y2={transportPos.y}
                stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="5 3" strokeOpacity={0.6} />
              <circle cx={transportPos.x} cy={transportPos.y} r={7}
                fill="#fbbf2415" stroke="#fbbf24" strokeWidth={1.5} />
              <text x={transportPos.x + 10} y={transportPos.y + 4} fontSize={9} fill="#fbbf24" fontFamily="Helvetica Neue, sans-serif">
                {sc.nearest_transport?.type}
              </text>
            </>
          )}
          {/* Business location */}
          <circle cx={CX} cy={CY} r={8} fill="#1db954" fillOpacity={0.15} stroke="#1db954" strokeWidth={2} />
          <circle cx={CX} cy={CY} r={3} fill="#1db954" />
          {/* City center direction indicator */}
          {sc.city_center_distance_m != null && (
            <>
              <line x1={CX} y1={CY} x2={CX - 40} y2={CY + 30}
                stroke="rgba(0,0,0,0.18)" strokeWidth={1} strokeDasharray="3 4" />
              <text x={CX - 80} y={CY + 42} fontSize={8} fill="rgba(0,0,0,0.35)" fontFamily="Helvetica Neue, sans-serif">
                City Centre {(sc.city_center_distance_m / 1000).toFixed(1)}km
              </text>
            </>
          )}
        </svg>
        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.77rem', paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1db954' }} />
            <span style={{ color: '#888' }}>This business</span>
          </div>
          {sc.nearest_transport && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #fbbf24', background: 'transparent' }} />
              <span style={{ color: '#888' }}>{sc.nearest_transport.type} ({sc.nearest_transport.distance_m}m)</span>
            </div>
          )}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 6, marginTop: 2 }}>
            <div style={{ fontSize: '0.68rem', color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>POI Categories</div>
            {Object.entries(catColor).map(([cat, col]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
                <span style={{ color: '#666', textTransform: 'capitalize' }}>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── P&L Range Table ────────────────────────────────────────────────────────────

function PLRangeTable({ pl }: { pl: SyntheticPL }) {
  const rows: { label: string; range?: FinancialRange; single?: number; sub?: boolean; bold?: boolean; accent?: string; }[] = [
    { label: 'Revenue', range: pl.revenue, bold: true },
    { label: `COGS (${(100 - pl.gross_margin_pct).toFixed(0)}%)`, range: { low: -pl.cogs.low, mid: -pl.cogs.mid, high: -pl.cogs.high }, sub: true },
    { label: `Gross Profit (${pl.gross_margin_pct}%)`, range: pl.gross_profit, bold: true, accent: '#4e9a66' },
    { label: `Personnel — ${pl.fte_estimate} FTE`, single: -pl.personnel_cost, sub: true },
    { label: `Facility — ${pl.facility_sqm}m²`, single: -pl.facility_cost, sub: true },
    { label: 'Other OpEx (8% var.)', range: { low: -pl.other_opex.low, mid: -pl.other_opex.mid, high: -pl.other_opex.high }, sub: true },
    { label: 'EBITDA', range: pl.ebitda, bold: true, accent: pl.ebitda.mid >= 0 ? '#4ade80' : '#f87171' },
  ];

  return (
    <div className="pl-table">
      <div className="pl-table-header">
        <span>Line Item</span>
        <span style={{ textAlign: 'right' }}>Bear</span>
        <span style={{ textAlign: 'right' }}>Base</span>
        <span style={{ textAlign: 'right' }}>Bull</span>
      </div>
      {rows.map((row, i) => {
        const low  = row.single !== undefined ? row.single : (row.range?.low  ?? 0);
        const mid  = row.single !== undefined ? row.single : (row.range?.mid  ?? 0);
        const high = row.single !== undefined ? row.single : (row.range?.high ?? 0);
        return (
          <div key={i} className={`pl-table-row${row.bold ? ' pl-table-row-bold' : ''}${row.sub ? ' pl-table-row-sub' : ''}`}
            style={row.accent ? { color: row.accent } : undefined}>
            <span>{row.label}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: low < 0 ? '#f87171' : '#666666' }}>{fmtEur(low)}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.accent ?? (mid < 0 ? '#f87171' : '#666666') }}>{fmtEur(mid)}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: high < 0 ? '#f87171' : '#4ade80' }}>{fmtEur(high)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Dependency Matrix ──────────────────────────────────────────────────────────

function DependencyMatrixBlock({ dm }: { dm: DependencyMatrix }) {
  const severityColor: Record<string, string> = { critical: '#f87171', high: '#fb923c', medium: '#fbbf24', low: '#4ade80' };
  const trendIcon: Record<string, string> = { worsening: '↑', stable: '→', improving: '↓' };
  const trendColor: Record<string, string> = { worsening: '#f87171', stable: '#888888', improving: '#4ade80' };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(78,154,102,0.06)', border: '1px solid rgba(78,154,102,0.12)' }}>
          <div style={{ fontSize: '0.7rem', color: '#4e9a66', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Business Model</div>
          <p style={{ margin: 0, fontSize: '0.79rem', color: '#888888', lineHeight: 1.55 }}>{dm.business_model_summary}</p>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)' }}>
          <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Primary Leverage</div>
          <p style={{ margin: 0, fontSize: '0.79rem', color: '#888888', lineHeight: 1.55 }}>{dm.primary_leverage}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dm.drivers.map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 70px 60px', gap: 12, alignItems: 'start', padding: '10px 12px', borderRadius: 6, background: 'rgba(0,0,0,0.03)', borderLeft: `3px solid ${severityColor[d.severity]}40` }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#666666', marginBottom: 2 }}>{d.name}</div>
              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: `${severityColor[d.severity]}18`, color: severityColor[d.severity] }}>{d.severity}</span>
            </div>
            <div style={{ fontSize: '0.77rem', color: '#666666', lineHeight: 1.5 }}>{d.description}</div>
            <div style={{ fontSize: '0.77rem', color: trendColor[d.trend], fontWeight: 600, textAlign: 'center' }}>{trendIcon[d.trend]} {d.trend}</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f87171', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.ebitda_impact_pct.toFixed(1)}pp</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: '0.77rem', color: '#666666' }}>Net EBITDA drag from structural pressures:</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>{dm.net_ebitda_drag_pct.toFixed(1)}pp</span>
      </div>
    </div>
  );
}

// ── Sanity check badge ─────────────────────────────────────────────────────────

function SanityBadge({ sc }: { sc: SanityCheck }) {
  if (!sc.overheated) return null;
  return (
    <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', fontSize: '0.77rem', color: '#fbbf24', lineHeight: 1.5 }}>
      <span style={{ fontWeight: 700 }}>⚠ Model ceiling applied — </span>{sc.compression_note}
    </div>
  );
}

function FloorBadge({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(29,185,84,0.05)', border: '1px solid rgba(29,185,84,0.2)', fontSize: '0.77rem', color: '#17a349', lineHeight: 1.5 }}>
      <span style={{ fontWeight: 700 }}>✓ Operational floor applied — </span>{note}
    </div>
  );
}



// ── Task 3: Climate Sensitivity Chart ─────────────────────────────────────────

function ClimateSensitivityChart({ cd }: { cd: ClimateData }) {
  const tip = { background: '#ffffff', border: '1px solid #e5e5e5', color: '#666', fontSize: 11 };
  const scoreColor = cd.climate_sensitivity_score >= 65 ? '#f87171' : cd.climate_sensitivity_score >= 35 ? '#fbbf24' : '#1db954';
  return (
    <div style={{ marginTop: 4 }}>
      {/* Score header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#999', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
            Climate Sensitivity Score
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: scoreColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {cd.climate_sensitivity_score}
            <span style={{ fontSize: '1rem', color: '#aaa', fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4, maxWidth: 380, lineHeight: 1.5 }}>{cd.interpretation}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'right', fontSize: '0.78rem' }}>
          <div><span style={{ color: '#999' }}>Demand correlation:</span> <span style={{ fontWeight: 700, color: cd.weather_correlation_pct >= 50 ? '#f87171' : '#1db954' }}>{cd.weather_correlation_pct}%</span></div>
          <div><span style={{ color: '#999' }}>Best month:</span> <span style={{ fontWeight: 600, color: '#1db954' }}>{cd.peak_weather_month}</span></div>
          <div><span style={{ color: '#999' }}>Worst month:</span> <span style={{ fontWeight: 600, color: '#f87171' }}>{cd.worst_weather_month}</span></div>
        </div>
      </div>
      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={cd.monthly} margin={{ top: 4, right: 16, bottom: 16, left: 4 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#bbb', fontSize: 9 }} interval={3} angle={-30} textAnchor="end" axisLine={false} tickLine={false} />
          <YAxis yAxisId="temp" domain={[-5, 35]} tick={{ fill: '#bbb', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}°`} width={28} />
          <YAxis yAxisId="score" orientation="right" domain={[0, 110]} tick={{ fill: '#bbb', fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tip}
            formatter={(v: number, name: string) => {
              if (name === 'avg_temp_c') return [`${v}°C`, 'Avg Temp'];
              if (name === 'climate_score') return [`${v}/100`, 'Climate Score'];
              if (name === 'review_activity_norm') return [`${v} idx`, 'Demand Index'];
              return [v, name];
            }} />
          {/* Temperature as bar */}
          <Bar yAxisId="temp" dataKey="avg_temp_c" fill="#e8f4f8" fillOpacity={0.8} barSize={8} radius={[2,2,0,0]} name="avg_temp_c" />
          {/* Climate score line */}
          <Line yAxisId="score" type="monotone" dataKey="climate_score" stroke="#4e9a66" strokeWidth={2} dot={false} name="climate_score" />
          {/* Demand activity line */}
          <Line yAxisId="score" type="monotone" dataKey="review_activity_norm" stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="review_activity_norm" />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ fontSize: '0.72rem', color: '#bbbbbb', lineHeight: 1.5, marginTop: 2 }}>
        <span style={{ color: '#4e9a66', fontWeight: 600 }}>Climate score</span> — comfort index (100 = ideal trading weather, ~18°C low rain).&nbsp;
        <span style={{ color: '#fbbf24', fontWeight: 600 }}>Demand index</span> — normalized review activity. Correlation = weather sensitivity of revenue.
        Source: Open-Meteo archive.
      </div>
    </div>
  );
}

// ── Task 3: Unemployment & Demand Trend Chart ──────────────────────────────────

function UnemploymentTrendChart({ md, mt }: { md: MacroData; mt: TimelinePoint[] }) {
  if (!md.unemployment_history || md.unemployment_history.length === 0) return null;

  // Map market timeline (quarterly) to monthly scale by repeating each quarter 3 times
  const trendByMonth: Record<string, number> = {};
  mt.forEach(p => {
    const [q, yr] = p.period.split(' ');
    const qNum = parseInt(q.replace('Q', ''));
    const months = [(qNum - 1) * 3, (qNum - 1) * 3 + 1, (qNum - 1) * 3 + 2];
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    months.forEach(m => {
      const key = `${names[m]} ${yr.slice(-2) === '20' ? yr : yr}`;
      trendByMonth[key] = p.trends_index;
    });
  });

  const data = md.unemployment_history.map(h => ({
    month: h.month,
    rate: h.rate,
    demand: trendByMonth[h.month] ?? null,
  }));

  const minRate = Math.max(0, Math.min(...data.map(d => d.rate)) - 0.5);
  const maxRate = Math.max(...data.map(d => d.rate)) + 0.5;
  const tip = { background: '#ffffff', border: '1px solid #e5e5e5', color: '#666666', fontSize: 11 };

  return (
    <div style={{ marginTop: 16, marginBottom: 4 }}>
      <div style={{ fontSize: '0.7rem', color: '#999999', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
        Regional Unemployment Rate (Jan 2023 – Dec 2024)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 16, left: 4 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#aaa', fontSize: 9 }} interval={3} angle={-30} textAnchor="end" axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" domain={[minRate, maxRate]} tick={{ fill: '#aaa', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={32} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 130]} tick={{ fill: '#aaa', fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tip} formatter={(v: number, name: string) => [name === 'rate' ? `${v}%` : `${v} idx`, name === 'rate' ? 'Unemployment' : 'Demand Index']} />
          <Bar yAxisId="left" dataKey="rate" fill="#e8e8e8" fillOpacity={0.9} barSize={8} radius={[2, 2, 0, 0]} name="rate" />
          <Line yAxisId="right" type="monotone" dataKey="demand" stroke="#1db954" strokeWidth={2} dot={false} name="demand" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ fontSize: '0.73rem', color: '#aaaaaa', lineHeight: 1.5, marginTop: 4 }}>
        <span style={{ color: '#1db954', fontWeight: 600 }}>Demand index</span> (right axis) — normalized category search interest correlated with unemployment trajectory.
        Source: {md.data_source}.
      </div>
    </div>
  );
}

// ── PPP Bar ────────────────────────────────────────────────────────────────────

function PPPBar({ macro }: { macro: MacroData }) {
  const data = [
    { label: 'National avg', value: 100, fill: '#444444' },
    { label: macro.city ?? macro.bundesland ?? 'Local', value: macro.ppp_index, fill: macro.ppp_index >= 100 ? '#4ade80' : '#f87171' },
  ];
  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="rgba(0,0,0,0.05)" />
        <XAxis type="number" domain={[75, 120]} tick={{ fill: '#444444', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fill: '#666666', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
        <ReferenceLine x={100} stroke="rgba(0,0,0,0.18)" strokeDasharray="3 3" />
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', color: '#666666', fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(1)}`, 'PPP Index']} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={24}>
          {data.map((e, i) => <Cell key={i} fill={e.fill} fillOpacity={0.75} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── EBITDA benchmark chart ─────────────────────────────────────────────────────

function EbitdaBenchmark({ pl }: { pl: SyntheticPL }) {
  if (!pl.ebitda_margin_pct || !pl.industry_avg_ebitda_margin) return null;
  const data = [
    { label: 'Sector avg', value: pl.industry_avg_ebitda_margin, fill: '#444444' },
    { label: 'Bear', value: pl.ebitda_margin_pct.low, fill: '#f87171' },
    { label: 'Base', value: pl.ebitda_margin_pct.mid, fill: pl.ebitda_margin_pct.mid >= pl.industry_avg_ebitda_margin ? '#4ade80' : '#f87171' },
    { label: 'Bull', value: pl.ebitda_margin_pct.high, fill: '#4ade80' },
  ];
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="rgba(0,0,0,0.05)" />
        <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fill: '#444444', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fill: '#666666', fontSize: 10 }} axisLine={false} tickLine={false} width={54} />
        <ReferenceLine x={pl.industry_avg_ebitda_margin} stroke="rgba(78,154,102,0.3)" strokeDasharray="3 3" />
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', color: '#666666', fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'EBITDA Margin']} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={20}>
          {data.map((e, i) => <Cell key={i} fill={e.fill} fillOpacity={0.8} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Foot traffic score bar ─────────────────────────────────────────────────────

function FootTrafficBar({ score }: { score: number }) {
  const color = score >= 70 ? '#4ade80' : score >= 45 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: '0.85rem', fontWeight: 700, color, minWidth: 38, fontVariantNumeric: 'tabular-nums' }}>{score}/100</span>
    </div>
  );
}

// ── Zone badge ─────────────────────────────────────────────────────────────────

function ZoneBadge({ zone }: { zone: string }) {
  const map: Record<string, [string, string]> = {
    prime_commercial:    ['Prime Commercial', '#4ade80'],
    secondary_commercial:['Secondary Commercial', '#4e9a66'],
    mixed_use:           ['Mixed Use', '#fbbf24'],
    residential:         ['Residential', '#a78bfa'],
    peripheral:          ['Peripheral', '#f87171'],
    unknown:             ['Unknown', '#666666'],
  };
  const [label, color] = map[zone] ?? ['—', '#666666'];
  return <span style={{ fontSize: '0.77rem', padding: '3px 10px', borderRadius: 20, background: `${color}15`, color, border: `1px solid ${color}30`, fontWeight: 600 }}>{label}</span>;
}

// ── Risk level helpers ─────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = { low: '#4ade80', medium: '#fbbf24', high: '#fb923c', critical: '#f87171' };
const RISK_BG:    Record<string, string> = { low: 'rgba(74,222,128,0.07)', medium: 'rgba(251,191,36,0.07)', high: 'rgba(251,146,60,0.07)', critical: 'rgba(248,113,113,0.07)' };

function RiskBadge({ level, label }: { level: string; label?: string }) {
  const c = RISK_COLOR[level] ?? '#888';
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: '0.73rem', fontWeight: 700, background: `${c}18`, color: c, border: `1px solid ${c}35`, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label ?? level}</span>;
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>
        <div style={{ width: `${Math.min(100, score)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
    </div>
  );
}

// ── Task 5: City Demographics ──────────────────────────────────────────────────

function CityDemographicsBlock({ cd }: { cd: CityDemographics }) {
  const trendIcon = cd.trend === 'growing' ? '↑' : cd.trend === 'declining' ? '↓' : '→';
  const trendColor = cd.trend === 'growing' ? '#4ade80' : cd.trend === 'declining' ? '#f87171' : '#fbbf24';
  const satColor = (cd.market_saturation_index ?? 0) < 1 ? '#4ade80' : (cd.market_saturation_index ?? 0) < 3 ? '#fbbf24' : '#f87171';
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        {cd.population != null && (
          <div className="data-cell" style={{ gridColumn: 'span 1' }}>
            <div className="data-cell-label">City Population</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, marginTop: 4 }}>
              {cd.population.toLocaleString('de-DE')}
            </div>
            {cd.population_density_per_km2 != null && <div style={{ fontSize: '0.73rem', color: '#888', marginTop: 2 }}>{cd.population_density_per_km2.toLocaleString('de-DE')}/km²</div>}
          </div>
        )}
        {cd.gdp_per_capita_eur != null && (
          <DataCell label="GDP per Capita" value={`€${cd.gdp_per_capita_eur.toLocaleString('de-DE')}`} />
        )}
        {cd.demographic_growth_5y_pct != null && (
          <div className="data-cell">
            <div className="data-cell-label">5Y Population Trend</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: trendColor }}>{trendIcon}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: trendColor }}>{cd.demographic_growth_5y_pct > 0 ? '+' : ''}{cd.demographic_growth_5y_pct}%</span>
            </div>
          </div>
        )}
        {cd.market_saturation_index != null && (
          <div className="data-cell">
            <div className="data-cell-label">Market Saturation</div>
            <div style={{ marginTop: 6 }}>
              <ScoreBar score={Math.round(cd.market_saturation_index * 20)} color={satColor} />
              <div style={{ fontSize: '0.73rem', color: '#888', marginTop: 3 }}>{cd.market_saturation_index} rivals per 10k residents</div>
            </div>
          </div>
        )}
      </div>
      <ProseBlock text={cd.interpretation} />
      <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: 6 }}>Source: {cd.data_source}</div>
    </div>
  );
}

// ── Task 6: Energy & Supply Chain ─────────────────────────────────────────────

function EnergyVulnerabilityBlock({ ev }: { ev: EnergyVulnerability }) {
  const rc = RISK_COLOR[ev.overall_risk];
  const rb = RISK_BG[ev.overall_risk];
  const trendIcon = (t: string) => t === 'rising' ? '↑' : t === 'falling' ? '↓' : '→';
  const trendColor = (t: string) => t === 'rising' ? '#f87171' : t === 'falling' ? '#4ade80' : '#888';
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: rb, border: `1px solid ${rc}25`, minWidth: 160 }}>
          <div style={{ fontSize: '0.68rem', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Energy Risk</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: rc, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{ev.energy_dependency_score}</div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 3 }}>/100 exposure score</div>
          <div style={{ marginTop: 8 }}><RiskBadge level={ev.overall_risk} /></div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <DataGrid>
            <DataCell label="Est. Annual kWh"  value={ev.estimated_annual_kwh.toLocaleString('de-DE')} />
            <DataCell label="Est. Energy Cost"  value={`€${ev.estimated_energy_cost_eur.toLocaleString('de-DE')}/yr`} />
            <DataCell label="% of OpEx"         value={<span style={{ color: ev.energy_as_opex_pct > 8 ? '#f87171' : '#666' }}>{ev.energy_as_opex_pct}%</span>} />
            <DataCell label="PPI Sensitivity"   value={<RiskBadge level={ev.ppi_sensitivity} />} />
          </DataGrid>
        </div>
      </div>
      {ev.supply_chain_risks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Supply Chain Inputs — PPI (DE 2020=100)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ev.supply_chain_risks.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 60px 60px 1fr', gap: 8, fontSize: '0.78rem', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span style={{ color: '#444', textTransform: 'capitalize' }}>{r.category}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: r.ppi_index > 140 ? '#f87171' : r.ppi_index > 120 ? '#fbbf24' : '#4ade80' }}>{r.ppi_index}</span>
                <span style={{ color: trendColor(r.trend), fontWeight: 600 }}>{trendIcon(r.trend)} {r.trend}</span>
                <span style={{ color: '#888', fontSize: '0.73rem' }}>−{r.margin_impact_pct}% margin impact</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <ProseBlock text={ev.interpretation} />
    </div>
  );
}

// ── Task 7: Digital Vulnerability ─────────────────────────────────────────────

function DigitalVulnerabilityBlock({ dv }: { dv: DigitalVulnerability }) {
  const rc = RISK_COLOR[dv.risk_level];
  const rb = RISK_BG[dv.risk_level];
  const sevColor = (s: string) => RISK_COLOR[s] ?? '#888';
  const Check = ({ ok, label }: { ok: boolean | null; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <span style={{ fontSize: '0.9rem', color: ok === null ? '#aaa' : ok ? '#4ade80' : '#f87171', width: 16 }}>{ok === null ? '?' : ok ? '✓' : '✗'}</span>
      <span style={{ fontSize: '0.8rem', color: '#444', flex: 1 }}>{label}</span>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: ok === null ? '#aaa' : ok ? '#4ade80' : '#f87171' }}>{ok === null ? 'unknown' : ok ? 'pass' : 'fail'}</span>
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: rb, border: `1px solid ${rc}25`, minWidth: 160 }}>
          <div style={{ fontSize: '0.68rem', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Risk Score</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: rc, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{dv.overall_risk_score}</div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 3 }}>/100 threat exposure</div>
          <div style={{ marginTop: 8 }}><RiskBadge level={dv.risk_level} /></div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Security Checklist</div>
          <Check ok={dv.ssl_valid}    label="SSL / TLS Certificate" />
          <Check ok={dv.spf_present}  label="SPF Record (email spoofing protection)" />
          <Check ok={dv.dmarc_present} label="DMARC Policy (fraud visibility)" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: '0.9rem', color: dv.security_headers_score >= 75 ? '#4ade80' : dv.security_headers_score >= 50 ? '#fbbf24' : '#f87171', width: 16 }}>◉</span>
            <span style={{ fontSize: '0.8rem', color: '#444', flex: 1 }}>Security Headers ({dv.security_headers_score}%)</span>
          </div>
          {dv.domain && <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 6 }}>Domain: {dv.domain}</div>}
        </div>
      </div>
      {dv.risks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dv.risks.map((r, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: `${sevColor(r.severity)}08`, border: `1px solid ${sevColor(r.severity)}20` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <RiskBadge level={r.severity} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#222' }}>{r.type}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#666', lineHeight: 1.55 }}>{r.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task 8: Labor Market Liquidity ─────────────────────────────────────────────

function LaborMarketBlock({ lm }: { lm: LaborMarketLiquidity }) {
  const fc = lm.bottleneck_flag ? '#f87171' : lm.avg_vacancy_days > 38 ? '#fbbf24' : '#4ade80';
  const trendColor = lm.vacancy_trend === 'worsening' ? '#f87171' : lm.vacancy_trend === 'improving' ? '#4ade80' : '#fbbf24';
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: `${fc}0d`, border: `1px solid ${fc}25`, minWidth: 160 }}>
          <div style={{ fontSize: '0.68rem', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Avg. Vacancy Days</div>
          <div style={{ fontSize: '2.1rem', fontWeight: 900, color: fc, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{lm.avg_vacancy_days}</div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 3 }}>days to fill a role</div>
          {lm.bottleneck_flag && <div style={{ marginTop: 8 }}><RiskBadge level="critical" label="Bottleneck" /></div>}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <DataGrid>
            <DataCell label="Sector" value={<span style={{ textTransform: 'capitalize' }}>{lm.sector}</span>} />
            <DataCell label="Vacancy Trend" value={<span style={{ color: trendColor, fontWeight: 700 }}>{lm.vacancy_trend}</span>} />
            <DataCell label="Replacement / FTE" value={`€${lm.replacement_cost_per_fte_eur.toLocaleString('de-DE')}`} />
            <DataCell label="Total Replacement" value={<span style={{ fontWeight: 700, color: lm.total_replacement_cost_eur > 15000 ? '#f87171' : '#666' }}>€{lm.total_replacement_cost_eur.toLocaleString('de-DE')}</span>} />
            <DataCell label="FTE Count" value={lm.fte_count} />
          </DataGrid>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 5 }}>Recruitment Friction</div>
            <ScoreBar score={lm.recruitment_friction_score} color={fc} />
          </div>
        </div>
      </div>
      <ProseBlock text={lm.interpretation} />
      {lm.risk_signals.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lm.risk_signals.map((s, i) => <div key={i} style={{ fontSize: '0.77rem', color: '#f87171', display: 'flex', gap: 6 }}><span>⚠</span><span>{s}</span></div>)}
        </div>
      )}
    </div>
  );
}

// ── Task 9: KfW Eligibility ────────────────────────────────────────────────────

function KfwEligibilityBlock({ kfw }: { kfw: KfwEligibility }) {
  const Rule = ({ passed, label }: { passed: boolean; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: passed ? 'rgba(29,185,84,0.04)' : 'rgba(248,113,113,0.04)', border: `1px solid ${passed ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)'}` }}>
      <span style={{ fontSize: '0.9rem', color: passed ? '#4ade80' : '#f87171', width: 18 }}>{passed ? '✓' : '✗'}</span>
      <span style={{ fontSize: '0.8rem', color: '#444', flex: 1 }}>{label}</span>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: passed ? '#4ade80' : '#f87171' }}>{passed ? 'PASS' : 'FAIL'}</span>
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: kfw.eligible ? 'rgba(29,185,84,0.05)' : 'rgba(248,113,113,0.04)', border: `1px solid ${kfw.eligible ? 'rgba(34,197,94,0.2)' : 'rgba(248,113,113,0.15)'}`, minWidth: 160, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 4 }}>{kfw.eligible ? '✅' : '❌'}</div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: kfw.eligible ? '#4ade80' : '#f87171' }}>{kfw.eligible ? 'Eligible' : 'Not Eligible'}</div>
          <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 3 }}>KfW Acquisition Finance</div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          {kfw.program && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(29,185,84,0.04)', border: '1px solid rgba(34,197,94,0.15)', marginBottom: 12 }}>
              <div style={{ fontSize: '0.68rem', color: '#4e9a66', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Qualifying Program</div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#222', marginBottom: 6 }}>{kfw.program}</div>
              {kfw.program_description && <p style={{ margin: 0, fontSize: '0.76rem', color: '#666', lineHeight: 1.55 }}>{kfw.program_description}</p>}
            </div>
          )}
          <DataGrid>
            {kfw.revenue_mid_eur != null && <DataCell label="Base Revenue" value={kfw.revenue_mid_eur >= 1_000_000 ? `€${(kfw.revenue_mid_eur / 1_000_000).toFixed(1)}M` : `€${Math.round(kfw.revenue_mid_eur / 1000)}k`} />}
            {kfw.fte_estimate != null && <DataCell label="FTE Estimate" value={String(kfw.fte_estimate)} />}
            {kfw.estimated_age_years != null && <DataCell label="Business Age" value={`${kfw.estimated_age_years} years`} />}
          </DataGrid>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <Rule passed={kfw.country_check} label="Rule A — Geography: German address (country code DE)" />
        <Rule passed={kfw.sme_check} label="Rule B — SME Thresholds: Revenue < €50M · Headcount < 250 FTE" />
        <Rule passed={kfw.industry_check} label="Rule C — Industry: Not in restricted sectors (gambling, tobacco, military)" />
      </div>
      {kfw.failed_rules.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {kfw.failed_rules.map((fr, i) => (
            <div key={i} style={{ fontSize: '0.77rem', color: '#f87171', display: 'flex', gap: 6, marginBottom: 4 }}>
              <span>⚠</span><span>{fr}</span>
            </div>
          ))}
        </div>
      )}
      {kfw.notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {kfw.notes.map((n, i) => (
            <div key={i} style={{ fontSize: '0.76rem', color: '#666', display: 'flex', gap: 6 }}>
              <span style={{ color: '#4e9a66' }}>→</span><span>{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task 10: Seasonality Volatility ───────────────────────────────────────────

function SeasonalityChart({ sp }: { sp: SeasonalityProfile }) {
  const riskColor = sp.risk_label === 'High Seasonality Risk' ? '#f87171' : sp.risk_label === 'Moderate Seasonality' ? '#fbbf24' : '#4ade80';
  const total = sp.monthly_buckets.reduce((s, b) => s + b.count, 0);
  const meanCount = Number((total / 12).toFixed(1));
  const chartData = sp.monthly_buckets.map(b => ({ ...b, mean: meanCount }));
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ padding: '14px 18px', borderRadius: 10, background: `${riskColor}0d`, border: `1px solid ${riskColor}25`, minWidth: 160 }}>
          <div style={{ fontSize: '0.68rem', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Seasonality Coefficient</div>
          <div style={{ fontSize: '2.1rem', fontWeight: 900, color: riskColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{sp.seasonality_coefficient.toFixed(2)}</div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 3 }}>σ / μ · threshold 0.35</div>
          <div style={{ marginTop: 8, display: 'inline-flex', padding: '2px 8px', borderRadius: 12, background: `${riskColor}1a`, border: `1px solid ${riskColor}30`, fontSize: '0.7rem', fontWeight: 700, color: riskColor }}>{sp.risk_label}</div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <DataGrid>
            {sp.peak_month && <DataCell label="Peak Month" value={<span style={{ color: '#4e9a66', fontWeight: 700 }}>{sp.peak_month}</span>} />}
            {sp.trough_month && <DataCell label="Slowest Month" value={<span style={{ color: '#f87171', fontWeight: 700 }}>{sp.trough_month}</span>} />}
            <DataCell label="Dated Reviews" value={total.toString()} />
            <DataCell label="High Risk Flag" value={<span style={{ color: sp.high_risk_flag ? '#f87171' : '#4ade80', fontWeight: 700 }}>{sp.high_risk_flag ? '⚠ Yes' : '✓ No'}</span>} />
          </DataGrid>
        </div>
      </div>
      <div style={{ height: 160, marginBottom: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: '0.78rem' }} labelStyle={{ color: '#333', fontWeight: 700 }} />
            <Bar dataKey="count" name="Reviews" fill={`${riskColor}66`} radius={[3, 3, 0, 0]} />
            <Line dataKey="mean" name="Monthly Mean" stroke="#aaaaaa" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: '0.68rem', color: '#aaa', marginBottom: 10 }}>
        Monthly review distribution (timestamped reviews only) · Dashed = monthly mean
      </div>
      <ProseBlock text={sp.interpretation} />
    </div>
  );
}

// ── Result card ────────────────────────────────────────────────────────────────

function ResultCard({ r }: { r: ExtractionData }) {
  const ad  = r.address_detail ?? {};
  const ra  = r.review_analysis;
  const eco = r.industry_economics;
  const wd  = r.website_data;
  const pp  = r.pricing_power;
  const am  = r.area_metrics;
  const sk  = r.sentiment_keywords;
  const md  = r.macro_data;
  const lf  = r.labor_friction;
  const pl  = r.synthetic_pl;
  const mt  = r.market_timeline ?? [];
  const sc  = r.spatial_context;
  const cd  = r.climate_data;
  const dem = r.city_demographics;
  const ev  = r.energy_vulnerability;
  const dv  = r.digital_vulnerability;
  const lm  = r.labor_market;
  const kfw = r.kfw_eligibility;
  const sp  = r.seasonality_profile;

  const [teaserLoading,  setTeaserLoading]  = useState(false);
  const [teaserError,    setTeaserError]    = useState<string | null>(null);
  const [reportLoading,  setReportLoading]  = useState(false);
  const [reportError,    setReportError]    = useState<string | null>(null);

  async function generateTeaser() {
    setTeaserLoading(true);
    setTeaserError(null);
    try {
      const res  = await fetch('/api/teaser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const win = window.open('', '_blank');
      if (win) { win.document.write(data.html); win.document.close(); }
    } catch (e: any) {
      setTeaserError(e.message ?? 'Teaser generation failed');
    } finally {
      setTeaserLoading(false);
    }
  }

  async function generateReport() {
    setReportLoading(true);
    setReportError(null);
    try {
      const res  = await fetch('/api/admin/generate-investor-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const win = window.open('', '_blank');
      if (win) { win.document.write(data.html); win.document.close(); }
    } catch (e: any) {
      setReportError(e.message ?? 'Report generation failed');
    } finally {
      setReportLoading(false);
    }
  }

  const coords = r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : null;
  const statusColor = r.business_status === 'OPERATIONAL' ? '#4ade80' : r.business_status === 'CLOSED_TEMPORARILY' ? '#facc15' : '#f87171';
  const services = [
    { label: 'Delivery', v: r.delivery }, { label: 'Dine-in', v: r.dine_in }, { label: 'Takeout', v: r.takeout },
    { label: 'Reservable', v: r.reservable }, { label: 'Curbside', v: r.curbside_pickup }, { label: 'Beer', v: r.serves_beer },
    { label: 'Wine', v: r.serves_wine }, { label: 'Breakfast', v: r.serves_breakfast }, { label: 'Dinner', v: r.serves_dinner },
    { label: 'Wheelchair', v: r.wheelchair_accessible },
  ].filter(s => s.v !== null);
  const socialIcons: Record<string, string> = { instagram: '📸', facebook: '👥', linkedin: '💼', twitter: '𝕏', tiktok: '🎵', youtube: '▶️' };

  return (
    <div className="report-card">

      {/* ═══ IDENTITY ═══ */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 800, color: '#111111' }}>{r.name || 'Unknown business'}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          {r.category && <span style={{ fontSize: '0.8rem', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.category.replace(/_/g, ' ')}</span>}
          {r.business_status && <span style={{ fontSize: '0.75rem', color: statusColor, fontWeight: 700 }}>● {r.business_status.replace(/_/g, ' ')}</span>}
          {r.is_open !== null && <span style={{ fontSize: '0.75rem', color: r.is_open ? '#4ade80' : '#f87171', fontWeight: 700 }}>{r.is_open ? 'OPEN' : 'CLOSED'}</span>}
          {r.price_level && <span style={{ color: '#fbbf24', fontWeight: 700 }}>{r.price_level}</span>}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          {r.rating && <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fbbf24' }}>★ {r.rating}</span>}
          {r.review_volume && <span style={{ color: '#666666', fontSize: '0.85rem' }}>{Number(r.review_volume).toLocaleString('de-DE')} reviews</span>}
          {r.summary && <span style={{ color: '#666666', fontSize: '0.82rem', fontStyle: 'italic' }}>{r.summary}</span>}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: '0.82rem', flexWrap: 'wrap' }}>
          {r.google_maps_url && <a href={r.google_maps_url} target="_blank" rel="noreferrer" style={{ color: '#4e9a66' }}>Google Maps →</a>}
          {r.website && <a href={r.website} target="_blank" rel="noreferrer" style={{ color: '#4e9a66' }}>Website →</a>}
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="button"
            onClick={generateReport}
            disabled={reportLoading}
            style={{ background: '#1A5C3A', fontSize: '0.8rem', letterSpacing: '0.04em', minWidth: 0, padding: '11px 22px', fontWeight: 800 }}
          >
            {reportLoading ? 'Generiere Bericht...' : '📄 Investorenbericht (DE) generieren'}
          </button>
          <button
            className="button"
            onClick={generateTeaser}
            disabled={teaserLoading}
            style={{ background: '#111111', fontSize: '0.8rem', letterSpacing: '0.05em', minWidth: 0, padding: '10px 20px' }}
          >
            {teaserLoading ? 'Generiere Teaser...' : 'Investment Teaser (DE)'}
          </button>
          {reportError && <span style={{ fontSize: '0.78rem', color: '#b91c1c' }}>{reportError}</span>}
          {teaserError && <span style={{ fontSize: '0.78rem', color: '#b91c1c' }}>{teaserError}</span>}
        </div>
      </div>

      <Divider />

      {/* ═══ INDUSTRY ECONOMICS ═══ */}
      {eco && (
        <>
          <SectionLabel>Industry Economics — {eco.industry_label}</SectionLabel>
          <DataGrid style={{ marginBottom: 14 }}>
            <DataCell label="EBITDA Multiple" value={`${eco.ebitda_multiple.low}× – ${eco.ebitda_multiple.mid}× – ${eco.ebitda_multiple.high}×`} />
            {eco.avg_margin_pct != null && <DataCell label="Avg EBITDA Margin" value={`${eco.avg_margin_pct}%`} />}
            {eco.market_size_de_bn != null && <DataCell label="Market Size (DE)" value={`€${eco.market_size_de_bn} Mrd.`} />}
            {eco.cagr_5y_pct != null && <DataCell label="5Y CAGR" value={`${eco.cagr_5y_pct}%`} />}
          </DataGrid>
          <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: '#888888', lineHeight: 1.6 }}>{eco.trend_summary}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { title: 'Structural Margins', text: eco.structural_margins },
              { title: 'Business Model Mechanics', text: eco.model_mechanics },
              { title: 'Failure Rate & Risk', text: eco.failure_rate_note },
            ].map(({ title, text }) => (
              <div key={title} style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4e9a66', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
                <p style={{ margin: 0, fontSize: '0.79rem', color: '#666666', lineHeight: 1.6 }}>{text}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {eco.yearly.map((y, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, fontSize: '0.78rem', lineHeight: 1.6 }}>
                <span style={{ color: '#4e9a66', fontWeight: 700, minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{y.year}</span>
                <span style={{ color: '#444444' }}>{y.context}</span>
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* ═══ BUSINESS MODEL & COST DRIVERS ═══ */}
      {pl && (
        <>
          <SectionLabel>Business Model & Cost Drivers</SectionLabel>
          <DependencyMatrixBlock dm={pl.dependency_matrix} />
          <Divider />
        </>
      )}

      {/* ═══ MACRO ═══ */}
      {md && lf && (
        <>
          <SectionLabel>Regional Macroeconomics</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 170px) 1fr', gap: 16, alignItems: 'center', marginBottom: 14 }}>
            <LFIGauge index={lf.index} />
            <div>
              <ProseBlock text={lf.interpretation} />
              <DataGrid style={{ marginTop: 10 }}>
                <DataCell label="Local Unemployment" value={<span style={{ color: lf.unemployment_pct > lf.national_avg_unemployment ? '#f87171' : '#4ade80', fontWeight: 700 }}>{lf.unemployment_pct}%</span>} />
                <DataCell label="National Avg" value={`${lf.national_avg_unemployment}%`} />
                <DataCell label="Wage Pressure" value={<span style={{ color: lf.wage_pressure_flag ? '#fbbf24' : '#4ade80' }}>{lf.wage_pressure_flag ? 'Elevated' : 'Normal'}</span>} />
              </DataGrid>
            </div>
          </div>
          <DataGrid style={{ marginBottom: 14 }}>
            {md.bundesland && <DataCell label="Bundesland" value={md.bundesland} />}
            {md.city && <DataCell label="City" value={md.city} />}
            <DataCell label="Median Gross Wage" value={`€${md.median_gross_wage.toLocaleString('de-DE')} p.a.`} />
            <DataCell label="Commercial Rent" value={`€${md.commercial_rent_per_sqm}/m²/mo`} />
            <DataCell label="PPP Index" value={<span style={{ color: md.ppp_index >= 100 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{md.ppp_index.toFixed(1)}</span>} />
          </DataGrid>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: '0.7rem', color: '#999999', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Purchasing Power vs National Average (100)</div>
            <PPPBar macro={md} />
          </div>
          <UnemploymentTrendChart md={md} mt={mt} />
          <Divider />
        </>
      )}

      {/* ═══ SYNTHETIC P&L ═══ */}
      {pl && (
        <>
          <SectionLabel>Synthetic P&L — Probabilistic Estimate</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {[
              { k: 'Est. Age', v: `${pl.estimated_age_years}y` },
              { k: 'FTE', v: String(pl.fte_estimate) },
              { k: 'Avg Basket', v: `€${pl.adjusted_basket_eur.toFixed(0)}` },
              { k: 'Capture Rate', v: `${pl.capture_rate_optimistic}% – ${pl.capture_rate_expected}% – ${pl.capture_rate_pessimistic}%` },
              { k: 'Gross Margin', v: `${pl.gross_margin_pct}%` },
            ].map(({ k, v }) => (
              <div key={k} style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(78,154,102,0.06)', border: '1px solid rgba(78,154,102,0.1)' }}>
                <div style={{ fontSize: '0.68rem', color: '#444444', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#888888', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              </div>
            ))}
          </div>
          {pl.operational_floor_applied && <div style={{ marginBottom: 12 }}><FloorBadge note={pl.floor_adjustment_note} /></div>}
          {pl.sanity_check.overheated && <div style={{ marginBottom: 12 }}><SanityBadge sc={pl.sanity_check} /></div>}
          <ProbabilisticRevChart pl={pl} />
          <PLRangeTable pl={pl} />
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <div style={{ fontSize: '0.7rem', color: '#444444', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Revenue Range (Bear → Base → Bull)</div>
            <RangeBar range={pl.revenue} />
            <RangeBar range={pl.ebitda} label="EBITDA Range" />
            {pl.ebitda_margin_pct && <RangeBar range={pl.ebitda_margin_pct} formatter={v => `${v.toFixed(1)}%`} label="EBITDA Margin Range" />}
          </div>
          {pl.industry_avg_ebitda_margin != null && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.7rem', color: '#444444', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>EBITDA vs Sector Benchmark</div>
              <EbitdaBenchmark pl={pl} />
            </div>
          )}
          <DataGrid style={{ marginBottom: 14 }}>
            <DataCell label="Rev / Employee" value={fmtEur(pl.revenue_per_employee)} />
            <DataCell label="Benchmark Rev/FTE" value={fmtEur(pl.sanity_check.rev_per_employee_benchmark)} />
            <DataCell label="Ratio" value={<span style={{ color: pl.sanity_check.overheated ? '#f87171' : '#4ade80', fontWeight: 700 }}>{pl.sanity_check.ratio}×</span>} />
            {pl.rent_as_revenue_pct != null && <DataCell label="Rent / Revenue" value={<span style={{ color: pl.rent_as_revenue_pct > 12 ? '#f87171' : '#666666' }}>{pl.rent_as_revenue_pct.toFixed(1)}%</span>} />}
            {pl.personnel_as_revenue_pct != null && <DataCell label="Personnel / Revenue" value={<span style={{ color: pl.personnel_as_revenue_pct > 35 ? '#f87171' : '#666666' }}>{pl.personnel_as_revenue_pct.toFixed(1)}%</span>} />}
            <DataCell label="Fixed Cost Ratio" value={<span style={{ color: pl.fixed_cost_ratio > 80 ? '#f87171' : pl.fixed_cost_ratio > 65 ? '#fbbf24' : '#4ade80', fontWeight: 700 }}>{pl.fixed_cost_ratio}% of gross profit</span>} />
            <DataCell label="Breakeven Revenue" value={fmtEur(pl.breakeven_revenue)} />
            <DataCell label="Total Fixed Costs" value={fmtEur(pl.total_fixed_costs)} />
          </DataGrid>
          <ProseBlock text={pl.risk_summary} />
          <Divider />
        </>
      )}

      {/* ═══ AREA OVERVIEW ═══ */}
      {(am || r.radar_data.length > 0) && (
        <>
          <SectionLabel>Area Overview — 500m–1km radius</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 170px) 1fr', gap: 16, alignItems: 'center', marginBottom: 14 }}>
            {am && <AQIGauge index={am.quality_index} />}
            {r.radar_data.length > 0 && <CompetitorRadar data={r.radar_data} />}
          </div>
          {am && (
            <DataGrid>
              {am.avg_rating_area != null && <DataCell label="Area Avg Rating" value={`★ ${am.avg_rating_area}`} />}
              {am.avg_price_level_area != null && <DataCell label="Area Avg Price" value={`€ × ${am.avg_price_level_area}`} />}
              {am.operational_pct != null && <DataCell label="Operational %" value={`${am.operational_pct}%`} />}
              <DataCell label="Businesses (1km)" value={am.businesses_count} />
              <DataCell label="Total Area Reviews" value={am.total_area_reviews.toLocaleString('de-DE')} />
            </DataGrid>
          )}
          <Divider />
        </>
      )}

      {/* ═══ KFW ELIGIBILITY ═══ */}
      {kfw && (
        <>
          <SectionLabel>KfW Acquisition Financing Eligibility</SectionLabel>
          <KfwEligibilityBlock kfw={kfw} />
          <Divider />
        </>
      )}

      {/* ═══ SEASONALITY ═══ */}
      {sp && (
        <>
          <SectionLabel>Seasonality Volatility Analysis</SectionLabel>
          <SeasonalityChart sp={sp} />
          <Divider />
        </>
      )}

      {/* ═══ ENERGY & SUPPLY CHAIN ═══ */}
      {ev && (
        <>
          <SectionLabel>Energy & Supply Chain Vulnerability</SectionLabel>
          <EnergyVulnerabilityBlock ev={ev} />
          <Divider />
        </>
      )}

      {/* ═══ MARKET TIMELINE ═══ */}
      {mt.length > 0 && (
        <>
          <SectionLabel>Market Dynamics — 2020–2024</SectionLabel>
          <MarketTimeline points={mt} />
          <div style={{ marginTop: 8, fontSize: '0.76rem', color: '#444444', lineHeight: 1.55 }}>
            <span style={{ color: '#4e9a66', fontWeight: 600 }}>Market Index</span> — synthetic demand index combining COVID recovery trajectory, seasonal patterns and sector cycles for Germany 2020–2024. &nbsp;
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>Review Activity</span> — normalized quarterly review volume, anchored to real timestamps where available.
          </div>
          <Divider />
        </>
      )}

      {/* ═══ CLIMATE SENSITIVITY ═══ */}
      {cd && (
        <>
          <SectionLabel>Climate Sensitivity Analysis — 24 Months</SectionLabel>
          <ClimateSensitivityChart cd={cd} />
          <Divider />
        </>
      )}

      {/* ═══ LABOR MARKET ═══ */}
      {lm && (
        <>
          <SectionLabel>Labor Market Liquidity & Replacement Cost</SectionLabel>
          <LaborMarketBlock lm={lm} />
          <Divider />
        </>
      )}

      {/* ═══ PRICING POWER ═══ */}
      {pp && (
        <>
          <SectionLabel>Pricing Power Signal</SectionLabel>
          <div style={{ padding: '14px 16px', borderRadius: 8, background: pp.confirmed ? 'rgba(29,185,84,0.05)' : 'rgba(248,113,113,0.04)', border: `1px solid ${pp.confirmed ? 'rgba(34,197,94,0.2)' : 'rgba(248,113,113,0.15)'}`, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: '1.2rem' }}>{pp.confirmed ? '✅' : '❌'}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: pp.confirmed ? '#4ade80' : '#f87171' }}>
                  {pp.confirmed ? 'Confirmed Pricing Power' : 'No Confirmed Pricing Power'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#666666' }}>
                  {pp.confirmed ? 'Economic moat present — margin expansion viable' : 'Insufficient moat signals for safe price expansion'}
                </div>
              </div>
            </div>
            <DataGrid>
              <DataCell label="Price Premium" value={pp.price_premium_index != null ? `${pp.price_premium_index}×` : '—'} accent={pp.price_premium_index != null && pp.price_premium_index > 1 ? 'green' : 'red'} />
              <DataCell label="Rating Premium" value={pp.rating_premium != null ? (pp.rating_premium >= 0 ? `+${pp.rating_premium}` : String(pp.rating_premium)) : '—'} accent={pp.rating_premium != null && pp.rating_premium >= 0 ? 'green' : 'red'} />
              <DataCell label="Demand Share" value={pp.local_demand_share_pct != null ? `${pp.local_demand_share_pct}%` : '—'} />
              <DataCell label="Neg. Price Sentiment" value={pp.neg_price_sentiment_ratio != null ? `${(pp.neg_price_sentiment_ratio * 100).toFixed(1)}%` : '—'} accent={pp.neg_price_sentiment_ratio != null && pp.neg_price_sentiment_ratio < 0.05 ? 'green' : 'red'} />
            </DataGrid>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {pp.factors_met.map((f, i) => <div key={i} style={{ fontSize: '0.77rem', color: '#4ade80' }}>✓ {f}</div>)}
              {pp.factors_missing.map((f, i) => <div key={i} style={{ fontSize: '0.77rem', color: '#f87171' }}>✗ {f}</div>)}
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* ═══ CITY DEMOGRAPHICS ═══ */}
      {dem && (
        <>
          <SectionLabel>City Demographics & Market Sizing</SectionLabel>
          <CityDemographicsBlock cd={dem} />
          <Divider />
        </>
      )}

      {/* ═══ DIGITAL VULNERABILITY ═══ */}
      {dv && (
        <>
          <SectionLabel>Digital Infrastructure Risk</SectionLabel>
          <DigitalVulnerabilityBlock dv={dv} />
          <Divider />
        </>
      )}

      {/* ═══ LOCATION ECONOMICS ═══ */}
      {sc && (
        <>
          <SectionLabel>Location Economics</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            <div className="data-cell" style={{ gridColumn: 'span 1' }}>
              <div className="data-cell-label">Zone</div>
              <div style={{ marginTop: 4 }}><ZoneBadge zone={sc.zone_classification} /></div>
            </div>
            {sc.nearest_transport && (
              <DataCell label={`${sc.nearest_transport.type} (nearest)`} value={`${sc.nearest_transport.name} — ${sc.nearest_transport.distance_m}m · ${sc.nearest_transport.walking_min} min`} />
            )}
            {sc.city_center_distance_m != null && (
              <DataCell label="Distance to City Center" value={`${sc.city_center_distance_m.toLocaleString()}m`} />
            )}
            <div className="data-cell">
              <div className="data-cell-label">Foot Traffic Score</div>
              <div style={{ marginTop: 6 }}><FootTrafficBar score={sc.foot_traffic_score} /></div>
            </div>
          </div>
          <ProseBlock text={sc.location_economics} />
          {r.latitude != null && r.longitude != null && r.points_of_interest.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <AbstractSpatialMap sc={sc} pois={r.points_of_interest} r={{ latitude: r.latitude!, longitude: r.longitude! }} />
            </div>
          )}
          <Divider />
        </>
      )}

      {/* ═══ CONTACT & ADDRESS ═══ */}
      <SectionLabel>Contact & Location</SectionLabel>
      <DataGrid>
        {r.address && <DataCell label="Address" value={<CopyBtn value={r.address} />} />}
        {r.phone && <DataCell label="Phone" value={<CopyBtn value={r.phone} />} />}
        {r.phone_intl && r.phone_intl !== r.phone && <DataCell label="Intl." value={<CopyBtn value={r.phone_intl} />} />}
        {coords && <DataCell label="Coordinates" value={<CopyBtn value={coords} />} />}
        {r.plus_code && <DataCell label="Plus Code" value={<CopyBtn value={r.plus_code} />} />}
        {ad.postal_code && <DataCell label="PLZ" value={ad.postal_code} />}
        {ad.landkreis && <DataCell label="Landkreis" value={ad.landkreis} />}
        {ad.bundesland && <DataCell label="Bundesland" value={ad.bundesland} />}
        {ad.country && <DataCell label="Country" value={`${ad.country}${ad.country_code ? ` (${ad.country_code})` : ''}`} />}
      </DataGrid>
      <Divider />

      {/* ═══ OPENING HOURS ═══ */}
      {r.opening_hours && (
        <>
          <SectionLabel>Opening Hours</SectionLabel>
          <DataGrid style={{ marginBottom: 10 }}>
            {r.opening_hours.total_weekly_hours != null && <DataCell label="Weekly Total" value={`${r.opening_hours.total_weekly_hours}h`} />}
            {r.opening_hours.avg_daily_hours != null && <DataCell label="Avg / Day" value={`${r.opening_hours.avg_daily_hours}h`} />}
            <DataCell label="Weekends" value={<span style={{ color: r.opening_hours.open_on_weekends ? '#4ade80' : '#f87171' }}>{r.opening_hours.open_on_weekends ? 'Open' : 'Closed'}</span>} />
          </DataGrid>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
            {r.opening_hours.weekday_text.map((line, i) => {
              const idx = line.indexOf(': ');
              return (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: '0.8rem', lineHeight: 1.7 }}>
                  <span style={{ color: '#444444', minWidth: 90 }}>{idx > -1 ? line.slice(0, idx) : line}</span>
                  <span style={{ color: '#666666' }}>{idx > -1 ? line.slice(idx + 2) : ''}</span>
                </div>
              );
            })}
          </div>
          <Divider />
        </>
      )}

      {/* ═══ SERVICES ═══ */}
      {services.length > 0 && (
        <>
          <SectionLabel>Services & Attributes</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {services.map(s => (
              <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: s.v ? 'rgba(34,197,94,0.08)' : 'rgba(248,113,113,0.06)', color: s.v ? '#4ade80' : '#f87171', border: `1px solid ${s.v ? 'rgba(34,197,94,0.18)' : 'rgba(248,113,113,0.12)'}` }}>
                {s.v ? '✓' : '✗'} {s.label}
              </span>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* ═══ WEBSITE INTELLIGENCE ═══ */}
      {wd && (wd.meta_description || wd.emails.length > 0 || Object.keys(wd.socials).length > 0) && (
        <>
          <SectionLabel>Website Intelligence</SectionLabel>
          {wd.page_title && <div style={{ fontSize: '0.82rem', color: '#888888', marginBottom: 6, fontStyle: 'italic' }}>"{wd.page_title}"</div>}
          {wd.meta_description && <p style={{ margin: '0 0 12px', fontSize: '0.81rem', color: '#666666', lineHeight: 1.55 }}>{wd.meta_description}</p>}
          <DataGrid style={{ marginBottom: 10 }}>
            {wd.emails.length > 0 && <DataCell label="Emails" value={<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{wd.emails.map((e, i) => <CopyBtn key={i} value={e} />)}</div>} />}
            {wd.phones_found.length > 0 && <DataCell label="Phones (site)" value={<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{wd.phones_found.map((p, i) => <CopyBtn key={i} value={p} />)}</div>} />}
          </DataGrid>
          {Object.keys(wd.socials).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {Object.entries(wd.socials).map(([platform, url]) => (
                <a key={platform} href={url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: 'rgba(78,154,102,0.07)', border: '1px solid rgba(78,154,102,0.18)', fontSize: '0.77rem', textDecoration: 'none', color: '#4e9a66' }}>
                  {socialIcons[platform] ?? '🔗'} {platform}
                </a>
              ))}
            </div>
          )}
          <Divider />
        </>
      )}

      {/* ═══ SENTIMENT ═══ */}
      {sk && (sk.praises.length > 0 || sk.complaints.length > 0) && (
        <>
          <SectionLabel>Review Sentiment Analysis</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4ade80', letterSpacing: '0.07em', marginBottom: 8 }}>PRAISES</div>
              {sk.praises.map((t, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#666666', marginBottom: 3 }}>{t.theme} <span style={{ color: '#4ade80', fontWeight: 400 }}>({t.count}×)</span></div>
                  {t.examples.map((ex, j) => <div key={j} style={{ fontSize: '0.75rem', color: '#444444', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8, borderLeft: '2px solid rgba(34,197,94,0.25)' }}>"{ex}"</div>)}
                </div>
              ))}
              {sk.praises.length === 0 && <div style={{ fontSize: '0.78rem', color: '#444444' }}>No praises detected</div>}
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f87171', letterSpacing: '0.07em', marginBottom: 8 }}>COMPLAINTS</div>
              {sk.complaints.map((t, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#666666', marginBottom: 3 }}>{t.theme} <span style={{ color: '#f87171', fontWeight: 400 }}>({t.count}×)</span></div>
                  {t.examples.map((ex, j) => <div key={j} style={{ fontSize: '0.75rem', color: '#444444', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8, borderLeft: '2px solid rgba(248,113,113,0.25)' }}>"{ex}"</div>)}
                </div>
              ))}
              {sk.complaints.length === 0 && <div style={{ fontSize: '0.78rem', color: '#444444' }}>No complaints detected</div>}
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* ═══ REVIEW ANALYSIS ═══ */}
      {ra && ra.total > 0 && (
        <>
          <SectionLabel>Review Analysis — {ra.total} sampled</SectionLabel>
          <DataGrid style={{ marginBottom: 12 }}>
            <DataCell label="Sentiment Score" value={<span style={{ color: ra.sentiment_score != null && ra.sentiment_score > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{ra.sentiment_score != null ? (ra.sentiment_score > 0 ? `+${ra.sentiment_score}` : String(ra.sentiment_score)) : '—'}</span>} />
            <DataCell label="Pos / Neg / Neutral" value={<><span style={{ color: '#4ade80' }}>{ra.positive}↑</span>{' / '}<span style={{ color: '#f87171' }}>{ra.negative}↓</span>{' / '}<span style={{ color: '#666666' }}>{ra.neutral}→</span></>} />
            {ra.avg_review_length > 0 && <DataCell label="Avg Length" value={`${ra.avg_review_length} chars`} />}
            {ra.tourist_ratio_pct != null && <DataCell label="Tourist Reviews" value={`${ra.tourist_ratio_pct}%`} />}
            {ra.languages.length > 0 && <DataCell label="Languages" value={ra.languages.join(', ')} />}
            {ra.oldest_date && <DataCell label="Date Range" value={`${ra.oldest_date} → ${ra.newest_date}`} />}
          </DataGrid>
          <div style={{ display: 'grid', gap: 6 }}>
            {r.reviews.map((rv, i) => (
              <div key={i} style={{ background: '#f8f8f8', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, padding: '9px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#888888' }}>{rv.author || 'Anonymous'}</span>
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.77rem', color: '#444444' }}>
                    {rv.rating != null && <span style={{ color: '#fbbf24' }}>{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</span>}
                    {rv.relative_time && <span>{rv.relative_time}</span>}
                    {rv.language && rv.language !== 'de' && <span style={{ color: '#4e9a66' }}>[{rv.language}]</span>}
                  </div>
                </div>
                {rv.text && <p style={{ margin: 0, fontSize: '0.8rem', color: '#666666', lineHeight: 1.55 }}>{rv.text}</p>}
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* ═══ FOOT TRAFFIC DRIVERS ═══ */}
      {r.points_of_interest.length > 0 && (
        <>
          <SectionLabel>Demand Drivers — {r.points_of_interest.length} nearby venues</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {r.points_of_interest.map((poi) => {
              const catColor: Record<string, string> = { tourism: '#4e9a66', amenity: '#a78bfa', historic: '#fbbf24', leisure: '#4ade80' };
              const c = catColor[poi.category] ?? '#888888';
              return (
                <div key={poi.id} style={{ background: '#f8f8f8', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, padding: '9px 12px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#888888', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 8, background: `${c}15`, color: c, border: `1px solid ${c}28` }}>{poi.category}</span>
                    <span style={{ fontSize: '0.7rem', color: '#444444' }}>{poi.subtype}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <Divider />
        </>
      )}

      {/* ═══ PHOTOS ═══ */}
      {r.photos.length > 0 && (
        <>
          <SectionLabel>Photos — {r.photos_count} total</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, marginBottom: 4 }}>
            {r.photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} loading="lazy"
                  style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(0,0,0,0.06)', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </a>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* ═══ COMPETITORS ═══ */}
      {r.competitors.length > 0 && (
        <>
          <SectionLabel>Competitors — {r.competitors.length} within 1km</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {r.competitors.map((c, ci) => (
              <div key={ci} style={{ background: '#f8f8f8', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#888888', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 7, fontSize: '0.76rem', flexWrap: 'wrap', marginBottom: 4 }}>
                  {c.rating && <span style={{ color: '#fbbf24' }}>★ {c.rating}</span>}
                  {c.review_volume && <span style={{ color: '#444444' }}>{Number(c.review_volume).toLocaleString('de-DE')} rev.</span>}
                  {c.price_level && <span style={{ color: '#fbbf24' }}>{c.price_level}</span>}
                </div>
                {c.address && <div style={{ fontSize: '0.72rem', color: '#444444', lineHeight: 1.4, marginBottom: 4 }}>{c.address}</div>}
                {c.url && <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#4e9a66' }}>Website →</a>}
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<ExtractionData[]>([]);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    const urlList = parseUrls(urls);
    if (!urlList.length) { setError('Paste at least one Google Maps link.'); return; }
    setLoading(true); setError(''); setResults([]);
    const extracted: ExtractionData[] = [];
    for (let i = 0; i < urlList.length; i++) {
      setProgress(`Extracting ${i + 1} / ${urlList.length}…`);
      try {
        const res = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: urlList[i] }) });
        if (res.ok) extracted.push(await res.json());
      } catch (err) { console.error(err); }
    }
    setResults(extracted); setProgress(''); setLoading(false);
    if (!extracted.length) setError('No results extracted. Check that the links are valid Google Maps URLs.');
  };

  const downloadJSON = () => {
    if (!results.length) return;
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(results, null, 2));
    a.download = 'firmadeal_export.json'; a.click();
  };

  const downloadCSV = () => {
    if (!results.length) return;
    const headers = ['Name','Category','Rating','Reviews','Address','Phone','PLZ','Landkreis','Bundesland','City','Country','Lat','Lng','Website','PriceLevel','OpenNow','WeeklyHours','Sentiment','TouristPct','Emails','Instagram','EbitdaMid','EbitdaMultipleMid','MarketDEbn','PricingPower','PricePremiumIdx','RatingPremium','Competitors','AQI','Rev_Low','Rev_Mid','Rev_High','EBITDA_Low','EBITDA_Mid','EBITDA_High','FTE','LaborFrictionIdx','PPPIndex','Zone','FootTrafficScore','TransportDist','CityCenter_m','PlaceID'];
    const rows = results.map(r => [
      r.name, r.category, r.rating, r.review_volume, r.address, r.phone,
      r.address_detail?.postal_code, r.address_detail?.landkreis, r.address_detail?.bundesland, r.city, r.country,
      r.latitude, r.longitude, r.website, r.price_level, r.is_open,
      r.opening_hours?.total_weekly_hours, r.review_analysis?.sentiment_score, r.review_analysis?.tourist_ratio_pct,
      r.website_data?.emails.join('; '), r.website_data?.socials?.instagram,
      r.synthetic_pl?.ebitda.mid, r.industry_economics?.ebitda_multiple.mid, r.industry_economics?.market_size_de_bn,
      r.pricing_power?.confirmed, r.pricing_power?.price_premium_index, r.pricing_power?.rating_premium,
      r.competitor_count, r.area_metrics?.quality_index,
      r.synthetic_pl?.revenue.low, r.synthetic_pl?.revenue.mid, r.synthetic_pl?.revenue.high,
      r.synthetic_pl?.ebitda.low, r.synthetic_pl?.ebitda.mid, r.synthetic_pl?.ebitda.high,
      r.synthetic_pl?.fte_estimate, r.labor_friction?.index, r.macro_data?.ppp_index,
      r.spatial_context?.zone_classification, r.spatial_context?.foot_traffic_score,
      r.spatial_context?.nearest_transport?.distance_m, r.spatial_context?.city_center_distance_m,
      r.place_id,
    ].map(v => `"${v ?? ''}"`).join(','));
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(','), ...rows].join('\n'));
    a.download = 'firmadeal_export.csv'; a.click();
  };

  return (
    <main>
      <div className="page">
        <div className="header">
          <h1>Firmadeal Extractor</h1>
          <p>Business intelligence for acquisition research</p>
        </div>

        <div className="panel">
          <label className="label">Paste Google Maps links</label>
          <textarea className="textarea" value={urls} onChange={e => setUrls(e.target.value)}
            placeholder="https://maps.app.goo.gl/...\nOne per line, or comma / space separated" rows={4} />
          <div className="button-row">
            <button className="button" onClick={handleExtract} disabled={loading}>
              {loading ? progress || 'Extracting…' : 'Extract Intelligence'}
            </button>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        {results.length > 0 && (
          <>
            <div className="result-actions" style={{ marginBottom: 16 }}>
              <p style={{ color: '#666666', fontSize: '0.85rem' }}>{results.length} business{results.length !== 1 ? 'es' : ''} extracted</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="button" onClick={downloadJSON}>JSON</button>
                <button className="button" onClick={downloadCSV}>CSV</button>
                <button className="button secondary" onClick={() => { setResults([]); setUrls(''); setError(''); }}>Clear</button>
              </div>
            </div>
            <div className="results-grid">
              {results.map((r, idx) => <ResultCard key={idx} r={r} />)}
            </div>
          </>
        )}

        {!results.length && !loading && (
          <div className="panel">
            <h3 style={{ color: '#1db954', marginBottom: 14, fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Intelligence modules</h3>
            <ul className="info-list">
              <li><span>💰</span><strong>Probabilistic P&L</strong> — Bear / Base / Bull revenue, EBITDA, margin ranges with sanity-check ceiling and model compression alerts</li>
              <li><span>📐</span><strong>Cost Driver Matrix</strong> — sector-specific structural pressures, severity ratings, EBITDA drag in percentage points</li>
              <li><span>📍</span><strong>Location Economics</strong> — walking distance to nearest transport hub, distance to city center, zone classification, foot traffic score</li>
              <li><span>🏭</span><strong>Deep Industry Economics</strong> — structural margins, business model mechanics, failure rates, 5-year context</li>
              <li><span>🔴/🟢</span><strong>Pricing Power Engine</strong> — 4-factor moat signal with price premium, rating premium, demand share, sentiment</li>
              <li><span>📡</span><strong>Competitor Radar</strong> — multi-metric chart vs local market average</li>
              <li><span>📈</span><strong>Market Timeline</strong> — 20-quarter demand index 2020–2024 with COVID trajectory</li>
              <li><span>🌍</span><strong>Macro / Labor</strong> — Bundesland PPP index, unemployment, Labor Friction Index gauge</li>
              <li><span>💬</span><strong>NLP Sentiment</strong> — categorized praises and complaints from review text</li>
              <li><span>🌐</span><strong>Website Intel</strong> — emails, social profiles, meta description, keywords</li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
