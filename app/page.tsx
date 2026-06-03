'use client';

import { useState } from 'react';

interface CompetitorData {
  name: string;
  rating: string | null;
  review_volume: string | null;
  category: string | null;
  distance: string | null;
  url: string | null;
}

interface ExtractionData {
  name: string | null;
  category: string | null;
  rating: string | null;
  review_volume: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  resolved_url: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  competitor_count: number | null;
  competitors: CompetitorData[];
  search_interest: string | null;
  spot_category: string | null;
}

function parseUrls(raw: string): string[] {
  // Accept any separator: newlines, commas, spaces
  return raw
    .split(/[\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http') || u.startsWith('maps.'));
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

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
        if (res.ok) {
          extracted.push(await res.json());
        }
      } catch (err) {
        console.error('Error extracting', urlList[i], err);
      }
    }

    setResults(extracted);
    setProgress('');
    setLoading(false);

    if (extracted.length === 0) {
      setError('No results extracted. Check that the links are valid Google Maps URLs.');
    }
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
    const headers = ['Name', 'Category', 'Rating', 'Reviews', 'Address', 'Phone', 'Latitude', 'Longitude', 'City', 'Region', 'Country', 'Competitors'];
    const rows = results.map((r) =>
      [r.name, r.category, r.rating, r.review_volume, r.address, r.phone, r.latitude, r.longitude, r.city, r.region, r.country, r.competitor_count]
        .map((v) => `"${v ?? ''}"`)
        .join(',')
    );
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
          <p>Extract business data from Google Maps at scale</p>
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
              <p>
                {results.length} business{results.length !== 1 ? 'es' : ''} extracted — click any value to copy
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="button" onClick={downloadJSON}>
                  Download JSON
                </button>
                <button className="button" onClick={downloadCSV}>
                  Download CSV
                </button>
                <button
                  className="button secondary"
                  onClick={() => { setResults([]); setUrls(''); setError(''); }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="results-grid">
              {results.map((r, idx) => {
                const coords =
                  r.latitude != null && r.longitude != null
                    ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`
                    : null;

                const location = [r.city, r.region, r.country].filter(Boolean).join(', ');

                return (
                  <div key={idx} className="result-card">
                    <h2>{r.name || 'Unknown business'}</h2>
                    <p>{r.category || 'Category not available'}</p>

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
                      {r.rating && (
                        <span style={{ color: '#fbbf24' }}>★ {r.rating}</span>
                      )}
                      {r.review_volume && (
                        <span style={{ color: '#94a3b8' }}>{r.review_volume} reviews</span>
                      )}
                      {location && (
                        <span style={{ color: '#94a3b8' }}>{location}</span>
                      )}
                      {r.competitor_count != null && r.competitor_count > 0 && (
                        <span style={{ color: '#94a3b8' }}>{r.competitor_count} nearby</span>
                      )}
                    </div>

                    {r.resolved_url && (
                      <a href={r.resolved_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem' }}>
                        Open in Google Maps →
                      </a>
                    )}

                    <div className="result-row" style={{ marginTop: 16 }}>
                      <div className="result-item">
                        <strong>Address</strong>
                        <button
                          onClick={() => copyToClipboard(r.address || '')}
                          title="Click to copy"
                          style={{ background: 'none', padding: 0, borderRadius: 0, color: '#cbd5e1', fontSize: '0.9rem', textAlign: 'left' }}
                        >
                          {r.address || '—'}
                        </button>
                      </div>

                      <div className="result-item">
                        <strong>Phone</strong>
                        <button
                          onClick={() => copyToClipboard(r.phone || '')}
                          title="Click to copy"
                          style={{ background: 'none', padding: 0, borderRadius: 0, color: '#cbd5e1', fontSize: '0.9rem', textAlign: 'left' }}
                        >
                          {r.phone || '—'}
                        </button>
                      </div>

                      {coords && (
                        <div className="result-item">
                          <strong>Coordinates</strong>
                          <button
                            onClick={() => copyToClipboard(coords)}
                            title="Click to copy"
                            style={{ background: 'none', padding: 0, borderRadius: 0, color: '#cbd5e1', fontSize: '0.9rem', textAlign: 'left' }}
                          >
                            {coords}
                          </button>
                        </div>
                      )}

                      {r.search_interest && (
                        <div className="result-item">
                          <strong>Search Interest</strong>
                          <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{r.search_interest}</span>
                        </div>
                      )}
                    </div>

                    {r.competitors.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <strong style={{ display: 'block', marginBottom: 10 }}>
                          Nearby businesses ({r.competitors.length})
                        </strong>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                          {r.competitors.map((c, ci) => (
                            <div
                              key={ci}
                              style={{
                                background: '#0b1122',
                                border: '1px solid rgba(148,163,184,0.12)',
                                borderRadius: 14,
                                padding: '12px 14px',
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.name}
                              </div>
                              {c.url && (
                                <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>
                                  Open →
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* How-to when empty */}
        {results.length === 0 && !loading && (
          <div className="panel">
            <h3 style={{ color: '#38bdf8', marginBottom: 14, fontWeight: 700 }}>How to use</h3>
            <ul className="info-list">
              <li>
                <span>1.</span>
                Open a business on Google Maps, copy the link from the address bar or the Share button
              </li>
              <li>
                <span>2.</span>
                Paste one or more links above — any format works (newlines, spaces, or commas)
              </li>
              <li>
                <span>3.</span>
                Click <strong>Extract Data</strong> and wait ~10–15 s per link
              </li>
              <li>
                <span>4.</span>
                Click any field to copy it, or export the full dataset as JSON / CSV
              </li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
