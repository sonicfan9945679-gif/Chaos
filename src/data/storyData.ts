import type { EeveelutionForm, ExpressionState } from './eeveeData';

export interface StoryBeat {
  id: string;
  speaker: 'narrator' | 'eevee';
  text: string;
  form?: EeveelutionForm;
  plate?: string;
  tera?: string;
  expression?: ExpressionState;
  moveUsed?: string | null;
}

export interface StoryChoice {
  id: string;
  label: string;
  tacticalTag: string;
  nextNodeId: string;
}

export interface StoryNode {
  id: string;
  title: string;
  beats: StoryBeat[];
  choices?: StoryChoice[];
  endingSummary?: {
    title: string;
    outcome: string;
    chatHandoffPrompt: string;
  };
}

export interface StoryArc {
  id: string;
  title: string;
  subtitle: string;
  setting: string;
  startNodeId: string;
  nodes: Record<string, StoryNode>;
}

export const STORY_ARCS: StoryArc[] = [
  {
    id: 'dinner-guests',
    title: 'The Surprise Dinner Guests',
    subtitle: 'Your friends show up early while Eevee is already demanding food.',
    setting: 'Living Room · 18:45 · Master Ball on the End Table',
    startNodeId: 'guests-arrive',
    nodes: {
      'guests-arrive': {
        id: 'guests-arrive',
        title: 'Chapter 1 · Knock at the Door',
        beats: [
          {
            id: 'g1',
            speaker: 'narrator',
            text: 'Three knocks echo from the hallway. Before you can stand up, The Anomalous Eevee drops off the sofa in a textbook combat stance, neon-red slit eyes locked on the deadbolt.',
            form: 'Eevee',
            plate: 'None (Base)',
            tera: 'Normal',
            expression: 'Combat-Ready',
            moveUsed: null,
          },
          {
            id: 'g2',
            speaker: 'eevee',
            text: '“You told me tonight was a quiet evening. I specifically cleared my evening schedule for dinner at seven. Who is standing on our welcome mat?”',
            form: 'Eevee',
            plate: 'Mind Plate',
            tera: 'Psychic',
            expression: 'Stern',
            moveUsed: 'Mind Reader',
          },
          {
            id: 'g3',
            speaker: 'eevee',
            text: '*A soft violet pulse radiates from his fur as he reads the visitor’s mind through the door.* “Oh, wonderful. Your friend Marcus. And he brought a camera to film ‘your cute little Eevee.’”',
            form: 'Espeon',
            plate: 'Mind Plate',
            tera: 'Psychic',
            expression: 'Judging You',
            moveUsed: null,
          },
        ],
        choices: [
          {
            id: 'c-honest',
            label: 'Warn Marcus honestly before opening the door',
            tacticalTag: 'Diplomatic Briefing',
            nextNodeId: 'guests-warn',
          },
          {
            id: 'c-masterball',
            label: 'Hold up the Master Ball and ask Eevee to wait inside for five minutes',
            tacticalTag: 'Containment Request',
            nextNodeId: 'guests-ball',
          },
          {
            id: 'c-flex',
            label: 'Let Eevee greet him as-is so Marcus learns immediately',
            tacticalTag: 'Shock & Awe',
            nextNodeId: 'guests-greet',
          },
        ],
      },
      'guests-warn': {
        id: 'guests-warn',
        title: 'Chapter 2 · The Disclaimer',
        beats: [
          {
            id: 'gw1',
            speaker: 'narrator',
            text: 'You crack the door two inches and whisper that your Eevee does not appreciate baby talk, sudden camera flashes, or being picked up.',
            form: 'Eevee',
            plate: 'None (Base)',
            tera: 'Normal',
            expression: 'Stern',
            moveUsed: null,
          },
          {
            id: 'gw2',
            speaker: 'eevee',
            text: '*He reverts back to his compact Eevee form, hops onto the console table at eye level, and bares his fangs at Marcus as the door opens.* “Good evening, Marcus. Put the phone away before I use Taunt in front of the neighbors.”',
            form: 'Eevee',
            plate: 'Dread Plate',
            tera: 'Dark',
            expression: 'Mocking Smile',
            moveUsed: 'Taunt',
          },
        ],
        choices: [
          {
            id: 'c-order-food',
            label: 'Order takeout immediately to appease everyone',
            tacticalTag: 'Peace Offering',
            nextNodeId: 'end-truce',
          },
          {
            id: 'c-spar-demo',
            label: 'Tell Marcus he can ask one question about Eevee’s abilities',
            tacticalTag: 'Controlled Demo',
            nextNodeId: 'end-respect',
          },
        ],
      },
      'guests-ball': {
        id: 'guests-ball',
        title: 'Chapter 2 · The Master Ball Negotiation',
        beats: [
          {
            id: 'gb1',
            speaker: 'eevee',
            text: '*His glowing red eyes drop from your face to the Master Ball in your hand. The room drops ten degrees as frost forms on the coffee table.* “You want me to sit in a Master Ball like an unruly Growlithe because Marcus lacks basic survival instincts?”',
            form: 'Glaceon',
            plate: 'Icicle Plate',
            tera: 'Ice',
            expression: 'Judging You',
            moveUsed: null,
          },
          {
            id: 'gb2',
            speaker: 'eevee',
            text: '*He sighs through his nose, melts the frost cleanly, and teleports directly onto the top of the refrigerator behind you.* “Fine. Five minutes. Double portion of salmon afterward.”',
            form: 'Eevee',
            plate: 'None (Base)',
            tera: 'Psychic',
            expression: 'Demanding Dinner',
            moveUsed: 'Teleport',
          },
        ],
        choices: [
          {
            id: 'c-deal',
            label: 'Agree to double salmon and greet Marcus calmly',
            tacticalTag: 'Contract Signed',
            nextNodeId: 'end-truce',
          },
          {
            id: 'c-counter',
            label: 'Ask Eevee to stop spying from on top of the fridge',
            tacticalTag: 'Kitchen Standoff',
            nextNodeId: 'end-fridge',
          },
        ],
      },
      'guests-greet': {
        id: 'guests-greet',
        title: 'Chapter 2 · The Reality Check',
        beats: [
          {
            id: 'gg1',
            speaker: 'narrator',
            text: 'You swing the door open. Marcus raises his phone and coos, “Aww, look at the little guy—”',
            form: 'Sylveon',
            plate: 'Pixie Plate',
            tera: 'Fairy',
            expression: 'Mocking Smile',
            moveUsed: null,
          },
          {
            id: 'gg2',
            speaker: 'eevee',
            text: '*In half a second he shifts into Sylveon—ribbons snapping taut like steel cables while retaining the exact same murderous slit-eyed scowl—then sparks a tiny Draco Plate Judgment sphere over one paw just to make a point.*',
            form: 'Sylveon',
            plate: 'Draco Plate',
            tera: 'Stellar',
            expression: 'Mocking Smile',
            moveUsed: 'Judgment',
          },
          {
            id: 'gg3',
            speaker: 'eevee',
            text: '“Say ‘aww’ one more time, Marcus. I dare you.”',
            form: 'Eevee',
            plate: 'None (Base)',
            tera: 'Normal',
            expression: 'Stern',
            moveUsed: null,
          },
        ],
        choices: [
          {
            id: 'c-laugh',
            label: 'Tell Marcus he brought snacks and should offer them quickly',
            tacticalTag: 'De-escalation',
            nextNodeId: 'end-respect',
          },
          {
            id: 'c-dinner',
            label: 'Send Marcus to the kitchen to start prepping dinner',
            tacticalTag: 'Tactical Chore',
            nextNodeId: 'end-fridge',
          },
        ],
      },
      'end-truce': {
        id: 'end-truce',
        title: 'Ending · Household Truce',
        beats: [
          {
            id: 'et1',
            speaker: 'eevee',
            text: '*Seated on the dining chair like an armed bodyguard, Eevee inspects the salmon bowl, takes a bite, and grudgingly allows Marcus to survive the evening.*',
            form: 'Eevee',
            plate: 'None (Base)',
            tera: 'Normal',
            expression: 'Demanding Dinner',
            moveUsed: null,
          },
        ],
        endingSummary: {
          title: 'Ending A · Respectable Dinner Host',
          outcome: 'You kept the peace, Marcus learned not to test your pet, and Eevee got his salmon on schedule.',
          chatHandoffPrompt: 'Marcus just left after dinner. Admit it—you actually handled tonight well without using Hyper Beam once.',
        },
      },
      'end-respect': {
        id: 'end-respect',
        title: 'Ending · Feared & Respected',
        beats: [
          {
            id: 'er1',
            speaker: 'eevee',
            text: '*Marcus sits motionless on the opposite end of the couch, addressing Eevee exclusively as “sir” for the rest of the night. Eevee looks deeply satisfied.*',
            form: 'Eevee',
            plate: 'Draco Plate',
            tera: 'Stellar',
            expression: 'Mocking Smile',
            moveUsed: 'Extreme Speed',
          },
        ],
        endingSummary: {
          title: 'Ending B · Formal Respect Achieved',
          outcome: 'Marcus now understands why your household pet rides in a Master Ball.',
          chatHandoffPrompt: 'Did you really have to make Marcus call you "sir" for two hours straight?',
        },
      },
      'end-fridge': {
        id: 'end-fridge',
        title: 'Ending · Kitchen Supervisor',
        beats: [
          {
            id: 'ef1',
            speaker: 'eevee',
            text: '*Perched atop the refrigerator as Flareon, he lights the stove burner from four feet away with a surgically controlled Will-O-Wisp.* “Hurry up. The rice is taking too long.”',
            form: 'Flareon',
            plate: 'Flame Plate',
            tera: 'Fire',
            expression: 'Stern',
            moveUsed: 'Will-O-Wisp',
          },
        ],
        endingSummary: {
          title: 'Ending C · Overqualified Sous-Chef',
          outcome: 'Dinner finished in record time under strict elemental supervision.',
          chatHandoffPrompt: 'Please stop using Will-O-Wisp on the kitchen stove when we have guests over.',
        },
      },
    },
  },
  {
    id: 'midnight-patrol',
    title: 'The Midnight Shadow Patrol',
    subtitle: 'A noise on the balcony triggers an over-engineered nocturnal sweep.',
    setting: 'Apartment Balcony · 01:20 · Moonlit Skyline',
    startNodeId: 'patrol-alert',
    nodes: {
      'patrol-alert': {
        id: 'patrol-alert',
        title: 'Chapter 1 · Acoustic Anomaly',
        beats: [
          {
            id: 'mp1',
            speaker: 'narrator',
            text: 'At 1:20 AM, a metallic clatter echoes from the fire escape. Before your feet hit the floor, Eevee melts into the shadows as Umbreon, faint crimson glow pulsing beneath his dark fur.',
            form: 'Umbreon',
            plate: 'Spooky Plate',
            tera: 'Ghost',
            expression: 'Combat-Ready',
            moveUsed: 'Shadow Sneak',
          },
          {
            id: 'mp2',
            speaker: 'eevee',
            text: '“Stay behind me. Either a wild Murkrow knocked over the watering can, or someone is about to regret testing this building’s perimeter.”',
            form: 'Umbreon',
            plate: 'Dread Plate',
            tera: 'Dark',
            expression: 'Stern',
            moveUsed: null,
          },
        ],
        choices: [
          {
            id: 'c-scan',
            label: 'Tell him to scan first with Mind Reader—no holes in the balcony wall',
            tacticalTag: 'Recon First',
            nextNodeId: 'patrol-recon',
          },
          {
            id: 'c-ambush',
            label: 'Give him clearance for Shadow Force intimidation',
            tacticalTag: 'Ghost Ambush',
            nextNodeId: 'patrol-shadow',
          },
        ],
      },
      'patrol-recon': {
        id: 'patrol-recon',
        title: 'Chapter 2 · Telepathic Sweep',
        beats: [
          {
            id: 'pr1',
            speaker: 'eevee',
            text: '*He shifts silently to Espeon, narrowing his eyes toward the railing.* “Mind Reader locks onto one frantic heartbeat behind the planter box. Small. Clumsy. Carrying a stolen shiny bottle cap.”',
            form: 'Espeon',
            plate: 'Mind Plate',
            tera: 'Psychic',
            expression: 'Judging You',
            moveUsed: 'Mind Reader',
          },
          {
            id: 'pr2',
            speaker: 'narrator',
            text: 'A sleepy neighborhood Zigzagoon pokes its head out from behind the rosemary pot, freezes under the neon-red glare, and drops the bottle cap immediately.',
            form: 'Eevee',
            plate: 'None (Base)',
            tera: 'Normal',
            expression: 'Stern',
            moveUsed: null,
          },
        ],
        choices: [
          {
            id: 'c-treat',
            label: 'Leave a spare berry outside and head back to bed',
            tacticalTag: 'Mercy',
            nextNodeId: 'end-guardian',
          },
          {
            id: 'c-lecture',
            label: 'Let Eevee deliver a stern warning about trespassing',
            tacticalTag: 'Perimeter Rules',
            nextNodeId: 'end-lectured',
          },
        ],
      },
      'patrol-shadow': {
        id: 'patrol-shadow',
        title: 'Chapter 2 · Vanishing Act',
        beats: [
          {
            id: 'ps1',
            speaker: 'eevee',
            text: '*He slips into a dimensional rift with Shadow Force, emerging right behind a startled raccoon-like Zigzagoon that was rummaging in the recycling bin.*',
            form: 'Umbreon',
            plate: 'Spooky Plate',
            tera: 'Ghost',
            expression: 'Mocking Smile',
            moveUsed: 'Shadow Force',
          },
          {
            id: 'ps2',
            speaker: 'eevee',
            text: '“Unimpressive intruder. No Shadow Ball required. Leave the recyclables and vacate my property.”',
            form: 'Umbreon',
            plate: 'Dread Plate',
            tera: 'Dark',
            expression: 'Stern',
            moveUsed: null,
          },
        ],
        choices: [
          {
            id: 'c-sleep',
            label: 'Thank him for guarding the place and go back to sleep',
            tacticalTag: 'Night Watch',
            nextNodeId: 'end-guardian',
          },
        ],
      },
      'end-guardian': {
        id: 'end-guardian',
        title: 'Ending · Silent Watchdog',
        beats: [
          {
            id: 'eg1',
            speaker: 'eevee',
            text: '*Back at the foot of your bed, he reverts to Eevee and curls near the door, keeping one glowing eye half-open.* “Go to sleep. You’re hopeless without supervision.”',
            form: 'Eevee',
            plate: 'None (Base)',
            tera: 'Normal',
            expression: 'Stern',
            moveUsed: null,
          },
        ],
        endingSummary: {
          title: 'Ending A · Overqualified Guard Dog',
          outcome: 'No balcony walls were harmed, and Eevee quietly resumed watch duty by your bed.',
          chatHandoffPrompt: 'Thanks for checking the balcony last night—even if Shadow Force for a Zigzagoon was slightly excessive.',
        },
      },
      'end-lectured': {
        id: 'end-lectured',
        title: 'Ending · Neighborhood Legend',
        beats: [
          {
            id: 'el1',
            speaker: 'eevee',
            text: '*After a 40-second tactical lecture delivered in deadpan fluent speech, the Zigzagoon sprints down the fire escape and never returns.*',
            form: 'Umbreon',
            plate: 'Dread Plate',
            tera: 'Dark',
            expression: 'Mocking Smile',
            moveUsed: 'Taunt',
          },
        ],
        endingSummary: {
          title: 'Ending B · Zero Trespassers',
          outcome: 'Word spread across the local alleyways that Apartment 4B is defended by an articulate nightmare.',
          chatHandoffPrompt: 'Did you seriously lecture a wild Zigzagoon at 1:30 in the morning?',
        },
      },
    },
  },
  {
    id: 'ace-challenger',
    title: 'The Overconfident Ace Trainer',
    subtitle: 'Someone challenges your “ordinary house pet” outside the park.',
    setting: 'Neighborhood Sparring Court · 16:15',
    startNodeId: 'challenge-start',
    nodes: {
      'challenge-start': {
        id: 'challenge-start',
        title: 'Chapter 1 · Unsolicited Battle',
        beats: [
          {
            id: 'ac1',
            speaker: 'narrator',
            text: 'On your afternoon walk, a crisp-suited Ace Trainer laughs at the Master Ball clipped to your belt and sends out a Dragonite, assuming your small Eevee is a joke.',
            form: 'Eevee',
            plate: 'None (Base)',
            tera: 'Normal',
            expression: 'Judging You',
            moveUsed: null,
          },
          {
            id: 'ac2',
            speaker: 'eevee',
            text: '*A slow, sharp-fanged smile crosses his muzzle.* “A Dragonite? And he thinks a Master Ball is excessive? Watch closely.”',
            form: 'Eevee',
            plate: 'Pixie Plate',
            tera: 'Fairy',
            expression: 'Mocking Smile',
            moveUsed: 'Fake Out',
          },
        ],
        choices: [
          {
            id: 'c-sylveon',
            label: 'Call for the Sylveon + Pixie Plate counter',
            tacticalTag: 'Type Advantage',
            nextNodeId: 'challenge-sylveon',
          },
          {
            id: 'c-glaceon',
            label: 'Shift to Glaceon + Icicle Plate for 4x Ice pressure',
            tacticalTag: 'Sub-Zero Artillery',
            nextNodeId: 'challenge-glaceon',
          },
          {
            id: 'c-stellar',
            label: 'Stay base Eevee and unleash Tera Stellar Judgment',
            tacticalTag: 'Pure Flex',
            nextNodeId: 'challenge-stellar',
          },
        ],
      },
      'challenge-sylveon': {
        id: 'challenge-sylveon',
        title: 'Chapter 2 · Ribbons & Fangs',
        beats: [
          {
            id: 'cs1',
            speaker: 'eevee',
            text: '*He morphs effortlessly into Sylveon—Dragon Claw bouncing harmlessly off his Fairy aura—and snaps off a boosted Judgment before the trainer can recall.*',
            form: 'Sylveon',
            plate: 'Pixie Plate',
            tera: 'Fairy',
            expression: 'Mocking Smile',
            moveUsed: 'Judgment',
          },
        ],
        choices: [
          {
            id: 'c-finish-1',
            label: 'Revert to Eevee and walk away calmly',
            tacticalTag: 'Clean Exit',
            nextNodeId: 'end-victory',
          },
        ],
      },
      'challenge-glaceon': {
        id: 'challenge-glaceon',
        title: 'Chapter 2 · Flash Freeze',
        beats: [
          {
            id: 'cg1',
            speaker: 'eevee',
            text: '*Shifting into Glaceon, he pairs Mind Reader with an Icicle Plate Judgment that freezes the opponent’s momentum in one clean strike.*',
            form: 'Glaceon',
            plate: 'Icicle Plate',
            tera: 'Ice',
            expression: 'Combat-Ready',
            moveUsed: 'Mind Reader',
          },
        ],
        choices: [
          {
            id: 'c-finish-2',
            label: 'Return to Eevee and head for snacks',
            tacticalTag: 'Post-Match Errand',
            nextNodeId: 'end-victory',
          },
        ],
      },
      'challenge-stellar': {
        id: 'challenge-stellar',
        title: 'Chapter 2 · Base Form Supremacy',
        beats: [
          {
            id: 'cst1',
            speaker: 'eevee',
            text: '*Without even bothering to evolve, he Terastallizes into Stellar type, dodges with Extreme Speed, and fires a Draco Plate Judgment straight through the center of the court.*',
            form: 'Eevee',
            plate: 'Draco Plate',
            tera: 'Stellar',
            expression: 'Mocking Smile',
            moveUsed: 'Extreme Speed',
          },
        ],
        choices: [
          {
            id: 'c-finish-3',
            label: 'Offer a polite nod and head home',
            tacticalTag: 'Undefeated Pet',
            nextNodeId: 'end-victory',
          },
        ],
      },
      'end-victory': {
        id: 'end-victory',
        title: 'Ending · Another Doubt Resolved',
        beats: [
          {
            id: 'ev1',
            speaker: 'eevee',
            text: '*Back in base Eevee form, he shakes dust from his neck ruff and glares up at you.* “That took forty seconds. You owe me ice cream.”',
            form: 'Eevee',
            plate: 'None (Base)',
            tera: 'Normal',
            expression: 'Demanding Dinner',
            moveUsed: null,
          },
        ],
        endingSummary: {
          title: 'Ending · Effortless Victory',
          outcome: 'The Ace Trainer stood stunned on the sidewalk while your "ordinary pet" demanded dessert.',
          chatHandoffPrompt: 'Alright, you earned that ice cream after dismantling a Dragonite in under a minute. What flavor?',
        },
      },
    },
  },
];
