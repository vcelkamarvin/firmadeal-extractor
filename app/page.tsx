'use client';

import { useState } from 'react';

// ── Interfaces (mirroring route.ts) ──────────────────────────────────────────

interface ReviewData {
  author: string | null;
  photo_url: string | null;
  rating: number | null;
  text: string | null;
  language: string | null;
  date: string | null;
  relative_time: string | null;
}

interface ReviewAnalysis {
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

interface HoursData {
  weekday_text: string[];
  open_now: boolean | null;
  total_weekly_hours: number | null;
  open_on_weekends: boolean;
  avg_daily_hours: number | null;
}

interface AddressDetail {
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

interface CompetitorData {
  name: string | null;
  url: string | null;
  address: string | null;
  rating: string | null;
  review_volume: string | null;
  category: string | null;
  distance: string | null;
}

interface ExtractionData {
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
  reviews: ReviewData[];
  review_analysis: ReviewAnalysis | null;
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
  competitor_count: number | null;
  competitors: CompetitorData[];
  search_interest: string | null;
  spot_category: string | null;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http') || u.startsWith('maps.'));
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function CopyBtn({ value, display }: { value: string; display?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const handleClick = () => {
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleClick}
      title="Click to copy"
      style={{
        background: copied ? 'rgba(56,189,248,0.12)' : 'none',
        padding: 0,
        borderRadius: 4,
        color: copied ? '#38bdf8' : '#cbd5e1',
        fontSize: '0.9rem',
        textAlign: 'left',
        transition: 'color 0.2s',
        cursor: 'pointer',
        border: 'none',
      }}
    >
      {copied ? '✓ Copied' : (display ?? value || '—')}
    </button>
  );
}

function ServiceBadge({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: '0.78rem',
        fontWeight: 600,
        background: value ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.1)',
        color: value ? '#4ade80' : '#f87171',
        border: `1px solid ${value ? 'rgba(34,197,94,0.25)' : 'rgba(248,113,113,0.2)'}`,
      }}
    >
      {value ? '✓' : '✗'} {label}
    </span>
  );
}

// ── Result card ──────────────────────────────────────────────────────────────

