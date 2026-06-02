'use client';

import { useState } from 'react';

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
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExtractionData | null>(null);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    if (!url.trim()) {
      setError('Please enter a Google Maps URL');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Extraction failed');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    if (!data) return;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2)));
    element.setAttribute('download', 'institutional_target.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Firmadeal Extractor
          </h1>
          <p className="text-gray-400 text-lg">
            Extract institutional-grade business intelligence from Google Maps
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 mb-8">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Google Maps Link
          </label>
          <textarea
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste your Google Maps link here (e.g., https://maps.app.goo.gl/aEhAJeQvLueyFUcr6)"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-none"
            rows={3}
          />
          
          <button
            onClick={handleExtract}
            disabled={loading}
            className="mt-4 w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105 disabled:scale-100"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-8 text-red-300">
            {error}
          </div>
        )}

        {/* Results Section */}
        {data && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-blue-400">Extraction Results</h2>
              <button
                onClick={downloadJSON}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Download JSON
              </button>
            </div>

            <div className="space-y-4">
              {/* Business Name */}
              {data.name && (
                <div className="border-b border-slate-700 pb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Business Name
                  </label>
                  <p className="text-xl text-white">{data.name}</p>
                </div>
              )}

              {/* Category */}
              {data.category && (
                <div className="border-b border-slate-700 pb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Category
                  </label>
                  <p className="text-white">{data.category}</p>
                </div>
              )}

              {/* Rating */}
              {data.rating && (
                <div className="border-b border-slate-700 pb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Rating
                  </label>
                  <p className="text-white">{data.rating}</p>
                </div>
              )}

              {/* Review Volume */}
              {data.review_volume && (
                <div className="border-b border-slate-700 pb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Review Volume
                  </label>
                  <p className="text-white">{data.review_volume}</p>
                </div>
              )}

              {/* Address */}
              {data.address && (
                <div className="border-b border-slate-700 pb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Address
                  </label>
                  <p className="text-white">{data.address}</p>
                </div>
              )}

              {/* Phone */}
              {data.phone && (
                <div className="border-b border-slate-700 pb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Phone
                  </label>
                  <p className="text-white">{data.phone}</p>
                </div>
              )}

              {/* Coordinates */}
              {(data.latitude || data.longitude) && (
                <div className="border-b border-slate-700 pb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Geographic Coordinates
                  </label>
                  <p className="text-white font-mono">
                    {data.latitude?.toFixed(6)}, {data.longitude?.toFixed(6)}
                  </p>
                  <a
                    href={`https://www.google.com/maps/@${data.latitude},${data.longitude},15z`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
                  >
                    Open in Google Maps →
                  </a>
                </div>
              )}

              {/* Raw JSON */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Raw JSON Output
                </label>
                <pre className="bg-slate-900 rounded p-4 text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-slate-800 rounded-lg border border-slate-700 p-8">
          <h3 className="text-xl font-bold text-blue-400 mb-4">How It Works</h3>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start">
              <span className="text-cyan-400 mr-3">→</span>
              <span>Paste your Google Maps shortened link or full URL</span>
            </li>
            <li className="flex items-start">
              <span className="text-cyan-400 mr-3">→</span>
              <span>The system navigates using a headless browser and extracts data via ARIA labels</span>
            </li>
            <li className="flex items-start">
              <span className="text-cyan-400 mr-3">→</span>
              <span>Coordinates are parsed directly from the URL for maximum stability</span>
            </li>
            <li className="flex items-start">
              <span className="text-cyan-400 mr-3">→</span>
              <span>Output is instantly available as structured JSON for your valuation pipeline</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Institutional Data Extraction Engine • Firmadeal 2024</p>
        </div>
      </div>
    </main>
  );
}
