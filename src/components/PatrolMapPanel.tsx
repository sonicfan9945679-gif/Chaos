/// <reference types="google.maps" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  CalendarPlus,
  LocateFixed,
  MapPin,
  MessageSquare,
  Navigation,
  Search,
  Star,
} from 'lucide-react';

export interface DiscoveredPlace {
  id: string;
  name: string;
  address: string;
  position: { lat: number; lng: number };
  rating?: number | null;
  userRatingCount?: number | null;
  categoryLabel?: string | null;
  googleMapsURI?: string | null;
}

export interface RouteSummaryInfo {
  distanceText: string;
  durationText: string;
  travelMode: TravelModeOption;
  destinationName: string;
}

type TravelModeOption = 'WALKING' | 'DRIVING' | 'BICYCLING' | 'TRANSIT';

interface PatrolMapPanelProps {
  apiKey: string;
  onAskEeveeAboutPlace: (place: DiscoveredPlace, route?: RouteSummaryInfo | null) => void;
  onSchedulePlace: (place: DiscoveredPlace) => void;
}

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

const ERRAND_CATEGORIES: {
  id: string;
  label: string;
  primaryType: string;
  eeveeNote: string;
}[] = [
  {
    id: 'grocery',
    label: 'Grocery & Snacks',
    primaryType: 'supermarket',
    eeveeNote: 'Dinner inventory check',
  },
  {
    id: 'park',
    label: 'Parks & Patrol',
    primaryType: 'park',
    eeveeNote: 'Open sparring terrain',
  },
  {
    id: 'pet',
    label: 'Pet Supplies',
    primaryType: 'pet_store',
    eeveeNote: 'Treats & Master Ball care',
  },
  {
    id: 'cafe',
    label: 'Cafés & Takeout',
    primaryType: 'cafe',
    eeveeNote: 'Quick sustenance stop',
  },
];

function isQuotaExhaustedError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err ?? '');
  return (
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('429') ||
    text.includes('OverQuotaMapError') ||
    text.includes('QuotaExceededError')
  );
}

function normalizeLatLng(
  loc: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined
): { lat: number; lng: number } | null {
  if (!loc) return null;
  if (typeof (loc as google.maps.LatLng).toJSON === 'function') {
    const json = (loc as google.maps.LatLng).toJSON();
    return { lat: json.lat, lng: json.lng };
  }
  const literal = loc as google.maps.LatLngLiteral;
  if (typeof literal.lat === 'number' && typeof literal.lng === 'number') {
    return { lat: literal.lat, lng: literal.lng };
  }
  return null;
}

function toPlaceSummary(place: google.maps.places.Place): DiscoveredPlace | null {
  const pos = normalizeLatLng(place.location);
  if (!pos) return null;
  return {
    id: place.id || `${pos.lat},${pos.lng}`,
    name: place.displayName || 'Unnamed Location',
    address: place.formattedAddress || 'Address unavailable',
    position: pos,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    categoryLabel: place.primaryTypeDisplayName ?? null,
    googleMapsURI: place.googleMapsURI ?? null,
  };
}

