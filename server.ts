import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPartFromUri, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB per uploaded image/video
const INLINE_THRESHOLD_BYTES = 15 * 1024 * 1024; // 15 MB inline limit; larger uses Files API
const MAX_FILES_PER_MESSAGE = 4;

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

    const prompt = `Current Scene Context: ${scenario}
Current Active Form: ${activeForm}
Current Equipped Arceus Plate: ${activePlate}
Current Active Tera Type: ${activeTera}${timeContextBlock}

Conversation so far:
${historyTranscript}${mediaPromptNote}

Respond now in-character as The Anomalous Eevee to the Owner's latest message.`;

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
