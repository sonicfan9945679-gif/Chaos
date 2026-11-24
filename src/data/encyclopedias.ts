export interface PreloadedEncyclopedia {
  id: string;
  name: string;
  domain: string;
  category: string;
  articleBaseUrl: string;
  apiEndpoint: string;
  featuredArticleTitle: string;
  featuredArticleUrl: string;
}

export const PRELOADED_ENCYCLOPEDIAS: PreloadedEncyclopedia[] = [
  {
    id: 'sonic',
    name: 'Sonic Wiki Zone',
    domain: 'sonic.fandom.com',
    category: 'Gaming',
    articleBaseUrl: 'https://sonic.fandom.com/wiki/',
    apiEndpoint: 'https://sonic.fandom.com/api.php',
    featuredArticleTitle: 'Sonic the Hedgehog',
    featuredArticleUrl: 'https://sonic.fandom.com/wiki/Sonic_the_Hedgehog',
  },
  {
    id: 'minecraft',
    name: 'Minecraft Wiki',
    domain: 'minecraft.wiki',
    category: 'Gaming',
    articleBaseUrl: 'https://minecraft.wiki/w/',
    apiEndpoint: 'https://minecraft.wiki/api.php',
    featuredArticleTitle: 'Ender Dragon',
    featuredArticleUrl: 'https://minecraft.wiki/w/Ender_Dragon',
  },
  {
    id: 'pacman',
    name: 'Pac-Man Wiki',
    domain: 'pacman.fandom.com',
    category: 'Gaming',
    articleBaseUrl: 'https://pacman.fandom.com/wiki/',
    apiEndpoint: 'https://pacman.fandom.com/api.php',
    featuredArticleTitle: 'Pac-Man',
    featuredArticleUrl: 'https://pacman.fandom.com/wiki/Pac-Man',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    domain: 'en.wikipedia.org',
    category: 'General',
    articleBaseUrl: 'https://en.wikipedia.org/wiki/',
    apiEndpoint: 'https://en.wikipedia.org/w/api.php',
    featuredArticleTitle: 'Red fox',
    featuredArticleUrl: 'https://en.wikipedia.org/wiki/Red_fox',
  },
  {
    id: 'smashwiki',
    name: 'SmashWiki',
    domain: 'ssbwiki.com',
    category: 'Gaming',
    articleBaseUrl: 'https://www.ssbwiki.com/',
    apiEndpoint: 'https://www.ssbwiki.com/api.php',
    featuredArticleTitle: 'Pikachu',
    featuredArticleUrl: 'https://www.ssbwiki.com/Pikachu',
  },
  {
    id: 'wikirby',
    name: 'WiKirby',
    domain: 'wikirby.com',
    category: 'Gaming',
    articleBaseUrl: 'https://wikirby.com/wiki/',
    apiEndpoint: 'https://wikirby.com/w/api.php',
    featuredArticleTitle: 'Kirby',
    featuredArticleUrl: 'https://wikirby.com/wiki/Kirby',
  },
  {
    id: 'bulbapedia',
    name: 'Bulbapedia',
    domain: 'bulbapedia.bulbagarden.net',
    category: 'Pokémon',
    articleBaseUrl: 'https://bulbapedia.bulbagarden.net/wiki/',
    apiEndpoint: 'https://bulbapedia.bulbagarden.net/w/api.php',
    featuredArticleTitle: 'Eevee (Pokémon)',
    featuredArticleUrl: 'https://bulbapedia.bulbagarden.net/wiki/Eevee_(Pok%C3%A9mon)',
  },
  {
    id: 'metalgear',
    name: 'Metal Gear Wiki',
    domain: 'metalgear.fandom.com',
    category: 'Gaming',
    articleBaseUrl: 'https://metalgear.fandom.com/wiki/',
    apiEndpoint: 'https://metalgear.fandom.com/api.php',
    featuredArticleTitle: 'Solid Snake',
    featuredArticleUrl: 'https://metalgear.fandom.com/wiki/Solid_Snake',
  },
  {
    id: 'kidicarus',
    name: 'Icaruspedia (Kid Icarus Wiki)',
    domain: 'www.kidicaruswiki.org',
    category: 'Gaming',
    articleBaseUrl: 'https://www.kidicaruswiki.org/wiki/',
    apiEndpoint: 'https://www.kidicaruswiki.org/w/api.php',
    featuredArticleTitle: 'Pit',
    featuredArticleUrl: 'https://www.kidicaruswiki.org/wiki/Pit',
  },
  {
    id: 'killlakill',
    name: 'Kill la Kill Wiki',
    domain: 'kill-la-kill.fandom.com',
    category: 'Anime',
    articleBaseUrl: 'https://kill-la-kill.fandom.com/wiki/',
    apiEndpoint: 'https://kill-la-kill.fandom.com/api.php',
    featuredArticleTitle: 'Ryuko Matoi',
    featuredArticleUrl: 'https://kill-la-kill.fandom.com/wiki/Ryuko_Matoi',
  },
  {
    id: 'metroid',
    name: 'Metroid Wiki',
    domain: 'www.metroidwiki.org',
    category: 'Gaming',
    articleBaseUrl: 'https://www.metroidwiki.org/wiki/',
    apiEndpoint: 'https://www.metroidwiki.org/w/api.php',
    featuredArticleTitle: 'Samus Aran',
    featuredArticleUrl: 'https://www.metroidwiki.org/wiki/Samus_Aran',
  },
  {
    id: 'pikipedia',
    name: 'Pikipedia (Pikmin Wiki)',
    domain: 'www.pikminwiki.com',
    category: 'Gaming',
    articleBaseUrl: 'https://www.pikminwiki.com/',
    apiEndpoint: 'https://www.pikminwiki.com/api.php',
    featuredArticleTitle: 'Captain Olimar',
    featuredArticleUrl: 'https://www.pikminwiki.com/Captain_Olimar',
  },
  {
    id: 'angrybirds',
    name: 'Angry Birds Wiki',
    domain: 'angrybirds.fandom.com',
    category: 'Gaming',
    articleBaseUrl: 'https://angrybirds.fandom.com/wiki/',
    apiEndpoint: 'https://angrybirds.fandom.com/api.php',
    featuredArticleTitle: 'Red',
    featuredArticleUrl: 'https://angrybirds.fandom.com/wiki/Red',
  },
  {
    id: 'zeldawiki',
    name: 'Zelda Wiki',
    domain: 'zeldawiki.wiki',
    category: 'Gaming',
    articleBaseUrl: 'https://zeldawiki.wiki/wiki/',
    apiEndpoint: 'https://zeldawiki.wiki/w/api.php',
    featuredArticleTitle: 'Link',
    featuredArticleUrl: 'https://zeldawiki.wiki/wiki/Link',
  },
  {
    id: 'mmkb',
    name: 'MMKB (Mega Man Knowledge Base)',
    domain: 'megaman.fandom.com',
    category: 'Gaming',
    articleBaseUrl: 'https://megaman.fandom.com/wiki/',
    apiEndpoint: 'https://megaman.fandom.com/api.php',
    featuredArticleTitle: 'Mega Man',
    featuredArticleUrl: 'https://megaman.fandom.com/wiki/Mega_Man',
  },
];

