import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  CloudRain,
  Compass,
  Droplets,
  ExternalLink,
  Eye,
  Gauge,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  RefreshCw,
  Search,
  Send,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { EeveelutionForm, ExpressionState } from '../data/eeveeData';
import type { TimePhase } from '../utils/timeOfDay';
import { TIME_PHASES } from '../utils/timeOfDay';

interface WeatherForecastPanelProps {
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  activePhase: TimePhase;
  localTimeDisplay: string;
  onApplyCharacterState: (state: {
    form?: EeveelutionForm;
    plate?: string;
    tera?: string;
    expression?: ExpressionState;
  }) => void;
  onSwitchToFreeChat: (handoffPrompt?: string) => void;
  modeSwitcher?: React.ReactNode;
}

interface WeatherAlertItem {
  alertId: string;
  title: string;
  eventType: string;
  areaName: string;
  severity: string;
  urgency: string;
  certainty: string;
  description: string;
  instruction: string[];
  safetyRecommendations: Array<{ directive: string; subtext: string }>;
  startTime: string;
  expirationTime: string;
  dataSource: {
    publisher: string;
    name: string;
    authorityUri: string;
  };
}

interface WeatherResponsePayload {
  location: {
    label: string;
    latitude: number;
    longitude: number;
    timeZoneId: string;
  };
  unitsSystem: 'IMPERIAL' | 'METRIC';
  current: {
    currentTime: string;
    timeZoneId: string;
    isDaytime: boolean;
    conditionType: string;
    conditionText: string;
    iconBaseUri: string;
    temp: number;
    feelsLike: number;
    tempUnit: string;
    humidity: number;
    uvIndex: number;
    precipPercent: number;
    precipType: string;
    precipQuantity: number;
    precipUnit: string;
    thunderstormProbability: number;
    pressureMb: number;
    windSpeed: number;
    windGust: number;
    windUnit: string;
    windCardinal: string;
    visibility: number;
    visibilityUnit: string;
    cloudCover: number;
    max24h: number | null;
    min24h: number | null;
  };
  hourly: Array<{
    timeLabel: string;
    hour24: number;
    isDaytime: boolean;
    temp: number;
    feelsLike: number;
    conditionText: string;
    conditionType: string;
    iconBaseUri: string;
    precipPercent: number;
    precipType: string;
    windSpeed: number;
    windUnit: string;
  }>;
  daily: Array<{
    dateLabel: string;
    weekdayLabel: string;
    maxTemp: number;
    minTemp: number;
    dayConditionText: string;
    dayConditionType: string;
    dayIconBaseUri: string;
    nightConditionText: string;
    dayPrecipPercent: number;
    nightPrecipPercent: number;
    dayWindSpeed: number;
    uvIndex: number;
    sunriseTime: string;
    sunsetTime: string;
    moonPhase: string;
  }>;
  alerts: WeatherAlertItem[];
  eeveeForecast: {
    forecastMonologue: string;
    hourlyOutlook: string;
    tacticalAdvice: string[];
    activeForm: EeveelutionForm;
    activePlate: string;
    activeTera: string;
    expression: ExpressionState;
    moveUsed: string | null;
  };
}

interface WeatherQAItem {
  id: string;
  question: string;
  reply: string;
  activeForm: EeveelutionForm;
  activePlate: string;
  moveUsed: string | null;
}

const QUICK_CITIES = [
  'San Francisco, CA',
  'Seattle, WA',
  'Tokyo, Japan',
  'New York, NY',
  'London, UK',
];

function renderFormattedText(content: string) {
  const lines = content.split('\n');
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={lineIdx} className="h-1.5" />;
    const segments = trimmed.split(/(\*[^*]+\*)/g);
    return (
      <p key={lineIdx} className="leading-relaxed">
        {segments.map((seg, segIdx) => {
          if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2) {
            return (
              <em key={segIdx} className="text-[var(--text-muted)] italic">
                {seg.slice(1, -1)}
              </em>
            );
          }
          return (
            <span key={segIdx} className="text-[var(--text-primary)]">
              {seg}
            </span>
          );
        })}
      </p>
    );
  });
}

function getWeatherIconSrc(iconBaseUri?: string): string | null {
  if (!iconBaseUri) return null;
  return `${iconBaseUri}.png`;
}

