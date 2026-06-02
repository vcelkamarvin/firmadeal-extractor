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

export default function Home() {
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ExtractionData[]>([]);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    const urlList = urls
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urlList.length === 0) {
      setError('Please enter at least one Google Maps URL');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const extractedResults: ExtractionData[] = [];

      for (const url of urlList) {
        try {
          const response = await fetch('/api/extract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });

          if (response.ok) {
            const data = await response.json();
            extractedResults.push(data);
          }
        } catch (err) {
          console.error(`Error extracting ${url}:`, err);
        }
      }

      setResults(extractedResults);
      if (extractedResults.length === 0) {
        setError('No results extracted. Check URLs and try again.');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    if (results.length === 0) return;
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(results, null, 2))
    );
    element.setAttribute('download', 'extracted_businesses.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadCSV = () => {
    if (results.length === 0) return;
    const headers = ['Name', 'Category', 'City', 'Region', 'Country', 'Rating', 'Reviews', 'Address', 'Phone', 'Latitude', 'Longitude', 'CompetitorCount'];
    const csvContent = [
      headers.join(','),
      ...results.map((r) =>
        [r.name, r.category, r.city, r.region, r.country, r.rating, r.review_volume, r.address, r.phone, r.latitude, r.longitude, r.competitor_count]
          .map((v) => `"${v ?? ''}"`)
          .join(',')
      ),
    ].join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', 'extracted_businesses.csv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Firmadeal Extractor</h1>
          <p className="text-gray-400">Batch extract business data from Google Maps</p>
        </div>

        {/* Input Section */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Google Maps Links (one per line)
          </label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://maps.app.goo.gl/aEhAJeQvLueyFUcr6
https://maps.app.goo.gl/..."
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-vertical"
            rows={6}
          />

          <button
            onClick={handleExtract}
            disabled={loading}
            className="mt-4 w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition transform hover:scale-105 disabled:scale-100"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Extracting...
              </span>
            ) : (
              'Extract Data'
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6 text-red-300">
            {error}
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-gray-300">
                Extracted {results.length} business{results.length !== 1 ? 'es' : ''}. Copy values directly or export them for your workflow.
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={downloadJSON}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Download JSON
                </button>
                <button
                  onClick={downloadCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => {
                    setResults([]);
                    setUrls('');
                    setError('');
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid gap-6">
              {results.map((result, idx) => {
                const coords =
                  result.latitude != null && result.longitude != null
                    ? `${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`
                    : '-';

                return (
                  <div key={idx} className="bg-slate-800 rounded-3xl border border-slate-700 p-6 shadow-xl">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <h2 className="text-2xl font-semibold text-white">
                          {result.name || 'Untitled business'}
                        </h2>
                        <p className="text-gray-400">{result.category || 'Category not available'}</p>
                        {result.resolved_url ? (
                          <a
                            href={result.resolved_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300"
                          >
                            Open Google Maps listing
                          </a>
                        ) : null}
                      </div>

                      <div className="grid gap-2 text-sm text-gray-300 text-left sm:text-right">
                        <span>{result.rating || '-'} rating</span>
                        <span>{result.review_volume || '-'} reviews</span>
                        <span>{result.competitor_count ?? 0} competitors</span>
                        <span>
                          {result.city || '-'} / {result.region || '-'} / {result.country || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Address</div>
                        <button
                          onClick={() => copyToClipboard(result.address || '')}
                          className="text-sm text-gray-100 text-left hover:text-blue-300 transition w-full"
                          title="Click to copy"
                        >
                          {result.address || 'Not available'}
                        </button>
                      </div>
                      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Phone</div>
                        <button
                          onClick={() => copyToClipboard(result.phone || '')}
                          className="text-sm text-gray-100 text-left hover:text-blue-300 transition w-full"
                          title="Click to copy"
                        >
                          {result.phone || 'Not available'}
                        </button>
                      </div>
                      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Coordinates</div>
                        <button
                          onClick={() => copyToClipboard(coords)}
                          className="text-sm text-gray-100 text-left hover:text-blue-300 transition w-full"
                          title="Click to copy"
                        >
                          {coords}
                        </button>
                      </div>
                      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Search Interest</div>
                        <div className="text-sm text-gray-100">{result.search_interest || 'Auto-generated search interest unavailable'}</div>
                      </div>
                    </div>

                    {result.competitors.length > 0 && (
                      <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4">
                        <div className="mb-3 text-sm font-semibold text-white">Detected competitors</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {result.competitors.map((competitor, compIndex) => (
                            <div key={compIndex} className="rounded-2xl border border-slate-800 bg-slate-800 p-4">
                              <div className="font-medium text-white truncate">{competitor.name}</div>
                              <div className="text-xs text-slate-400 truncate">
                                {competitor.category || 'Unknown category'}
                              </div>
                              <div className="text-xs text-slate-500">
                                {competitor.rating || competitor.review_volume || 'No rating data'}
                              </div>
                              {competitor.url ? (
                                <a
                                  href={competitor.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                                >
                                  Open listing →
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info Section */}
        {results.length === 0 && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-4">How to Use</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start">
                <span className="text-cyan-400 mr-3">1.</span>
                <span>Paste Google Maps links (one per line)</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-3">2.</span>
                <span>Click "Extract Data" to batch process</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-3">3.</span>
                <span>Click any cell to copy data instantly</span>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-3">4.</span>
                <span>Download as JSON or CSV for your pipeline</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
