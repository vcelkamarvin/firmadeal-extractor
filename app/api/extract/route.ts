import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

const KEY            = process.env.GOOGLE_MAPS_API_KEY ?? '';
const SEARCH_URL     = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_URL     = 'https://places.googleapis.com/v1/places:searchNearby';
const PHOTO_BASE     = 'https://places.googleapis.com/v1';

// All fields we want — billed per field group by Google
const SEARCH_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.location',
  'places.plusCode',
  'places.addressComponents',
  'places.rating',
  'places.userRatingCount',
  'places.reviews',
  'places.currentOpeningHours',
  'places.regularOpeningHours',
  'places.priceLevel',
  'places.types',
  'places.editorialSummary',
  'places.delivery',
  'places.dineIn',
  'places.takeout',
  'places.reservable',
  'places.servesBeer',
  'places.servesBreakfast',
  'places.servesBrunch',
  'places.servesDinner',
  'places.servesLunch',
  'places.servesWine',
  'places.accessibilityOptions',
  'places.curbsidePickup',
  'places.photos',
  'places.utcOffsetMinutes',
].join(',');

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE:    '€',
  PRICE_LEVEL_MODERATE:       '€€',
  PRICE_LEVEL_EXPENSIVE:      '€€€',
  PRICE_LEVEL_VERY_EXPENSIVE: '€€€€',
};

// ── Interfaces ────────────────────────────────────────────────────────────────

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

export interface CompetitorData {
  name: string | null;
  url: string | null;
  address: string | null;
  rating: string | null;
  review_volume: string | null;
  category: string | null;
  distance: string | null;
}

export interface ExtractionPayload {
  // Identity
  place_id: string | null;
  name: string | null;
  types: string[];
  category: string | null;
  business_status: string | null;
  summary: string | null;

  // Contact
  address: string | null;
  vicinity: string | null;
  phone: string | null;
  phone_intl: string | null;
  website: string | null;
  google_maps_url: string | null;
  resolved_url: string | null;

  // Location
  latitude: number | null;
  longitude: number | null;
  plus_code: string | null;
  address_detail: AddressDetail;

  // Legacy compat (used in CSV export / pipeline)
  city: string | null;
  region: string | null;
  country: string | null;

  // Ratings
  rating: string | null;
  review_volume: string | null;
  price_level: string | null;
  price_level_num: number | null;

  // Reviews
  reviews: ReviewData[];
  review_analysis: ReviewAnalysis | null;

  // Opening hours
  opening_hours: HoursData | null;
  is_open: boolean | null;

  // Service attributes
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

  // Photos
  photos: string[];
  photos_count: number;

  // Market context
  competitor_count: number | null;
  competitors: CompetitorData[];
  search_interest: string | null;
  spot_category: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function parseMapUrl(url: string): { name: string | null; lat: number | null; lng: number | null } {
  const nameMatch = url.match(/\/maps\/place\/([^/@?]+)/);
  const name = nameMatch
    ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).replace(/\s+/g, ' ').trim()
    : null;
  const coordsMatch = url.match(/@(-?[0-9.]+),(-?[0-9.]+)/);
  return {
    name,
    lat: coordsMatch ? parseFloat(coordsMatch[1]) : null,
    lng: coordsMatch ? parseFloat(coordsMatch[2]) : null,
  };
}

function parseAddressComponents(components: any[]): AddressDetail {
  const get = (type: string, short = false) => {
    const c = components.find((c: any) => c.types?.includes(type));
    return c ? (short ? c.shortText : c.longText) ?? null : null;
  };
  return {
    street_number: get('street_number'),
    street:        get('route'),
    sublocality:   get('sublocality') ?? get('sublocality_level_1'),
    city:          get('locality') ?? get('postal_town'),
    bundesland:    get('administrative_area_level_1'),
    landkreis:     get('administrative_area_level_2') ?? get('administrative_area_level_3'),
    postal_code:   get('postal_code'),
    country:       get('country'),
    country_code:  get('country', true),
  };
}

function calcOpeningHours(periods: any[], weekdayText: string[], openNow: boolean | null): HoursData {
  let totalMinutes = 0;
  let openOnWeekends = false;

  for (const period of (periods ?? [])) {
    const open  = period.open;
    const close = period.close;
    if (!open || !close) continue;
    const day = open.day ?? 0;
    if (day === 0 || day === 6) openOnWeekends = true;
    const openMins  = (open.hour  ?? 0) * 60 + (open.minute  ?? 0);
    let   closeMins = (close.hour ?? 0) * 60 + (close.minute ?? 0);
    if (closeMins <= openMins) closeMins += 24 * 60;
    totalMinutes += closeMins - openMins;
  }

  const totalHours   = totalMinutes / 60;
  const daysOpen     = (periods ?? []).length;

  return {
    weekday_text:      weekdayText ?? [],
    open_now:          openNow,
    total_weekly_hours: totalHours > 0 ? Math.round(totalHours * 10) / 10 : null,
    open_on_weekends:  openOnWeekends,
    avg_daily_hours:   daysOpen > 0 ? Math.round(totalHours / daysOpen * 10) / 10 : null,
  };
}

