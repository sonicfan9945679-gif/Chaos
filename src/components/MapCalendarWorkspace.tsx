import React, { useState } from 'react';
import { PatrolMapPanel, type DiscoveredPlace, type RouteSummaryInfo } from './PatrolMapPanel';
import { CalendarSchedulePanel } from './CalendarSchedulePanel';

interface MapCalendarWorkspaceProps {
  mapsApiKey: string;
  onAskEeveeAboutPlace: (place: DiscoveredPlace, route?: RouteSummaryInfo | null) => void;
  onDiscussScheduleWithEevee: (eventsSummary: string) => void;
}

export const MapCalendarWorkspace: React.FC<MapCalendarWorkspaceProps> = ({
  mapsApiKey,
  onAskEeveeAboutPlace,
  onDiscussScheduleWithEevee,
}) => {
  const [prefillLocation, setPrefillLocation] = useState<{
    name: string;
    address: string;
  } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--text-primary)]">
            Field Ops: Patrol Map & Google Calendar
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Plan real errands with Google Maps Platform, manage your Google Calendar, and feed live context directly to The Anomalous Eevee.
          </p>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]">
          Includes Google Maps features subject to{' '}
          <a
            href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--text-primary)]"
          >
            Google Maps End User Terms
          </a>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <PatrolMapPanel
            apiKey={mapsApiKey}
            onAskEeveeAboutPlace={onAskEeveeAboutPlace}
            onSchedulePlace={(place) =>
              setPrefillLocation({ name: place.name, address: place.address })
            }
          />
        </div>

        <div className="lg:col-span-5">
          <CalendarSchedulePanel
            prefillLocation={prefillLocation}
            onClearPrefill={() => setPrefillLocation(null)}
            onDiscussScheduleWithEevee={onDiscussScheduleWithEevee}
          />
        </div>
      </div>
    </div>
  );
};
