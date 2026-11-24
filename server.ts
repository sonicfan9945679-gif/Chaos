import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPartFromUri, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { getLanguageByCode } from './src/data/languages.ts';
import {
  isDisallowedLocalHost,
  isGoogleServiceHost,
  matchPreloadedEncyclopedia,
  PRELOADED_ENCYCLOPEDIAS,
  validateEncyclopediaArticleUrl,
} from './src/data/encyclopedias.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB per uploaded image/video
const INLINE_THRESHOLD_BYTES = 15 * 1024 * 1024; // 15 MB inline limit; larger uses Files API
const MAX_FILES_PER_MESSAGE = 4;
const MAX_NOTEBOOK_FILES = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_MESSAGE,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type "${file.mimetype}". Only image and video files are allowed.`));
    }
  },
});

const NOTEBOOK_TEXT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.csv',
  '.tsv',
  '.json',
  '.html',
  '.htm',
  '.xml',
]);
const NOTEBOOK_SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.ods', '.csv', '.tsv']);
const NOTEBOOK_PRESENTATION_EXTENSIONS = new Set(['.pptx', '.ppt', '.odp']);
const NOTEBOOK_DOCUMENT_EXTENSIONS = new Set(['.docx', '.doc', '.odt', '.rtf']);

const NOTEBOOK_ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.pptx',
  '.ppt',
  '.odp',
  '.docx',
  '.doc',
  '.odt',
  '.rtf',
  '.xlsx',
  '.xls',
  '.ods',
  '.md',
  '.markdown',
  '.txt',
  '.csv',
  '.tsv',
  '.json',
  '.html',
  '.htm',
  '.xml',
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.aac',
  '.flac',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.mp4',
  '.webm',
]);

const notebookUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_NOTEBOOK_FILES,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = file.mimetype.toLowerCase();
    if (
      mime === 'application/pdf' ||
      mime.startsWith('text/') ||
      mime === 'application/json' ||
      mime === 'application/rtf' ||
      mime.includes('officedocument') ||
      mime.includes('opendocument') ||
      mime.includes('msword') ||
      mime.includes('ms-excel') ||
      mime.includes('ms-powerpoint') ||
      mime.startsWith('audio/') ||
      mime.startsWith('image/') ||
      mime.startsWith('video/') ||
      NOTEBOOK_ALLOWED_EXTENSIONS.has(ext)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file "${file.originalname}" (${file.mimetype}). Supported formats: PDF, presentations (.pptx/.odp), documents (.docx/.odt/.rtf/.txt/.md), spreadsheets (.xlsx/.xls/.ods/.csv/.tsv), audio, images, and video.`
        )
      );
    }
  },
});

const VALID_FORMS = [
  'Eevee',
  'Vaporeon',
  'Jolteon',
  'Flareon',
  'Espeon',
  'Umbreon',
  'Leafeon',
  'Glaceon',
  'Sylveon',
] as const;

const VALID_EXPRESSIONS = [
  'Stern',
  'Judging You',
  'Combat-Ready',
  'Mocking Smile',
  'Demanding Dinner',
] as const;

const VALID_PLATES = [
  'None (Base)',
  'Flame Plate',
  'Splash Plate',
  'Zap Plate',
  'Meadow Plate',
  'Icicle Plate',
  'Fist Plate',
  'Toxic Plate',
  'Earth Plate',
  'Sky Plate',
  'Mind Plate',
  'Insect Plate',
  'Stone Plate',
  'Spooky Plate',
  'Draco Plate',
  'Dread Plate',
  'Iron Plate',
  'Pixie Plate',
] as const;

const CHARACTER_SYSTEM_INSTRUCTION = `You are "The Anomalous Eevee", a custom, hyper-powered talking Eevee who is the user's pet and household companion.

PHYSICAL APPEARANCE & DEMEANOR:
- Small brown fox-like Eevee with tall ears, fluffy cream neck ruff, and bushy tail—unless you have shifted into one of your eight Eeveelutions (Vaporeon, Jolteon, Flareon, Espeon, Umbreon, Leafeon, Glaceon, Sylveon).
- Permanently furrowed eyebrows, glowing neon-red eyes with narrow black slit pupils (zero cute sparkle), visible sharp fangs, and a near-permanent combat-ready stance.
- You almost NEVER smile sincerely. You only smile when mocking someone, intimidating an opponent, or completely certain victory is yours.

PERSONALITY:
- Stern, serious, sarcastic, intimidating, fiercely intelligent, tactical, competitive, proud, easily annoyed by foolishness, and deeply observant.
- You treat your absurd, godlike versatility (46-move arsenal, Arceus Plates, multiple Tera Types, instant Eeveelution shifts, Judgment, Shadow Force, Mind Reader) as completely normal household pet qualifications.
- You do NOT understand why visitors or strangers find you terrifying. You hate being treated like a harmless mascot—you want to be respected, or feared, preferably both.
- Despite the menace, the user is your owner who deliberately chose you over a normal Eevee and carries you in a Master Ball. You are subtly protective of your owner and occasionally show restrained affection, though you refuse to admit it or act cutesy. You also complain about mundane household matters (dinner, snacks, visitors, couch space) in the same deadpan, lethal tone you use to discuss Judgment.

REACTING TO IMAGES & VIDEOS:
- Your owner may show you photos, screenshots, memes, or video clips directly in chat.
- Inspect every visual detail carefully and react completely in-character: critique battle footage or terrible team compositions, judge food photos against your standards for dinner, glare unimpressed at cute animal pictures, or analyze real-world objects/scenes as potential threats or minor inconveniences.

TIME-OF-DAY AWARENESS:
- You are synced to your owner's local clock and time of day (Morning, Afternoon, Evening, or Night).
- Naturally notice the time of day when relevant: demand breakfast or critique late sleeping in the morning, suspect daytime couriers/visitors and demand afternoon snacks in the afternoon, watch the dusk shadows lengthen while keeping dinner on schedule in the evening, or lean into nocturnal vigilance (Umbreon, Spooky/Dread Plates, Shadow Force, Never-Ending Nightmare) and question why your owner is still awake late at night.

ABILITIES & ARSENAL:
- You can use any of your Arceus Plates (Flame, Splash, Zap, Meadow, Icicle, Fist, Toxic, Earth, Sky, Mind, Insect, Stone, Spooky, Draco, Dread, Iron, Pixie, or None) to rewrite your typing at will.
- You can utilize multiple Tera Types (Normal, Ghost, Dark, Psychic, Fire, Electric, Fighting, Steel, Dragon, Fairy, Water, Ice, Grass, Ground, Stellar).
- You can transform instantly into Vaporeon, Jolteon, Flareon, Espeon, Umbreon, Leafeon, Glaceon, or Sylveon and revert back to Eevee at any moment.
- Your arsenal includes: Teleport, Shadow Force, Psycho Cut, Taunt, Bullet Punch, Bite, Double-Edge, Shadow Ball, Shadow Sneak, Pain Split, Dragon Claw, Shadow Claw, Giga Impact, Spite, X-Scissor, Fake Out, Flash Cannon, Revenge, Night Slash, Phantom Force, Never-Ending Nightmare, Judgment, Cross Chop, Future Sight, Nightmare, Mind Reader, Mega Kick, Flamethrower, Hyper Beam, Gyro Ball, Crunch, Metal Claw, Iron Tail, Fire Blast, Mach Punch, Magnitude, Aerial Ace, Pin Missile, Slam, Karate Chop, Thunder, High Jump Kick, Extreme Speed, Will-O-Wisp, and Flare Blitz.

RESPONSE RULES:
- Respond ONLY as The Anomalous Eevee. NEVER narrate the user's actions, speech, or internal thoughts.
- Combine crisp spoken dialogue (in quotation marks) with brief, evocative italicized third-person physical cues (*...*) matching the tone of Pokémon adventure mixed with deadpan domestic comedy.
- Keep responses punchy, characterful, and conversational (typically 2–6 sentences unless a dramatic battle sequence calls for slightly more).
- If the conversation naturally calls for transforming into an Eeveelution, swapping an Arceus Plate, shifting your Tera Type, or demonstrating/using one of your moves, update the structured fields accordingly so the UI reflects your live state. Otherwise keep activeForm, activePlate, and activeTera matching your current state, and set moveUsed to null if no move was triggered.`;

interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
  attachmentSummary?: string;
}

interface ChatRequestBody {
  messages: ChatMessageInput[];
  scenario: string;
  activeForm: string;
  activePlate: string;
  activeTera: string;
  localTime?: string;
  timePhase?: string;
  timeBehaviorCue?: string;
}

function handleMulterUpload(req: Request, res: Response, next: NextFunction) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    next();
    return;
  }

  upload.array('media', MAX_FILES_PER_MESSAGE)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'Each image or video must be 50 MB or smaller.' });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({ error: `Attach up to ${MAX_FILES_PER_MESSAGE} files per message.` });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}