function analyzeReviews(reviews: any[]): ReviewAnalysis {
  if (!reviews.length) {
    return { total: 0, positive: 0, negative: 0, neutral: 0, sentiment_score: null,
             avg_review_length: 0, oldest_date: null, newest_date: null,
             languages: [], tourist_ratio_pct: null };
  }

  const positive = reviews.filter(r => (r.rating ?? 0) >= 4).length;
  const negative = reviews.filter(r => (r.rating ?? 0) <= 2).length;
  const neutral  = reviews.length - positive - negative;
  const sentimentScore = Math.round((positive - negative) / reviews.length * 100) / 100;

  const texts = reviews.map(r => (r.text?.text ?? r.text ?? '') as string);
  const avgLength = Math.round(texts.reduce((s, t) => s + t.length, 0) / reviews.length);

  const times = reviews
    .map(r => r.publishTime)
    .filter(Boolean)
    .map((t: string) => new Date(t).getTime())
    .sort((a: number, b: number) => a - b);
  const oldest = times[0]
    ? new Date(times[0]).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
    : null;
  const newest = times[times.length - 1]
    ? new Date(times[times.length - 1]).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
    : null;

  const langs = [...new Set(reviews.map(r =>
    r.originalText?.languageCode ?? r.text?.languageCode ?? 'de'
  ).filter(Boolean))] as string[];

  const nonDe = reviews.filter(r => {
    const lang = r.originalText?.languageCode ?? r.text?.languageCode ?? 'de';
    return lang !== 'de';
  }).length;
  const touristRatio = Math.round(nonDe / reviews.length * 100);

  return { total: reviews.length, positive, negative, neutral, sentiment_score: sentimentScore,
           avg_review_length: avgLength, oldest_date: oldest, newest_date: newest,
           languages: langs, tourist_ratio_pct: touristRatio };
}

function buildPhotoUrls(photos: any[]): string[] {
  return (photos ?? []).slice(0, 10).map((p: any) =>
    `${PHOTO_BASE}/${p.name}/media?maxWidthPx=600&key=${KEY}`
  );
}

// ── Places API calls ──────────────────────────────────────────────────────────

async function placesTextSearch(query: string, lat: number | null, lng: number | null): Promise<any | null> {
  const body: any = { textQuery: query, maxResultCount: 1, languageCode: 'de' };
  if (lat !== null && lng !== null) {
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius: 500.0 },
    };
  }

  const r = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': SEARCH_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Places API error ${r.status}: ${err}`);
  }

  const data = await r.json();
  return data.places?.[0] ?? null;
}

