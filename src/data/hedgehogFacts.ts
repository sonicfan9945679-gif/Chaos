export interface HedgehogFactEntry {
  id: string;
  number: number;
  title: string;
  speciesFocus: string;
  category:
    | 'Anatomy & Spines'
    | 'Behavior & Defense'
    | 'Diet & Physiology'
    | 'Lifecycle & Ecology'
    | 'Evolution & Taxonomy';
  fact: string;
  scientificNote: string;
  eeveeTriggerHint: string;
}

/**
 * 36 verified real-world scientific facts solely about real-world hedgehogs (Erinaceinae).
 * Selected deterministically by local calendar date so there is strictly one daily fact per day
 * and consecutive days always alternate cleanly through the catalog.
 */
export const HEDGEHOG_FACTS: HedgehogFactEntry[] = [
  {
    id: 'hg-01',
    number: 1,
    title: '5,000 to 7,000 Hollow Keratin Spines',
    speciesFocus: 'European Hedgehog (Erinaceus europaeus)',
    category: 'Anatomy & Spines',
    fact: 'An adult European hedgehog carries roughly 5,000 to 7,000 dorsal spines—each a hollow, air-filled cylinder of keratin (the same protein as human fingernails) reinforced with internal longitudinal ridges that give maximum stiffness at minimal weight.',
    scientificNote:
      'Because each spine is a modified hair with a flexible narrowed neck at the skin follicle, impact energy bends the base like a shock-absorbing spring rather than snapping the shaft.',
    eeveeTriggerHint: 'Compare their hollow keratin armor to Iron Defense or Pin Missile.',
  },
  {
    id: 'hg-02',
    number: 2,
    title: 'Hedgehogs Never Shoot or Detach Their Quills',
    speciesFocus: 'All 17 Living Hedgehog Species (Erinaceinae)',
    category: 'Anatomy & Spines',
    fact: 'Unlike porcupines, hedgehogs cannot fire, shoot, or detach their spines at predators—each spine stays anchored inside its skin follicle unless shed naturally during juvenile quilling or routine adult coat turnover.',
    scientificNote:
      'Hedgehog spines are also smooth rather than backward-barbed, meaning they deter bites through dense outward geometry rather than staying embedded inside a predator.',
    eeveeTriggerHint: 'Critique the myth that anything spiky works like Pin Missile.',
  },
  {
    id: 'hg-03',
    number: 3,
    title: 'The Circular Drawstring Muscle Ring',
    speciesFocus: 'Erinaceus & Atelerix Genera',
    category: 'Anatomy & Spines',
    fact: 'A specialized band of ring-shaped skin muscle called the orbicularis (part of the panniculus carnosus) wraps around the edge of a hedgehog’s spiny mantle and contracts like a drawstring purse to tuck the head, belly, and legs completely inside a locked sphere of spines.',
    scientificNote:
      'While curled, longitudinal muscles on the back erect all spines outward in overlapping angles simultaneously, shielding the unprotected soft underside.',
    eeveeTriggerHint: 'Respect a purely anatomical defense stance that rivals Protect.',
  },
  {
    id: 'hg-04',
    number: 4,
    title: 'Hedgehogs Are Naturally Lactose Intolerant',
    speciesFocus: 'Wild European & African Hedgehogs',
    category: 'Diet & Physiology',
    fact: 'Despite centuries of folklore advising homeowners to leave saucers of cow’s milk in gardens, hedgehogs lack sufficient lactase enzymes to digest dairy sugars, so cow’s milk causes painful diarrhea and severe dehydration.',
    scientificNote:
      'Wildlife biologists recommend offering plain fresh water and meat-based wet food or natural insects instead of milk or bread.',
    eeveeTriggerHint: 'Scold humans for leaving bad food offerings out for nocturnal hunters.',
  },
  {
    id: 'hg-05',
    number: 5,
    title: 'Self-Anointing With Frothy Saliva',
    speciesFocus: 'All True Hedgehogs (Subfamily Erinaceinae)',
    category: 'Behavior & Defense',
    fact: 'When a hedgehog encounters an unfamiliar strong scent or taste, it chews the source, whips up thick frothy saliva, and contorts its spine-covered back to lick and coat its quills—a behavior zoologists call self-anointing.',
    scientificNote:
      'Researchers hypothesize self-anointing either masks the hedgehog’s scent, adds irritating plant or toad toxins to its spines, or functions as scent-marking.',
    eeveeTriggerHint: 'React with disgust and grudging respect for biological chemical warfare.',
  },
  {
    id: 'hg-06',
    number: 6,
    title: 'Natural Resistance to Viper Venom via Erinacin',
    speciesFocus: 'European Hedgehog (Erinaceus europaeus)',
    category: 'Diet & Physiology',
    fact: 'European hedgehogs possess a specialized blood protein inhibitor called erinacin that neutralizes hemorrhagic metalloproteinases in adder venom, making a healthy adult roughly 30 to 40 times more resistant to viper bites per gram than a mouse.',
    scientificNote:
      'Thanks to both erinacin and spine armor, wild hedgehogs actively hunt and eat venomous snakes, though extremely large venom doses can still injure them.',
    eeveeTriggerHint: 'Note how useful Poison resistance is without needing a Toxic Plate.',
  },
  {
    id: 'hg-07',
    number: 7,
    title: 'Hoglets Are Born With Soft, Fluid-Covered Spines',
    speciesFocus: 'Neonatal Hedgehogs',
    category: 'Lifecycle & Ecology',
    fact: 'Newborn baby hedgehogs—called hoglets—emerge blind and hairless with their first set of soft white spines tucked safely beneath a fluid-swollen layer of dorsal skin so they do not injure their mother during birth.',
    scientificNote:
      'Within a few hours after birth, the skin fluid resorbs and roughly 100 soft white spines push through the surface, followed days later by darker pigmented adult-type spines.',
    eeveeTriggerHint: 'Acknowledge that even newborn hedgehogs arrive pre-equipped with armor.',
  },
  {
    id: 'hg-08',
    number: 8,
    title: 'Hibernation Slows the Heartbeat by Nearly 90 Percent',
    speciesFocus: 'European Hedgehog (Erinaceus europaeus)',
    category: 'Diet & Physiology',
    fact: 'During winter hibernation, a European hedgehog drops its core body temperature from around 35°C down close to ambient air (4–10°C) and reduces its heart rate from roughly 190 beats per minute to around 20 beats per minute.',
    scientificNote:
      'Hibernating hedgehogs still wake briefly several times across winter, so building enough autumn fat reserves—typically at least 500–600 grams—is critical to surviving until spring.',
    eeveeTriggerHint: 'Judge winter sleep vs. staying on year-round combat alert.',
  },
  {
    id: 'hg-09',
    number: 9,
    title: 'Nightly Foraging Patrols of One to Two Miles',
    speciesFocus: 'Wild European Hedgehogs',
    category: 'Lifecycle & Ecology',
    fact: 'Although their legs are short, wild hedgehogs routinely walk 1 to 2 miles (1.6 to 3.2 km) in a single night while patrolling gardens, hedgerows, and woodland edges for beetles, earthworms, and slugs.',
    scientificNote:
      'Radio-tracking studies show adult males often patrol larger overlapping home ranges than females, especially during spring breeding.',
    eeveeTriggerHint: 'Compare garden night-patrol routes to your own territorial surveillance.',
  },
  {
    id: 'hg-10',
    number: 10,
    title: 'Sharp Hearing and Smell Compensate for Weak Vision',
    speciesFocus: 'Erinaceinae Family',
    category: 'Anatomy & Spines',
    fact: 'Hedgehogs have relatively poor eyesight tuned mainly for dim twilight silhouettes, so they navigate almost entirely by a hyper-sensitive damp nose and acute hearing capable of detecting high-frequency insect rustling.',
    scientificNote:
      'Their olfactory bulbs occupy a disproportionately large fraction of the forebrain compared with visually oriented daytime mammals.',
    eeveeTriggerHint: 'Contrast poor eyesight with your own Mind Reader and neon-red slit pupils.',
  },
  {
    id: 'hg-11',
    number: 11,
    title: 'Middle English Origins of the Name "Hedgehog"',
    speciesFocus: 'European Hedgehog Historical Etymology',
    category: 'Evolution & Taxonomy',
    fact: 'The English word "hedgehog" appeared in the 1400s from "hedge" (their preferred hedgerow cover) and "hog" (their pig-like snout and audible snuffling grunts while rooting through leaf litter).',
    scientificNote:
      'Before "hedgehog" became standard, English speakers called the animal an "urchin"—which is why sea urchins still carry that name for their spines.',
    eeveeTriggerHint: 'Deliver dry linguistic commentary on small animals named after pigs.',
  },
  {
    id: 'hg-12',
    number: 12,
    title: 'Seventeen Living Species Across Three Continents',
    speciesFocus: 'Global Subfamily Erinaceinae',
    category: 'Evolution & Taxonomy',
    fact: 'There are 17 recognized living species of true hedgehogs grouped into 5 genera—native across Europe, Asia, and Africa, with zero species naturally native to the Americas or Australia.',
    scientificNote:
      'Popular pet "African pygmy hedgehogs" are captive-bred hybrids primarily derived from the four-toed hedgehog (Atelerix albiventris) and Algerian hedgehog (Atelerix algirus).',
    eeveeTriggerHint: 'Note regional exclusivity like regional forms, except real biology.',
  },
  {
    id: 'hg-13',
    number: 13,
    title: 'Desert Long-Eared Hedgehogs Radiate Heat Through Ears',
    speciesFocus: 'Long-Eared Hedgehog (Hemiechinus auritus)',
    category: 'Anatomy & Spines',
    fact: 'Long-eared hedgehogs living in arid Central Asian steppes and deserts possess oversized ears packed with blood vessels that dump excess body heat into dry night air—the same cooling principle seen in desert foxes.',
    scientificNote:
      'Unlike European hedgehogs, Hemiechinus species are faster runners and often rely on sprinting or biting rather than curling immediately into a ball.',
    eeveeTriggerHint: 'Compare heat-radiating ears to Jolteon speed or thermal regulation.',
  },
  {
    id: 'hg-14',
    number: 14,
    title: 'An Ancient Mammal Lineage Over 15 Million Years Old',
    speciesFocus: 'Fossil Erinaceinae & Erinaceidae',
    category: 'Evolution & Taxonomy',
    fact: 'True spiny hedgehogs appear in the fossil record at least 15 million years ago in the Miocene, while their broader eulipotyphlan family dates back more than 50 million years—making modern hedgehogs living relics of early placental mammals.',
    scientificNote:
      'Despite superficial resemblance, hedgehogs are NOT rodents; they belong to order Eulipotyphla alongside shrews and moles.',
    eeveeTriggerHint: 'Correct anyone who carelessly lumps hedgehogs in with rodents.',
  },
  {
    id: 'hg-15',
    number: 15,
    title: 'A Group of Hedgehogs Is Called an Array or Prickle',
    speciesFocus: 'Social Biology of Hedgehogs',
    category: 'Lifecycle & Ecology',
    fact: 'Although wild adult hedgehogs lead mostly solitary lives outside mating and nursing, a collective group of hedgehogs is traditionally known as an "array" (or informally a "prickle").',
    scientificNote:
      'Even when foraging gardens overlap, hedgehogs generally ignore or step around each other rather than forming cooperative packs.',
    eeveeTriggerHint: 'Approve of solitary discipline over noisy pack behavior.',
  },
  {
    id: 'hg-16',
    number: 16,
    title: 'Surprisingly Capable Swimmers and Fence Climbers',
    speciesFocus: 'European & African Hedgehogs',
    category: 'Behavior & Defense',
    fact: 'Hedgehogs can swim steadily using buoyant air trapped inside their hollow spines and can climb rough wooden fences, stone garden walls, and ivy over a meter tall.',
    scientificNote:
      'Climbing upward is easy with curved claws, so hedgehogs sometimes tumble into steep garden ponds—making shallow exit ramps critical for urban wildlife.',
    eeveeTriggerHint: 'Compare hollow-spine buoyancy to switching to Vaporeon without needing water.',
  },
  {
    id: 'hg-17',
    number: 17,
    title: 'Thirty-Six to Forty-Four Needle-Sharp Insectivore Teeth',
    speciesFocus: 'Craniodental Anatomy of Erinaceinae',
    category: 'Anatomy & Spines',
    fact: 'Depending on the species, a hedgehog’s skull houses 36 to 44 specialized sharp teeth, including forward-angled upper incisors spaced to seize wriggling earthworms and beetles before crushing their exoskeletons.',
    scientificNote:
      'Hedgehog molars carry pointed cusps built for shearing chitinous insect shells rather than grinding fibrous plants.',
    eeveeTriggerHint: 'Inspect their dentition with respect—you appreciate visible fangs yourself.',
  },
  {
    id: 'hg-18',
    number: 18,
    title: 'Desert Hedgehogs Aestivate Through Brutal Summers',
    speciesFocus: 'Desert Hedgehog (Paraechinus aethiopicus)',
    category: 'Behavior & Defense',
    fact: 'While temperate European hedgehogs hibernate through freezing winters, desert-dwelling hedgehogs enter summer dormancy—called aestivation—sealing themselves in cool underground burrows to conserve water and survive extreme heat.',
    scientificNote:
      'Paraechinus aethiopicus can survive for weeks on stored tail-base and dorsal fat plus metabolic water when desert insects vanish.',
    eeveeTriggerHint: 'Respect tactical conservation over stubborn heatstroke.',
  },
  {
    id: 'hg-19',
    number: 19,
    title: 'Zero Venom Glands on Spines, Unlike Rare Venomous Mammals',
    speciesFocus: 'Defensive Biochemistry of Hedgehogs',
    category: 'Behavior & Defense',
    fact: 'Hedgehog spines contain no venom glands or poison ducts whatsoever; any sting or irritation someone feels after handling a wild hedgehog comes strictly from mechanical pricking or dried saliva left from self-anointing.',
    scientificNote:
      'Their close relatives in order Eulipotyphla actually include genuinely venomous mammals such as solenodons and certain shrews, making non-venomous hedgehogs the armored specialists of the clade.',
    eeveeTriggerHint: 'Clarify pure physical contact damage versus Poison-type moves.',
  },
  {
    id: 'hg-20',
    number: 20,
    title: 'Shock-Absorbing Spines Protect Against Falls',
    speciesFocus: 'Biomechanics of Hedgehog Spines',
    category: 'Anatomy & Spines',
    fact: 'Biomechanical testing shows that curved, hollow hedgehog spines buckle slightly at their skin bases under sudden load, acting as natural shock absorbers that let climbing hedgehogs survive drops off low garden walls.',
    scientificNote:
      'Engineering researchers have studied the internal walled structure of hedgehog spines to design lighter, crack-resistant protective helmets and impact foams.',
    eeveeTriggerHint: 'Take a subtle jab at helmet engineering versus biological armor.',
  },
  {
    id: 'hg-21',
    number: 21,
    title: 'Distinctive Defensive "Popping" and Huffing',
    speciesFocus: 'Four-Toed & European Hedgehogs',
    category: 'Behavior & Defense',
    fact: 'When startled before fully curling up, a hedgehog slams its forehead spines forward while expelling sharp bursts of air that sound like rapid huffs, sneezes, or popcorn popping.',
    scientificNote:
      'Juvenile hedgehogs also emit bird-like high-pitched whistles when separated from their mother so she can relocate them quickly in dark undergrowth.',
    eeveeTriggerHint: 'Evaluate their intimidation display against Fake Out or Bite.',
  },
  {
    id: 'hg-22',
    number: 22,
    title: 'African Pygmy Hedgehogs Have Four Toes on Hind Feet',
    speciesFocus: 'Four-Toed Hedgehog (Atelerix albiventris)',
    category: 'Anatomy & Spines',
    fact: 'Unlike European hedgehogs with five toes on every foot, the Central and East African Atelerix albiventris carries five toes in front and only four toes on each hind foot—giving it the common name "four-toed hedgehog."',
    scientificNote:
      'Loss of the inner hind digit (hallux) is a classic cursorial adaptation among small terrestrial mammals that trot briskly across open savanna scrub.',
    eeveeTriggerHint: 'Show off sharp observational trivia on hind-foot anatomy.',
  },
  {
    id: 'hg-23',
    number: 23,
    title: 'Toad Skin Secretions Trigger Intense Self-Anointing',
    speciesFocus: 'European & Steppe Hedgehogs',
    category: 'Diet & Physiology',
    fact: 'Because hedgehogs tolerate certain amphibian bufotoxins that repel other small carnivores, they frequently bite toxic toads specifically to chew the skin secretions into frothy saliva and smear them across their own spines.',
    scientificNote:
      'This transfers mild irritant chemicals onto the tips of the spines, giving the hedgehog borrowed chemical deterrence without producing venom internally.',
    eeveeTriggerHint: 'Acknowledge borrowed elemental typing—not unlike using an Arceus Plate.',
  },
  {
    id: 'hg-24',
    number: 24,
    title: 'Garden Pest Control Specialists',
    speciesFocus: 'European Hedgehog (Erinaceus europaeus)',
    category: 'Lifecycle & Ecology',
    fact: 'A single wild hedgehog can eat dozens of slugs, earwigs, caterpillars, and ground beetles in one night, earning it centuries of affection from farmers and gardeners as a natural pest-control ally.',
    scientificNote:
      'However, heavy use of metaldehyde slug pellets harms hedgehogs through secondary poisoning, contributing to steep urban population declines in Western Europe.',
    eeveeTriggerHint: 'Point out that wild hedgehogs actually work for their keep, unlike careless humans.',
  },
  {
    id: 'hg-25',
    number: 25,
    title: 'Scorpions Are Routine Prey for Desert Hedgehogs',
    speciesFocus: 'Desert Hedgehog (Paraechinus aethiopicus)',
    category: 'Diet & Physiology',
    fact: 'Desert hedgehogs actively hunt venomous scorpions at night—carefully biting off or crushing the stinging tail segment first while letting stiff facial spines shield their eyes and muzzle.',
    scientificNote:
      'Laboratory assays confirm desert hedgehogs also carry elevated natural tolerance to scorpion and snake venoms compared with non-insectivorous mammals of similar size.',
    eeveeTriggerHint: 'Respect tactical target prioritization—neutralize the stinger first.',
  },
  {
    id: 'hg-26',
    number: 26,
    title: 'Two Distinct Coats: Soft Belly Fur and Dorsal Armor',
    speciesFocus: 'Erinaceinae Pelage Structure',
    category: 'Anatomy & Spines',
    fact: 'Hedgehogs grow two completely separate hair coats simultaneously: dense, warm, flexible fur along their underside, face, and limbs, and a thick mantle of rigid cream-and-brown banded spines across their back and crown.',
    scientificNote:
      'Because no spines grow on the face, throat, or belly, curling tightly is essential to close the only exposed vulnerability gap.',
    eeveeTriggerHint: 'Analyze armored versus unarmored hitboxes with tactical precision.',
  },
  {
    id: 'hg-27',
    number: 27,
    title: 'Badgers Are the Primary Natural Predator in Europe',
    speciesFocus: 'European Hedgehog Predator Ecology',
    category: 'Lifecycle & Ecology',
    fact: 'In Great Britain and mainland Europe, the European badger (Meles meles) is one of the very few predators strong enough to pry open a curled hedgehog using powerful digging foreclaws.',
    scientificNote:
      'Field studies show hedgehogs actively avoid foraging in areas saturated with fresh badger scent, choosing suburban gardens over open badger-heavy woodland.',
    eeveeTriggerHint: 'Note that even high Defense stats lose to specialized counters.',
  },
  {
    id: 'hg-28',
    number: 28,
    title: 'Juveniles Shed Baby Spines in a "Quilling" Phase',
    speciesFocus: 'Developing Young Hedgehogs',
    category: 'Lifecycle & Ecology',
    fact: 'Between roughly six and twelve weeks of age, young hedgehogs go through "quilling"—shedding their first delicate juvenile spines in batches as thicker, darker, stronger adult spines push upward beneath the skin.',
    scientificNote:
      'Because dozens of new rigid tips emerge through the skin at once, quilling temporarily makes young hedgehogs notoriously grumpy and sensitive to touch.',
    eeveeTriggerHint: 'Sympathize with being permanently irritable while growing sharper defenses.',
  },
  {
    id: 'hg-29',
    number: 29,
    title: 'Short Gestation of Roughly Five Weeks',
    speciesFocus: 'Erinaceus & Atelerix Reproduction',
    category: 'Lifecycle & Ecology',
    fact: 'Hedgehog pregnancy lasts only about 31 to 38 days, producing typical litters of 3 to 6 blind hoglets that weigh just 10 to 25 grams each—roughly the mass of a single strawberry.',
    scientificNote:
      'Male hedgehogs play zero role in raising young; the mother alone builds a woven leaf-and-moss nursery nest and nurses her litter until they forage independently at four to six weeks.',
    eeveeTriggerHint: 'Keep commentary strictly on real-world maternal biology.',
  },
  {
    id: 'hg-30',
    number: 30,
    title: 'Brown-Spined Nests Built From Woven Leaves',
    speciesFocus: 'Wild European Hedgehogs',
    category: 'Behavior & Defense',
    fact: 'Hedgehogs construct waterproof daytime sleeping nests and winter hibernacula by rotating inside piles of dry oak leaves, moss, and grass until the foliage compacts into an insulated, weather-tight dome.',
    scientificNote:
      'Because they often choose garden compost heaps or unlit bonfire piles for winter nests, wildlife groups urge people to check woodpiles before burning them in autumn.',
    eeveeTriggerHint: 'Demand comfortable, dry sleeping spots indoors rather than damp leaf piles.',
  },
  {
    id: 'hg-31',
    number: 31,
    title: 'Non-Native Hedgehogs Reshaped New Zealand Ecosystems',
    speciesFocus: 'Introduced Erinaceus europaeus in New Zealand',
    category: 'Lifecycle & Ecology',
    fact: 'Introduced to New Zealand by 19th-century settlers to eat garden pests, European hedgehogs multiplied rapidly without native badgers or owls and now thrive in dense wild populations across both main islands.',
    scientificNote:
      'In New Zealand’s predator-free-evolved ecosystems, introduced hedgehogs unfortunately prey heavily on endangered native flightless insects like wetas and ground-nesting bird eggs.',
    eeveeTriggerHint: 'Comment coldly on what happens when a species has zero natural counters.',
  },
  {
    id: 'hg-32',
    number: 32,
    title: 'Colorless Albino and Leucistic Hedgehogs Occur Naturally',
    speciesFocus: 'Wild & Captive Erinaceinae Genetics',
    category: 'Evolution & Taxonomy',
    fact: 'True albino hedgehogs—with pale cream spines and bright pink or ruby eyes—appear rarely in the wild, including famous isolated populations on the Channel Island of Alderney where blonde/leucistic traits are unusually common.',
    scientificNote:
      'Without dark cryptic spine banding, bright pale hedgehogs stand out far more visibly to nocturnal owls and foxes on mainland landscapes.',
    eeveeTriggerHint: 'Compare rare pale morphs versus your own shiny-locked neon-red eyes.',
  },
  {
    id: 'hg-33',
    number: 33,
    title: 'Independent Lifespans Double Under Safe Care',
    speciesFocus: 'Wild vs. Managed Hedgehogs',
    category: 'Lifecycle & Ecology',
    fact: 'In the wild, hedgehogs live an average of 2 to 5 years due to road traffic, harsh winters, and predators—whereas safely sheltered individuals routinely reach 7 to 10 years old.',
    scientificNote:
      'Roadways and fenced suburban gardens remain two of the largest modern obstacles to wild European hedgehog survival, prompting "hedgehog highway" holes cut under garden fences.',
    eeveeTriggerHint: 'Approve of tactical infrastructure corridors—except keep trespassers out.',
  },
  {
    id: 'hg-34',
    number: 34,
    title: 'High-Speed Cooling Arousal Uses Brown Fat',
    speciesFocus: 'Hibernating Erinaceus europaeus',
    category: 'Diet & Physiology',
    fact: 'When waking from deep winter hibernation, a hedgehog fires up specialized "brown adipose tissue" packed around its shoulders and chest, rapidly burning stored lipids as pure heat to rewarm its heart and brain from ~5°C back to 35°C within a few hours.',
    scientificNote:
      'This non-shivering thermogenesis demands intense oxygen consumption and explains why disturbing a hibernating hedgehog mid-winter wastes vital fat reserves.',
    eeveeTriggerHint: 'Compare brown fat ignition to powering up Flare Blitz from freezing rest.',
  },
  {
    id: 'hg-35',
    number: 35,
    title: 'Distinct Scent-Gland Communication Along Trails',
    speciesFocus: 'Scent Ecology of Erinaceinae',
    category: 'Behavior & Defense',
    fact: 'Hedgehogs carry specialized sebaceous scent glands around the chin, cheek corners, and paws, subtly tagging stones, grass stems, and feeding paths so nocturnal neighbors know who patrolled the hedge recently.',
    scientificNote:
      'Male hedgehogs frequently perform noisy circling rituals—sometimes dubbed the "hedgehog carousel"—for hours while snorting around a prospective mate during spring nights.',
    eeveeTriggerHint: 'Dismiss noisy nocturnal courtship circles as embarrassing lack of dignity.',
  },
  {
    id: 'hg-36',
    number: 36,
    title: 'Curved Foreclaws Built for Digging Out Grub Burrows',
    speciesFocus: 'All True Hedgehogs',
    category: 'Anatomy & Spines',
    fact: 'Each of a hedgehog’s front paws ends in five stout, slightly curved claws paired with strong shoulder muscles built to excavate buried beetle larvae, shallow earthworm tunnels, and nighttime soil shelters.',
    scientificNote:
      'Their compact, plantigrade feet place the whole sole flat on the ground, giving steady traction when prying under bark or digging damp turf.',
    eeveeTriggerHint: 'Respect practical close-quarters claws—not unlike Metal Claw or Dig.',
  },
];