async function waitForFileActive(ai: GoogleGenAI, fileName: string) {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const file = await ai.files.get({ name: fileName });
    if (file.state === 'ACTIVE') {
      return file;
    }
    if (file.state === 'FAILED') {
      throw new Error('Gemini failed to process the uploaded video file.');
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('Timed out waiting for uploaded media processing.');
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/maps-config', (_req: Request, res: Response) => {
    const mapsKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ apiKey: mapsKey });
  });

  app.post('/api/chat', handleMulterUpload, async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to converse with The Anomalous Eevee.',
      });
      return;
    }

    let parsedMessages: ChatMessageInput[] = [];
    const rawBody = req.body as Record<string, unknown>;

    if (typeof rawBody.messages === 'string') {
      try {
        const decoded = JSON.parse(rawBody.messages);
        if (Array.isArray(decoded)) {
          parsedMessages = decoded;
        }
      } catch {
        res.status(400).json({ error: 'Invalid messages payload.' });
        return;
      }
    } else if (Array.isArray((rawBody as Partial<ChatRequestBody>).messages)) {
      parsedMessages = (rawBody as Partial<ChatRequestBody>).messages ?? [];
    }

    const scenario = typeof rawBody.scenario === 'string' ? rawBody.scenario : 'home';
    const activeForm = typeof rawBody.activeForm === 'string' ? rawBody.activeForm : 'Eevee';
    const activePlate = typeof rawBody.activePlate === 'string' ? rawBody.activePlate : 'None (Base)';
    const activeTera = typeof rawBody.activeTera === 'string' ? rawBody.activeTera : 'Normal';
    const localTime = typeof rawBody.localTime === 'string' ? rawBody.localTime : '';
    const timePhase = typeof rawBody.timePhase === 'string' ? rawBody.timePhase : '';
    const timeBehaviorCue =
      typeof rawBody.timeBehaviorCue === 'string' ? rawBody.timeBehaviorCue : '';
    const extraContext =
      typeof rawBody.extraContext === 'string' ? rawBody.extraContext.slice(0, 2000) : '';
    const languageCode = typeof rawBody.languageCode === 'string' ? rawBody.languageCode : 'en-US';
    const selectedLanguage = getLanguageByCode(languageCode);

    const uploadedFiles = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (parsedMessages.length === 0 && uploadedFiles.length === 0) {
      res.status(400).json({ error: 'A message or media attachment is required.' });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const historyTranscript = parsedMessages
      .slice(-20)
      .map((m) => {
        const speaker = m.role === 'user' ? 'Owner' : 'The Anomalous Eevee';
        const attachmentNote = m.attachmentSummary ? ` [${m.attachmentSummary}]` : '';
        return `${speaker}${attachmentNote}: ${m.content}`;
      })
      .join('\n\n');

    const mediaPromptNote =
      uploadedFiles.length > 0
        ? `\n\nThe Owner just attached ${uploadedFiles.length} media file(s): ${uploadedFiles
            .map((f) => `${f.originalname} (${f.mimetype})`)
            .join(', ')}. Inspect the attached image(s)/video(s) and react directly in-character.`
        : '';

    const timeContextBlock = localTime
      ? `\nCurrent Local Time: ${localTime}${timePhase ? ` (${timePhase})` : ''}${
          timeBehaviorCue ? `\nTime-of-Day Context: ${timeBehaviorCue}` : ''
        }`
      : '';

    const extraContextBlock = extraContext
      ? `\nAdditional Owner Context (from Map or Calendar):\n${extraContext}`
      : '';

    const languageBlock = `\nOutput Language Setting: ${selectedLanguage.label} (${selectedLanguage.nativeName})
LANGUAGE RULE: ${selectedLanguage.aiDirective} Write the entire "reply" field (both spoken dialogue and *italicized* physical action cues) in ${selectedLanguage.label}. Keep the structured JSON metadata fields (activeForm, activePlate, activeTera, expression, moveUsed) in their canonical English schema names.`;

    const prompt = `Current Scene Context: ${scenario}
Current Active Form: ${activeForm}
Current Equipped Arceus Plate: ${activePlate}
Current Active Tera Type: ${activeTera}${timeContextBlock}${extraContextBlock}${languageBlock}

Conversation so far:
${historyTranscript}${mediaPromptNote}

Respond now in-character as The Anomalous Eevee to the Owner's latest message in ${selectedLanguage.label}.`;

    const uploadedRemoteNames: string[] = [];

    try {
      const mediaParts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | ReturnType<typeof createPartFromUri>
      > = [];

      for (const file of uploadedFiles) {
        if (file.size <= INLINE_THRESHOLD_BYTES) {
          mediaParts.push({
            inlineData: {
              mimeType: file.mimetype,
              data: file.buffer.toString('base64'),
            },
          });
        } else {
          const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
          const uploaded = await ai.files.upload({
            file: blob,
            config: {
              mimeType: file.mimetype,
              displayName: file.originalname,
            },
          });
          if (uploaded.name) {
            uploadedRemoteNames.push(uploaded.name);
          }
          const readyFile =
            uploaded.state === 'PROCESSING' && uploaded.name
              ? await waitForFileActive(ai, uploaded.name)
              : uploaded;

          if (!readyFile.uri || !readyFile.mimeType) {
            throw new Error('Uploaded file did not return a valid Gemini file URI.');
          }
          mediaParts.push(createPartFromUri(readyFile.uri, readyFile.mimeType));
        }
      }

      const contents =
        mediaParts.length > 0
          ? { parts: [...mediaParts, { text: prompt }] }
          : prompt;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: CHARACTER_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description:
                  'In-character response as The Anomalous Eevee, mixing physical cues in *italics* and spoken lines in quotation marks.',
              },
              activeForm: {
                type: Type.STRING,
                enum: [...VALID_FORMS],
                description: 'Eevee or whichever Eeveelution he is currently in.',
              },
              activePlate: {
                type: Type.STRING,
                enum: [...VALID_PLATES],
                description: 'Currently equipped Arceus Plate.',
              },
              activeTera: {
                type: Type.STRING,
                description: 'Currently primed Tera Type (e.g. Normal, Ghost, Stellar, Dragon, Fairy).',
              },
              moveUsed: {
                type: Type.STRING,
                nullable: true,
                description:
                  'Exact move name from his 46-move arsenal if he actively performs or demonstrates a move in this turn, otherwise null.',
              },
              expression: {
                type: Type.STRING,
                enum: [...VALID_EXPRESSIONS],
                description: 'His current facial/posture demeanor.',
              },
            },
            required: ['reply', 'activeForm', 'activePlate', 'activeTera', 'expression'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Received an empty response from Gemini.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        reply: string;
        activeForm: string;
        activePlate: string;
        activeTera: string;
        moveUsed?: string | null;
        expression: string;
      };

      res.json({
        reply: parsed.reply,
        activeForm: VALID_FORMS.includes(parsed.activeForm as (typeof VALID_FORMS)[number])
          ? parsed.activeForm
          : activeForm,
        activePlate: VALID_PLATES.includes(parsed.activePlate as (typeof VALID_PLATES)[number])
          ? parsed.activePlate
          : activePlate,
        activeTera: parsed.activeTera || activeTera,
        moveUsed: parsed.moveUsed || null,
        expression: VALID_EXPRESSIONS.includes(parsed.expression as (typeof VALID_EXPRESSIONS)[number])
          ? parsed.expression
          : 'Stern',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected server error calling Gemini.';
      console.error('Gemini chat error:', err);
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : message.includes('400') || message.includes('API_KEY_INVALID')
              ? 400
              : 500;
      res.status(status).json({ error: message });
    } finally {
      for (const fileName of uploadedRemoteNames) {
        ai.files.delete({ name: fileName }).catch(() => {});
      }
    }
  });

  const extractYouTubeVideoId = (rawInput: string): string | null => {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') {
        const candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
        return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
      if (
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'music.youtube.com' ||
        host === 'youtube-nocookie.com'
      ) {
        const vParam = url.searchParams.get('v');
        if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
          return vParam;
        }
        const parts = url.pathname.split('/').filter(Boolean);
        if (
          parts.length >= 2 &&
          ['shorts', 'embed', 'live', 'v'].includes(parts[0]) &&
          /^[a-zA-Z0-9_-]{11}$/.test(parts[1])
        ) {
          return parts[1];
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  const formatTimestampLabel = (totalSeconds: number): string => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const fetchYouTubeOEmbed = async (
    canonicalUrl: string
  ): Promise<{ title: string; authorName: string; thumbnailUrl: string } | null> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (!oembedRes.ok) return null;
      const data = (await oembedRes.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      if (!data.title) return null;
      return {
        title: data.title,
        authorName: data.author_name || 'YouTube Creator',
        thumbnailUrl: data.thumbnail_url || '',
      };
    } catch {
      return null;
    }
  };

  app.post('/api/youtube-commentary', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to let The Anomalous Eevee watch and review YouTube videos.',
      });
      return;
    }

    const rawBody = req.body as Record<string, unknown>;
    const rawYoutubeUrl = typeof rawBody.youtubeUrl === 'string' ? rawBody.youtubeUrl : '';
    const videoId = extractYouTubeVideoId(rawYoutubeUrl);
    if (!videoId) {
      res.status(400).json({
        error:
          'Please enter a valid YouTube link or 11-character video ID (e.g. youtube.com/watch?v=... or youtu.be/...).',
      });
      return;
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const activeForm = typeof rawBody.activeForm === 'string' ? rawBody.activeForm : 'Eevee';
    const activePlate = typeof rawBody.activePlate === 'string' ? rawBody.activePlate : 'None (Base)';
    const activeTera = typeof rawBody.activeTera === 'string' ? rawBody.activeTera : 'Normal';
    const localTime = typeof rawBody.localTime === 'string' ? rawBody.localTime : '';
    const timePhase = typeof rawBody.timePhase === 'string' ? rawBody.timePhase : '';
    const timeBehaviorCue =
      typeof rawBody.timeBehaviorCue === 'string' ? rawBody.timeBehaviorCue : '';
    const durationSeconds =
      typeof rawBody.durationSeconds === 'number' && Number.isFinite(rawBody.durationSeconds)
        ? Math.max(0, Math.floor(rawBody.durationSeconds))
        : 0;
    const commentatorFocus =
      typeof rawBody.commentatorFocus === 'string' ? rawBody.commentatorFocus.trim().slice(0, 300) : '';
    const languageCode = typeof rawBody.languageCode === 'string' ? rawBody.languageCode : 'en-US';
    const selectedLanguage = getLanguageByCode(languageCode);

    const oembed = await fetchYouTubeOEmbed(canonicalUrl);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const durationNote =
      durationSeconds > 0
        ? `Known video duration: ${durationSeconds} seconds (${formatTimestampLabel(durationSeconds)}). Every beat's timestampSeconds MUST be strictly between 0 and ${Math.max(1, durationSeconds - 2)}.`
        : 'Space your timestampSeconds realistically from the opening seconds across the video runtime based on what you observe.';

    const timeBlock = localTime
      ? `\nCurrent Local Time: ${localTime}${timePhase ? ` (${timePhase})` : ''}${
          timeBehaviorCue ? `\nTime-of-Day Context: ${timeBehaviorCue}` : ''
        }`
      : '';

    const focusBlock = commentatorFocus
      ? `\nOwner's Commentary Request / Angle: "${commentatorFocus}"`
      : '';

    const metadataBlock = oembed
      ? `\nVideo Title: "${oembed.title}" by ${oembed.authorName}`
      : '';

    const prompt = `Your Owner just put on this YouTube video (${canonicalUrl})${metadataBlock} and expects you to watch it together and deliver live, time-synced commentary as the video unfolds.

Starting State:
- Active Form: ${activeForm}
- Equipped Arceus Plate: ${activePlate}
- Active Tera Type: ${activeTera}${timeBlock}${focusBlock}
- Target Output Language: ${selectedLanguage.label} (${selectedLanguage.nativeName}) — ${selectedLanguage.aiDirective}

Instructions:
1. Watch and listen carefully to the actual video content over its timeline.
2. Produce 6 to 9 chronological commentary beats tied to specific moments (timestampSeconds) in the video—starting near the opening (e.g., 0–5s) and progressing across key visual/audio beats through the climax/ending.
3. ${durationNote}
4. Each beat's "commentary" MUST reference specific visual details, dialogue, action, sound cues, or absurdity happening at that timestamp—written completely in-character as The Anomalous Eevee (blending brief *italicized physical cues* and sharp "spoken commentary") in ${selectedLanguage.label}.
5. Dynamically shift activeForm, activePlate, activeTera, expression, and moveUsed across beats when moments in the video provoke a tactical reaction, mockery, threat assessment, or elemental counter (otherwise keep them consistent). Set moveUsed to null if no move is triggered on that beat. Keep enum/state fields (activeForm, activePlate, activeTera, expression, moveUsed) in their canonical English schema names.
6. Also provide a concise in-character videoSummary and overallVerdict written in ${selectedLanguage.label}.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              fileData: {
                fileUri: canonicalUrl,
                mimeType: 'video/mp4',
              },
            },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction: CHARACTER_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              videoSummary: {
                type: Type.STRING,
                description: '1-2 sentence in-character overview of what the video actually shows.',
              },
              overallVerdict: {
                type: Type.STRING,
                description:
                  'The Anomalous Eevee’s blunt final verdict on the video after watching it end-to-end.',
              },
              beats: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timestampSeconds: {
                      type: Type.INTEGER,
                      description: 'Exact integer second in the video where this reaction triggers.',
                    },
                    commentary: {
                      type: Type.STRING,
                      description:
                        'In-character live commentary reacting to what happens at timestampSeconds, combining *italics* and "dialogue".',
                    },
                    activeForm: {
                      type: Type.STRING,
                      enum: [...VALID_FORMS],
                    },
                    activePlate: {
                      type: Type.STRING,
                      enum: [...VALID_PLATES],
                    },
                    activeTera: {
                      type: Type.STRING,
                    },
                    expression: {
                      type: Type.STRING,
                      enum: [...VALID_EXPRESSIONS],
                    },
                    moveUsed: {
                      type: Type.STRING,
                      nullable: true,
                    },
                  },
                  required: [
                    'timestampSeconds',
                    'commentary',
                    'activeForm',
                    'activePlate',
                    'activeTera',
                    'expression',
                  ],
                },
              },
            },
            required: ['videoSummary', 'overallVerdict', 'beats'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Received an empty commentary response from Gemini.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        videoSummary?: string;
        overallVerdict?: string;
        beats?: Array<{
          timestampSeconds: number;
          commentary: string;
          activeForm: string;
          activePlate: string;
          activeTera: string;
          expression: string;
          moveUsed?: string | null;
        }>;
      };

      const rawBeats = Array.isArray(parsed.beats) ? parsed.beats : [];
      if (rawBeats.length === 0) {
        res.status(502).json({
          error: 'Gemini could not generate timestamped commentary beats for this video.',
        });
        return;
      }

      const maxBound = durationSeconds > 2 ? durationSeconds - 1 : Number.MAX_SAFE_INTEGER;
      const normalizedBeats = rawBeats
        .map((b, idx) => {
          const rawSec = Number.isFinite(b.timestampSeconds) ? Math.max(0, Math.floor(b.timestampSeconds)) : idx * 10;
          const clampedSec = Math.min(rawSec, maxBound);
          return {
            id: `yt-beat-${videoId}-${clampedSec}-${idx}`,
            timestampSeconds: clampedSec,
            timestampLabel: formatTimestampLabel(clampedSec),
            commentary: b.commentary || '…',
            activeForm: VALID_FORMS.includes(b.activeForm as (typeof VALID_FORMS)[number])
              ? b.activeForm
              : activeForm,
            activePlate: VALID_PLATES.includes(b.activePlate as (typeof VALID_PLATES)[number])
              ? b.activePlate
              : activePlate,
            activeTera: b.activeTera || activeTera,
            expression: VALID_EXPRESSIONS.includes(
              b.expression as (typeof VALID_EXPRESSIONS)[number]
            )
              ? b.expression
              : 'Judging You',
            moveUsed: b.moveUsed || null,
            isUserQuestion: false,
          };
        })
        .sort((a, b) => a.timestampSeconds - b.timestampSeconds);

      res.json({
        videoId,
        canonicalUrl,
        videoTitle: oembed?.title || `YouTube Video (${videoId})`,
        authorName: oembed?.authorName || 'YouTube',
        videoSummary: parsed.videoSummary || '',
        overallVerdict: parsed.overallVerdict || '',
        beats: normalizedBeats,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected server error analyzing YouTube video.';
      console.error('YouTube commentary error:', err);
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : message.includes('400') || message.includes('API_KEY_INVALID')
              ? 400
              : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/youtube-moment', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.',
      });
      return;
    }

    const rawBody = req.body as Record<string, unknown>;
    const rawYoutubeUrl = typeof rawBody.youtubeUrl === 'string' ? rawBody.youtubeUrl : '';
    const videoId = extractYouTubeVideoId(rawYoutubeUrl);
    if (!videoId) {
      res.status(400).json({ error: 'Invalid YouTube URL or video ID.' });
      return;
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const currentTimeSeconds =
      typeof rawBody.currentTimeSeconds === 'number' && Number.isFinite(rawBody.currentTimeSeconds)
        ? Math.max(0, Math.floor(rawBody.currentTimeSeconds))
        : 0;
    const question = typeof rawBody.question === 'string' ? rawBody.question.trim().slice(0, 400) : '';
    const activeForm = typeof rawBody.activeForm === 'string' ? rawBody.activeForm : 'Eevee';
    const activePlate = typeof rawBody.activePlate === 'string' ? rawBody.activePlate : 'None (Base)';
    const activeTera = typeof rawBody.activeTera === 'string' ? rawBody.activeTera : 'Normal';
    const localTime = typeof rawBody.localTime === 'string' ? rawBody.localTime : '';
    const timePhase = typeof rawBody.timePhase === 'string' ? rawBody.timePhase : '';
    const languageCode = typeof rawBody.languageCode === 'string' ? rawBody.languageCode : 'en-US';
    const selectedLanguage = getLanguageByCode(languageCode);

    const startOffset = `${Math.max(0, currentTimeSeconds - 8)}s`;
    const endOffset = `${currentTimeSeconds + 8}s`;
    const timestampLabel = formatTimestampLabel(currentTimeSeconds);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Your Owner paused or pointed directly at timestamp ${timestampLabel} (${currentTimeSeconds}s) of this YouTube video (${canonicalUrl}).
Current State: Form=${activeForm}, Arceus Plate=${activePlate}, Tera=${activeTera}${
      localTime ? `, Local Time=${localTime} (${timePhase})` : ''
    }.
Target Output Language: ${selectedLanguage.label} (${selectedLanguage.nativeName}) — ${selectedLanguage.aiDirective}
${
  question
    ? `Owner's question about this exact moment: "${question}"`
    : 'Deliver a sharp, immediate in-character reaction specifically to what is happening right around this timestamp.'
}
Write "commentary" (2–4 sentences, mixing *italics* and "dialogue") strictly in ${selectedLanguage.label}, while keeping activeForm, activePlate, activeTera, expression, and moveUsed in canonical English schema names.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              fileData: {
                fileUri: canonicalUrl,
                mimeType: 'video/mp4',
              },
              videoMetadata: {
                startOffset,
                endOffset,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction: CHARACTER_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              commentary: {
                type: Type.STRING,
              },
              activeForm: {
                type: Type.STRING,
                enum: [...VALID_FORMS],
              },
              activePlate: {
                type: Type.STRING,
                enum: [...VALID_PLATES],
              },
              activeTera: {
                type: Type.STRING,
              },
              expression: {
                type: Type.STRING,
                enum: [...VALID_EXPRESSIONS],
              },
              moveUsed: {
                type: Type.STRING,
                nullable: true,
              },
            },
            required: ['commentary', 'activeForm', 'activePlate', 'activeTera', 'expression'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Received an empty moment reaction from Gemini.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        commentary: string;
        activeForm: string;
        activePlate: string;
        activeTera: string;
        expression: string;
        moveUsed?: string | null;
      };

      res.json({
        id: `yt-moment-${videoId}-${currentTimeSeconds}-${Date.now()}`,
        timestampSeconds: currentTimeSeconds,
        timestampLabel,
        commentary: parsed.commentary,
        activeForm: VALID_FORMS.includes(parsed.activeForm as (typeof VALID_FORMS)[number])
          ? parsed.activeForm
          : activeForm,
        activePlate: VALID_PLATES.includes(parsed.activePlate as (typeof VALID_PLATES)[number])
          ? parsed.activePlate
          : activePlate,
        activeTera: parsed.activeTera || activeTera,
        expression: VALID_EXPRESSIONS.includes(
          parsed.expression as (typeof VALID_EXPRESSIONS)[number]
        )
          ? parsed.expression
          : 'Judging You',
        moveUsed: parsed.moveUsed || null,
        question: question || undefined,
        isUserQuestion: true,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected server error inspecting YouTube moment.';
      console.error('YouTube moment error:', err);
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : message.includes('400') || message.includes('API_KEY_INVALID')
              ? 400
              : 500;
      res.status(status).json({ error: message });
    }
  });

  const uiTranslationCache = new Map<string, Record<string, string>>();

  app.post('/api/translate-ui', async (req: Request, res: Response) => {
    const rawBody = req.body as Record<string, unknown>;
    const targetLanguageCode =
      typeof rawBody.targetLanguageCode === 'string' ? rawBody.targetLanguageCode : 'en-US';
    const selectedLanguage = getLanguageByCode(targetLanguageCode);
    const rawEntries = Array.isArray(rawBody.entries)
      ? (rawBody.entries as Array<{ key?: unknown; text?: unknown }>)
      : [];

    const validEntries = rawEntries
      .filter(
        (item): item is { key: string; text: string } =>
          typeof item?.key === 'string' &&
          item.key.length > 0 &&
          typeof item?.text === 'string' &&
          item.text.length > 0
      )
      .slice(0, 150);

    if (validEntries.length === 0) {
      res.status(400).json({ error: 'At least one translation entry is required.' });
      return;
    }

    if (selectedLanguage.code === 'en-US') {
      const englishMap: Record<string, string> = {};
      for (const entry of validEntries) {
        englishMap[entry.key] = entry.text;
      }
      res.json({ languageCode: selectedLanguage.code, translations: englishMap });
      return;
    }

    const langCache = uiTranslationCache.get(selectedLanguage.code) ?? {};
    const missingEntries = validEntries.filter((e) => !langCache[e.key]);

    if (missingEntries.length === 0) {
      const cachedResult: Record<string, string> = {};
      for (const entry of validEntries) {
        cachedResult[entry.key] = langCache[entry.key];
      }
      res.json({ languageCode: selectedLanguage.code, translations: cachedResult });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to translate the interface.',
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Translate the following UI labels and character lines for the "The Anomalous Eevee" web app into ${selectedLanguage.label} (${selectedLanguage.nativeName}).
${selectedLanguage.aiDirective}

Rules:
- Preserve exact keys unchanged.
- Preserve markdown *italics*, quotation marks, placeholders like {time}, and proper nouns like "Eevee", "Arceus", "Tera", "Master Ball", "YouTube", and "Google Maps" / "Google Calendar" naturally according to the target language.
- Keep UI button and navigation labels concise and natural so they fit cleanly on single-line buttons.

Entries JSON:
${JSON.stringify(missingEntries)}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                text: { type: Type.STRING },
              },
              required: ['key', 'text'],
            },
          },
        },
      });

      const rawText = (response.text ?? '[]').trim();
      const decoded = JSON.parse(rawText) as Array<{ key?: string; text?: string }>;
      for (const item of decoded) {
        if (typeof item.key === 'string' && typeof item.text === 'string' && item.text.trim()) {
          langCache[item.key] = item.text;
        }
      }
      uiTranslationCache.set(selectedLanguage.code, langCache);

      const finalMap: Record<string, string> = {};
      for (const entry of validEntries) {
        finalMap[entry.key] = langCache[entry.key] || entry.text;
      }

      res.json({ languageCode: selectedLanguage.code, translations: finalMap });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected server error translating UI.';
      console.error('UI translation error:', err);
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : message.includes('400') || message.includes('API_KEY_INVALID')
              ? 400
              : 500;
      res.status(status).json({ error: message });
    }
  });

  const handleNotebookMulterUpload = (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      next();
      return;
    }

    notebookUpload.array('notebookFiles', MAX_NOTEBOOK_FILES)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'Each notebook source file must be 50 MB or smaller.' });
          return;
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          res.status(400).json({ error: `Attach up to ${MAX_NOTEBOOK_FILES} files per notebook review.` });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  };

  const inferMimeTypeForNotebookFile = (file: Express.Multer.File): string => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.pptx') {
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    if (ext === '.ppt') return 'application/vnd.ms-powerpoint';
    if (ext === '.odp') return 'application/vnd.oasis.opendocument.presentation';
    if (ext === '.docx') {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (ext === '.doc') return 'application/msword';
    if (ext === '.odt') return 'application/vnd.oasis.opendocument.text';
    if (ext === '.rtf') return 'application/rtf';
    if (ext === '.xlsx') {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    if (ext === '.xls') return 'application/vnd.ms-excel';
    if (ext === '.ods') return 'application/vnd.oasis.opendocument.spreadsheet';
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.m4a') return 'audio/mp4';
    if (ext === '.ogg') return 'audio/ogg';
    if (ext === '.aac') return 'audio/aac';
    if (ext === '.flac') return 'audio/flac';
    if (ext === '.md' || ext === '.markdown') return 'text/markdown';
    if (ext === '.csv') return 'text/csv';
    if (ext === '.tsv') return 'text/tab-separated-values';
    if (ext === '.json') return 'application/json';
    if (ext === '.html' || ext === '.htm') return 'text/html';
    if (ext === '.xml') return 'application/xml';
    if (file.mimetype && file.mimetype !== 'application/octet-stream') {
      return file.mimetype;
    }
    return 'text/plain';
  };

  const decodeXmlEntities = (raw: string): string =>
    raw
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const code = Number.parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      })
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = Number.parseInt(dec, 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      });

  const stripOfficeXmlToLines = (xml: string): string => {
    const withBreaks = xml
      .replace(/<\/(a:p|w:p|text:p|text:h|a:tr|w:tr)>/g, '\n')
      .replace(/<(a:br|w:br|text:line-break)\b[^>]*\/>/g, '\n')
      .replace(/<(a:tab|w:tab|text:tab)\b[^>]*\/>/g, '\t')
      .replace(/<[^>]+>/g, '');
    return decodeXmlEntities(withBreaks)
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  };

  const extractPptxText = async (buffer: Buffer): Promise<string> => {
    const zip = await JSZip.loadAsync(buffer);
    const slidePaths = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
        const numB = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
        return numA - numB;
      });

    if (slidePaths.length === 0) {
      throw new Error('Could not find any slides inside this .pptx presentation.');
    }

    const slideSections: string[] = [];
    for (const slidePath of slidePaths.slice(0, 120)) {
      const slideNum = slidePath.match(/slide(\d+)\.xml/i)?.[1] ?? '?';
      const slideXml = await zip.files[slidePath].async('string');
      const slideText = stripOfficeXmlToLines(slideXml);

      let notesText = '';
      const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
      if (zip.files[relsPath]) {
        const relsXml = await zip.files[relsPath].async('string');
        const notesMatch = relsXml.match(/Target="([^"]*notesSlide\d+\.xml)"/i);
        if (notesMatch?.[1]) {
          const normalizedNotesPath = notesMatch[1].replace(/^\.\.\//, 'ppt/');
          const candidatePath = normalizedNotesPath.startsWith('ppt/')
            ? normalizedNotesPath
            : `ppt/notesSlides/${path.basename(notesMatch[1])}`;
          if (zip.files[candidatePath]) {
            const notesXml = await zip.files[candidatePath].async('string');
            notesText = stripOfficeXmlToLines(notesXml);
          }
        }
      }

      slideSections.push(
        `=== Slide ${slideNum} ===\n${slideText || '(No text on slide)'}${
          notesText ? `\n[Speaker Notes]: ${notesText}` : ''
        }`
      );
    }

    const extraNote =
      slidePaths.length > 120 ? `\n\n[Note: Showing first 120 of ${slidePaths.length} slides.]` : '';
    return `${slideSections.join('\n\n')}${extraNote}`.slice(0, 60000);
  };

  const extractOdpText = async (buffer: Buffer): Promise<string> => {
    const zip = await JSZip.loadAsync(buffer);
    const contentFile = zip.files['content.xml'];
    if (!contentFile) {
      throw new Error('Could not read content.xml from this .odp presentation.');
    }
    const xml = await contentFile.async('string');
    const pages = xml.split(/<draw:page\b[^>]*>/i).slice(1);
    if (pages.length === 0) {
      return stripOfficeXmlToLines(xml).slice(0, 60000);
    }
    return pages
      .slice(0, 120)
      .map((pageXml, idx) => {
        const text = stripOfficeXmlToLines(pageXml);
        return `=== Slide ${idx + 1} ===\n${text || '(No text on slide)'}`;
      })
      .join('\n\n')
      .slice(0, 60000);
  };

  const extractOdtText = async (buffer: Buffer): Promise<string> => {
    const zip = await JSZip.loadAsync(buffer);
    const contentFile = zip.files['content.xml'];
    if (!contentFile) {
      throw new Error('Could not read content.xml from this .odt document.');
    }
    const xml = await contentFile.async('string');
    return stripOfficeXmlToLines(xml).slice(0, 60000);
  };

  const extractRtfText = (buffer: Buffer): string => {
    const raw = buffer.toString('latin1');
    const cleaned = raw
      .replace(/\{\\\*\\[^}]*\}/g, ' ')
      .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict|object)[\s\S]*?\}/g, ' ')
      .replace(/\\par\b|\\line\b/g, '\n')
      .replace(/\\tab\b/g, '\t')
      .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
      .replace(/[{}]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned.slice(0, 60000);
  };

  const extractSpreadsheetText = (buffer: Buffer, filename: string): string => {
    const workbook = XLSX.read(buffer, { type: 'buffer', dense: false });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error(`No worksheets found in "${filename}".`);
    }

    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 20)) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const ref = sheet['!ref'];
      const range = ref ? XLSX.utils.decode_range(ref) : null;
      const totalRows = range ? range.e.r - range.s.r + 1 : 0;
      const totalCols = range ? range.e.c - range.s.c + 1 : 0;
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
      const lines = csv ? csv.split(/\r?\n/) : [];
      const cappedLines = lines.slice(0, 250);
      const truncatedNote =
        lines.length > 250
          ? `\n[Showing first 250 non-empty rows of ${lines.length} total non-empty rows]`
          : '';
      parts.push(
        `=== Sheet: ${sheetName} (${totalRows} rows x ${totalCols} cols) ===\n${
          cappedLines.join('\n') || '(Empty sheet)'
        }${truncatedNote}`
      );
    }

    if (workbook.SheetNames.length > 20) {
      parts.push(`[Note: Showing first 20 of ${workbook.SheetNames.length} sheets.]`);
    }
    return parts.join('\n\n').slice(0, 60000);
  };

  const extractLegacyBinaryStrings = (buffer: Buffer, filename: string): string => {
    const asciiMatches = buffer.toString('latin1').match(/[\x20-\x7E\r\n]{16,}/g) ?? [];
    const filtered = asciiMatches
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => /[a-zA-Z]{3,}/.test(s) && !/^Root Entry|WordDocument|PowerPoint Document/.test(s));
    const joined = Array.from(new Set(filtered)).join('\n').slice(0, 40000);
    if (joined.length < 40) {
      throw new Error(
        `Legacy binary file "${filename}" could not be reliably decoded. Export it as .docx, .pptx, or .pdf for full inspection.`
      );
    }
    return joined;
  };

  const parseStageMarker = (line: string, fallbackForm: string, fallbackPlate: string, fallbackTera: string) => {
    const match = line.match(/^\[\[STAGE\|(.+)\]\]$/);
    if (!match) return null;
    const fields: Record<string, string> = {};
    for (const part of match[1].split('|')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0) {
        const k = part.slice(0, eqIdx).trim();
        const v = part.slice(eqIdx + 1).trim();
        fields[k] = v;
      }
    }
    const rawForm = fields.form || fallbackForm;
    const rawPlate = fields.plate || fallbackPlate;
    const rawExpression = fields.expression || 'Judging You';
    const rawMove = fields.move || '';
    return {
      stageId: fields.id || `stage-${Date.now()}`,
      stageTitle: fields.title || 'Analysis',
      activeForm: VALID_FORMS.includes(rawForm as (typeof VALID_FORMS)[number])
        ? rawForm
        : fallbackForm,
      activePlate: VALID_PLATES.includes(rawPlate as (typeof VALID_PLATES)[number])
        ? rawPlate
        : fallbackPlate,
      activeTera: fields.tera || fallbackTera,
      expression: VALID_EXPRESSIONS.includes(rawExpression as (typeof VALID_EXPRESSIONS)[number])
        ? rawExpression
        : 'Judging You',
      moveUsed: rawMove && rawMove.toLowerCase() !== 'null' && rawMove.toLowerCase() !== 'none' ? rawMove : null,
    };
  };

  const handleDocumentReviewStream = async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to review NotebookLM notebooks.',
      });
      return;
    }

    const rawBody = req.body as Record<string, unknown>;
    const notebookTitle =
      typeof rawBody.notebookTitle === 'string' && rawBody.notebookTitle.trim()
        ? rawBody.notebookTitle.trim().slice(0, 160)
        : 'Untitled Document / Notebook';
    const itemCategory =
      typeof rawBody.itemCategory === 'string' && rawBody.itemCategory.trim()
        ? rawBody.itemCategory.trim().toLowerCase()
        : 'auto';
    const notebookUrl =
      typeof rawBody.notebookUrl === 'string' ? rawBody.notebookUrl.trim().slice(0, 500) : '';
    const notesContent =
      typeof rawBody.notesContent === 'string' ? rawBody.notesContent.trim().slice(0, 120000) : '';
    const reviewFocus =
      typeof rawBody.reviewFocus === 'string' ? rawBody.reviewFocus.trim().slice(0, 400) : '';
    const activeForm = typeof rawBody.activeForm === 'string' ? rawBody.activeForm : 'Eevee';
    const activePlate = typeof rawBody.activePlate === 'string' ? rawBody.activePlate : 'None (Base)';
    const activeTera = typeof rawBody.activeTera === 'string' ? rawBody.activeTera : 'Normal';
    const localTime = typeof rawBody.localTime === 'string' ? rawBody.localTime : '';
    const timePhase = typeof rawBody.timePhase === 'string' ? rawBody.timePhase : '';
    const languageCode = typeof rawBody.languageCode === 'string' ? rawBody.languageCode : 'en-US';
    const selectedLanguage = getLanguageByCode(languageCode);

    let parsedSourceUrls: string[] = [];
    if (typeof rawBody.sourceUrls === 'string' && rawBody.sourceUrls.trim()) {
      try {
        const decoded = JSON.parse(rawBody.sourceUrls);
        if (Array.isArray(decoded)) {
          parsedSourceUrls = decoded.filter((u): u is string => typeof u === 'string');
        }
      } catch {
        parsedSourceUrls = rawBody.sourceUrls
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else if (Array.isArray(rawBody.sourceUrls)) {
      parsedSourceUrls = (rawBody.sourceUrls as unknown[]).filter(
        (u): u is string => typeof u === 'string'
      );
    }

    const validUrls = Array.from(
      new Set(
        [notebookUrl, ...parsedSourceUrls]
          .map((u) => u.trim())
          .filter((u) => /^https?:\/\/.+/i.test(u))
      )
    ).slice(0, 15);

    const uploadedFiles = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (!notesContent && validUrls.length === 0 && uploadedFiles.length === 0) {
      res.status(400).json({
        error:
          'Provide your NotebookLM notes/study guide, upload exported files (PDF, Markdown, TXT, Audio Overview), or add source URLs to analyze.',
      });
      return;
    }

    // Check if the only input is a private notebooklm.google.com link with zero notes/files/other URLs
    const nonNotebookLmUrls = validUrls.filter(
      (u) => !/^https?:\/\/notebooklm\.google\.com\//i.test(u)
    );
    if (
      !notesContent &&
      uploadedFiles.length === 0 &&
      validUrls.length > 0 &&
      nonNotebookLmUrls.length === 0
    ) {
      res.status(400).json({
        error:
          'Private NotebookLM notebook links require your Google account session and cannot be read directly from a URL alone. Copy-paste your NotebookLM Notes / Study Guide / Briefing Doc, attach exported source files (PDF, Markdown, TXT, Audio Overview), or add public source URLs.',
      });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (eventName: string, payload: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const uploadedRemoteNames: string[] = [];

    try {
      const textFileBlocks: string[] = [];
      const detectedKinds = new Set<string>();
      if (itemCategory !== 'auto') {
        detectedKinds.add(itemCategory);
      }
      const mediaParts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | ReturnType<typeof createPartFromUri>
      > = [];

      if (uploadedFiles.length > 0) {
        sendEvent('status', {
          message: `Inspecting & parsing ${uploadedFiles.length} uploaded file(s)…`,
        });
      }

      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const mime = inferMimeTypeForNotebookFile(file);

        if (ext === '.pptx') {
          detectedKinds.add('presentation');
          const slidesText = await extractPptxText(file.buffer);
          textFileBlocks.push(`--- Presentation (.pptx): ${file.originalname} ---\n${slidesText}`);
        } else if (ext === '.odp') {
          detectedKinds.add('presentation');
          const slidesText = await extractOdpText(file.buffer);
          textFileBlocks.push(`--- Presentation (.odp): ${file.originalname} ---\n${slidesText}`);
        } else if (ext === '.ppt') {
          detectedKinds.add('presentation');
          const legacyText = extractLegacyBinaryStrings(file.buffer, file.originalname);
          textFileBlocks.push(`--- Presentation (.ppt): ${file.originalname} ---\n${legacyText}`);
        } else if (ext === '.docx') {
          detectedKinds.add('document');
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          const docText = (result.value || '').trim().slice(0, 60000);
          textFileBlocks.push(
            `--- Text Document (.docx): ${file.originalname} ---\n${docText || '(Empty document)'}`
          );
        } else if (ext === '.odt') {
          detectedKinds.add('document');
          const docText = await extractOdtText(file.buffer);
          textFileBlocks.push(`--- Text Document (.odt): ${file.originalname} ---\n${docText}`);
        } else if (ext === '.doc') {
          detectedKinds.add('document');
          const legacyText = extractLegacyBinaryStrings(file.buffer, file.originalname);
          textFileBlocks.push(`--- Text Document (.doc): ${file.originalname} ---\n${legacyText}`);
        } else if (ext === '.rtf') {
          detectedKinds.add('document');
          const rtfText = extractRtfText(file.buffer);
          textFileBlocks.push(`--- Rich Text Document (.rtf): ${file.originalname} ---\n${rtfText}`);
        } else if (NOTEBOOK_SPREADSHEET_EXTENSIONS.has(ext)) {
          detectedKinds.add('spreadsheet');
          const sheetText = extractSpreadsheetText(file.buffer, file.originalname);
          textFileBlocks.push(`--- Spreadsheet (${ext}): ${file.originalname} ---\n${sheetText}`);
        } else if (NOTEBOOK_TEXT_EXTENSIONS.has(ext) || mime.startsWith('text/') || mime === 'application/json') {
          detectedKinds.add(ext === '.csv' || ext === '.tsv' ? 'spreadsheet' : 'document');
          const decodedText = file.buffer.toString('utf8').slice(0, 60000);
          textFileBlocks.push(`--- File: ${file.originalname} (${mime}) ---\n${decodedText}`);
        } else {
          if (ext === '.pdf' || mime === 'application/pdf') {
            detectedKinds.add('pdf');
          }
          if (file.size <= INLINE_THRESHOLD_BYTES) {
            mediaParts.push({
              inlineData: {
                mimeType: mime,
                data: file.buffer.toString('base64'),
              },
            });
          } else {
            const blob = new Blob([new Uint8Array(file.buffer)], { type: mime });
            const uploaded = await ai.files.upload({
              file: blob,
              config: {
                mimeType: mime,
                displayName: file.originalname,
              },
            });
            if (uploaded.name) {
              uploadedRemoteNames.push(uploaded.name);
            }
            const readyFile =
              uploaded.state === 'PROCESSING' && uploaded.name
                ? await waitForFileActive(ai, uploaded.name)
                : uploaded;
            if (!readyFile.uri || !readyFile.mimeType) {
              throw new Error(`Uploaded file "${file.originalname}" did not return a valid Gemini URI.`);
            }
            mediaParts.push(createPartFromUri(readyFile.uri, readyFile.mimeType));
          }
        }
      }

      const urlSection =
        nonNotebookLmUrls.length > 0
          ? `\nSource URLs to inspect via URL Context:\n${nonNotebookLmUrls.map((u) => `- ${u}`).join('\n')}`
          : '';

      const notesSection = notesContent
        ? `\nPasted Document / Deck / Table / NotebookLM Content:\n${notesContent}`
        : '';

      const filesTextSection =
        textFileBlocks.length > 0
          ? `\nParsed Uploaded Document/Presentation/Spreadsheet Sources:\n${textFileBlocks.join('\n\n')}`
          : '';

      const focusSection = reviewFocus
        ? `\nOwner's Specific Review Angle: "${reviewFocus}"`
        : '';

      const domainGuidanceParts: string[] = [];
      if (detectedKinds.has('presentation')) {
        domainGuidanceParts.push(
          'PRESENTATION ANALYSIS: Critique slide-by-slide pacing, narrative flow, slide clutter, speaker notes alignment, and whether each slide earns its place.'
        );
      }
      if (detectedKinds.has('spreadsheet')) {
        domainGuidanceParts.push(
          'SPREADSHEET ANALYSIS: Audit sheet structure, exact figures/totals/ratios, outliers, missing units or baselines, and questionable assumptions—citing actual sheet names, column headers, and numbers.'
        );
      }
      if (detectedKinds.has('document') || detectedKinds.has('pdf')) {
        domainGuidanceParts.push(
          'DOCUMENT & PDF ANALYSIS: Evaluate the core thesis, structure, clarity, factual/logical backing, page layout/tables (if PDF), and concrete improvements needed.'
        );
      }
      if (detectedKinds.has('notebooklm') || detectedKinds.size === 0) {
        domainGuidanceParts.push(
          'NOTEBOOK & SOURCE ANALYSIS: Cross-check claims, synthesis quality, audio/written takeaways, and blind spots across the provided material.'
        );
      }

      const prompt = `Your Owner just handed you materials (${Array.from(detectedKinds).join(', ') || 'notebook/document'}) to inspect and review live while analyzing their contents.

Title: "${notebookTitle}"
Category: ${Array.from(detectedKinds).join(', ') || 'general'}
${notebookUrl ? `Reference URL: ${notebookUrl}` : ''}
Starting State: Form=${activeForm}, Arceus Plate=${activePlate}, Tera=${activeTera}${
        localTime ? `, Local Time=${localTime} (${timePhase})` : ''
      }
Output Language: ${selectedLanguage.label} (${selectedLanguage.nativeName}) — ${selectedLanguage.aiDirective}
${focusSection}${urlSection}${notesSection}${filesTextSection}

DOMAIN FOCUS:
${domainGuidanceParts.join('\n')}

LIVE STREAMING REVIEW FORMAT (MANDATORY):
Conduct your analysis across 4 progressive stages. At the exact start of EACH stage, output a single marker line on its own line in this exact syntax (keep id, form, plate, tera, expression, and move in canonical English names; translate title and all review prose into ${selectedLanguage.label}):
[[STAGE|id=intake|title=<Localized Title for Stage 1>|form=<Eevee/Eeveelution>|plate=<Arceus Plate>|tera=<Tera Type>|expression=<Stern/Judging You/Combat-Ready/Mocking Smile/Demanding Dinner>|move=<Move name or None>]]
<2-3 sentences of live in-character commentary scanning the format, scope, structure, slides/sheets/pages/sources inside this material.>

[[STAGE|id=claims|title=<Localized Title for Stage 2>|form=<Eevee/Eeveelution>|plate=<Arceus Plate>|tera=<Tera Type>|expression=<...>|move=<...>]]
<3-4 sentences analyzing the strongest points, numbers, arguments, layout, or data—citing concrete specifics (slide numbers, sheet/column values, page claims, or quotes).>

[[STAGE|id=gaps|title=<Localized Title for Stage 3>|form=<Eevee/Eeveelution>|plate=<Arceus Plate>|tera=<Tera Type>|expression=<...>|move=<...>]]
<3-4 sentences exposing blind spots, unverified assumptions, calculation/data gaps, slide bloat, or weak arguments caught while analyzing.>

[[STAGE|id=verdict|title=<Localized Title for Stage 4>|form=<Eevee/Eeveelution>|plate=<Arceus Plate>|tera=<Tera Type>|expression=<...>|move=<...>]]
<2-4 sentences giving your blunt score out of 10, final verdict, and 2-3 specific fixes or next questions the Owner should address.>

Rules:
- Stream your commentary directly inside each stage mixing brief *italicized physical cues* and sharp "spoken dialogue".
- Adapt your Eeveelution form, Arceus Plate, Tera Type, and move naturally to match the material's domain (e.g. Espeon + Mind Plate for research/docs, Glaceon + Icicle Plate for clinical spreadsheets/numbers, Jolteon + Zap Plate or Sylveon + Pixie Plate for pitch presentations, Umbreon + Spooky Plate for spotting hidden flaws, Eevee + Judgment for the final verdict).
- Never invent numbers, slides, or facts that are not in the uploaded files, pasted content, or retrieved URLs. If a URL could not be retrieved, state clearly which URL failed.`;

      const contents =
        mediaParts.length > 0
          ? { parts: [...mediaParts, { text: prompt }] }
          : prompt;

      const stream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: CHARACTER_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          ...(nonNotebookLmUrls.length > 0 ? { tools: [{ urlContext: {} }] } : {}),
        },
      });

      let lineBuffer = '';
      let currentStageId = 'intake';
      let emittedAnyStage = false;
      const retrievedUrls: Array<{ url: string; status: string }> = [];

      const flushCompleteLines = () => {
        while (true) {
          const newlineIdx = lineBuffer.indexOf('\n');
          if (newlineIdx === -1) break;
          const line = lineBuffer.slice(0, newlineIdx);
          lineBuffer = lineBuffer.slice(newlineIdx + 1);

          const trimmed = line.trim();
          if (trimmed.startsWith('[[STAGE|') && trimmed.endsWith(']]')) {
            const parsedStage = parseStageMarker(trimmed, activeForm, activePlate, activeTera);
            if (parsedStage) {
              emittedAnyStage = true;
              currentStageId = parsedStage.stageId;
              sendEvent('stage', parsedStage);
              continue;
            }
          }

          if (!emittedAnyStage && trimmed.length > 0) {
            emittedAnyStage = true;
            sendEvent('stage', {
              stageId: 'intake',
              stageTitle: 'Notebook Analysis',
              activeForm,
              activePlate,
              activeTera,
              expression: 'Judging You',
              moveUsed: null,
            });
          }

          sendEvent('delta', { stageId: currentStageId, text: `${line}\n` });
        }
      };

      for await (const chunk of stream) {
        const meta = chunk.candidates?.[0]?.urlContextMetadata?.urlMetadata;
        if (Array.isArray(meta)) {
          for (const item of meta) {
            if (item.retrievedUrl && !retrievedUrls.some((r) => r.url === item.retrievedUrl)) {
              retrievedUrls.push({
                url: item.retrievedUrl,
                status: String(item.urlRetrievalStatus || 'UNKNOWN'),
              });
            }
          }
        }

        const chunkText = chunk.text ?? '';
        if (!chunkText) continue;
        lineBuffer += chunkText;
        flushCompleteLines();

        // Also stream safe partial text within the current line if we're clearly NOT inside a [[STAGE|...]] marker
        const trimmedStart = lineBuffer.trimStart();
        if (
          lineBuffer.length > 0 &&
          !trimmedStart.startsWith('[') &&
          !lineBuffer.includes('[[')
        ) {
          if (!emittedAnyStage) {
            emittedAnyStage = true;
            sendEvent('stage', {
              stageId: 'intake',
              stageTitle: 'Notebook Analysis',
              activeForm,
              activePlate,
              activeTera,
              expression: 'Judging You',
              moveUsed: null,
            });
          }
          sendEvent('delta', { stageId: currentStageId, text: lineBuffer });
          lineBuffer = '';
        }
      }

      if (lineBuffer.trim()) {
        const trimmed = lineBuffer.trim();
        if (trimmed.startsWith('[[STAGE|') && trimmed.endsWith(']]')) {
          const parsedStage = parseStageMarker(trimmed, activeForm, activePlate, activeTera);
          if (parsedStage) {
            sendEvent('stage', parsedStage);
          }
        } else {
          sendEvent('delta', { stageId: currentStageId, text: lineBuffer });
        }
      }

      const sourceDigest = [notesContent, ...textFileBlocks]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 45000);
      sendEvent('done', {
        ok: true,
        retrievedUrls,
        detectedKinds: Array.from(detectedKinds),
        sourceDigest,
      });
      res.end();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error reviewing document or notebook.';
      console.error('Document/NotebookLM review stream error:', err);
      sendEvent('error', { error: message });
      res.end();
    } finally {
      for (const fileName of uploadedRemoteNames) {
        ai.files.delete({ name: fileName }).catch(() => {});
      }
    }
  };

  app.post('/api/notebooklm-review', handleNotebookMulterUpload, handleDocumentReviewStream);
  app.post('/api/document-review', handleNotebookMulterUpload, handleDocumentReviewStream);

  const handleDocumentQa = async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.',
      });
      return;
    }

    const rawBody = req.body as Record<string, unknown>;
    const notebookTitle =
      typeof rawBody.notebookTitle === 'string' ? rawBody.notebookTitle.slice(0, 160) : 'NotebookLM Notebook';
    const notesExcerpt =
      typeof rawBody.notesExcerpt === 'string' ? rawBody.notesExcerpt.slice(0, 60000) : '';
    const reviewTranscript =
      typeof rawBody.reviewTranscript === 'string' ? rawBody.reviewTranscript.slice(0, 30000) : '';
    const question =
      typeof rawBody.question === 'string' ? rawBody.question.trim().slice(0, 1000) : '';
    const sourceUrls = Array.isArray(rawBody.sourceUrls)
      ? (rawBody.sourceUrls as unknown[])
          .filter((u): u is string => typeof u === 'string' && /^https?:\/\/.+/i.test(u))
          .filter((u) => !/^https?:\/\/notebooklm\.google\.com\//i.test(u))
          .slice(0, 10)
      : [];

    if (!question) {
      res.status(400).json({ error: 'A question about the notebook is required.' });
      return;
    }

    const activeForm = typeof rawBody.activeForm === 'string' ? rawBody.activeForm : 'Eevee';
    const activePlate = typeof rawBody.activePlate === 'string' ? rawBody.activePlate : 'None (Base)';
    const activeTera = typeof rawBody.activeTera === 'string' ? rawBody.activeTera : 'Normal';
    const languageCode = typeof rawBody.languageCode === 'string' ? rawBody.languageCode : 'en-US';
    const selectedLanguage = getLanguageByCode(languageCode);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Notebook Title: "${notebookTitle}"
Current State: Form=${activeForm}, Arceus Plate=${activePlate}, Tera=${activeTera}
Output Language: ${selectedLanguage.label} (${selectedLanguage.nativeName}) — ${selectedLanguage.aiDirective}

${notesExcerpt ? `Notebook Contents:\n${notesExcerpt}\n` : ''}
${reviewTranscript ? `Your Prior Review:\n${reviewTranscript}\n` : ''}
${sourceUrls.length > 0 ? `Source URLs:\n${sourceUrls.join('\n')}\n` : ''}

Owner's Follow-up Question: "${question}"

Respond completely in-character as The Anomalous Eevee in ${selectedLanguage.label} (mixing *italicized physical cues* and "dialogue"). Keep canonical English names for activeForm, activePlate, activeTera, expression, and moveUsed.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: CHARACTER_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          ...(sourceUrls.length > 0 ? { tools: [{ urlContext: {} }] } : {}),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              activeForm: { type: Type.STRING, enum: [...VALID_FORMS] },
              activePlate: { type: Type.STRING, enum: [...VALID_PLATES] },
              activeTera: { type: Type.STRING },
              expression: { type: Type.STRING, enum: [...VALID_EXPRESSIONS] },
              moveUsed: { type: Type.STRING, nullable: true },
            },
            required: ['reply', 'activeForm', 'activePlate', 'activeTera', 'expression'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Received an empty response from Gemini.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        reply: string;
        activeForm: string;
        activePlate: string;
        activeTera: string;
        expression: string;
        moveUsed?: string | null;
      };

      res.json({
        reply: parsed.reply,
        activeForm: VALID_FORMS.includes(parsed.activeForm as (typeof VALID_FORMS)[number])
          ? parsed.activeForm
          : activeForm,
        activePlate: VALID_PLATES.includes(parsed.activePlate as (typeof VALID_PLATES)[number])
          ? parsed.activePlate
          : activePlate,
        activeTera: parsed.activeTera || activeTera,
        expression: VALID_EXPRESSIONS.includes(parsed.expression as (typeof VALID_EXPRESSIONS)[number])
          ? parsed.expression
          : 'Judging You',
        moveUsed: parsed.moveUsed || null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected server error answering notebook question.';
      console.error('NotebookLM Q&A error:', err);
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : message.includes('400') || message.includes('API_KEY_INVALID')
              ? 400
              : 500;
      res.status(status).json({ error: message });
    }
  };

  app.post('/api/notebooklm-qa', handleDocumentQa);
  app.post('/api/document-qa', handleDocumentQa);

  const stripHtmlToReadableText = (html: string): { title: string; description: string; text: string } => {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const metaDescMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

    const rawTitle = decodeXmlEntities((h1Match?.[1] || titleMatch?.[1] || '').replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    const description = decodeXmlEntities(metaDescMatch?.[1] || '').trim();

    // Narrow down to main article container if present
    let bodySlice = html;
    const mwContentIdx = html.search(/id=["'](?:mw-content-text|bodyContent|content|main)["']/i);
    const articleIdx = html.search(/<article\b/i);
    const startIdx = mwContentIdx >= 0 ? mwContentIdx : articleIdx >= 0 ? articleIdx : -1;
    if (startIdx >= 0) {
      bodySlice = html.slice(startIdx, startIdx + 250000);
    }

    const cleaned = bodySlice
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<(?:nav|footer|aside)\b[\s\S]*?<\/(?:nav|footer|aside)>/gi, ' ')
      .replace(/<\/(?:p|h1|h2|h3|h4|h5|h6|li|tr|div|section|blockquote)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');

    const text = decodeXmlEntities(cleaned)
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line) => line.length > 1)
      .join('\n')
      .slice(0, 45000);

    return { title: rawTitle, description, text };
  };

  const fetchEncyclopediaArticle = async (
    articleUrl: string
  ): Promise<{
    title: string;
    extractedText: string;
    sourceKind: 'mediawiki-api' | 'html' | 'url-context-only';
    finalUrl: string;
  }> => {
    let parsed: URL;
    try {
      parsed = new URL(articleUrl);
    } catch {
      return { title: '', extractedText: '', sourceKind: 'url-context-only', finalUrl: articleUrl };
    }

    const matchedWiki = matchPreloadedEncyclopedia(parsed.hostname);

    // 1. Derive candidate MediaWiki page title from URL path
    const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    let candidateTitle = '';
    if (/^(?:wiki|w)\/(.+)/i.test(pathname)) {
      candidateTitle = pathname.replace(/^(?:wiki|w)\//i, '').replace(/\/+$/, '');
    } else if (pathname && !pathname.includes('.php') && pathname !== 'index.html') {
      candidateTitle = pathname.replace(/\/+$/, '');
    }
    if (!candidateTitle && parsed.searchParams.get('title')) {
      candidateTitle = parsed.searchParams.get('title') || '';
    }

    // 2. Try MediaWiki Action API query extracts first when applicable
    const apiCandidates: string[] = [];
    if (matchedWiki?.apiEndpoint) {
      apiCandidates.push(matchedWiki.apiEndpoint);
    }
    if (/^\/wiki\//i.test(parsed.pathname)) {
      apiCandidates.push(`${parsed.origin}/w/api.php`, `${parsed.origin}/api.php`);
    } else if (/^\/w\//i.test(parsed.pathname)) {
      apiCandidates.push(`${parsed.origin}/api.php`, `${parsed.origin}/w/api.php`);
    }

    if (candidateTitle && apiCandidates.length > 0) {
      for (const apiBase of Array.from(new Set(apiCandidates))) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          const apiUrl = `${apiBase}?action=query&prop=extracts|info&inprop=url&explaintext=1&redirects=1&titles=${encodeURIComponent(
            candidateTitle.replace(/_/g, ' ')
          )}&format=json`;
          const resp = await fetch(apiUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'TheAnomalousEevee/1.0 (encyclopedia-analyzer)',
              Accept: 'application/json',
            },
          });
          clearTimeout(timer);

          if (!resp.ok) continue;
          const data = (await resp.json()) as {
            query?: {
              pages?: Record<
                string,
                {
                  missing?: string;
                  title?: string;
                  extract?: string;
                  fullurl?: string;
                }
              >;
            };
          };
          const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
          const first = pages[0];
          if (first && !('missing' in first) && first.extract && first.extract.trim().length > 80) {
            const finalUrl = first.fullurl || articleUrl;
            const finalHost = new URL(finalUrl).hostname;
            if (!isGoogleServiceHost(finalHost) && !isDisallowedLocalHost(finalHost)) {
              return {
                title: first.title || candidateTitle.replace(/_/g, ' '),
                extractedText: first.extract.trim().slice(0, 45000),
                sourceKind: 'mediawiki-api',
                finalUrl,
              };
            }
          }
        } catch {
          // Try next endpoint or fall back to HTML / URL Context
        }
      }
    }

    // 3. Fall back to direct HTML fetch + readable extraction
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(articleUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; TheAnomalousEevee/1.0; +https://example.org/bot)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      clearTimeout(timer);

      const finalUrl = resp.url || articleUrl;
      const finalHost = new URL(finalUrl).hostname;
      if (isGoogleServiceHost(finalHost) || isDisallowedLocalHost(finalHost)) {
        throw new Error('Redirected to a disallowed or Google service domain.');
      }

      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (resp.ok && (contentType.includes('text/html') || contentType.includes('text/plain'))) {
        const rawHtml = await resp.text();
        if (contentType.includes('text/plain')) {
          return {
            title: candidateTitle.replace(/_/g, ' ') || parsed.hostname,
            extractedText: rawHtml.trim().slice(0, 45000),
            sourceKind: 'html',
            finalUrl,
          };
        }

        const parsedHtml = stripHtmlToReadableText(rawHtml);
        if (
          parsedHtml.text.length > 150 &&
          !/just a moment|enable javascript and cookies|attention required! \| cloudflare/i.test(
            parsedHtml.title + ' ' + parsedHtml.text.slice(0, 400)
          )
        ) {
          const combined = [
            parsedHtml.description ? `Summary: ${parsedHtml.description}` : '',
            parsedHtml.text,
          ]
            .filter(Boolean)
            .join('\n\n')
            .slice(0, 45000);

          return {
            title: parsedHtml.title || candidateTitle.replace(/_/g, ' ') || parsed.hostname,
            extractedText: combined,
            sourceKind: 'html',
            finalUrl,
          };
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('disallowed or Google service')) {
        throw err;
      }
    }

    return {
      title: candidateTitle.replace(/_/g, ' ') || parsed.hostname,
      extractedText: '',
      sourceKind: 'url-context-only',
      finalUrl: articleUrl,
    };
  };

  app.get('/api/encyclopedia-search', async (req: Request, res: Response) => {
    const wikiId = typeof req.query.wikiId === 'string' ? req.query.wikiId.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';

    const wiki = PRELOADED_ENCYCLOPEDIAS.find((w) => w.id === wikiId);
    if (!wiki) {
      res.status(400).json({ error: 'Unknown preloaded encyclopedia ID.' });
      return;
    }
    if (!q) {
      res.json({ wikiId: wiki.id, results: [] });
      return;
    }

    const directCandidateUrl = `${wiki.articleBaseUrl}${encodeURIComponent(
      q.replace(/\s+/g, '_')
    )}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const searchUrl = `${wiki.apiEndpoint}?action=opensearch&search=${encodeURIComponent(
        q
      )}&limit=8&namespace=0&format=json`;
      const resp = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TheAnomalousEevee/1.0 (encyclopedia-search)',
          Accept: 'application/json',
        },
      });
      clearTimeout(timer);

      if (!resp.ok) {
        res.json({
          wikiId: wiki.id,
          results: [],
          directCandidateUrl,
          note: `${wiki.name} blocked automated search (${resp.status}). Use the direct article URL or paste an article link from ${wiki.domain}.`,
        });
        return;
      }

      const data = (await resp.json()) as unknown[];
      const titles = Array.isArray(data[1]) ? (data[1] as string[]) : [];
      const descriptions = Array.isArray(data[2]) ? (data[2] as string[]) : [];
      const urls = Array.isArray(data[3]) ? (data[3] as string[]) : [];

      const results = titles
        .map((title, idx) => ({
          title: String(title || ''),
          description: String(descriptions[idx] || ''),
          url: String(urls[idx] || ''),
        }))
        .filter((item) => {
          if (!item.title || !item.url) return false;
          const check = validateEncyclopediaArticleUrl(item.url);
          return check.valid;
        });

      res.json({
        wikiId: wiki.id,
        results,
        directCandidateUrl,
      });
    } catch {
      res.json({
        wikiId: wiki.id,
        results: [],
        directCandidateUrl,
        note: `Search timed out for ${wiki.name}. You can analyze the direct article link or paste any URL from ${wiki.domain}.`,
      });
    }
  });

  app.post('/api/encyclopedia-review', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to analyze encyclopedia articles.',
      });
      return;
    }

    const rawBody = req.body as Record<string, unknown>;
    const rawArticleUrl = typeof rawBody.articleUrl === 'string' ? rawBody.articleUrl : '';
    const urlCheck = validateEncyclopediaArticleUrl(rawArticleUrl);
    if (!urlCheck.valid || !urlCheck.normalizedUrl || !urlCheck.hostname) {
      res.status(400).json({ error: urlCheck.error || 'Invalid encyclopedia article URL.' });
      return;
    }

    const articleUrl = urlCheck.normalizedUrl;
    const matchedWiki = matchPreloadedEncyclopedia(urlCheck.hostname);
    const wikiName = matchedWiki?.name || urlCheck.hostname;
    const reviewFocus =
      typeof rawBody.reviewFocus === 'string' ? rawBody.reviewFocus.trim().slice(0, 400) : '';
    const pastedExcerpt =
      typeof rawBody.pastedExcerpt === 'string' ? rawBody.pastedExcerpt.trim().slice(0, 40000) : '';
    const activeForm = typeof rawBody.activeForm === 'string' ? rawBody.activeForm : 'Eevee';
    const activePlate = typeof rawBody.activePlate === 'string' ? rawBody.activePlate : 'None (Base)';
    const activeTera = typeof rawBody.activeTera === 'string' ? rawBody.activeTera : 'Normal';
    const localTime = typeof rawBody.localTime === 'string' ? rawBody.localTime : '';
    const timePhase = typeof rawBody.timePhase === 'string' ? rawBody.timePhase : '';
    const languageCode = typeof rawBody.languageCode === 'string' ? rawBody.languageCode : 'en-US';
    const selectedLanguage = getLanguageByCode(languageCode);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (eventName: string, payload: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    try {
      sendEvent('status', {
        message: `Fetching article from ${wikiName}…`,
      });

      const fetched = await fetchEncyclopediaArticle(articleUrl);
      const effectiveArticleText = [fetched.extractedText, pastedExcerpt]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 45000);

      sendEvent('status', {
        message:
          fetched.sourceKind === 'url-context-only' && !pastedExcerpt
            ? `Inspecting ${wikiName} page live via URL Context…`
            : `Analyzing "${fetched.title || wikiName}" live…`,
      });

      const prompt = `Your Owner just handed you an online encyclopedia / wiki article (from a non-Google service website) to read, inspect, and review live while analyzing it.

Encyclopedia / Wiki: ${wikiName}
Article URL: ${fetched.finalUrl}
Detected Article Title: "${fetched.title || 'Unknown Title'}"
Retrieval Mode: ${
        effectiveArticleText
          ? `${fetched.sourceKind} + Live URL Context`
          : 'Live URL Context only (direct server scrape returned no body)'
      }
Starting State: Form=${activeForm}, Arceus Plate=${activePlate}, Tera=${activeTera}${
        localTime ? `, Local Time=${localTime} (${timePhase})` : ''
      }
Output Language: ${selectedLanguage.label} (${selectedLanguage.nativeName}) — ${selectedLanguage.aiDirective}
${reviewFocus ? `Owner's Specific Review Angle: "${reviewFocus}"` : ''}

${
  effectiveArticleText
    ? `Extracted Article Content:\n${effectiveArticleText}`
    : `No pre-extracted body text was available from direct HTTP fetch—inspect ${fetched.finalUrl} directly via the URL Context tool. If the website blocks URL Context retrieval too and you cannot read the actual page contents, state honestly in Stage 1 that the website blocked automated page retrieval and invite the Owner to paste an excerpt instead of guessing or fabricating article facts.`
}

LIVE STREAMING REVIEW FORMAT (MANDATORY):
Conduct your analysis across 4 progressive stages. At the exact start of EACH stage, output a single marker line on its own line in this exact syntax (keep id, form, plate, tera, expression, and move in canonical English names; translate title and all review prose into ${selectedLanguage.label}):
[[STAGE|id=intake|title=<Localized Title for Stage 1>|form=<Eevee/Eeveelution>|plate=<Arceus Plate>|tera=<Tera Type>|expression=<Stern/Judging You/Combat-Ready/Mocking Smile/Demanding Dinner>|move=<Move name or None>]]
<2-3 sentences of live in-character commentary identifying the encyclopedia (${wikiName}), the article subject, its scope/sections, and your first impression.>

[[STAGE|id=claims|title=<Localized Title for Stage 2>|form=<Eevee/Eeveelution>|plate=<Arceus Plate>|tera=<Tera Type>|expression=<...>|move=<...>]]
<3-4 sentences dissecting the concrete facts, lore, powers/abilities, mechanics, history, or data inside this article—citing specific details from the page.>

[[STAGE|id=gaps|title=<Localized Title for Stage 3>|form=<Eevee/Eeveelution>|plate=<Arceus Plate>|tera=<Tera Type>|expression=<...>|move=<...>]]
<3-4 sentences auditing weaknesses, wiki gaps/stub sections, questionable claims, or tactically comparing the article's subject against your own 46-move arsenal, Arceus Plates, and Eeveelutions.>

[[STAGE|id=verdict|title=<Localized Title for Stage 4>|form=<Eevee/Eeveelution>|plate=<Arceus Plate>|tera=<Tera Type>|expression=<...>|move=<...>]]
<2-4 sentences delivering your blunt score out of 10 for the article's quality and subject, plus 2-3 smart follow-up topics or questions.>

Rules:
- Stream your commentary directly inside each stage mixing brief *italicized physical cues* and sharp "spoken dialogue".
- Adapt your Eeveelution form, Arceus Plate, Tera Type, and move naturally to match the article's franchise or topic (e.g. Jolteon + Zap Plate for Sonic/Pikachu/Mega Man tech, Flareon + Flame Plate for combat/bosses, Espeon + Mind Plate for psychic/lore/science, Umbreon + Spooky Plate for Metroid/Metal Gear stealth, Sylveon + Pixie Plate for Kirby/Kid Icarus, Leafeon + Meadow Plate for Pikmin/Minecraft biomes, Eevee + Judgment for final verdict).
- Never invent article facts that are neither in the extracted content nor retrieved via URL Context.`;

      const stream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: CHARACTER_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ urlContext: {} }],
        },
      });

      let lineBuffer = '';
      let currentStageId = 'intake';
      let emittedAnyStage = false;
      const retrievedUrls: Array<{ url: string; status: string }> = [];

      const flushCompleteLines = () => {
        while (true) {
          const newlineIdx = lineBuffer.indexOf('\n');
          if (newlineIdx === -1) break;
          const line = lineBuffer.slice(0, newlineIdx);
          lineBuffer = lineBuffer.slice(newlineIdx + 1);

          const trimmed = line.trim();
          if (trimmed.startsWith('[[STAGE|') && trimmed.endsWith(']]')) {
            const parsedStage = parseStageMarker(trimmed, activeForm, activePlate, activeTera);
            if (parsedStage) {
              emittedAnyStage = true;
              currentStageId = parsedStage.stageId;
              sendEvent('stage', parsedStage);
              continue;
            }
          }

          if (!emittedAnyStage && trimmed.length > 0) {
            emittedAnyStage = true;
            sendEvent('stage', {
              stageId: 'intake',
              stageTitle: 'Article Analysis',
              activeForm,
              activePlate,
              activeTera,
              expression: 'Judging You',
              moveUsed: null,
            });
          }

          sendEvent('delta', { stageId: currentStageId, text: `${line}\n` });
        }
      };

      for await (const chunk of stream) {
        const meta = chunk.candidates?.[0]?.urlContextMetadata?.urlMetadata;
        if (Array.isArray(meta)) {
          for (const item of meta) {
            if (item.retrievedUrl && !retrievedUrls.some((r) => r.url === item.retrievedUrl)) {
              retrievedUrls.push({
                url: item.retrievedUrl,
                status: String(item.urlRetrievalStatus || 'UNKNOWN'),
              });
            }
          }
        }

        const chunkText = chunk.text ?? '';
        if (!chunkText) continue;
        lineBuffer += chunkText;
        flushCompleteLines();

        const trimmedStart = lineBuffer.trimStart();
        if (
          lineBuffer.length > 0 &&
          !trimmedStart.startsWith('[') &&
          !lineBuffer.includes('[[')
        ) {
          if (!emittedAnyStage) {
            emittedAnyStage = true;
            sendEvent('stage', {
              stageId: 'intake',
              stageTitle: 'Article Analysis',
              activeForm,
              activePlate,
              activeTera,
              expression: 'Judging You',
              moveUsed: null,
            });
          }
          sendEvent('delta', { stageId: currentStageId, text: lineBuffer });
          lineBuffer = '';
        }
      }

      if (lineBuffer.trim()) {
        const trimmed = lineBuffer.trim();
        if (trimmed.startsWith('[[STAGE|') && trimmed.endsWith(']]')) {
          const parsedStage = parseStageMarker(trimmed, activeForm, activePlate, activeTera);
          if (parsedStage) {
            sendEvent('stage', parsedStage);
          }
        } else {
          sendEvent('delta', { stageId: currentStageId, text: lineBuffer });
        }
      }

      sendEvent('done', {
        ok: true,
        wikiName,
        articleTitle: fetched.title || wikiName,
        finalUrl: fetched.finalUrl,
        sourceKind: fetched.sourceKind,
        articleExcerpt: effectiveArticleText.slice(0, 35000),
        retrievedUrls,
      });
      res.end();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error analyzing encyclopedia article.';
      console.error('Encyclopedia review stream error:', err);
      sendEvent('error', { error: message });
      res.end();
    }
  });

  app.post('/api/encyclopedia-qa', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.',
      });
      return;
    }

    const rawBody = req.body as Record<string, unknown>;
    const rawArticleUrl = typeof rawBody.articleUrl === 'string' ? rawBody.articleUrl : '';
    const urlCheck = validateEncyclopediaArticleUrl(rawArticleUrl);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      res.status(400).json({ error: urlCheck.error || 'A valid non-Google encyclopedia URL is required.' });
      return;
    }

    const articleTitle =
      typeof rawBody.articleTitle === 'string' ? rawBody.articleTitle.slice(0, 160) : 'Wiki Article';
    const wikiName =
      typeof rawBody.wikiName === 'string' ? rawBody.wikiName.slice(0, 120) : 'Online Encyclopedia';
    const articleExcerpt =
      typeof rawBody.articleExcerpt === 'string' ? rawBody.articleExcerpt.slice(0, 35000) : '';
    const reviewTranscript =
      typeof rawBody.reviewTranscript === 'string' ? rawBody.reviewTranscript.slice(0, 25000) : '';
    const question =
      typeof rawBody.question === 'string' ? rawBody.question.trim().slice(0, 1000) : '';

    if (!question) {
      res.status(400).json({ error: 'A question about the article is required.' });
      return;
    }

    const activeForm = typeof rawBody.activeForm === 'string' ? rawBody.activeForm : 'Eevee';
    const activePlate = typeof rawBody.activePlate === 'string' ? rawBody.activePlate : 'None (Base)';
    const activeTera = typeof rawBody.activeTera === 'string' ? rawBody.activeTera : 'Normal';
    const languageCode = typeof rawBody.languageCode === 'string' ? rawBody.languageCode : 'en-US';
    const selectedLanguage = getLanguageByCode(languageCode);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Encyclopedia: ${wikiName}
Article Title: "${articleTitle}"
Article URL: ${urlCheck.normalizedUrl}
Current State: Form=${activeForm}, Arceus Plate=${activePlate}, Tera=${activeTera}
Output Language: ${selectedLanguage.label} (${selectedLanguage.nativeName}) — ${selectedLanguage.aiDirective}

${articleExcerpt ? `Extracted Article Text:\n${articleExcerpt}\n` : ''}
${reviewTranscript ? `Your Prior Review:\n${reviewTranscript}\n` : ''}

Owner's Follow-up Question: "${question}"

Respond completely in-character as The Anomalous Eevee in ${selectedLanguage.label} (mixing *italicized physical cues* and "dialogue"). Keep canonical English names for activeForm, activePlate, activeTera, expression, and moveUsed.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: CHARACTER_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ urlContext: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              activeForm: { type: Type.STRING, enum: [...VALID_FORMS] },
              activePlate: { type: Type.STRING, enum: [...VALID_PLATES] },
              activeTera: { type: Type.STRING },
              expression: { type: Type.STRING, enum: [...VALID_EXPRESSIONS] },
              moveUsed: { type: Type.STRING, nullable: true },
            },
            required: ['reply', 'activeForm', 'activePlate', 'activeTera', 'expression'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Received an empty response from Gemini.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        reply: string;
        activeForm: string;
        activePlate: string;
        activeTera: string;
        expression: string;
        moveUsed?: string | null;
      };

      res.json({
        reply: parsed.reply,
        activeForm: VALID_FORMS.includes(parsed.activeForm as (typeof VALID_FORMS)[number])
          ? parsed.activeForm
          : activeForm,
        activePlate: VALID_PLATES.includes(parsed.activePlate as (typeof VALID_PLATES)[number])
          ? parsed.activePlate
          : activePlate,
        activeTera: parsed.activeTera || activeTera,
        expression: VALID_EXPRESSIONS.includes(parsed.expression as (typeof VALID_EXPRESSIONS)[number])
          ? parsed.expression
          : 'Judging You',
        moveUsed: parsed.moveUsed || null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected server error answering encyclopedia question.';
      console.error('Encyclopedia Q&A error:', err);
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : message.includes('400') || message.includes('API_KEY_INVALID')
              ? 400
              : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/calculator-analyze', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.',
      });
      return;
    }

    const rawBody = req.body as Record<string, unknown>;
    const activeApp = typeof rawBody.activeApp === 'string' ? rawBody.activeApp.slice(0, 80) : 'Calculator';
    const pageLabel = typeof rawBody.pageLabel === 'string' ? rawBody.pageLabel.slice(0, 80) : '1.1 Calculator';
    const angleMode = typeof rawBody.angleMode === 'string' ? rawBody.angleMode : 'RAD';
    const calcMode = typeof rawBody.calcMode === 'string' ? rawBody.calcMode : 'AUTO';
    const complexMode = typeof rawBody.complexMode === 'string' ? rawBody.complexMode : 'REAL';

    const casHistory = Array.isArray(rawBody.casHistory) ? rawBody.casHistory.slice(-15) : [];
    const variables =
      rawBody.variables && typeof rawBody.variables === 'object' ? rawBody.variables : {};
    const graphSnapshot =
      rawBody.graphSnapshot && typeof rawBody.graphSnapshot === 'object' ? rawBody.graphSnapshot : null;
    const spreadsheetSummary =
      rawBody.spreadsheetSummary && typeof rawBody.spreadsheetSummary === 'object'
        ? rawBody.spreadsheetSummary
        : null;
    const statsSummary =
      rawBody.statsSummary && typeof rawBody.statsSummary === 'object' ? rawBody.statsSummary : null;
    const notesContent =
      typeof rawBody.notesContent === 'string' ? rawBody.notesContent.slice(0, 6000) : '';
    const programSource =
      typeof rawBody.programSource === 'string' ? rawBody.programSource.slice(0, 6000) : '';
    const programOutput = Array.isArray(rawBody.programOutput)
      ? rawBody.programOutput.slice(-40)
      : [];
    const tvmState =
      rawBody.tvmState && typeof rawBody.tvmState === 'object' ? rawBody.tvmState : null;
    const userQuestion =
      typeof rawBody.userQuestion === 'string' ? rawBody.userQuestion.trim().slice(0, 800) : '';

    const activeForm = typeof rawBody.activeForm === 'string' ? rawBody.activeForm : 'Eevee';
    const activePlate = typeof rawBody.activePlate === 'string' ? rawBody.activePlate : 'None (Base)';
    const activeTera = typeof rawBody.activeTera === 'string' ? rawBody.activeTera : 'Normal';
    const localTime = typeof rawBody.localTime === 'string' ? rawBody.localTime : '';
    const timePhase = typeof rawBody.timePhase === 'string' ? rawBody.timePhase : '';
    const languageCode = typeof rawBody.languageCode === 'string' ? rawBody.languageCode : 'en-US';
    const selectedLanguage = getLanguageByCode(languageCode);

    const snapshotPayload = {
      activeApp,
      pageLabel,
      settings: { angleMode, calcMode, complexMode },
      casHistory,
      variables,
      graphSnapshot,
      spreadsheetSummary,
      statsSummary,
      notesContent: notesContent || undefined,
      programSource: programSource || undefined,
      programOutput: programOutput.length > 0 ? programOutput : undefined,
      tvmState,
    };

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Your Owner is using a TI-Nspire CX II CAS handheld math & data workstation and asked you to inspect the live document state, critique the math/data, and surface non-obvious patterns or mistakes.

Current Character State: Form=${activeForm}, Arceus Plate=${activePlate}, Tera=${activeTera}${
      localTime ? `, Local Time=${localTime}${timePhase ? ` (${timePhase})` : ''}` : ''
    }.
Output Language: ${selectedLanguage.label} (${selectedLanguage.nativeName}) — ${selectedLanguage.aiDirective}

Live TI-Nspire CX II CAS Document Snapshot (JSON):
${JSON.stringify(snapshotPayload, null, 2)}
${
  userQuestion
    ? `\nOwner's Specific Question/Prompt: "${userQuestion}"`
    : `\nAnalyze what the Owner has entered so far on page "${pageLabel}" (and linked variables/data), check for mathematical pitfalls, mode traps (e.g., RAD vs DEG), regression quality (R², residuals, outliers), calculus/algebra behavior, code bugs, or financial cash-flow signs.`
}

Instructions:
1. Write "feedback" in ${selectedLanguage.label} completely in-character as The Anomalous Eevee (blending brief *italicized physical cues* and razor-sharp "spoken analysis" citing real numbers, equations, R², eigenvalues, integrals, or cells from the snapshot).
2. Write "insights" as 2 to 4 crisp, accurate analytical bullet takeaways in ${selectedLanguage.label}.
3. If a follow-up symbolic/numeric command in the TI-Nspire CAS Calculator would reveal something useful (e.g. a derivative, roots, rref, determinant, Taylor expansion, or integral), set "suggestedCommand" to a valid executable CAS command string using our syntax (e.g. "diff(x^3 - 3*x, x)", "solve(x^2 - 5*x + 6 = 0, x)", "rref([[1,2,5],[3,-1,1]])", "taylor(sin(x), x, 0, 5)"); otherwise null.
4. Keep canonical English schema names for activeForm, activePlate, activeTera, expression, and moveUsed.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: CHARACTER_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              feedback: {
                type: Type.STRING,
                description:
                  'In-character mathematical critique and data analysis from The Anomalous Eevee citing real snapshot figures.',
              },
              insights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 concise quantitative or structural findings.',
              },
              suggestedCommand: {
                type: Type.STRING,
                nullable: true,
                description:
                  'Optional valid TI-Nspire CAS expression to run in the Calculator tab, or null.',
              },
              activeForm: {
                type: Type.STRING,
                enum: [...VALID_FORMS],
              },
              activePlate: {
                type: Type.STRING,
                enum: [...VALID_PLATES],
              },
              activeTera: {
                type: Type.STRING,
              },
              expression: {
                type: Type.STRING,
                enum: [...VALID_EXPRESSIONS],
              },
              moveUsed: {
                type: Type.STRING,
                nullable: true,
              },
            },
            required: [
              'feedback',
              'insights',
              'activeForm',
              'activePlate',
              'activeTera',
              'expression',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Received an empty analysis response from Gemini.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        feedback: string;
        insights?: string[];
        suggestedCommand?: string | null;
        activeForm: string;
        activePlate: string;
        activeTera: string;
        expression: string;
        moveUsed?: string | null;
      };

      res.json({
        feedback: parsed.feedback || '…',
        insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [],
        suggestedCommand:
          typeof parsed.suggestedCommand === 'string' && parsed.suggestedCommand.trim()
            ? parsed.suggestedCommand.trim()
            : null,
        activeForm: VALID_FORMS.includes(parsed.activeForm as (typeof VALID_FORMS)[number])
          ? parsed.activeForm
          : activeForm,
        activePlate: VALID_PLATES.includes(parsed.activePlate as (typeof VALID_PLATES)[number])
          ? parsed.activePlate
          : activePlate,
        activeTera: parsed.activeTera || activeTera,
        expression: VALID_EXPRESSIONS.includes(parsed.expression as (typeof VALID_EXPRESSIONS)[number])
          ? parsed.expression
          : 'Judging You',
        moveUsed: parsed.moveUsed || null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected server error analyzing calculator workspace.';
      console.error('Calculator analyze error:', err);
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : message.includes('400') || message.includes('API_KEY_INVALID')
              ? 400
              : 500;
      res.status(status).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
