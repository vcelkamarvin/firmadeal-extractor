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
    const headers = ['Name', 'Category', 'Rating', 'Address', 'Phone', 'Latitude', 'Longitude'];
    const csvContent = [
      headers.join(','),
      ...results.map((r) =>
        [r.name, r.category, r.rating, r.address, r.phone, r.latitude, r.longitude]
          .map((v) => `"${v || ''}"`)
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
            {/* Export Buttons */}
            <div className="flex gap-3">
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
              <div className="flex-1"></div>
              <span className="text-gray-400 py-2">
                {results.length} business{results.length !== 1 ? 'es' : ''} extracted
              </span>
            </div>

            {/* Results Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-300 font-semibold">Business Name</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-semibold">Category</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-semibold">Address</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-semibold">Phone</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-semibold">Rating</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-semibold">Reviews</th>
                      <th className="px-4 py-3 text-left text-gray-300 font-semibold">Coords</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {results.map((result, idx) => (
                      <tr key={idx} className="hover:bg-slate-700/50 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white truncate max-w-xs">{result.name || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-300 truncate max-w-xs">{result.category || '-'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          <button
                            onClick={() => copyToClipboard(result.address || '')}
                            className="hover:text-blue-400 transition truncate max-w-xs block"
                            title="Click to copy"
                          >
                            {result.address || '-'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          <button
                            onClick={() => copyToClipboard(result.phone || '')}
                            className="hover:text-blue-400 transition font-mono"
                            title="Click to copy"
                          >
                            {result.phone || '-'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-yellow-400 text-xs">{result.rating || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 text-xs">{result.review_volume || '-'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                          <button
                            onClick={() => copyToClipboard(`${result.latitude},${result.longitude}`)}
                            className="hover:text-blue-400 transition"
                            title="Click to copy"
                          >
                            {result.latitude?.toFixed(3)}, {result.longitude?.toFixed(3)}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed View (Expandable) */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-lg font-bold text-blue-400 mb-4">Raw JSON Export</h3>
              <pre className="bg-slate-900 rounded p-4 text-xs text-gray-300 overflow-x-auto max-h-96">
                {JSON.stringify(results, null, 2)}
              </pre>
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