function parseDateKeyToUtcDayNumber(dateKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) {
    const now = new Date();
    return Math.floor(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return Math.floor(Date.UTC(year, month, day) / 86_400_000);
}

/**
 * Returns local calendar key YYYY-MM-DD for a Date object.
 */
export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns strictly ONE deterministic hedgehog fact for a given local calendar date.
 * Because HEDGEHOG_FACTS is indexed sequentially modulo length, consecutive days
 * always advance by +1 and therefore alternate cleanly every single day.
 */
export function getDailyHedgehogFact(dateKey = getLocalDateKey()): {
  dateKey: string;
  fact: HedgehogFactEntry;
  daySlotIndex: number;
} {
  // Reference epoch aligned cleanly so day indices step +1 each calendar day
  const EPOCH_DAY = 20000;
  const utcDay = parseDateKeyToUtcDayNumber(dateKey);
  const len = HEDGEHOG_FACTS.length;
  const index = (((utcDay - EPOCH_DAY) % len) + len) % len;
  return {
    dateKey,
    fact: HEDGEHOG_FACTS[index],
    daySlotIndex: index,
  };
}

export function getPreviousDailyHedgehogFacts(
  dateKey = getLocalDateKey(),
  count = 5
): Array<{ dateKey: string; fact: HedgehogFactEntry }> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const baseDate = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date();
  const results: Array<{ dateKey: string; fact: HedgehogFactEntry }> = [];
  for (let offset = 1; offset <= count; offset++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - offset);
    const key = getLocalDateKey(d);
    results.push({
      dateKey: key,
      fact: getDailyHedgehogFact(key).fact,
    });
  }
  return results;
}