interface PlaceMarkerProps {
  place: DiscoveredPlace;
  selected: boolean;
  onSelect: (place: DiscoveredPlace, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}

const PlaceMarker: React.FC<PlaceMarkerProps> = ({ place, selected, onSelect }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  return (
    <AdvancedMarker
      ref={markerRef}
      position={place.position}
      title={place.name}
      zIndex={selected ? 1000 : 10}
      onClick={() => onSelect(place, marker)}
    >
      <Pin
        background={selected ? '#DC2626' : '#1E293B'}
        borderColor={selected ? '#FCA5A5' : '#94A3B8'}
        glyphColor="#FFFFFF"
      />
    </AdvancedMarker>
  );
};

interface PatrolMapInnerProps {
  onAskEeveeAboutPlace: (place: DiscoveredPlace, route?: RouteSummaryInfo | null) => void;
  onSchedulePlace: (place: DiscoveredPlace) => void;
}

const PatrolMapInner: React.FC<PatrolMapInnerProps> = ({
  onAskEeveeAboutPlace,
  onSchedulePlace,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [originCenter, setOriginCenter] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [places, setPlaces] = useState<DiscoveredPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<DiscoveredPlace | null>(null);
  const [selectedMarker, setSelectedMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const [travelMode, setTravelMode] = useState<TravelModeOption>('WALKING');
  const [routeSummary, setRouteSummary] = useState<RouteSummaryInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const clearRoutePolylines = useCallback(() => {
    polylinesRef.current.forEach((p: google.maps.Polyline) => p.setMap(null));
    polylinesRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearRoutePolylines();
    };
  }, [clearRoutePolylines]);

  // Autocomplete suggestions via Places API (New) JS SDK + AutocompleteSessionToken
  useEffect(() => {
    if (!placesLib || !searchInput.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: searchInput.trim(),
          sessionToken: sessionTokenRef.current,
          locationBias: originCenter,
        });
        setSuggestions(res.suggestions ?? []);
      } catch (err: unknown) {
        if (isQuotaExhaustedError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [placesLib, searchInput, originCenter]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoNotice('Browser geolocation is unavailable.');
      return;
    }
    setGeoNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextCenter = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setOriginCenter(nextCenter);
        map?.panTo(nextCenter);
        map?.setZoom(14);
        setGeoNotice('Centered on your current location.');
      },
      () => {
        setGeoNotice('Location permission declined. Showing default patrol map area.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    setMapError(null);
    setIsSearching(true);

    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'viewport',
          'rating',
          'userRatingCount',
          'primaryTypeDisplayName',
          'googleMapsURI',
        ],
      });
      sessionTokenRef.current = null;
      setSuggestions([]);
      setSearchInput('');

      const summary = toPlaceSummary(place);
      if (summary) {
        setPlaces((prev) => [
          summary,
          ...prev.filter((item) => item.id !== summary.id),
        ]);
        setSelectedPlace(summary);
        setSelectedMarker(null);
        setInfoOpen(false);
        setRouteSummary(null);
        clearRoutePolylines();
        if (place.viewport) {
          map?.fitBounds(place.viewport);
        } else {
          map?.panTo(summary.position);
          map?.setZoom(15);
        }
      }
    } catch (err: unknown) {
      if (isQuotaExhaustedError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setMapError(
        err instanceof Error ? err.message : 'Unable to load place details.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleTextSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placesLib || !searchInput.trim()) return;
    setMapError(null);
    setIsSearching(true);
    setSuggestions([]);

    try {
      const { places: foundPlaces } = await placesLib.Place.searchByText({
        textQuery: searchInput.trim(),
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'rating',
          'userRatingCount',
          'primaryTypeDisplayName',
          'googleMapsURI',
        ],
        locationBias: originCenter,
        maxResultCount: 8,
        internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
      });

      const summaries = (foundPlaces ?? [])
        .map(toPlaceSummary)
        .filter((p): p is DiscoveredPlace => p !== null);

      setPlaces(summaries);
      setRouteSummary(null);
      clearRoutePolylines();

      if (summaries[0]) {
        setSelectedPlace(summaries[0]);
        map?.panTo(summaries[0].position);
        map?.setZoom(14);
      } else {
        setSelectedPlace(null);
        setMapError('No places matched that search in this area.');
      }
    } catch (err: unknown) {
      if (isQuotaExhaustedError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setMapError(
        err instanceof Error ? err.message : 'Unable to search places right now.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleCategorySearch = async (primaryType: string) => {
    if (!placesLib) return;
    setMapError(null);
    setIsSearching(true);
    setSuggestions([]);

    const currentCenter = map?.getCenter()?.toJSON() ?? originCenter;
    setOriginCenter(currentCenter);

    try {
      const { places: nearby } = await placesLib.Place.searchNearby({
        locationRestriction: {
          center: currentCenter,
          radius: 3000,
        },
        includedPrimaryTypes: [primaryType],
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'rating',
          'userRatingCount',
          'primaryTypeDisplayName',
          'googleMapsURI',
        ],
        maxResultCount: 8,
        internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
      });

      const summaries = (nearby ?? [])
        .map(toPlaceSummary)
        .filter((p): p is DiscoveredPlace => p !== null);

      setPlaces(summaries);
      setRouteSummary(null);
      clearRoutePolylines();

      if (summaries[0]) {
        setSelectedPlace(summaries[0]);
        map?.panTo(summaries[0].position);
        map?.setZoom(14);
      } else {
        setSelectedPlace(null);
        setMapError('No nearby locations found for that category within 3 km.');
      }
    } catch (err: unknown) {
      if (isQuotaExhaustedError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setMapError(
        err instanceof Error ? err.message : 'Unable to search nearby places.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleComputeRoute = async (
    targetPlace: DiscoveredPlace,
    modeOverride?: TravelModeOption
  ) => {
    if (!routesLib || !map) return;
    const activeMode = modeOverride ?? travelMode;
    setMapError(null);
    setIsRouting(true);
    clearRoutePolylines();

    try {
      const result = await routesLib.Route.computeRoutes({
        origin: originCenter,
        destination: targetPlace.position,
        travelMode: activeMode as google.maps.TravelModeString,
        fields: [
          'path',
          'distanceMeters',
          'durationMillis',
          'viewport',
          'legs',
          'localizedValues',
        ],
      });

      const primaryRoute = result.routes?.[0];
      if (!primaryRoute) {
        setMapError('No route found between your patrol origin and that destination.');
        setRouteSummary(null);
        return;
      }

      const newPolylines = primaryRoute.createPolylines({
        polylineOptions: {
          strokeColor: '#DC2626',
          strokeWeight: 5,
          strokeOpacity: 0.9,
        },
      });
      newPolylines.forEach((p: google.maps.Polyline) => p.setMap(map));
      polylinesRef.current = newPolylines;

      if (primaryRoute.viewport) {
        map.fitBounds(primaryRoute.viewport);
      }

      const distanceText =
        primaryRoute.localizedValues?.distance ||
        (primaryRoute.distanceMeters
          ? `${(primaryRoute.distanceMeters / 1000).toFixed(2)} km`
          : 'Distance ready');
      const durationText =
        primaryRoute.localizedValues?.duration ||
        (primaryRoute.durationMillis
          ? `${Math.max(1, Math.round(primaryRoute.durationMillis / 60000))} min`
          : 'Duration ready');

      setRouteSummary({
        distanceText,
        durationText,
        travelMode: activeMode,
        destinationName: targetPlace.name,
      });
    } catch (err: unknown) {
      if (isQuotaExhaustedError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setMapError(
        err instanceof Error ? err.message : 'Unable to compute route.'
      );
    } finally {
      setIsRouting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
            Patrol & Errands Map
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Scout real grocery stops, parks, and patrol routes via Google Maps Platform.
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseMyLocation}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-red-500/40 hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
        >
          <LocateFixed className="h-3.5 w-3.5 text-[var(--accent-text)]" />
          Use My Location
        </button>
      </div>

      {geoNotice && (
        <p className="text-xs text-[var(--text-muted)]">{geoNotice}</p>
      )}

      {/* Search & Autocomplete */}
      <form onSubmit={handleTextSearchSubmit} className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search nearby grocery stores, parks, cafés, or addresses…"
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchInput.trim()}
            className="min-h-[40px] rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            {isSearching ? 'Scanning…' : 'Search'}
          </button>
        </div>

        {suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] py-1 shadow-xl">
            {suggestions.map((s, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => void handleSelectSuggestion(s)}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                  <span className="truncate">
                    {s.placePrediction?.text.text ?? 'Place suggestion'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {/* Quick Errand Category Filters */}
      <div className="flex flex-wrap gap-2">
        {ERRAND_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            disabled={isSearching}
            onClick={() => void handleCategorySearch(cat.primaryType)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-red-500/40 hover:text-[var(--text-primary)] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            title={cat.eeveeNote}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {mapError && (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3.5 py-2 text-xs text-red-700 dark:text-red-200">
          {mapError}
        </p>
      )}

      {/* Map Container (Explicit Height Required) */}
      <div className="h-[380px] sm:h-[430px] w-full overflow-hidden rounded-lg border border-[var(--border-subtle)]">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={13}
          gestureHandling="greedy"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Patrol Origin Pin */}
          <AdvancedMarker position={originCenter} title="Patrol Origin">
            <Pin background="#0F172A" borderColor="#EF4444" glyphColor="#FCA5A5" />
          </AdvancedMarker>

          {/* Discovered Places Markers */}
          {places.map((p) => (
            <PlaceMarker
              key={p.id}
              place={p}
              selected={selectedPlace?.id === p.id}
              onSelect={(place, marker) => {
                setSelectedPlace(place);
                setSelectedMarker(marker);
                setInfoOpen(true);
              }}
            />
          ))}

          {infoOpen && selectedPlace && selectedMarker && (
            <InfoWindow
              anchor={selectedMarker}
              onCloseClick={() => setInfoOpen(false)}
            >
              <div className="max-w-[220px] p-1 text-slate-900">
                <p className="text-xs font-bold">{selectedPlace.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  {selectedPlace.address}
                </p>
                {selectedPlace.rating != null && (
                  <p className="mt-1 text-[11px] font-medium text-amber-700">
                    ★ {selectedPlace.rating} ({selectedPlace.userRatingCount ?? 0})
                  </p>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Selected Place & Route Controls */}
      {selectedPlace && (
        <div className="space-y-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                {selectedPlace.name}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {selectedPlace.address}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                {selectedPlace.categoryLabel && (
                  <span>{selectedPlace.categoryLabel}</span>
                )}
                {selectedPlace.rating != null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[var(--text-primary)]">
                      <Star className="h-3 w-3 text-amber-500" />
                      {selectedPlace.rating} ({selectedPlace.userRatingCount ?? 0})
                    </span>
                  </>
                )}
                {selectedPlace.googleMapsURI && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={selectedPlace.googleMapsURI}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-[var(--text-primary)]"
                    >
                      Open in Google Maps
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-0.5 text-[11px]">
              {(['WALKING', 'DRIVING', 'BICYCLING', 'TRANSIT'] as TravelModeOption[]).map(
                (mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setTravelMode(mode);
                      void handleComputeRoute(selectedPlace, mode);
                    }}
                    className={`rounded px-2 py-1 font-medium cursor-pointer ${
                      travelMode === mode
                        ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {mode === 'WALKING'
                      ? 'Walk'
                      : mode === 'DRIVING'
                        ? 'Drive'
                        : mode === 'BICYCLING'
                          ? 'Bike'
                          : 'Transit'}
                  </button>
                )
              )}
            </div>
          </div>

          {routeSummary && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs">
              <Navigation className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              <span className="font-semibold text-[var(--text-primary)]">
                {routeSummary.durationText}
              </span>
              <span aria-hidden="true" className="text-[var(--text-muted)]">
                ·
              </span>
              <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                {routeSummary.distanceText}
              </span>
              <span aria-hidden="true" className="text-[var(--text-muted)]">
                ·
              </span>
              <span className="text-[var(--text-muted)]">{routeSummary.travelMode}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isRouting}
              onClick={() => void handleComputeRoute(selectedPlace)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/40 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Navigation className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              {isRouting ? 'Computing Route…' : 'Plot Route'}
            </button>

            <button
              type="button"
              onClick={() => onSchedulePlace(selectedPlace)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/40 cursor-pointer whitespace-nowrap"
            >
              <CalendarPlus className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              Add to Calendar
            </button>

            <button
              type="button"
              onClick={() => onAskEeveeAboutPlace(selectedPlace, routeSummary)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask Eevee About This Place
            </button>
          </div>
        </div>
      )}

      {/* Search Results Strip */}
      {places.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {places.slice(0, 4).map((p) => {
            const active = selectedPlace?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPlace(p);
                  map?.panTo(p.position);
                  map?.setZoom(15);
                }}
                className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-red-500/60 bg-[var(--bg-elevated)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]'
                }`}
              >
                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                  {p.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                  {p.address}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const PatrolMapPanel: React.FC<PatrolMapPanelProps> = ({
  apiKey,
  onAskEeveeAboutPlace,
  onSchedulePlace,
}) => {
  if (!apiKey) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
        <MapPin className="h-8 w-8 text-[var(--accent-text)]" />
        <h2 className="mt-3 font-display text-base font-bold text-[var(--text-primary)]">
          Patrol Map Waiting for API Key
        </h2>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--text-muted)]">
          Restart the app or ensure your Google Maps Platform API key is configured in the environment.
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      libraries={['places', 'routes', 'marker']}
      language="en"
      region="US"
    >
      <PatrolMapInner
        onAskEeveeAboutPlace={onAskEeveeAboutPlace}
        onSchedulePlace={onSchedulePlace}
      />
    </APIProvider>
  );
};
