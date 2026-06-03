'use client';

import { useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, RadialBarChart, RadialBar, Tooltip, Legend,
} from 'recharts';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface ReviewData { author: string | null; rating: number | null; text: string | null; language: string | null; relative_time: string | null; }
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
interface IndustryEconomics { industry_label: string; ebitda_multiple: { low: number; mid: number; high: number }; avg_margin_pct: number | null; market_size_de_bn: number | null; cagr_5y_pct: number | null; trend_summary: string; yearly: IndustryYearData[]; }
interface CompetitorData { name: string | null; url: string | null; address: string | null; rating: string | null; review_volume: string | null; category: string | null; price_level: string | null; phone: string | null; business_status: string | null; }

interface ExtractionData {
  place_id: string | null; name: string | null; types: string[]; category: string | null; business_status: string | null; summary: string | null;
  address: string | null; vicinity: string | null; phone: string | null; phone_intl: string | null; website: string | null; google_maps_url: string | null; resolved_url: string | null;
  latitude: number | null; longitude: number | null; plus_code: string | null; address_detail: AddressDetail;
  city: string | null; region: string | null; country: string | null;
  rating: string | null; review_volume: string | null; price_level: string | null;
  reviews: ReviewData[]; review_analysis: ReviewAnalysis | null; sentiment_keywords: SentimentKeywords | null;
  opening_hours: HoursData | null; is_open: boolean | null;
  delivery: boolean | null; dine_in: boolean | null; takeout: boolean | null; reservable: boolean | null;
  serves_beer: boolean | null; serves_breakfast: boolean | null; serves_brunch: boolean | null; serves_dinner: boolean | null; serves_lunch: boolean | null; serves_wine: boolean | null;
  wheelchair_accessible: boolean | null; curbside_pickup: boolean | null;
  photos: string[]; photos_count: number; website_data: WebsiteData | null;
  competitor_count: number | null; competitors: CompetitorData[];
  area_metrics: AreaMetrics | null; radar_data: RadarPoint[]; pricing_power: PricingPower | null;
  points_of_interest: PointOfInterest[]; industry_economics: IndustryEconomics | null;
  search_interest: string | null; spot_category: string | null;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function parseUrls(raw: string) {
  return raw.split(/[\n,\s]+/).map(u => u.trim()).filter(u => u.startsWith('http') || u.startsWith('maps.'));
}

function CopyBtn({ value, display }: { value: string; display?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ background: copied ? 'rgba(56,189,248,0.1)' : 'none', padding: '0 4px', borderRadius: 4, color: copied ? '#38bdf8' : '#cbd5e1', fontSize: '0.86rem', textAlign: 'left', border: 'none', cursor: 'pointer' }}>
      {copied ? '✓' : (display ?? (value || '—'))}
    </button>
  );
}

function Badge({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600, background: value ? 'rgba(34,197,94,0.1)' : 'rgba(248,113,113,0.08)', color: value ? '#4ade80' : '#f87171', border: `1px solid ${value ? 'rgba(34,197,94,0.2)' : 'rgba(248,113,113,0.15)'}` }}>
      {value ? '✓' : '✗'} {label}
    </span>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="result-item">
      <strong>{k}</strong>
      <span style={{ color: '#cbd5e1', fontSize: '0.86rem' }}>{v}</span>
    </div>
  );
}

// ── Recharts: Area Quality Gauge ──────────────────────────────────────────────

function QualityGauge({ index }: { index: number }) {
  const color = index >= 70 ? '#4ade80' : index >= 45 ? '#fbbf24' : '#f87171';
  const data = [{ name: 'AQI', value: index, fill: color }];
  return (
    <div style={{ textAlign: 'center' }}>
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="100%"
          startAngle={180} endAngle={0} data={data} barSize={22}>
          <RadialBar background dataKey="value" cornerRadius={6} />
          <Tooltip formatter={(v: number) => [`${v}/100`, 'Area Quality Index']} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', color: '#94a3b8', fontSize: 12 }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: -28, fontSize: '2rem', fontWeight: 800, color }}>{index}</div>
      <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>Area Quality Index / 100</div>
    </div>
  );
}

