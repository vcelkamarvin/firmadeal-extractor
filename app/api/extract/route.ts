import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';
const PLACES_SEARCH = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_NEARBY = 'https://places.googleapis.com/v1/places:searchNearby';

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location',
  'rating', 'userRatingCount', 'priceLevel', 'businessStatus',
  'nationalPhoneNumber', 'internationalPhoneNumber',
  'websiteUri', 'currentOpeningHours', 'types',
  'editorialSummary', 'reviews',
].join(',');

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE:    '€',
  PRICE_LEVEL_MODERATE:       '€€',
  PRICE_LEVEL_EXPENSIVE:      '€€€',
  PRICE_LEVEL_VERY_EXPENSIVE: '€€€€',
};

interface ExtractionPayload {
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
  competitors: any[];
  search_interest: string | null;
  spot_category: string | null;
  price_level: string | null;
  website: string | null;
  is_open: boolean | null;
  summary: string | null;
}

// ── Step 1: resolve short URL → full Google Maps URL ─────────────────────────
async function resolveUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Firmadeal/1.0)' },
    });
    return r.url || url;
  } catch {
    return url;
  }
}

// ── Step 2: extract name + coords from Maps URL ───────────────────────────────
function parseMapUrl(url: string): { name: string | null; lat: number | null; lng: number | null } {
  const nameMatch = url.match(/\/maps\/place\/([^/@?]+)/);
  const name = nameMatch
    ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).replace(/\s+/g, ' ').trim()
    : null;

  const coordsMatch = url.match(/@(-?[0-9.]+),(-?[0-9.]+)/);
  const lat = coordsMatch ? parseFloat(coordsMatch[1]) : null;
  const lng = coordsMatch ? parseFloat(coordsMatch[2]) : null;

  return { name, lat, lng };
}

// ── Step 3: Places text search ────────────────────────────────────────────────
async function placesTextSearch(query: string, lat: number | null, lng: number | null): Promise<any | null> {
  const body: any = {
    textQuery: query,
    maxResultCount: 1,
    languageCode: 'de',
  };
  if (lat !== null && lng !== null) {
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius: 500.0 },
    };
  }

  const r = await fetch(PLACES_SEARCH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': `places.${DETAIL_FIELDS.split(',').join(',places.')}`,
    },
    body: JSON.stringify(body),
  });

  const data = await r.json();
  return data.places?.[0] ?? null;
}

// ── Step 4: fetch nearby competitors ─────────────────────────────────────────
async function nearbyCompetitors(lat: number, lng: number, types: string[]): Promise<any[]> {
  const primaryType = types.find(t =>
    ['lodging', 'restaurant', 'cafe', 'bar', 'bakery', 'car_repair', 'dentist', 'pharmacy', 'hair_care'].includes(t)
  ) ?? types[0] ?? 'establishment';

  const r = await fetch(PLACES_NEARBY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.formattedAddress',
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 800.0 },
      },
      includedTypes: [primaryType],
      maxResultCount: 8,
      languageCode: 'de',
    }),
  });

  const data = await r.json();
  return (data.places ?? []).map((p: any) => ({
    name: p.displayName?.text ?? null,
    url: p.websiteUri ?? null,
    address: p.formattedAddress ?? null,
    rating: p.rating ? String(p.rating) : null,
    review_volume: p.userRatingCount ? String(p.userRatingCount) : null,
    category: null,
    distance: null,
  }));
}

// ── Derive city from address ──────────────────────────────────────────────────
function parseAddress(address: string | null): { city: string | null; region: string | null; country: string | null } {
  if (!address) return { city: null, region: null, country: null };
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  return {
    country: parts.at(-1) ?? null,
    city:    parts.at(-2)?.replace(/^\d{4,5}\s*/, '') ?? null,
    region:  parts.at(-3) ?? null,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
async function extractFromUrl(inputUrl: string): Promise<ExtractionPayload> {
  const payload: ExtractionPayload = {
    name: null, category: null, rating: null, review_volume: null,
    address: null, phone: null, latitude: null, longitude: null,
    resolved_url: inputUrl, city: null, region: null, country: null,
    competitor_count: 0, competitors: [],
    search_interest: null, spot_category: null,
    price_level: null, website: null, is_open: null, summary: null,
  };

  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is not set');
  }

  // 1. Resolve short URL
  const fullUrl = await resolveUrl(inputUrl);
  payload.resolved_url = fullUrl;

  // 2. Parse name + coordinates from URL
  const { name: urlName, lat: urlLat, lng: urlLng } = parseMapUrl(fullUrl);

  // 3. Search Places API
  const searchQuery = urlName ?? inputUrl;
  const place = await placesTextSearch(searchQuery, urlLat, urlLng);

  if (!place) {
    payload.name = urlName;
    payload.latitude = urlLat;
    payload.longitude = urlLng;
    return payload;
  }

  // 4. Populate payload from Places API response
  payload.name          = place.displayName?.text ?? null;
  payload.address       = place.formattedAddress ?? null;
  payload.phone         = place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null;
  payload.website       = place.websiteUri ?? null;
  payload.rating        = place.rating != null ? String(place.rating) : null;
  payload.review_volume = place.userRatingCount != null ? String(place.userRatingCount) : null;
  payload.price_level   = PRICE_MAP[place.priceLevel ?? ''] ?? null;
  payload.is_open       = place.currentOpeningHours?.openNow ?? null;
  payload.summary       = place.editorialSummary?.text ?? null;
  payload.latitude      = place.location?.latitude ?? urlLat;
  payload.longitude     = place.location?.longitude ?? urlLng;

  // Category from types
  const types: string[] = place.types ?? [];
  payload.category = types[0]?.replace(/_/g, ' ') ?? null;

  // Address breakdown
  const { city, region, country } = parseAddress(payload.address);
  payload.city    = city;
  payload.region  = region;
  payload.country = country;

  // Search interest label
  if (payload.category) {
    payload.search_interest = payload.city
      ? `${payload.category} in ${payload.city}`
      : payload.category;
    payload.spot_category = payload.category;
  }

  // 5. Nearby competitors
  if (payload.latitude !== null && payload.longitude !== null) {
    const competitors = await nearbyCompetitors(payload.latitude, payload.longitude, types);
    // Remove the target itself
    payload.competitors = competitors.filter(c => c.name !== payload.name).slice(0, 6);
    payload.competitor_count = payload.competitors.length;
  }

  return payload;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    const data = await extractFromUrl(url);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { error: 'Extraction failed', details: String(error) },
      { status: 500 }
    );
  }
}
