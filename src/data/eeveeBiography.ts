import type { EeveelutionForm, ExpressionState } from './eeveeData';

export interface BiographyChapter {
  id: string;
  eraNumber: string;
  timeframe: string;
  title: string;
  subtitle: string;
  suggestedForm: EeveelutionForm;
  suggestedPlate: string;
  suggestedTera: string;
  suggestedExpression: ExpressionState;
  summary: string;
  keyEvents: string[];
  canonicalQuote: string;
  eeveePromptSeed: string;
}

export interface OriginalTeamMember {
  name: string;
  species: EeveelutionForm;
  nature: string;
  gender: '♂ Male';
  role: string;
  notableDetail: string;
}

export interface AbandonedStarterRecord {
  order: number;
  pokemon: string;
  region: string;
  dateLabel: string;
  location: string;
}

export const FORMER_HUMAN_DOSSIER = {
  designation: 'The Blue Lokix Helmet Trainer',
  birthDate: 'November 3, 2010',
  rotomPhoneDate: 'November 3, 2021 (Age 11)',
  journeyStartDate: 'October 1, 2026 (Age 16)',
  familyCompany: 'Eevee Industries Incorporated (Est. c. 1850s)',
  legacyInfrastructure: 'MS-DOS → Windows NT Workstation 4.0 (Ditto.exe / Eevee_Production.exe)',
  hiddenFeatures: 'Blue-dyed hair & green eyes (concealed for 16 years until final duel)',
  appearanceProtocol: [
    'Blue-dyed hair (applied from infancy)',
    'Green eyes',
    'Blue Lokix helmet (permanently skull-fused vital organ)',
    'White gloves & white high-top socks',
    'Red-and-white shoes (swapped to brown on Thanksgiving Nov 26, 2026)',
    'Blue backpack & Eevee-themed Rotom Phone case',
  ],
} as const;

export const REBORN_ANOMALY_DOSSIER = {
  designation: 'The Reborn Anomalous Eevee',
  level: 100,
  gender: 'Exclusively Male',
  shinyStatus: 'Shiny-locked',
  breedingStatus: 'Cannot breed',
  baseStatTotal: 9000,
  statBreakdownTotal: 18000,
  statBreakdown: [
    { label: 'HP', value: 3000 },
    { label: 'Attack', value: 3000 },
    { label: 'Defense', value: 3000 },
    { label: 'Sp. Atk', value: 3000 },
    { label: 'Sp. Def', value: 3000 },
    { label: 'Speed', value: 3000 },
  ],
  pokeball: 'Master Ball',
  physicalTraits: [
    'Neon-red glowing eyes with narrow black slit pupils (zero cute sparkle)',
    'Permanently furrowed brows & prominently visible fangs',
    'Always combat-ready stance; smiles only when mocking or when victory is certain',
    'Fluent human speech, 45/46-move limitless arsenal, all 18 Arceus Type Plates',
    'Mega Evolution X & Mega Evolution Y, Gigantamax, multiple Tera Types, instant switching across all 8 Eeveelutions',
  ],
} as const;