// ── Recharts: Competitor Radar ────────────────────────────────────────────────

function CompetitorRadar({ data }: { data: RadarPoint[] }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="rgba(148,163,184,0.15)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="This business" dataKey="target" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.25} strokeWidth={2} />
        <Radar name="Market avg" dataKey="market" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.12} strokeWidth={1.5} strokeDasharray="4 3" />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', color: '#94a3b8', fontSize: 12 }} formatter={(v: number, name: string) => [`${v}/100`, name]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({ r }: { r: ExtractionData }) {
  const ad  = r.address_detail ?? {};
  const ra  = r.review_analysis;
  const eco = r.industry_economics;
  const wd  = r.website_data;
  const pp  = r.pricing_power;
  const am  = r.area_metrics;
  const sk  = r.sentiment_keywords;

  const coords = r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : null;
  const statusColor = r.business_status === 'OPERATIONAL' ? '#4ade80' : r.business_status === 'CLOSED_TEMPORARILY' ? '#facc15' : '#f87171';

  const services = [
    { label: 'Delivery', value: r.delivery }, { label: 'Dine-in', value: r.dine_in },
    { label: 'Takeout', value: r.takeout }, { label: 'Reservable', value: r.reservable },
    { label: 'Curbside', value: r.curbside_pickup }, { label: 'Beer', value: r.serves_beer },
    { label: 'Wine', value: r.serves_wine }, { label: 'Breakfast', value: r.serves_breakfast },
    { label: 'Brunch', value: r.serves_brunch }, { label: 'Lunch', value: r.serves_lunch },
    { label: 'Dinner', value: r.serves_dinner }, { label: 'Wheelchair', value: r.wheelchair_accessible },
  ].filter(s => s.value !== null);

  const socialIcons: Record<string, string> = { instagram: '📸', facebook: '👥', linkedin: '💼', twitter: '𝕏', tiktok: '🎵', youtube: '▶️' };

  return (
    <div className="result-card">

      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 6px' }}>{r.name || 'Unknown business'}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {r.category && <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{r.category.replace(/_/g, ' ')}</span>}
          {r.business_status && <span style={{ fontSize: '0.76rem', color: statusColor, fontWeight: 700 }}>● {r.business_status.replace(/_/g, ' ')}</span>}
          {r.is_open !== null && <span style={{ fontSize: '0.76rem', color: r.is_open ? '#4ade80' : '#f87171', fontWeight: 700 }}>{r.is_open ? 'OPEN NOW' : 'CLOSED NOW'}</span>}
          {r.price_level && <span style={{ color: '#fbbf24', fontWeight: 700 }}>{r.price_level}</span>}
        </div>
      </div>

      {/* ── Rating ── */}
      {(r.rating || r.review_volume || r.summary) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          {r.rating && <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1.1rem' }}>★ {r.rating}</span>}
          {r.review_volume && <span style={{ color: '#94a3b8' }}>{Number(r.review_volume).toLocaleString('de-DE')} reviews</span>}
          {r.summary && <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>{r.summary}</span>}
        </div>
      )}

      {/* ── Links ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20, fontSize: '0.85rem' }}>
        {r.google_maps_url && <a href={r.google_maps_url} target="_blank" rel="noreferrer">Google Maps →</a>}
        {r.website && <a href={r.website} target="_blank" rel="noreferrer">Website →</a>}
      </div>

      {/* ── Pricing Power Engine ── */}
      {pp && (
        <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 14, background: pp.confirmed ? 'rgba(34,197,94,0.06)' : 'rgba(248,113,113,0.06)', border: `1.5px solid ${pp.confirmed ? 'rgba(34,197,94,0.3)' : 'rgba(248,113,113,0.25)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>{pp.confirmed ? '✅' : '❌'}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: pp.confirmed ? '#4ade80' : '#f87171' }}>
                {pp.confirmed ? 'Confirmed Pricing Power' : 'No Pricing Power Confirmed'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                {pp.confirmed ? 'Strong economic moat — safe margin expansion opportunity' : 'Insufficient moat for margin expansion'}
              </div>
            </div>
          </div>
          <div className="result-row" style={{ marginBottom: 12 }}>
            <Kv k="Price Premium Index" v={<span style={{ color: pp.price_premium_index != null && pp.price_premium_index > 1 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{pp.price_premium_index ?? '—'}x</span>} />
            <Kv k="Rating Premium" v={<span style={{ color: pp.rating_premium != null && pp.rating_premium >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{pp.rating_premium != null ? (pp.rating_premium >= 0 ? `+${pp.rating_premium}` : pp.rating_premium) : '—'}</span>} />
            <Kv k="Local Demand Share" v={<span style={{ fontWeight: 700 }}>{pp.local_demand_share_pct != null ? `${pp.local_demand_share_pct}%` : '—'}</span>} />
            <Kv k="Neg. Price Sentiment" v={<span style={{ color: pp.neg_price_sentiment_ratio != null && pp.neg_price_sentiment_ratio < 0.05 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{pp.neg_price_sentiment_ratio != null ? `${(pp.neg_price_sentiment_ratio * 100).toFixed(1)}%` : '—'}</span>} />
          </div>
          {pp.factors_met.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              {pp.factors_met.map((f, i) => <div key={i} style={{ fontSize: '0.8rem', color: '#4ade80', lineHeight: 1.6 }}>✓ {f}</div>)}
            </div>
          )}
          {pp.factors_missing.length > 0 && (
            <div>{pp.factors_missing.map((f, i) => <div key={i} style={{ fontSize: '0.8rem', color: '#f87171', lineHeight: 1.6 }}>✗ {f}</div>)}</div>
          )}
        </div>
      )}

      {/* ── Area Overview: gauge + radar side by side ── */}
      {(am || r.radar_data.length > 0) && (
        <Sec title="Area Overview (500m–1km radius)">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 200px) 1fr', gap: 20, alignItems: 'center', marginBottom: 14 }}>
            {am && <QualityGauge index={am.quality_index} />}
            {r.radar_data.length > 0 && <CompetitorRadar data={r.radar_data} />}
          </div>
          {am && (
            <div className="result-row">
              {am.avg_rating_area != null && <Kv k="Area Avg Rating" v={`★ ${am.avg_rating_area}`} />}
              {am.avg_price_level_area != null && <Kv k="Area Avg Price" v={`€ × ${am.avg_price_level_area}`} />}
              {am.operational_pct != null && <Kv k="Operational" v={`${am.operational_pct}%`} />}
              <Kv k="Businesses" v={am.businesses_count} />
              <Kv k="Total Area Reviews" v={am.total_area_reviews.toLocaleString('de-DE')} />
            </div>
          )}
        </Sec>
      )}

      {/* ── Contact ── */}
      <Sec title="Contact">
        <div className="result-row">
          {r.address && <div className="result-item"><strong>Address</strong><CopyBtn value={r.address} /></div>}
          {r.phone && <div className="result-item"><strong>Phone</strong><CopyBtn value={r.phone} /></div>}
          {r.phone_intl && r.phone_intl !== r.phone && <div className="result-item"><strong>Intl.</strong><CopyBtn value={r.phone_intl} /></div>}
          {coords && <div className="result-item"><strong>Coordinates</strong><CopyBtn value={coords} /></div>}
          {r.plus_code && <div className="result-item"><strong>Plus Code</strong><CopyBtn value={r.plus_code} /></div>}
        </div>
      </Sec>

      {/* ── Address detail ── */}
      {(ad.bundesland || ad.landkreis || ad.postal_code) && (
        <Sec title="Address Detail">
          <div className="result-row">
            {ad.street && <Kv k="Street" v={ad.street_number ? `${ad.street} ${ad.street_number}` : ad.street} />}
            {ad.sublocality && <Kv k="District" v={ad.sublocality} />}
            {ad.city && <Kv k="City" v={ad.city} />}
            {ad.postal_code && <Kv k="PLZ" v={ad.postal_code} />}
            {ad.landkreis && <Kv k="Landkreis" v={ad.landkreis} />}
            {ad.bundesland && <Kv k="Bundesland" v={ad.bundesland} />}
            {ad.country && <Kv k="Country" v={`${ad.country}${ad.country_code ? ` (${ad.country_code})` : ''}`} />}
          </div>
        </Sec>
      )}

      {/* ── Website intelligence ── */}
      {wd && (wd.meta_description || wd.emails.length > 0 || Object.keys(wd.socials).length > 0) && (
        <Sec title="Website Intelligence">
          {wd.page_title && <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 8, fontStyle: 'italic' }}>"{wd.page_title}"</div>}
          {wd.meta_description && <div style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: 10, lineHeight: 1.55 }}>{wd.meta_description}</div>}
          <div className="result-row" style={{ marginBottom: 10 }}>
            {wd.emails.length > 0 && <div className="result-item"><strong>Emails</strong><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{wd.emails.map((e, i) => <CopyBtn key={i} value={e} />)}</div></div>}
            {wd.phones_found.length > 0 && <div className="result-item"><strong>Phones (site)</strong><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{wd.phones_found.map((p, i) => <CopyBtn key={i} value={p} />)}</div></div>}
          </div>
          {Object.keys(wd.socials).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: wd.keywords.length ? 10 : 0 }}>
              {Object.entries(wd.socials).map(([platform, url]) => (
                <a key={platform} href={url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', fontSize: '0.79rem', textDecoration: 'none', color: '#38bdf8' }}>
                  {socialIcons[platform] ?? '🔗'} {platform}
                </a>
              ))}
            </div>
          )}
          {wd.keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {wd.keywords.map((kw, i) => <span key={i} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(148,163,184,0.07)', color: '#475569', fontSize: '0.76rem', border: '1px solid rgba(148,163,184,0.1)' }}>{kw}</span>)}
            </div>
          )}
        </Sec>
      )}

      {/* ── Opening hours ── */}
      {r.opening_hours && (
        <Sec title="Opening Hours">
          <div className="result-row" style={{ marginBottom: 10 }}>
            {r.opening_hours.total_weekly_hours != null && <Kv k="Weekly Total" v={`${r.opening_hours.total_weekly_hours}h`} />}
            {r.opening_hours.avg_daily_hours != null && <Kv k="Avg / Day" v={`${r.opening_hours.avg_daily_hours}h`} />}
            <Kv k="Weekends" v={<span style={{ color: r.opening_hours.open_on_weekends ? '#4ade80' : '#f87171' }}>{r.opening_hours.open_on_weekends ? 'Open' : 'Closed'}</span>} />
          </div>
          {r.opening_hours.weekday_text.map((line, i) => {
            const idx = line.indexOf(': ');
            return (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: '0.82rem', lineHeight: 1.7 }}>
                <span style={{ color: '#475569', minWidth: 96 }}>{idx > -1 ? line.slice(0, idx) : line}</span>
                <span style={{ color: '#94a3b8' }}>{idx > -1 ? line.slice(idx + 2) : ''}</span>
              </div>
            );
          })}
        </Sec>
      )}

      {/* ── Services ── */}
      {services.length > 0 && (
        <Sec title="Services & Features">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {services.map(s => <Badge key={s.label} label={s.label} value={s.value} />)}
          </div>
        </Sec>
      )}

      {/* ── Sentiment: Praises & Complaints ── */}
      {sk && (sk.praises.length > 0 || sk.complaints.length > 0) && (
        <Sec title="Qualitative Analysis — Review Sentiment">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Praises */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>PRAISES</div>
              {sk.praises.length > 0 ? sk.praises.map((t, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 3 }}>{t.theme} <span style={{ color: '#4ade80', fontWeight: 400 }}>({t.count}×)</span></div>
                  {t.examples.map((ex, j) => <div key={j} style={{ fontSize: '0.77rem', color: '#475569', lineHeight: 1.45, marginBottom: 2, paddingLeft: 8, borderLeft: '2px solid rgba(34,197,94,0.3)' }}>"{ex}"</div>)}
                </div>
              )) : <div style={{ fontSize: '0.8rem', color: '#334155' }}>No praises detected</div>}
            </div>
            {/* Complaints */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', marginBottom: 8 }}>COMPLAINTS</div>
              {sk.complaints.length > 0 ? sk.complaints.map((t, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 3 }}>{t.theme} <span style={{ color: '#f87171', fontWeight: 400 }}>({t.count}×)</span></div>
                  {t.examples.map((ex, j) => <div key={j} style={{ fontSize: '0.77rem', color: '#475569', lineHeight: 1.45, marginBottom: 2, paddingLeft: 8, borderLeft: '2px solid rgba(248,113,113,0.3)' }}>"{ex}"</div>)}
                </div>
              )) : <div style={{ fontSize: '0.8rem', color: '#334155' }}>No complaints detected</div>}
            </div>
          </div>
        </Sec>
      )}

      {/* ── Review analysis ── */}
      {ra && ra.total > 0 && (
        <Sec title={`Review Analysis — ${ra.total} sample reviews`}>
          <div className="result-row" style={{ marginBottom: 12 }}>
            <Kv k="Sentiment" v={<span style={{ color: ra.sentiment_score != null && ra.sentiment_score > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{ra.sentiment_score != null ? (ra.sentiment_score > 0 ? `+${ra.sentiment_score}` : String(ra.sentiment_score)) : '—'}</span>} />
            <Kv k="Pos / Neg / Neutral" v={<><span style={{ color: '#4ade80' }}>{ra.positive}↑</span>{' / '}<span style={{ color: '#f87171' }}>{ra.negative}↓</span>{' / '}<span style={{ color: '#64748b' }}>{ra.neutral}→</span></>} />
            {ra.avg_review_length > 0 && <Kv k="Avg Length" v={`${ra.avg_review_length} chars`} />}
            {ra.tourist_ratio_pct != null && <Kv k="Tourist Reviews" v={`${ra.tourist_ratio_pct}%`} />}
            {ra.languages.length > 0 && <Kv k="Languages" v={ra.languages.join(', ')} />}
            {ra.oldest_date && <Kv k="Date Range" v={<span style={{ fontSize: '0.8rem' }}>{ra.oldest_date} → {ra.newest_date}</span>} />}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {r.reviews.map((rv, i) => (
              <div key={i} style={{ background: '#0b1122', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{rv.author || 'Anonymous'}</span>
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.79rem', color: '#475569' }}>
                    {rv.rating != null && <span style={{ color: '#fbbf24' }}>{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</span>}
                    {rv.relative_time && <span>{rv.relative_time}</span>}
                    {rv.language && rv.language !== 'de' && <span style={{ color: '#38bdf8' }}>[{rv.language}]</span>}
                  </div>
                </div>
                {rv.text && <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.55 }}>{rv.text}</p>}
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* ── Foot Traffic Drivers (POIs) ── */}
      {r.points_of_interest.length > 0 && (
        <Sec title={`Local Demand Drivers — ${r.points_of_interest.length} nearby venues`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {r.points_of_interest.map((poi) => {
              const catColor: Record<string, string> = { tourism: '#38bdf8', amenity: '#a78bfa', historic: '#fbbf24', leisure: '#4ade80' };
              return (
                <div key={poi.id} style={{ background: '#0b1122', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.83rem', marginBottom: 3 }}>{poi.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: '0.73rem', padding: '2px 7px', borderRadius: 10, background: `${catColor[poi.category] ?? '#64748b'}18`, color: catColor[poi.category] ?? '#64748b', border: `1px solid ${catColor[poi.category] ?? '#64748b'}30` }}>{poi.category}</span>
                    <span style={{ fontSize: '0.73rem', color: '#475569' }}>{poi.subtype}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Sec>
      )}

      {/* ── Photos ── */}
      {r.photos.length > 0 && (
        <Sec title={`Photos — ${r.photos_count} total`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {r.photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} loading="lazy"
                  style={{ width: '100%', height: 108, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(148,163,184,0.12)', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </a>
            ))}
          </div>
        </Sec>
      )}

      {/* ── Competitors ── */}
      {r.competitors.length > 0 && (
        <Sec title={`Nearby Competitors — ${r.competitors.length} within 1km`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {r.competitors.map((c, ci) => (
              <div key={ci} style={{ background: '#0b1122', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 8, fontSize: '0.78rem', flexWrap: 'wrap', marginBottom: 5 }}>
                  {c.rating && <span style={{ color: '#fbbf24' }}>★ {c.rating}</span>}
                  {c.review_volume && <span style={{ color: '#475569' }}>{Number(c.review_volume).toLocaleString('de-DE')} rev.</span>}
                  {c.price_level && <span style={{ color: '#fbbf24' }}>{c.price_level}</span>}
                  {c.business_status && c.business_status !== 'OPERATIONAL' && <span style={{ color: '#facc15', fontSize: '0.73rem' }}>{c.business_status.replace(/_/g, ' ')}</span>}
                </div>
                {c.phone && <div style={{ fontSize: '0.77rem', color: '#475569', marginBottom: 4 }}>{c.phone}</div>}
                {c.address && <div style={{ fontSize: '0.75rem', color: '#334155', marginBottom: 6, lineHeight: 1.4 }}>{c.address}</div>}
                {c.url && <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Website →</a>}
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* ── Industry Economics ── */}
      {eco && (
        <Sec title={`Industry Economics — ${eco.industry_label}`}>
          <div className="result-row" style={{ marginBottom: 12 }}>
            <Kv k="EBITDA Multiple" v={`${eco.ebitda_multiple.low}x – ${eco.ebitda_multiple.mid}x – ${eco.ebitda_multiple.high}x`} />
            {eco.avg_margin_pct != null && <Kv k="Avg EBITDA Margin" v={`${eco.avg_margin_pct}%`} />}
            {eco.market_size_de_bn != null && <Kv k="Market (DE)" v={`${eco.market_size_de_bn} Mrd. €`} />}
            {eco.cagr_5y_pct != null && <Kv k="5Y CAGR" v={`${eco.cagr_5y_pct}%`} />}
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '0.83rem', color: '#64748b', lineHeight: 1.55 }}>{eco.trend_summary}</p>
          {eco.yearly.map((y, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, fontSize: '0.8rem', lineHeight: 1.6 }}>
              <span style={{ color: '#38bdf8', fontWeight: 700, minWidth: 36 }}>{y.year}</span>
              <span style={{ color: '#475569' }}>{y.context}</span>
            </div>
          ))}
        </Sec>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<ExtractionData[]>([]);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    const urlList = parseUrls(urls);
    if (urlList.length === 0) { setError('Paste at least one Google Maps link.'); return; }
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
    if (extracted.length === 0) setError('No results extracted. Check that the links are valid Google Maps URLs.');
  };

  const downloadJSON = () => {
    if (!results.length) return;
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(results, null, 2));
    a.download = 'firmadeal_export.json'; a.click();
  };

  const downloadCSV = () => {
    if (!results.length) return;
    const headers = ['Name','Category','Rating','Reviews','Address','Phone','PLZ','Landkreis','Bundesland','City','Country','Lat','Lng','Website','PriceLevel','OpenNow','WeeklyHours','Sentiment','TouristPct','Emails','Instagram','EbitdaMid','MarketDEbn','PricingPower','PricePremiumIdx','RatingPremium','DemandShare%','Competitors','AQI','PlaceID'];
    const rows = results.map(r => [
      r.name, r.category, r.rating, r.review_volume, r.address, r.phone,
      r.address_detail?.postal_code, r.address_detail?.landkreis, r.address_detail?.bundesland, r.city, r.country,
      r.latitude, r.longitude, r.website, r.price_level, r.is_open,
      r.opening_hours?.total_weekly_hours, r.review_analysis?.sentiment_score, r.review_analysis?.tourist_ratio_pct,
      r.website_data?.emails.join('; '), r.website_data?.socials?.instagram,
      r.industry_economics?.ebitda_multiple.mid, r.industry_economics?.market_size_de_bn,
      r.pricing_power?.confirmed, r.pricing_power?.price_premium_index, r.pricing_power?.rating_premium,
      r.pricing_power?.local_demand_share_pct,
      r.competitor_count, r.area_metrics?.quality_index, r.place_id,
    ].map(v => `"${v ?? ''}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'firmadeal_export.csv'; a.click();
  };

  return (
    <main>
      <div className="page">
        <div className="header">
          <h1>Firmadeal Extractor</h1>
          <p>Full-stack business intelligence for acquisition research</p>
        </div>

        <div className="panel">
          <label className="label">Paste Google Maps links</label>
          <textarea className="textarea" value={urls} onChange={e => setUrls(e.target.value)}
            placeholder={`https://maps.app.goo.gl/aEhAJeQvLueyFUcr6\nhttps://maps.app.goo.gl/...\n\nOne per line, or separated by spaces / commas`} rows={5} />
          <div className="button-row">
            <button className="button" onClick={handleExtract} disabled={loading}>
              {loading ? progress || 'Extracting…' : 'Extract Data'}
            </button>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        {results.length > 0 && (
          <>
            <div className="result-actions" style={{ marginBottom: 18 }}>
              <p>{results.length} business{results.length !== 1 ? 'es' : ''} extracted</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="button" onClick={downloadJSON}>Download JSON</button>
                <button className="button" onClick={downloadCSV}>Download CSV</button>
                <button className="button secondary" onClick={() => { setResults([]); setUrls(''); setError(''); }}>Clear</button>
              </div>
            </div>
            <div className="results-grid">
              {results.map((r, idx) => <ResultCard key={idx} r={r} />)}
            </div>
          </>
        )}

        {results.length === 0 && !loading && (
          <div className="panel">
            <h3 style={{ color: '#38bdf8', marginBottom: 14, fontWeight: 700 }}>Output per business</h3>
            <ul className="info-list">
              <li><span>🔴/🟢</span><strong>Pricing Power Engine</strong> — Price Premium Index, Rating Premium, Local Demand Share, Sentiment Ratio → confirmed moat boolean</li>
              <li><span>📡</span><strong>Competitor Radar</strong> — multi-metric chart vs. local market average (rating, reviews, sentiment, digital, price)</li>
              <li><span>🎯</span><strong>Area Quality Index</strong> — 0–100 gauge from rating density, operational %, POI foot traffic</li>
              <li><span>💬</span><strong>NLP Review Analysis</strong> — categorized praises and complaints with real quote examples</li>
              <li><span>📍</span><strong>Foot Traffic Drivers</strong> — nearby museums, theatres, universities, parks via Overpass API</li>
              <li><span>🌐</span><strong>Website Intelligence</strong> — emails, social profiles, meta description, keywords</li>
              <li><span>📈</span><strong>Industry Economics</strong> — EBITDA multiples, market size DE, 5-year trend (2020–2024)</li>
              <li><span>📋</span>Full address (PLZ, Landkreis, Bundesland), opening hours, service flags, photos, competitors</li>
            </ul>
            <h3 style={{ color: '#38bdf8', margin: '20px 0 14px', fontWeight: 700 }}>How to use</h3>
            <ul className="info-list">
              <li><span>1.</span>Open a business on Google Maps → copy the link</li>
              <li><span>2.</span>Paste above — newlines, spaces, or commas all work</li>
              <li><span>3.</span>Click <strong>Extract Data</strong> — ~8–12 s per business</li>
              <li><span>4.</span>Download JSON or CSV for CRM / deal memo import</li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