export const WeatherForecastPanel: React.FC<WeatherForecastPanelProps> = ({
  activeForm,
  activePlate,
  activeTera,
  activePhase,
  localTimeDisplay,
  onApplyCharacterState,
  onSwitchToFreeChat,
  modeSwitcher,
}) => {
  const { language, t } = useLanguage();
  const phaseInfo = TIME_PHASES[activePhase];

  const [locationInput, setLocationInput] = useState<string>('San Francisco, CA');
  const [unitsSystem, setUnitsSystem] = useState<'IMPERIAL' | 'METRIC'>('IMPERIAL');
  const [forecastData, setForecastData] = useState<WeatherResponsePayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [qaInput, setQaInput] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [qaHistory, setQaHistory] = useState<WeatherQAItem[]>([]);

  const fetchForecast = useCallback(
    async (opts: {
      locationQuery?: string;
      lat?: number;
      lng?: number;
      locationLabel?: string;
      units?: 'IMPERIAL' | 'METRIC';
    }) => {
      setIsLoading(true);
      setErrorMessage(null);
      const nextUnits = opts.units ?? unitsSystem;

      try {
        const res = await fetch('/api/weather-forecast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationQuery: opts.locationQuery ?? locationInput,
            lat: opts.lat,
            lng: opts.lng,
            locationLabel: opts.locationLabel,
            unitsSystem: nextUnits,
            activeForm,
            activePlate,
            activeTera,
            localTime: localTimeDisplay,
            timePhase: phaseInfo.label,
            languageCode: language.code,
          }),
        });

        const data = (await res.json()) as WeatherResponsePayload & {
          error?: string;
          quotaExceeded?: boolean;
        };

        if (res.status === 429 || data.quotaExceeded) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }

        if (!res.ok) {
          throw new Error(data.error || `Weather forecast failed (${res.status}).`);
        }

        setForecastData(data);
        setQaHistory([]);
        onApplyCharacterState({
          form: data.eeveeForecast.activeForm,
          plate: data.eeveeForecast.activePlate,
          tera: data.eeveeForecast.activeTera,
          expression: data.eeveeForecast.expression,
        });
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to retrieve live weather forecast.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      unitsSystem,
      locationInput,
      activeForm,
      activePlate,
      activeTera,
      localTimeDisplay,
      phaseInfo.label,
      language.code,
      onApplyCharacterState,
    ]
  );

  // Load initial weather forecast when opening panel
  useEffect(() => {
    if (!forecastData && !isLoading && !errorMessage) {
      void fetchForecast({ locationQuery: locationInput, units: unitsSystem });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Browser geolocation is not available in this environment.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocationInput(`${lat.toFixed(3)}, ${lng.toFixed(3)}`);
        void fetchForecast({
          lat,
          lng,
          locationLabel: `Your Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
          units: unitsSystem,
        });
      },
      () => {
        setIsLoading(false);
        setErrorMessage('Location permission denied. Enter any city or address above.');
      },
      { timeout: 10_000 }
    );
  };

  const handleToggleUnits = (nextUnits: 'IMPERIAL' | 'METRIC') => {
    if (nextUnits === unitsSystem) return;
    setUnitsSystem(nextUnits);
    if (forecastData) {
      void fetchForecast({
        lat: forecastData.location.latitude,
        lng: forecastData.location.longitude,
        locationLabel: forecastData.location.label,
        units: nextUnits,
      });
    }
  };

  const handleAskFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forecastData || !qaInput.trim() || isAsking) return;
    const questionText = qaInput.trim();
    setQaInput('');
    setIsAsking(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/weather-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          weatherContext: {
            location: forecastData.location.label,
            current: forecastData.current,
            nextHours: forecastData.hourly.slice(0, 6),
            daily: forecastData.daily.slice(0, 4),
            alerts: forecastData.alerts.map((a) => ({
              title: a.title,
              severity: a.severity,
              source: a.dataSource.name,
            })),
          },
          activeForm,
          activePlate,
          activeTera,
          localTime: localTimeDisplay,
          timePhase: phaseInfo.label,
          languageCode: language.code,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        reply: string;
        activeForm: EeveelutionForm;
        activePlate: string;
        activeTera: string;
        expression: ExpressionState;
        moveUsed: string | null;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Could not answer weather question.');
      }

      setQaHistory((prev) => [
        ...prev,
        {
          id: `wqa-${Date.now()}`,
          question: questionText,
          reply: data.reply,
          activeForm: data.activeForm,
          activePlate: data.activePlate,
          moveUsed: data.moveUsed,
        },
      ]);

      onApplyCharacterState({
        form: data.activeForm,
        plate: data.activePlate,
        tera: data.activeTera,
        expression: data.expression,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Weather Q&A failed.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleSendToFreeChat = () => {
    if (!forecastData) return;
    const c = forecastData.current;
    const prompt = `Look at today's weather forecast for ${forecastData.location.label}: currently ${c.temp}${c.tempUnit} (${c.conditionText}, feels like ${c.feelsLike}${c.tempUnit}), humidity ${c.humidity}%, rain chance ${c.precipPercent}%, wind ${c.windSpeed} ${c.windUnit}. Do we cancel outdoor errands today?`;
    onSwitchToFreeChat(prompt);
  };

  return (
    <section
      aria-label={t.weatherTitle}
      className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
    >
      {/* Header + Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-600/10 text-[var(--accent-text)]">
            <Cloud className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold text-[var(--text-primary)] truncate">
              {t.weatherTitle}
            </h2>
            <p className="text-xs text-[var(--text-muted)] truncate">{t.weatherSubtitle}</p>
          </div>
        </div>
        {modeSwitcher}
      </div>

      {/* Location Search & Unit Controls */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/50 px-5 py-4 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void fetchForecast({ locationQuery: locationInput, units: unitsSystem });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder={t.weatherSearchPlaceholder}
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-red-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>{t.weatherForecastBtn}</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleUseMyLocation}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-red-500/50 hover:text-[var(--text-primary)] disabled:opacity-50 cursor-pointer"
          >
            <Navigation className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            <span>{t.weatherUseLocation}</span>
          </button>

          <div
            role="group"
            aria-label="Temperature unit system"
            className="inline-flex rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-0.5"
          >
            <button
              type="button"
              onClick={() => handleToggleUnits('IMPERIAL')}
              className={`rounded-md px-2.5 py-1 text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                unitsSystem === 'IMPERIAL'
                  ? 'bg-red-600 text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              °F
            </button>
            <button
              type="button"
              onClick={() => handleToggleUnits('METRIC')}
              className={`rounded-md px-2.5 py-1 text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                unitsSystem === 'METRIC'
                  ? 'bg-red-600 text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              °C
            </button>
          </div>
        </form>

        {/* Quick Cities */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] mr-1">
            Presets:
          </span>
          {QUICK_CITIES.map((city) => (
            <button
              key={city}
              type="button"
              disabled={isLoading}
              onClick={() => {
                setLocationInput(city);
                void fetchForecast({ locationQuery: city, units: unitsSystem });
              }}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-red-500/50 hover:text-[var(--text-primary)] cursor-pointer"
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-5 space-y-5">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading && !forecastData && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--accent-text)]" />
            <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
              {t.weatherLoading}
            </p>
          </div>
        )}

        {forecastData && (
          <>
            {/* Active Public Weather Alerts with Mandatory Official Source Attribution */}
            {forecastData.alerts.length > 0 && (
              <div className="space-y-2.5">
                {forecastData.alerts.map((alert) => (
                  <div
                    key={alert.alertId}
                    className="rounded-xl border border-amber-500/45 bg-amber-500/10 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="font-display text-sm font-bold">{alert.title}</span>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                        {alert.severity} · {alert.urgency}
                      </span>
                    </div>
                    {alert.areaName && (
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        Area: {alert.areaName}
                      </p>
                    )}
                    {alert.description && (
                      <p className="text-xs leading-relaxed text-[var(--text-secondary)] line-clamp-4">
                        {alert.description}
                      </p>
                    )}
                    {alert.instruction.length > 0 && (
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        {alert.instruction[0]}
                      </p>
                    )}
                    <p className="pt-1 text-xs text-[var(--text-muted)]">
                      Source:{' '}
                      <a
                        href={alert.dataSource.authorityUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-amber-400 underline hover:text-amber-300"
                      >
                        <span>{alert.dataSource.name}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Current Conditions Banner + Eevee Live Forecast */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Live Telemetry Card */}
              <div className="lg:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-text)]">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{forecastData.location.label}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                        {forecastData.location.timeZoneId || 'Local Telemetry'}
                      </p>
                    </div>
                    {getWeatherIconSrc(forecastData.current.iconBaseUri) ? (
                      <img
                        src={getWeatherIconSrc(forecastData.current.iconBaseUri)!}
                        alt={forecastData.current.conditionText}
                        className="h-12 w-12 shrink-0 object-contain"
                      />
                    ) : (
                      <Sun className="h-10 w-10 text-amber-400" />
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-display text-4xl font-bold tracking-tight tabular-nums text-[var(--text-primary)]">
                      {forecastData.current.temp}
                      {forecastData.current.tempUnit}
                    </span>
                    <div className="text-xs text-[var(--text-secondary)]">
                      <div className="font-semibold text-[var(--text-primary)]">
                        {forecastData.current.conditionText}
                      </div>
                      <div className="tabular-nums text-[var(--text-muted)]">
                        Feels like {forecastData.current.feelsLike}
                        {forecastData.current.tempUnit}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--border-subtle)] pt-3 text-xs">
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Droplets className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                    <span className="tabular-nums">
                      Humidity {forecastData.current.humidity}% · Rain{' '}
                      {forecastData.current.precipPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Wind className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="tabular-nums">
                      {forecastData.current.windSpeed} {forecastData.current.windUnit}{' '}
                      {forecastData.current.windCardinal}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="tabular-nums">
                      UV {forecastData.current.uvIndex} · Cloud {forecastData.current.cloudCover}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Eye className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                    <span className="tabular-nums">
                      Vis {forecastData.current.visibility} {forecastData.current.visibilityUnit}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Gauge className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                    <span className="tabular-nums">
                      {forecastData.current.pressureMb} mb
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Thermometer className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <span className="tabular-nums">
                      {forecastData.current.max24h !== null && forecastData.current.min24h !== null
                        ? `24h ${forecastData.current.min24h}° / ${forecastData.current.max24h}°`
                        : `Storm ${forecastData.current.thunderstormProbability}%`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Eevee's Live Broadcast Card */}
              <div className="lg:col-span-7 rounded-xl border border-red-500/30 bg-[var(--bg-elevated)] p-4 flex flex-col justify-between gap-3">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-[var(--accent-text)]" />
                      <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        Eevee’s Today Forecast
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                      Form: {forecastData.eeveeForecast.activeForm} ·{' '}
                      {forecastData.eeveeForecast.activePlate}
                    </span>
                  </div>

                  <div className="text-sm space-y-1.5">
                    {renderFormattedText(forecastData.eeveeForecast.forecastMonologue)}
                  </div>

                  {forecastData.eeveeForecast.hourlyOutlook && (
                    <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)]">Outlook: </strong>
                      {forecastData.eeveeForecast.hourlyOutlook}
                    </p>
                  )}

                  {forecastData.eeveeForecast.tacticalAdvice.length > 0 && (
                    <ul className="space-y-1 pt-1">
                      {forecastData.eeveeForecast.tacticalAdvice.map((tip, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-[var(--text-secondary)]"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                  {forecastData.eeveeForecast.moveUsed ? (
                    <span className="text-[11px] font-semibold text-[var(--accent-text)]">
                      {t.chatMoveExecuted}: {forecastData.eeveeForecast.moveUsed}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Expression: {forecastData.eeveeForecast.expression}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSendToFreeChat}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-red-500/60 cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    <span>{t.weatherDiscussInChat}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Hourly Strip */}
            {forecastData.hourly.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Next Hours
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
                  {forecastData.hourly.map((hr, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-2.5 text-center"
                    >
                      <span className="text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">
                        {hr.timeLabel}
                      </span>
                      {getWeatherIconSrc(hr.iconBaseUri) ? (
                        <img
                          src={getWeatherIconSrc(hr.iconBaseUri)!}
                          alt={hr.conditionText}
                          className="my-1.5 h-7 w-7 object-contain"
                        />
                      ) : (
                        <CloudRain className="my-1.5 h-5 w-5 text-sky-400" />
                      )}
                      <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
                        {hr.temp}°
                      </span>
                      <span className="mt-0.5 text-[10px] tabular-nums text-sky-400">
                        {hr.precipPercent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7-Day Daily Forecast */}
            {forecastData.daily.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  7-Day Daily Forecast
                </h3>
                <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  {forecastData.daily.map((day, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 text-xs"
                    >
                      <div className="col-span-4 sm:col-span-3">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {day.weekdayLabel}
                        </span>
                        <span className="ml-2 text-[var(--text-muted)] tabular-nums">
                          {day.dateLabel}
                        </span>
                      </div>
                      <div className="col-span-4 sm:col-span-4 flex items-center gap-2 min-w-0">
                        {getWeatherIconSrc(day.dayIconBaseUri) && (
                          <img
                            src={getWeatherIconSrc(day.dayIconBaseUri)!}
                            alt={day.dayConditionText}
                            className="h-6 w-6 shrink-0 object-contain"
                          />
                        )}
                        <span className="truncate text-[var(--text-secondary)]">
                          {day.dayConditionText}
                        </span>
                      </div>
                      <div className="col-span-2 text-right tabular-nums text-sky-400 font-medium">
                        {day.dayPrecipPercent}% rain
                      </div>
                      <div className="col-span-2 sm:col-span-3 text-right tabular-nums font-semibold">
                        <span className="text-[var(--text-primary)]">{day.maxTemp}°</span>
                        <span className="mx-1 text-[var(--text-muted)]">/</span>
                        <span className="text-[var(--text-muted)]">{day.minTemp}°</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Weather Q&A */}
            <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
              {qaHistory.length > 0 && (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {qaHistory.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-2 text-xs"
                    >
                      <div className="font-semibold text-[var(--text-secondary)]">
                        {t.chatYouOwner}: {item.question}
                      </div>
                      <div className="text-sm">{renderFormattedText(item.reply)}</div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAskFollowup} className="flex items-center gap-2">
                <input
                  type="text"
                  value={qaInput}
                  onChange={(e) => setQaInput(e.target.value)}
                  placeholder={t.weatherAskPlaceholder}
                  disabled={isAsking}
                  className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-red-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isAsking || !qaInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                >
                  {isAsking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>{t.chatSend}</span>
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