function ResultCard({ r }: { r: ExtractionData }) {
  const coords =
    r.latitude != null && r.longitude != null
      ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`
      : null;

  const ad = r.address_detail ?? {};
  const statusColor =
    r.business_status === 'OPERATIONAL' ? '#4ade80' :
    r.business_status === 'CLOSED_TEMPORARILY' ? '#facc15' : '#f87171';

  const services = [
    { label: 'Delivery',       value: r.delivery },
    { label: 'Dine-in',        value: r.dine_in },
    { label: 'Takeout',        value: r.takeout },
    { label: 'Reservable',     value: r.reservable },
    { label: 'Curbside',       value: r.curbside_pickup },
    { label: 'Beer',           value: r.serves_beer },
    { label: 'Wine',           value: r.serves_wine },
    { label: 'Breakfast',      value: r.serves_breakfast },
    { label: 'Brunch',         value: r.serves_brunch },
    { label: 'Lunch',          value: r.serves_lunch },
    { label: 'Dinner',         value: r.serves_dinner },
    { label: 'Wheelchair',     value: r.wheelchair_accessible },
  ].filter(s => s.value !== null);

  const ra = r.review_analysis;

  return (
    <div className="result-card">
      {/* ── Header ── */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px' }}>{r.name || 'Unknown business'}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {r.category && <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>{r.category.replace(/_/g, ' ')}</span>}
          {r.business_status && (
            <span style={{ fontSize: '0.78rem', color: statusColor, fontWeight: 600 }}>
              ● {r.business_status.replace(/_/g, ' ')}
            </span>
          )}
          {r.is_open !== null && (
            <span style={{ fontSize: '0.78rem', color: r.is_open ? '#4ade80' : '#f87171', fontWeight: 600 }}>
              {r.is_open ? 'OPEN NOW' : 'CLOSED NOW'}
            </span>
          )}
          {r.price_level && <span style={{ color: '#fbbf24', fontWeight: 700 }}>{r.price_level}</span>}
        </div>
      </div>

      {/* ── Rating row ── */}
      {(r.rating || r.review_volume) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          {r.rating && <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1.05rem' }}>★ {r.rating}</span>}
          {r.review_volume && <span style={{ color: '#94a3b8' }}>{Number(r.review_volume).toLocaleString('de-DE')} reviews</span>}
          {r.summary && <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>{r.summary}</span>}
        </div>
      )}

      {/* ── Links ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18, fontSize: '0.85rem' }}>
        {r.google_maps_url && <a href={r.google_maps_url} target="_blank" rel="noreferrer">Google Maps →</a>}
        {r.website && <a href={r.website} target="_blank" rel="noreferrer">Website →</a>}
      </div>

      {/* ── Contact & location ── */}
      <div className="result-row" style={{ marginBottom: 18 }}>
        {r.address && (
          <div className="result-item">
            <strong>Address</strong>
            <CopyBtn value={r.address} />
          </div>
        )}
        {r.phone && (
          <div className="result-item">
            <strong>Phone</strong>
            <CopyBtn value={r.phone} />
          </div>
        )}
        {r.phone_intl && r.phone_intl !== r.phone && (
          <div className="result-item">
            <strong>Intl. Phone</strong>
            <CopyBtn value={r.phone_intl} />
          </div>
        )}
        {coords && (
          <div className="result-item">
            <strong>Coordinates</strong>
            <CopyBtn value={coords} />
          </div>
        )}
        {r.plus_code && (
          <div className="result-item">
            <strong>Plus Code</strong>
            <CopyBtn value={r.plus_code} />
          </div>
        )}
      </div>

      {/* ── Address detail ── */}
      {(ad.bundesland || ad.landkreis || ad.postal_code) && (
        <div style={{ marginBottom: 18 }}>
          <strong style={{ display: 'block', marginBottom: 8, color: '#38bdf8' }}>Address Detail</strong>
          <div className="result-row">
            {ad.street && <div className="result-item"><strong>Street</strong><span>{ad.street_number ? `${ad.street} ${ad.street_number}` : ad.street}</span></div>}
            {ad.sublocality && <div className="result-item"><strong>District</strong><span>{ad.sublocality}</span></div>}
            {ad.city && <div className="result-item"><strong>City</strong><span>{ad.city}</span></div>}
            {ad.postal_code && <div className="result-item"><strong>PLZ</strong><span>{ad.postal_code}</span></div>}
            {ad.landkreis && <div className="result-item"><strong>Landkreis</strong><span>{ad.landkreis}</span></div>}
            {ad.bundesland && <div className="result-item"><strong>Bundesland</strong><span>{ad.bundesland}</span></div>}
            {ad.country && <div className="result-item"><strong>Country</strong><span>{ad.country} {ad.country_code ? `(${ad.country_code})` : ''}</span></div>}
          </div>
        </div>
      )}

      {/* ── Opening hours ── */}
      {r.opening_hours && (
        <div style={{ marginBottom: 18 }}>
          <strong style={{ display: 'block', marginBottom: 8, color: '#38bdf8' }}>Opening Hours</strong>
          <div className="result-row" style={{ marginBottom: 10 }}>
            {r.opening_hours.total_weekly_hours != null && (
              <div className="result-item">
                <strong>Weekly Hours</strong>
                <span>{r.opening_hours.total_weekly_hours}h</span>
              </div>
            )}
            {r.opening_hours.avg_daily_hours != null && (
              <div className="result-item">
                <strong>Avg / Day</strong>
                <span>{r.opening_hours.avg_daily_hours}h</span>
              </div>
            )}
            <div className="result-item">
              <strong>Weekends</strong>
              <span style={{ color: r.opening_hours.open_on_weekends ? '#4ade80' : '#f87171' }}>
                {r.opening_hours.open_on_weekends ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
          {r.opening_hours.weekday_text.length > 0 && (
            <div style={{ display: 'grid', gap: 3 }}>
              {r.opening_hours.weekday_text.map((line, i) => {
                const [day, ...rest] = line.split(': ');
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b', minWidth: 100 }}>{day}</span>
                    <span style={{ color: '#94a3b8' }}>{rest.join(': ')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Service attributes ── */}
      {services.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <strong style={{ display: 'block', marginBottom: 8, color: '#38bdf8' }}>Services &amp; Features</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {services.map(s => <ServiceBadge key={s.label} label={s.label} value={s.value} />)}
          </div>
        </div>
      )}

      {/* ── Review analysis ── */}
      {ra && ra.total > 0 && (
        <div style={{ marginBottom: 18 }}>
          <strong style={{ display: 'block', marginBottom: 8, color: '#38bdf8' }}>
            Review Analysis ({ra.total} sample reviews)
          </strong>
          <div className="result-row" style={{ marginBottom: 10 }}>
            <div className="result-item">
              <strong>Sentiment</strong>
              <span style={{ color: ra.sentiment_score != null && ra.sentiment_score > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                {ra.sentiment_score != null ? (ra.sentiment_score > 0 ? `+${ra.sentiment_score}` : String(ra.sentiment_score)) : '—'}
              </span>
            </div>
            <div className="result-item">
              <strong>Positive / Negative</strong>
              <span>
                <span style={{ color: '#4ade80' }}>{ra.positive}↑</span>
                {' / '}
                <span style={{ color: '#f87171' }}>{ra.negative}↓</span>
                {ra.neutral > 0 && <span style={{ color: '#94a3b8' }}> / {ra.neutral}→</span>}
              </span>
            </div>
            {ra.avg_review_length > 0 && (
              <div className="result-item">
                <strong>Avg Length</strong>
                <span>{ra.avg_review_length} chars</span>
              </div>
            )}
            {ra.tourist_ratio_pct != null && (
              <div className="result-item">
                <strong>Tourist Reviews</strong>
                <span>{ra.tourist_ratio_pct}%</span>
              </div>
            )}
            {ra.languages.length > 0 && (
              <div className="result-item">
                <strong>Languages</strong>
                <span>{ra.languages.join(', ')}</span>
              </div>
            )}
            {(ra.oldest_date || ra.newest_date) && (
              <div className="result-item">
                <strong>Date Range</strong>
                <span style={{ fontSize: '0.82rem' }}>{ra.oldest_date} → {ra.newest_date}</span>
              </div>
            )}
          </div>

          {/* Individual reviews */}
          {r.reviews.length > 0 && (
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {r.reviews.map((rv, i) => (
                <div key={i} style={{
                  background: '#0b1122',
                  border: '1px solid rgba(148,163,184,0.1)',
                  borderRadius: 10,
                  padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{rv.author || 'Anonymous'}</span>
                    <div style={{ display: 'flex', gap: 10, fontSize: '0.82rem', color: '#64748b' }}>
                      {rv.rating != null && <span style={{ color: '#fbbf24' }}>{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</span>}
                      {rv.relative_time && <span>{rv.relative_time}</span>}
                      {rv.language && rv.language !== 'de' && <span style={{ color: '#38bdf8' }}>[{rv.language}]</span>}
                    </div>
                  </div>
                  {rv.text && (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                      {rv.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Photos ── */}
      {r.photos.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <strong style={{ display: 'block', marginBottom: 8, color: '#38bdf8' }}>
            Photos ({r.photos_count} total, showing {r.photos.length})
          </strong>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 8,
          }}>
            {r.photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 10,
                    border: '1px solid rgba(148,163,184,0.15)',
                  }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Nearby competitors ── */}
      {r.competitors.length > 0 && (
        <div>
          <strong style={{ display: 'block', marginBottom: 10, color: '#38bdf8' }}>
            Nearby Competitors ({r.competitors.length})
          </strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
            {r.competitors.map((c, ci) => (
              <div key={ci} style={{
                background: '#0b1122',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: 14,
                padding: '12px 14px',
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: '#64748b', marginBottom: 6, flexWrap: 'wrap' }}>
                  {c.rating && <span style={{ color: '#fbbf24' }}>★ {c.rating}</span>}
                  {c.review_volume && <span>{Number(c.review_volume).toLocaleString('de-DE')} rev.</span>}
                  {c.category && <span>{c.category}</span>}
                </div>
                {c.address && <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 6, lineHeight: 1.4 }}>{c.address}</div>}
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>
                    Website →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<ExtractionData[]>([]);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    const urlList = parseUrls(urls);
    if (urlList.length === 0) {
      setError('Paste at least one Google Maps link.');
      return;
    }
    setLoading(true);
    setError('');
    setResults([]);
    const extracted: ExtractionData[] = [];
    for (let i = 0; i < urlList.length; i++) {
      setProgress(`Extracting ${i + 1} / ${urlList.length}…`);
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlList[i] }),
        });
        if (res.ok) extracted.push(await res.json());
      } catch (err) {
        console.error('Error extracting', urlList[i], err);
      }
    }
    setResults(extracted);
    setProgress('');
    setLoading(false);
    if (extracted.length === 0) setError('No results extracted. Check that the links are valid Google Maps URLs.');
  };

  const downloadJSON = () => {
    if (!results.length) return;
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(results, null, 2));
    a.download = 'firmadeal_export.json';
    a.click();
  };

  const downloadCSV = () => {
    if (!results.length) return;
    const headers = [
      'Name', 'Category', 'Rating', 'Reviews', 'Address', 'Phone',
      'PLZ', 'Landkreis', 'Bundesland', 'City', 'Country',
      'Latitude', 'Longitude', 'Website', 'Price Level',
      'Open Now', 'Weekly Hours', 'Sentiment', 'Tourist %',
      'Competitors', 'Place ID',
    ];
    const rows = results.map((r) => [
      r.name, r.category, r.rating, r.review_volume, r.address, r.phone,
      r.address_detail?.postal_code, r.address_detail?.landkreis, r.address_detail?.bundesland, r.city, r.country,
      r.latitude, r.longitude, r.website, r.price_level,
      r.is_open, r.opening_hours?.total_weekly_hours,
      r.review_analysis?.sentiment_score, r.review_analysis?.tourist_ratio_pct,
      r.competitor_count, r.place_id,
    ].map((v) => `"${v ?? ''}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'firmadeal_export.csv';
    a.click();
  };

  return (
    <main>
      <div className="page">
        {/* Header */}
        <div className="header">
          <h1>Firmadeal Extractor</h1>
          <p>Extract comprehensive business intelligence from Google Maps</p>
        </div>

        {/* Input panel */}
        <div className="panel">
          <label className="label">Paste Google Maps links</label>
          <textarea
            className="textarea"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={`https://maps.app.goo.gl/aEhAJeQvLueyFUcr6\nhttps://maps.app.goo.gl/...\n\nOne per line, or separated by spaces / commas`}
            rows={5}
          />
          <div className="button-row">
            <button className="button" onClick={handleExtract} disabled={loading}>
              {loading ? progress || 'Extracting…' : 'Extract Data'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div className="error-box">{error}</div>}

        {/* Results */}
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

        {/* How-to */}
        {results.length === 0 && !loading && (
          <div className="panel">
            <h3 style={{ color: '#38bdf8', marginBottom: 14, fontWeight: 700 }}>What you get</h3>
            <ul className="info-list">
              <li><span>📍</span>Full address breakdown: street, PLZ, Landkreis, Bundesland</li>
              <li><span>⭐</span>Rating, review count, price level, editorial summary</li>
              <li><span>🕐</span>Opening hours: weekly total, avg per day, weekend flag</li>
              <li><span>📊</span>Review analysis: sentiment score, languages, tourist ratio, date range</li>
              <li><span>🍽️</span>Service flags: delivery, dine-in, beer/wine, wheelchair access</li>
              <li><span>📸</span>Up to 10 place photos</li>
              <li><span>🏪</span>Up to 6 nearby competitors with ratings</li>
            </ul>
            <h3 style={{ color: '#38bdf8', margin: '20px 0 14px', fontWeight: 700 }}>How to use</h3>
            <ul className="info-list">
              <li><span>1.</span>Open a business on Google Maps, copy the link (Share button or address bar)</li>
              <li><span>2.</span>Paste one or more links above — newlines, spaces, or commas all work</li>
              <li><span>3.</span>Click <strong>Extract Data</strong> — results appear in ~3–5 s per link</li>
              <li><span>4.</span>Download as JSON or CSV for CRM import / due diligence</li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