const GOOGLE_SERVICE_DOMAINS = new Set([
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'googleusercontent.com',
  'googlevideo.com',
  'youtube.com',
  'youtu.be',
  'gmail.com',
  'googlemail.com',
  'blogger.com',
  'blogspot.com',
  'goo.gl',
  'g.co',
  'firebaseapp.com',
  'web.app',
  'withgoogle.com',
  'android.com',
  'chromium.org',
  'chromebook.com',
  'deepmind.google',
  'ai.google',
  'withyoutube.com',
  'doubleclick.net',
  'googleadservices.com',
  'googlesyndication.com',
  'googletagmanager.com',
  'google-analytics.com',
  'feedburner.com',
  'ggpht.com',
  'abc.xyz',
]);

export function isGoogleServiceHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return false;
  if (GOOGLE_SERVICE_DOMAINS.has(host)) return true;
  for (const domain of GOOGLE_SERVICE_DOMAINS) {
    if (host.endsWith(`.${domain}`)) return true;
  }
  // Match regional Google domains such as google.co.uk, www.google.de, scholar.google.ca, etc.
  if (/^(?:[a-z0-9-]+\.)*google\.[a-z]{2,}(?:\.[a-z]{2,})?$/i.test(host)) {
    return true;
  }
  return false;
}

export function isDisallowedLocalHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (
      a === 127 ||
      a === 10 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }
  return false;
}

export function validateEncyclopediaArticleUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl?: string;
  hostname?: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Enter an online encyclopedia article URL to analyze.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { valid: false, error: 'Invalid URL format. Enter a full article URL such as https://en.wikipedia.org/wiki/Eevee.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only http:// and https:// URLs are supported.' };
  }

  if (isDisallowedLocalHost(parsed.hostname)) {
    return { valid: false, error: 'Local or private network URLs are not allowed.' };
  }

  if (isGoogleServiceHost(parsed.hostname)) {
    return {
      valid: false,
      error: `"${parsed.hostname}" is a Google service website. Encyclopedia Analysis only accepts non-Google online encyclopedias and wikis.`,
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    hostname: parsed.hostname.toLowerCase(),
  };
}

export function matchPreloadedEncyclopedia(hostname: string): PreloadedEncyclopedia | null {
  const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
  return (
    PRELOADED_ENCYCLOPEDIAS.find((wiki) => {
      const wikiHost = wiki.domain.toLowerCase().replace(/^www\./, '');
      if (cleanHost === wikiHost) return true;
      if (wiki.id === 'wikipedia' && cleanHost.endsWith('.wikipedia.org')) return true;
      return false;
    }) ?? null
  );
}