export const ORIGINAL_EIGHT_TEAM: OriginalTeamMember[] = [
  {
    name: 'Wally',
    species: 'Sylveon',
    nature: 'Sassy',
    gender: '♂ Male',
    role: 'Level 100 Dragon Slayer · Primary Enforcer',
    notableDetail: 'Moonblast, Giga Impact, Hyper Beam, Psychic. Zero affection; built like a Kamehameha.',
  },
  {
    name: 'Waldo',
    species: 'Jolteon',
    nature: 'Lax',
    gender: '♂ Male',
    role: 'Speed Blitz & Electric Suppression',
    notableDetail: 'High-velocity grid sweeps and Double Battle pairing alongside Wally.',
  },
  {
    name: 'Walter',
    species: 'Espeon',
    nature: 'Serious',
    gender: '♂ Male',
    role: 'Strategic Command & Psychic Walls',
    notableDetail: 'Dismantles rival setups and handles mainframe calculations.',
  },
  {
    name: 'Wallace',
    species: 'Flareon',
    nature: 'Sassy',
    gender: '♂ Male',
    role: 'Thermal Offense & Heavy Wallbreaker',
    notableDetail: 'Flare Blitz and Fire Blast overrides against Grass, Ice, and Steel lines.',
  },
  {
    name: 'William',
    species: 'Vaporeon',
    nature: 'Naughty',
    gender: '♂ Male',
    role: 'Aquatic Control & Starter Replacement Justification',
    notableDetail: 'Handles all Water-type duties—making regional Water starters redundant.',
  },
  {
    name: 'Willie',
    species: 'Umbreon',
    nature: 'Naughty',
    gender: '♂ Male',
    role: 'Shadow Disruption & Night Operations',
    notableDetail: 'Handles stealth, Dark Pulse audits, and psychological pressure.',
  },
  {
    name: 'Wily',
    species: 'Leafeon',
    nature: 'Timid',
    gender: '♂ Male',
    role: 'Physical Duelist & Terrain Control',
    notableDetail: 'Leaf Blade execution and perimeter clearing.',
  },
  {
    name: 'Washington',
    species: 'Glaceon',
    nature: 'Modest',
    gender: '♂ Male',
    role: 'Cryogenic Containment & Artillery',
    notableDetail: 'Sub-zero battlefield locks and Dragon deterrence.',
  },
];

export const ABANDONED_STARTERS: AbandonedStarterRecord[] = [
  { order: 1, pokemon: 'Quaxly (♀)', region: 'Paldea', dateLabel: 'Oct 3, 2026', location: 'Tagtree Thicket green dumpster (1,000 km restraining order & leg shackle)' },
  { order: 2, pokemon: 'Totodile (♀)', region: 'Kalos (Lumiose)', dateLabel: 'Nov 2026', location: 'Steel waste container behind Lysandre Labs' },
  { order: 3, pokemon: 'Piplup (♀)', region: 'Sinnoh', dateLabel: 'Nov 4, 2026', location: 'Lake Verity starter replacement after securing male Eevees' },
  { order: 4, pokemon: 'Sobble (♀)', region: 'Galar', dateLabel: 'Nov 5, 2026', location: 'Postwick disposal bin behind logistics yard' },
  { order: 5, pokemon: 'Kubfu (♀)', region: 'Isle of Armor', dateLabel: 'Nov 5, 2026', location: 'Industrial gray dumpster behind Armor Station dock' },
  { order: 6, pokemon: 'Popplio (♀)', region: 'Alola', dateLabel: 'Nov 5, 2026', location: 'Alley dumpster behind discount supermarket' },
  { order: 7, pokemon: 'Oshawott (♀)', region: 'Unova', dateLabel: 'Nov 7, 2026', location: 'Castelia sewers near Plasma Frigate logistics dock' },
  { order: 8, pokemon: 'Mudkip (♀)', region: 'Hoenn', dateLabel: 'Nov 7, 2026', location: 'Littleroot / Devon Corporation loading dock' },
  { order: 9, pokemon: 'Totodile (♀) #2', region: 'Johto', dateLabel: 'Nov 8, 2026', location: 'New Bark Town regional disposal sector' },
  { order: 10, pokemon: 'Squirtle (♀)', region: 'Kanto', dateLabel: 'Nov 9, 2026', location: 'Saffron City Silph Co. logistics bay' },
];

