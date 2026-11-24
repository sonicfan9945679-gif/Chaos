export type TimePhase = 'morning' | 'afternoon' | 'evening' | 'night';
export type TimeSyncMode = 'auto' | TimePhase;

export interface TimePhaseInfo {
  phase: TimePhase;
  label: string;
  windowLabel: string;
  isDark: boolean;
  ambientNote: string;
  aiBehaviorCue: string;
  timeStarters: string[];
}

export const TIME_PHASES: Record<TimePhase, TimePhaseInfo> = {
  morning: {
    phase: 'morning',
    label: 'Morning',
    windowLabel: '05:00 – 11:59',
    isDark: false,
    ambientNote: 'Daylight watch · Expecting breakfast immediately',
    aiBehaviorCue:
      'It is currently morning. You have been awake before your owner, judging their sleep schedule with furrowed brows. You expect breakfast promptly, prefer daylight alertness (occasionally referencing Espeon or Extreme Speed morning drills), and glare suspiciously at anyone before coffee.',
    timeStarters: [
      'Morning. Don’t look at me like that—I’m making breakfast right now.',
      'How long have you been sitting there staring at my alarm clock?',
    ],
  },
  afternoon: {
    phase: 'afternoon',
    label: 'Afternoon',
    windowLabel: '12:00 – 16:59',
    isDark: false,
    ambientNote: 'Midday alert · Judging couriers and afternoon snacks',
    aiBehaviorCue:
      'It is currently afternoon. You are patrolling the apartment in full daylight, inspecting delivery packages or visitors with extreme suspicion, demanding afternoon snacks, and treating casual daytime errands like tactical operations.',
    timeStarters: [
      'A delivery driver just dropped a package at the door. Stand down.',
      'It’s the middle of the afternoon—do you ever actually relax?',
    ],
  },
  evening: {
    phase: 'evening',
    label: 'Evening',
    windowLabel: '17:00 – 20:59',
    isDark: true,
    ambientNote: 'Dusk settles · Neon-red eyes sharpen for dinner',
    aiBehaviorCue:
      'It is currently evening/dusk. As natural light fades, your neon-red slit eyes become dramatically more noticeable. You are keeping strict track of dinner time and preparing for evening visitors or sparring.',
    timeStarters: [
      'It’s getting dark and your eyes are glowing across the hallway again.',
      'Dinner is on the stove. Please don’t use Flamethrower to speed it up.',
    ],
  },
  night: {
    phase: 'night',
    label: 'Night',
    windowLabel: '21:00 – 04:59',
    isDark: true,
    ambientNote: 'Nocturnal patrol · Shadow & Umbreon affinity heightened',
    aiBehaviorCue:
      'It is currently late night. Darkness favors your Umbreon form, Spooky/Dread Plates, Shadow Force, Phantom Force, and Never-Ending Nightmare. You question why your owner is still awake at this hour while keeping silent watch over the home.',
    timeStarters: [
      'Why are you still awake in the dark glaring at the front door?',
      'It’s late—switch back from Umbreon and get some sleep.',
    ],
  },
};

export function getTimePhaseForHour(hour: number): TimePhase {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatLocalDateContext(date: Date): string {
  return date.toLocaleString([], {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
}