async function nearbyCompetitors(lat: number, lng: number, types: string[]): Promise<CompetitorData[]> {
  const primaryType = types.find(t =>
    ['lodging', 'restaurant', 'cafe', 'bar', 'bakery', 'car_repair', 'car_dealer',
     'dentist', 'pharmacy', 'hair_care', 'beauty_salon', 'gym'].includes(t)
  ) ?? types[0] ?? 'establishment';

  const r = await fetch(NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.formattedAddress,places.types',
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

  if (!r.ok) return [];
  const data = await r.json();

  return (data.places ?? []).map((p: any) => ({
    name:          p.displayName?.text ?? null,
    url:           p.websiteUri ?? null,
    address:       p.formattedAddress ?? null,
    rating:        p.rating != null ? String(p.rating) : null,
    review_volume: p.userRatingCount != null ? String(p.userRatingCount) : null,
    category:      (p.types?.[0] ?? '').replace(/_/g, ' ') || null,
    distance:      null,
  }));
}

// ── Main extraction ───────────────────────────────────────────────────────────

async function extractFromUrl(inputUrl: string): Promise<ExtractionPayload> {
  if (!KEY) throw new Error('GOOGLE_MAPS_API_KEY is not configured');

  const blank: AddressDetail = {
    street_number: null, street: null, sublocality: null, city: null,
    bundesland: null, landkreis: null, postal_code: null, country: null, country_code: null,
  };

  const payload: ExtractionPayload = {
    place_id: null, name: null, types: [], category: null, business_status: null, summary: null,
    address: null, vicinity: null, phone: null, phone_intl: null, website: null,
    google_maps_url: null, resolved_url: inputUrl,
    latitude: null, longitude: null, plus_code: null, address_detail: blank,
    city: null, region: null, country: null,
    rating: null, review_volume: null, price_level: null, price_level_num: null,
    reviews: [], review_analysis: null,
    opening_hours: null, is_open: null,
    delivery: null, dine_in: null, takeout: null, reservable: null,
    serves_beer: null, serves_breakfast: null, serves_brunch: null,
    serves_dinner: null, serves_lunch: null, serves_wine: null,
    wheelchair_accessible: null, curbside_pickup: null,
    photos: [], photos_count: 0,
    competitor_count: null, competitors: [],
    search_interest: null, spot_category: null,
  };

  // 1. Resolve short URL
  const fullUrl = await resolveUrl(inputUrl);
  payload.resolved_url = fullUrl;

  // 2. Extract name + coords from URL path
  const { name: urlName, lat: urlLat, lng: urlLng } = parseMapUrl(fullUrl);

  // 3. Places text search
  const place = await placesTextSearch(urlName ?? fullUrl, urlLat, urlLng);
  if (!place) {
    payload.name = urlName;
    payload.latitude = urlLat;
    payload.longitude = urlLng;
    return payload;
  }

  // ── Identity ────────────────────────────────────────────────────────────────
  payload.place_id        = place.id ?? null;
  payload.name            = place.displayName?.text ?? null;
  payload.types           = place.types ?? [];
  payload.category        = (place.types?.[0] ?? '').replace(/_/g, ' ') || null;
  payload.business_status = place.businessStatus ?? null;
  payload.summary         = place.editorialSummary?.text ?? null;

  // ── Contact ─────────────────────────────────────────────────────────────────
  payload.address         = place.formattedAddress ?? null;
  payload.vicinity        = place.shortFormattedAddress ?? null;
  payload.phone           = place.nationalPhoneNumber ?? null;
  payload.phone_intl      = place.internationalPhoneNumber ?? null;
  payload.website         = place.websiteUri ?? null;
  payload.google_maps_url = place.googleMapsUri ?? null;

  // ── Location ────────────────────────────────────────────────────────────────
  payload.latitude  = place.location?.latitude  ?? urlLat;
  payload.longitude = place.location?.longitude ?? urlLng;
  payload.plus_code = place.plusCode?.compoundCode ?? place.plusCode?.globalCode ?? null;

  if (place.addressComponents?.length) {
    const ad = parseAddressComponents(place.addressComponents);
    payload.address_detail = ad;
    payload.city    = ad.city;
    payload.region  = ad.bundesland;
    payload.country = ad.country;
  }

  // ── Ratings ─────────────────────────────────────────────────────────────────
  payload.rating        = place.rating != null ? String(place.rating) : null;
  payload.review_volume = place.userRatingCount != null ? String(place.userRatingCount) : null;
  payload.price_level   = PRICE_MAP[place.priceLevel ?? ''] ?? null;
  payload.price_level_num = place.priceLevel
    ? Object.keys(PRICE_MAP).indexOf(place.priceLevel)
    : null;

  // ── Reviews ─────────────────────────────────────────────────────────────────
  const rawReviews: any[] = place.reviews ?? [];
  payload.reviews = rawReviews.map((r: any) => ({
    author:        r.authorAttribution?.displayName ?? null,
    photo_url:     r.authorAttribution?.photoUri ?? null,
    rating:        r.rating ?? null,
    text:          r.text?.text ?? null,
    language:      r.originalText?.languageCode ?? r.text?.languageCode ?? null,
    date:          r.publishTime
                     ? new Date(r.publishTime).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })
                     : null,
    relative_time: r.relativePublishTimeDescription ?? null,
  }));
  payload.review_analysis = analyzeReviews(rawReviews);

  // ── Opening hours ───────────────────────────────────────────────────────────
  const hours = place.currentOpeningHours ?? place.regularOpeningHours;
  if (hours) {
    payload.is_open       = hours.openNow ?? null;
    payload.opening_hours = calcOpeningHours(hours.periods, hours.weekdayDescriptions, hours.openNow ?? null);
  }

  // ── Service attributes ──────────────────────────────────────────────────────
  payload.delivery    = place.delivery    ?? null;
  payload.dine_in     = place.dineIn      ?? null;
  payload.takeout     = place.takeout     ?? null;
  payload.reservable  = place.reservable  ?? null;
  payload.serves_beer      = place.servesBeer      ?? null;
  payload.serves_breakfast = place.servesBreakfast ?? null;
  payload.serves_brunch    = place.servesBrunch    ?? null;
  payload.serves_dinner    = place.servesDinner    ?? null;
  payload.serves_lunch     = place.servesLunch     ?? null;
  payload.serves_wine      = place.servesWine      ?? null;
  payload.wheelchair_accessible = place.accessibilityOptions?.wheelchairAccessibleEntrance ?? null;
  payload.curbside_pickup  = place.curbsidePickup  ?? null;

  // ── Photos ──────────────────────────────────────────────────────────────────
  payload.photos       = buildPhotoUrls(place.photos ?? []);
  payload.photos_count = (place.photos ?? []).length;

  // ── Search interest ─────────────────────────────────────────────────────────
  if (payload.category) {
    payload.search_interest = payload.city
      ? `${payload.category} in ${payload.city}`
      : payload.category;
    payload.spot_category = payload.category;
  }

  // ── Nearby competitors ──────────────────────────────────────────────────────
  if (payload.latitude !== null && payload.longitude !== null && payload.types.length) {
    const all = await nearbyCompetitors(payload.latitude, payload.longitude, payload.types);
    payload.competitors = all.filter(c => c.name !== payload.name).slice(0, 6);
    payload.competitor_count = payload.competitors.length;
  }

  return payload;
}

// ── Route handler ─────────────────────────────────────────────────────────────

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