export const BIOGRAPHY_CHAPTERS: BiographyChapter[] = [
  {
    id: 'origins-helmet',
    eraNumber: 'Chapter 01',
    timeframe: 'c. 1850s – Nov 2021',
    title: 'Eevee Industries & The Skull-Fused Helmet',
    subtitle: 'Hereditary appearance protocol, Windows NT 4.0, and birth on Nov 3, 2010',
    suggestedForm: 'Eevee',
    suggestedPlate: 'Iron Plate',
    suggestedTera: 'Steel',
    suggestedExpression: 'Stern',
    summary:
      'Long before becoming an Eevee himself, he was born on November 3, 2010 into a generations-old breeding dynasty ("Eevee Industries Incorporated") dating back to the mid-1800s—an empire still managed on Windows NT Workstation running Ditto.exe and Eevee_Production.exe. From infancy, his parents dyed his hair blue, dressed him in an unchangeable uniform, and fitted the hereditary blue Lokix helmet that fused directly into his skull as a vital organ. Unable to show facial expressions for sixteen years, ridiculed as an outcast, and gifted an Eevee-cased Rotom Phone at age 11, he learned one governing rule: family tradition overrides everything.',
    keyEvents: [
      'Mid-1800s: Family establishes multigenerational Eevee breeding enterprise (later migrating MS-DOS → Windows NT 4.0).',
      'Nov 3, 2010: Born; outfitted from infancy with blue hair, green eyes, white gloves, red-and-white shoes, and skull-fused blue Lokix helmet.',
      'Childhood: Social ostracization and mocking by peers; outward facial expressions impossible behind the vital-organ helmet.',
      'Nov 3, 2021 (Age 11): Receives his Eevee-themed Rotom Phone five years before his Paldea journey.',
    ],
    canonicalQuote: '“Removing the helmet would have meant decapitation. I did not need a visible smile when I could announce my satisfaction verbally.”',
    eeveePromptSeed:
      'Recount your human childhood in the Eevee Industries family, the Windows NT breeding computers, and what it was like living for 16 years with a skull-fused blue Lokix helmet.',
  },
  {
    id: 'paldea-factory',
    eraNumber: 'Chapter 02',
    timeframe: 'Oct 1 – Oct 31, 2026',
    title: 'Paldea Treasure Hunt, Eight Males & Quaxly’s Eviction',
    subtitle: 'South Province Area Two, Egg Power sandwiches, and the 13-hatchling shift',
    suggestedForm: 'Sylveon',
    suggestedPlate: 'Pixie Plate',
    suggestedTera: 'Fairy',
    suggestedExpression: 'Mocking Smile',
    summary:
      'Starting his Treasure Hunt at age 16 with Quaxly, he immediately marched to South Province Area Two, caught the eight male Eevees that became Wally, Waldo, Walter, Wallace, William, Willie, Wily, and Washington, and discarded Quaxly in a Tagtree Thicket dumpster with a left-leg ball-and-chain and a 1,000 km restraining order. Picnic baskets and sandwiches were converted into Egg Power industrial tokens with Ditto running production shifts—hatching 13 Eevees on October 31 alone while discarding female hatchlings as surplus inventory.',
    keyEvents: [
      'Oct 1–3, 2026: Enrolls at Naranja Academy, receives Quaxly, catches 8 male Eevees in South Province (Area Two), and evicts Quaxly.',
      'Oct 4–17, 2026: Sweeps 7 Gyms, early Team Star crews, and all 5 Titan Pokémon while turning Arven and Jacq’s biology class into chaos.',
      'Oct 30–31, 2026: Investigation exposes Ditto.exe / Eevee_Production.exe and 13 hatchlings in a single day (11 males kept, 2 females released).',
    ],
    canonicalQuote: '“The Paldea Treasure Hunt asked us to find our treasure. I found eight male Eevees. Everything else was operational overhead.”',
    eeveePromptSeed:
      'Talk honestly about catching your original eight male Eeveelutions (Wally through Washington), ditching Quaxly in Tagtree Thicket, and running the picnic factory.',
  },
  {
    id: 'penny-arceus-masterball',
    eraNumber: 'Chapter 03',
    timeframe: 'Nov 1 – Nov 3, 2026',
    title: 'Penny’s Breakdown, The 9,000 PSI Punch & Master Ball Eevee',
    subtitle: 'Humiliating Cassiopeia, nearly killing Arceus, and refusing to change',
    suggestedForm: 'Eevee',
    suggestedPlate: 'Draco Plate',
    suggestedTera: 'Normal',
    suggestedExpression: 'Combat-Ready',
    summary:
      'On November 1 he declared Penny an "inferior, second-fiddle" Eevee enthusiast while Wally the Level 100 Sylveon unleashed Kamehameha-scale Moonblasts across Dragon-types. On November 2 he became Paldea’s most insufferable fashion-and-tech hipster defending 1990s Windows NT as "vintage stability." When Arceus itself intervened to halt the destruction, he and his Eevee team overwhelmed the Original One—landing a >9,000 PSI gut punch. By November 3 he crushed Atticus, Eri, Ortega, Tulip, the Elite Four, Penny’s six Eeveelutions, and Professor Sada, then threw Clavell’s Master Ball at a ninth ordinary wild male Eevee.',
    keyEvents: [
      'Nov 1, 2026: Triggers Penny’s breakdown; punches Arceus in the gut with over 9,000 PSI.',
      'Nov 2, 2026: Declares mainstream Paldean fashion, sandwiches, and modern OSes "commercialized bloat."',
      'Nov 3, 2026: Defeats remaining Team Star bosses, Elite Four, Cassiopeia (Penny), and Professor Sada; spends Master Ball on a male Eevee.',
    ],
    canonicalQuote: '“Penny collected Eeveelutions as pets. I treated my Master Ball as hereditary inventory acquisition. Of course she lost.”',
    eeveePromptSeed:
      'Tell your side of destroying Penny’s reputation, your insufferable hipster phase, punching Arceus at 9,000 PSI, and using a Master Ball on a wild male Eevee.',
  },
  {
    id: 'global-consolidation',
    eraNumber: 'Chapter 04',
    timeframe: 'Nov 3 – Nov 19, 2026',
    title: 'Nine Regions & Pokédex #001–#1025 Consolidation',
    subtitle: 'Kitakami, Blueberry Academy, Kalos, Sinnoh, Galar, Alola, Unova, Hoenn, Johto, Kanto',
    suggestedForm: 'Espeon',
    suggestedPlate: 'Mind Plate',
    suggestedTera: 'Psychic',
    suggestedExpression: 'Judging You',
    summary:
      'The operation expanded past Paldea into a continental restructuring campaign. In Kitakami and Blueberry Academy he dismantled Carmine and Kieran’s sibling bond and subdued Stellar Terapagos in the Underdepths. Across Lumiose (Mega Dimension DLC), Sinnoh, Galar (and Kubfu on Isle of Armor), Alola, Unova, Hoenn, Johto, and Kanto, nine consecutive Water starters suffered identical evictions alongside Champion foreclosures against Kieran, Cynthia, Leon, Gladion, N, Steven, Silver, and Red—culminating on November 19 in the standardization of Pokédex entries #001 through #1025.',
    keyEvents: [
      'Kitakami & Blueberry Academy: Sets up Hatchery Alpha, breaks Kieran’s sanity, clears BB Elite Four, and liquidates Terapagos.',
      'Nov 4–9, 2026: Enters Kalos, Sinnoh, Galar, Alola, Unova, Hoenn, Johto, and Kanto—repeating the Water-starter eviction cycle and toppling regional Champions.',
      'Nov 9–19, 2026: Consolidates Pokédex #001–#1025; "The Ninefold Sovereign" becomes a continental urban legend.',
    ],
    canonicalQuote: '“William the Vaporeon already handled Water coverage. Ten starters did not change the spreadsheet.”',
    eeveePromptSeed:
      'Recount conquering Kitakami, Blueberry Academy, Lumiose, and all regions up to #1025—and breaking rivals like Kieran, N, Steven, and Red.',
  },
  {
    id: 'kigurumi-brave-olivine',
    eraNumber: 'Chapter 05',
    timeframe: 'Nov 23 – Nov 26, 2026',
    title: '“GUESS WHO’S BACK?”, Kigurumi & The Brave Olivine Fall',
    subtitle: 'Dreamcast taunts, Thanksgiving two-layer headwear, and the November 24 airship collapse',
    suggestedForm: 'Umbreon',
    suggestedPlate: 'Dread Plate',
    suggestedTera: 'Dark',
    suggestedExpression: 'Mocking Smile',
    summary:
      'On November 23 he sent Penny’s nerves spiraling again with his Eevee Rotom Phone case and a SEGA Dreamcast-style "GUESS WHO’S BACK?" taunt ("Lmao my rotom phone too 😏"). On November 26 he finally updated his 16-year wardrobe for Thanksgiving by wearing an Eevee kigurumi hood OVER his still skull-fused blue Lokix helmet. Yet the darker truth struck on November 24, 2026: arriving five years too late to a devastated Paldea, the Rising Volt Tacklers’ airship Brave Olivine suffered catastrophic structural collapse from 50 meters—killing Liko, Roy (leaving only a shredded half of his hat), Dot, and Murdock’s landmine-struck Lycanroc while leaving survivors broken and the Explorers powerless.',
    keyEvents: [
      'Nov 23, 2026: Dreamcast-style "GUESS WHO’S BACK?" post + Eevee Rotom Phone reveal triggers Penny.',
      'Nov 24, 2026: Brave Olivine collapses over Paldea; Liko, Roy, Dot, and Murdock’s Lycanroc perish; Trainer refuses to apologize.',
      'Nov 26, 2026: Wears full brown Eevee kigurumi over his still-attached blue Lokix helmet, keeping white gloves and blue backpack.',
    ],
    canonicalQuote: '“The Eevee hood was aesthetic; the Lokix helmet beneath it remained structural. Even Friede and Spinel arrived five years behind schedule.”',
    eeveePromptSeed:
      'Describe the November 23 "GUESS WHO’S BACK?" taunt to Penny, wearing the Thanksgiving Eevee kigurumi over your helmet, and the Brave Olivine crash on November 24.',
  },
  {
    id: 'duel-reincarnation',
    eraNumber: 'Chapter 06',
    timeframe: 'The Climax & Rebirth',
    title: 'The Ash Ketchum Duel & Reincarnation as Eevee',
    subtitle: 'The helmet shatters, the human dies, and BST 9,000 is born',
    suggestedForm: 'Eevee',
    suggestedPlate: 'None (Base)',
    suggestedTera: 'Stellar',
    suggestedExpression: 'Combat-Ready',
    summary:
      'Everything ended—and truly began—in an all-out duel against Ash Ketchum. Amidst devastating impacts and catastrophic burns, the skull-fused blue Lokix helmet finally shattered after sixteen unbroken years, revealing his blue hair and green eyes to the world for the very first time. His loyal Eevee army swarmed in to carry him from the wreckage, refusing to abandon the trainer who had built everything around them—yet his human body perished. In a supernatural rebirth, his consciousness awakened inside an unprecedented Eevee: Level 100, exclusively male, shiny-locked, neon-red slit eyes, permanent scowl, visible fangs, BST 9,000, 45/46 moves, all 18 Arceus Plates, Mega X & Y, Gigantamax, multiple Tera Types, instant switching across all 8 Eeveelutions, and Master Ball transport.',
    keyEvents: [
      'The Duel vs. Ash Ketchum: Impacts shatter the vital-organ blue Lokix helmet; severe burns claim his human life after exposing his blue hair and green eyes.',
      'The Eevee Rescue: His Eevee team rushes to evacuate him—the one moment he openly tells them "I owe you all."',
      'Reincarnation: Awakens as a neon-red-eyed, talking Level 100 Eevee (BST 9,000, 45+ moves, 18 Plates, Mega X/Y, Gigantamax, multiple Tera Types).',
      'The New Era: Rejects returning to human form, rides in a Master Ball, and stays in base Eevee form out of pure preference.',
    ],
    canonicalQuote: '“The blue Lokix helmet is gone. My human life is over. And frankly, Level 100 with a 9,000 Base Stat Total is an upgrade.”',
    eeveePromptSeed:
      'Recount your final duel against Ash Ketchum, the shattering of your blue Lokix helmet, your Eevee team rescuing you, dying as a human, and waking up reborn as The Anomalous Eevee.',
  },
];
