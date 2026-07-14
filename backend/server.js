import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import lamejs from 'lamejs';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './db.js';
import Script from './models/Script.js';

dotenv.config();

// Connect to Database
connectDB();

// ES Modules __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');

// Ensure uploads and temp directories exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
// Setup FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

// Helper to split text for Google Translate TTS (limit <= 180 characters per request)
function splitTextForTts(text) {
  const maxLen = 180;
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + ' ' + word).length > maxLen) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + word;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

// Helper to fetch voice audio from Google Translate TTS as fallback
async function getGoogleTranslateTts(text, language) {
  const lang = (language && language.toLowerCase().includes('hindi')) ? 'hi' : 'en';
  const textChunks = splitTextForTts(text);
  const bufferChunks = [];

  for (const chunk of textChunks) {
    if (!chunk.trim()) continue;
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      }
    });
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      bufferChunks.push(Buffer.from(arrayBuffer));
    } else {
      throw new Error(`Google Translate TTS returned status ${response.status}`);
    }
    await new Promise(resolve => setTimeout(resolve, 80));
  }

  return Buffer.concat(bufferChunks);
}

const app = express();
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// Serve uploads folder statically for video download/preview
app.use('/uploads', express.static(uploadsDir));

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `raw_${Date.now()}_${safeName}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not defined in the environment variables.');
}
const ai = new GoogleGenAI({ apiKey });

// In-memory Database Fallback (if MongoDB is offline)
const memoryDb = [];

const isDbConnected = () => {
  return mongoose.connection.readyState === 1;
};

// --- AUDIO HELPERS ---

/**
 * Prepends a standard 44-byte WAV header to raw 16-bit PCM data
 */
function convertPcmToWav(pcmBuffer, sampleRate = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Encodes 16-bit raw PCM buffer to MP3 using lamejs
 */
function convertPcmToMp3(pcmBuffer, sampleRate = 24000) {
  const channels = 1; 
  const kbps = 128; 
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  
  const pcmData = new Int16Array(pcmBuffer.length / 2);
  for (let i = 0; i < pcmData.length; i++) {
    pcmData[i] = pcmBuffer.readInt16LE(i * 2);
  }
  
  const mp3Data = [];
  const sampleBlockSize = 1152;
  
  for (let i = 0; i < pcmData.length; i += sampleBlockSize) {
    const sampleChunk = pcmData.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(Buffer.from(mp3buf));
    }
  }
  
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(Buffer.from(mp3buf));
  }
  
  return Buffer.concat(mp3Data);
}

// --- SUBTITLE HELPERS ---

/**
 * Generates snappy, shorts-style subtitle tracks (approx 3 words per block)
 * so subtitles don't cover the vertical screen and match the voiceover pace.
 */
function formatSrtText(scenes) {
  let srtContent = '';
  let runningTime = 0; // cumulative duration tracking
  let subtitleIndex = 1;

  scenes.forEach((scene) => {
    const duration = scene.duration || 6;
    const sceneStart = runningTime;
    const sceneEnd = runningTime + duration;

    // Split narrator text into words
    const words = scene.narratorText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
      runningTime = sceneEnd;
      return;
    }

    const wordsPerPhrase = 3; // snappier YouTube shorts style
    const totalWords = words.length;
    const timePerWord = duration / totalWords;

    const pad = (num, size = 2) => String(num).padStart(size, '0');
    const formatTime = (t) => {
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = Math.floor(t % 60);
      const ms = Math.floor((t % 1) * 1000);
      return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
    };

    for (let i = 0; i < totalWords; i += wordsPerPhrase) {
      const phraseWords = words.slice(i, i + wordsPerPhrase);
      const phraseText = phraseWords.join(' ');

      const phraseStart = sceneStart + (i * timePerWord);
      const phraseEnd = sceneStart + (Math.min(i + wordsPerPhrase, totalWords) * timePerWord);

      srtContent += `${subtitleIndex}\r\n`;
      srtContent += `${formatTime(phraseStart)} --> ${formatTime(phraseEnd)}\r\n`;
      srtContent += `${phraseText}\r\n\r\n`;

      subtitleIndex++;
    }

    runningTime = sceneEnd;
  });

  return srtContent;
}

// --- API ENDPOINTS ---

/**
 * @route POST /api/generate-script
 * @desc Generate anime shorts script based on title, language, and tone
 */
app.post('/api/generate-script', async (req, res) => {
  const { animeTitle, language, tone } = req.body;

  if (!animeTitle || !language || !tone) {
    return res.status(400).json({ error: 'Please provide animeTitle, language, and tone.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key is missing on the server. Please define GEMINI_API_KEY in backend/.env' });
  }

  try {
    const promptText = `You are a professional YouTube Shorts and TikTok content creator specializing in anime.
Generate a fast-paced, highly engaging 30-60 second script about the anime: "${animeTitle}".
The script must have a "${tone}" tone and be in "${language}" language.
Create exactly 4 to 6 scenes.
For each scene, provide:
1. sceneNumber: sequential index starting from 1.
2. narratorText: The voiceover narration script. If the language is Hindi, this narratorText must be written in Hindi (Devnagari script). The text must be punchy, highly engaging, and written for natural speech.
3. visualPrompt: A detailed visual description in English (regardless of narrator language) of what should be shown on screen (e.g. "Dramatic close-up of Naruto's eyes flashing yellow, dark background with crackling energy, epic anime style").
4. duration: Estimated duration of this scene in seconds (usually 5 to 10 seconds). The total duration of all scenes combined must be between 30 and 60 seconds.
5. episodeTimestampStart: Recommend a starting timestamp (integer in seconds, relative to the start of Episode 1 of the anime) where the visual action described in the visualPrompt occurs. Maintain this value between 60 seconds (1 minute) and 1200 seconds (20 minutes) to skip intros/outros.

Also, recommend which specific episodes, seasons, or key fighting scenes/moments from this anime the user should look for and upload as the source footage (e.g. "We recommend downloading clips from Jujutsu Kaisen Season 2, Episode 9 - Shibuya Incident arc showing Gojo's seal sequence."). Write this recommendation in the footageSuggestions field.

Strictly adhere to the output JSON schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            animeTitle: { type: 'STRING' },
            language: { type: 'STRING' },
            tone: { type: 'STRING' },
            footageSuggestions: { type: 'STRING' },
            scenes: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  sceneNumber: { type: 'INTEGER' },
                  narratorText: { type: 'STRING' },
                  visualPrompt: { type: 'STRING' },
                  duration: { type: 'INTEGER' },
                  episodeTimestampStart: { type: 'INTEGER' }
                },
                required: ['sceneNumber', 'narratorText', 'visualPrompt', 'duration', 'episodeTimestampStart']
              }
            }
          },
          required: ['animeTitle', 'language', 'tone', 'footageSuggestions', 'scenes']
        }
      }
    });

    const scriptData = JSON.parse(response.text);
    const scriptPayload = {
      animeTitle: scriptData.animeTitle || animeTitle,
      language: scriptData.language || language,
      tone: scriptData.tone || tone,
      footageSuggestions: scriptData.footageSuggestions || 'Recommended footage: search for action scenes from this anime.',
      scenes: scriptData.scenes,
      createdAt: new Date()
    };

    let result;
    if (isDbConnected()) {
      const newScript = new Script(scriptPayload);
      result = await newScript.save();
      console.log('Saved script to MongoDB');
    } else {
      result = {
        _id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        ...scriptPayload,
        audioBase64: ''
      };
      memoryDb.push(result);
      console.log('Saved script to In-Memory DB (MongoDB is offline)');
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error generating script:', error);
    res.status(500).json({ error: error.message || 'Failed to generate script' });
  }
});

/**
 * @route POST /api/custom-script
 * @desc Manually save a custom script to the database
 */
app.post('/api/custom-script', async (req, res) => {
  const { animeTitle, language, tone, scenes, footageSuggestions } = req.body;

  if (!animeTitle || !scenes || !Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: 'Please provide animeTitle and a list of scenes.' });
  }

  try {
    const scriptPayload = {
      animeTitle,
      language: language || 'English',
      tone: tone || 'Dramatic',
      footageSuggestions: footageSuggestions || 'Custom footage uploaded by user.',
      scenes: scenes.map((s, idx) => ({
        sceneNumber: s.sceneNumber || (idx + 1),
        narratorText: s.narratorText || '',
        visualPrompt: s.visualPrompt || 'Anime visual representation',
        duration: s.duration || 6,
        episodeTimestampStart: s.episodeTimestampStart || 60
      })),
      createdAt: new Date()
    };

    let result;
    if (isDbConnected()) {
      const newScript = new Script(scriptPayload);
      result = await newScript.save();
      console.log('Saved custom script to MongoDB');
    } else {
      result = {
        _id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        ...scriptPayload,
        audioBase64: ''
      };
      memoryDb.push(result);
      console.log('Saved custom script to In-Memory DB (MongoDB is offline)');
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error saving custom script:', error);
    res.status(500).json({ error: error.message || 'Failed to save custom script' });
  }
});

/**
 * @route POST /api/quick-tts
 * @desc Synthesize custom raw text to speech on the fly (returns WAV buffer)
 */
app.post('/api/quick-tts', async (req, res) => {
  const { text, voice } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Please provide text for speech synthesis.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key is missing on the server.' });
  }

  try {
    const selectedVoice = voice || 'Puck';
    let wavBuffer;

    try {
      console.log(`Generating quick TTS using Gemini 3.1 (voice: ${selectedVoice})...`);
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: text,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice
              }
            }
          }
        }
      });

      const parts = response.candidates?.[0]?.content?.parts;
      const inlineData = parts?.find(p => p.inlineData)?.inlineData;

      if (!inlineData || !inlineData.data) {
        throw new Error('No audio data returned by Gemini API.');
      }

      const rawPcm = Buffer.from(inlineData.data, 'base64');
      wavBuffer = convertPcmToWav(rawPcm, 24000);
    } catch (apiError) {
      console.warn(`Gemini Quick TTS failed or rate-limited: ${apiError.message}. Triggering Google Translate TTS fallback...`);
      const mp3Buffer = await getGoogleTranslateTts(text, 'English');
      wavBuffer = mp3Buffer;
    }

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': wavBuffer.length
    });

    res.send(wavBuffer);
  } catch (error) {
    console.error('Error generating quick TTS:', error);
    res.status(500).json({ error: error.message || 'Failed to generate speech' });
  }
});

/**
 * @route POST /api/generate-audio
 * @desc Generate TTS audio for a script (returns WAV buffer and saves to DB)
 */
app.post('/api/generate-audio', async (req, res) => {
  const { scriptId, voice } = req.body;

  if (!scriptId) {
    return res.status(400).json({ error: 'Please provide scriptId.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key is missing on the server. Please define GEMINI_API_KEY in backend/.env' });
  }

  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(scriptId);
    } else {
      script = memoryDb.find(s => s._id === scriptId);
    }

    if (!script) {
      return res.status(404).json({ error: 'Script not found.' });
    }

    // Concatenate all narrator text for speech
    const fullText = script.scenes.map(s => s.narratorText).join(' ');
    const selectedVoice = voice || 'Puck'; 

    let wavBuffer;
    try {
      console.log(`Generating audio using Gemini 3.1 TTS (voice: ${selectedVoice}) for script: ${script.animeTitle}...`);
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: fullText,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice
              }
            }
          }
        }
      });

      const parts = response.candidates?.[0]?.content?.parts;
      const inlineData = parts?.find(p => p.inlineData)?.inlineData;

      if (!inlineData || !inlineData.data) {
        throw new Error('No inline audio data returned by Gemini API.');
      }

      const rawPcm = Buffer.from(inlineData.data, 'base64');
      wavBuffer = convertPcmToWav(rawPcm, 24000);
    } catch (apiError) {
      console.warn(`Gemini TTS API failed or rate-limited: ${apiError.message}. Triggering Google Translate TTS fallback...`);
      const mp3Buffer = await getGoogleTranslateTts(fullText, script.language);
      wavBuffer = mp3Buffer;
    }

    const wavBase64 = wavBuffer.toString('base64');

    if (isDbConnected()) {
      script.audioBase64 = wavBase64;
      await script.save();
    } else {
      script.audioBase64 = wavBase64;
    }

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': wavBuffer.length,
      'Accept-Ranges': 'bytes'
    });

    res.send(wavBuffer);
  } catch (error) {
    console.error('Error generating audio:', error);
    res.status(500).json({ error: error.message || 'Failed to generate audio' });
  }
});

/**
 * @route GET /api/voice-preview
 * @desc Dynamically synthesize a short 1-second sample phrase for a specific voice actor
 */
app.get('/api/voice-preview', async (req, res) => {
  const { voice } = req.query;
  const selectedVoice = voice || 'Puck';

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key is missing on the server.' });
  }

  try {
    const previewText = `Hello! I am ${selectedVoice}.`;
    let wavBuffer;

    try {
      console.log(`Generating preview for voice actor ${selectedVoice}...`);
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: previewText,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice
              }
            }
          }
        }
      });

      const parts = response.candidates?.[0]?.content?.parts;
      const inlineData = parts?.find(p => p.inlineData)?.inlineData;

      if (!inlineData || !inlineData.data) {
        throw new Error('No inline audio data returned by Gemini API.');
      }

      const rawPcm = Buffer.from(inlineData.data, 'base64');
      wavBuffer = convertPcmToWav(rawPcm, 24000);
    } catch (apiError) {
      console.warn(`Gemini Voice Preview failed or rate-limited: ${apiError.message}. Triggering Google Translate TTS fallback...`);
      const mp3Buffer = await getGoogleTranslateTts(previewText, 'English');
      wavBuffer = mp3Buffer;
    }

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': wavBuffer.length
    });

    res.send(wavBuffer);
  } catch (error) {
    console.error('Error generating voice preview:', error);
    res.status(500).json({ error: error.message || 'Failed to generate voice preview' });
  }
});

/**
 * @route POST /api/generate-metadata
 * @desc Generate YouTube SEO tags, catchy description and Fair Use disclaimer for a script
 */
app.post('/api/generate-metadata', async (req, res) => {
  const { scriptId } = req.body;

  if (!scriptId) {
    return res.status(400).json({ error: 'Please provide scriptId.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key is missing on the server.' });
  }

  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(scriptId);
    } else {
      script = memoryDb.find(s => s._id === scriptId);
    }

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const scriptText = script.scenes.map(s => s.narratorText).join(' ');

    console.log(`Generating YouTube SEO metadata for anime title: ${script.animeTitle}...`);

    const promptText = `You are a professional YouTube growth and SEO manager.
Generate engaging YouTube Shorts metadata for an anime short titled: "${script.animeTitle}".
Here is the script contents:
"${scriptText}"

Please output a JSON object containing:
1. description: A high-retention, catchy YouTube Shorts description loaded with emojis, hashtags, a call to action to subscribe, and a hook.
2. tags: A comma-separated list of 10-15 high-volume SEO tags for this anime and general anime shorts.
3. disclaimer: A formal "Fair Use" copyright disclaimer tailored specifically for anime discussion, reaction, and commentary under Section 107 of the Copyright Act.

Strictly adhere to the JSON schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            description: { type: 'STRING' },
            tags: { type: 'STRING' },
            disclaimer: { type: 'STRING' }
          },
          required: ['description', 'tags', 'disclaimer']
        }
      }
    });

    const metadata = JSON.parse(response.text);
    res.json(metadata);
  } catch (error) {
    console.error('Error generating metadata:', error);
    res.status(500).json({ error: error.message || 'Failed to generate metadata' });
  }
});

/**
 * @route POST /api/render-video
 * @desc Process and render short: vertical crops video, burns subtitles, merges audio, and outputs MP4
 */
app.post('/api/render-video', upload.single('video'), async (req, res) => {
  const { scriptId, voice } = req.body;
  const uploadedFile = req.file;

  if (!scriptId) {
    return res.status(400).json({ error: 'Please provide scriptId.' });
  }

  if (!uploadedFile) {
    return res.status(400).json({ error: 'Please upload an .mp4 video file.' });
  }

  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(scriptId);
    } else {
      script = memoryDb.find(s => s._id === scriptId);
    }

    if (!script) {
      return res.status(404).json({ error: 'Script not found.' });
    }

    const voiceActor = voice || 'Puck';

    // 1. Synthesize audio on the fly if not cached
    if (!script.audioBase64) {
      console.log('Audio not found in database. Synthesizing audio first...');
      const fullText = script.scenes.map(s => s.narratorText).join(' ');
      
      const audioResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: fullText,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceActor
              }
            }
          }
        }
      });

      const parts = audioResponse.candidates?.[0]?.content?.parts;
      const inlineData = parts?.find(p => p.inlineData)?.inlineData;

      if (!inlineData || !inlineData.data) {
        throw new Error('Failed to dynamically synthesize audio track.');
      }
      
      const rawPcm = Buffer.from(inlineData.data, 'base64');
      const wavBuffer = convertPcmToWav(rawPcm, 24000);
      script.audioBase64 = wavBuffer.toString('base64');
      if (isDbConnected()) {
        await script.save();
      }
    }

    // 2. Write temp audio file
    const audioBuffer = Buffer.from(script.audioBase64, 'base64');
    const wavTempPath = path.join(tempDir, `temp_${Date.now()}_${scriptId}.wav`);
    fs.writeFileSync(wavTempPath, audioBuffer);

    // 3. Write temp SRT captions file (relative to backend folder to bypass Windows path colon escaping bug in FFmpeg subtitles filter)
    const srtText = formatSrtText(script.scenes);
    const srtFilename = `temp_${Date.now()}_${scriptId}.srt`;
    fs.writeFileSync(srtFilename, srtText);

    // 4. Output file config
    const outputFilename = `render_${Date.now()}_${scriptId}.mp4`;
    const outputPath = path.join(uploadsDir, outputFilename);
    const rawVideoPath = uploadedFile.path;

    console.log(`Starting FFmpeg rendering:`);
    console.log(`- Video input: ${rawVideoPath}`);
    console.log(`- Audio input: ${wavTempPath}`);
    console.log(`- SRT input (relative): ${srtFilename}`);
    console.log(`- Output path: ${outputPath}`);

    // 5. Build dynamic FFmpeg filter graph to clip, stitch, crop and burn subtitles
    const filterChain = [];
    const concatInputs = [];

    script.scenes.forEach((scene, index) => {
      const start = scene.episodeTimestampStart || (index * 60);
      const duration = scene.duration || 6;
      
      const trimOutput = `t${index}`;
      const ptsOutput = `v${index}`;
      
      // Cut raw video segment based on script AI timestamps
      filterChain.push({
        filter: 'trim',
        options: `start=${start}:duration=${duration}`,
        inputs: '0:v',
        outputs: trimOutput
      });
      
      // Reset timestamps for glitch-free concatenation
      filterChain.push({
        filter: 'setpts',
        options: 'PTS-STARTPTS',
        inputs: trimOutput,
        outputs: ptsOutput
      });
      
      concatInputs.push(ptsOutput);
    });

    // Concatenate all clipped segments sequentially
    filterChain.push({
      filter: 'concat',
      options: `n=${script.scenes.length}:v=1:a=0`,
      inputs: concatInputs,
      outputs: 'stitched'
    });

    // Centered vertical crop to 9:16
    filterChain.push({
      filter: 'crop',
      options: 'ih*9/16:ih',
      inputs: 'stitched',
      outputs: 'cropped'
    });

    // Burn subtitles onto cropped video. 
    // force_style specifies moderate FontSize=14 and Alignment=2 (bottom center) to avoid covering screen.
    filterChain.push({
      filter: 'subtitles',
      options: {
        filename: srtFilename,
        force_style: 'FontSize=14,PrimaryColour=&H00FFFFFF,Outline=1,Alignment=2,MarginV=20'
      },
      inputs: 'cropped',
      outputs: 'v_out'
    });

    // 6. Run FFmpeg command
    ffmpeg()
      .input(rawVideoPath)
      .input(wavTempPath)
      .complexFilter(filterChain)
      .outputOptions([
        '-map [v_out]',     // map our cropped/subtitled vertical video
        '-map 1:a',          // map our voiceover audio track
        '-c:v libx264',      // encode video to H.264
        '-preset superfast', // maximize speed for local renders
        '-c:a aac',          // encode audio to AAC
        '-shortest',         // terminate video clip at the end of the voiceover audio track
        '-threads 2'         // limit CPU core utilization to prevent Windows system freezes/crashes
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('FFmpeg spawned successfully. Command:', cmd);
      })
      .on('end', () => {
        try {
          console.log(`FFmpeg render completed. Output file: ${outputFilename}`);
          // Clean up temp files
          fs.unlink(wavTempPath, () => {});
          fs.unlink(srtFilename, () => {});
          fs.unlink(rawVideoPath, () => {}); // Remove uploaded raw clip to save space
          
          if (!res.headersSent) {
            res.json({
              success: true,
              videoUrl: `http://localhost:5000/uploads/${outputFilename}`
            });
          }
        } catch (err) {
          console.error('Error in FFmpeg end handler:', err);
        }
      })
      .on('error', (err) => {
        try {
          console.error('FFmpeg render error:', err);
          // Clean up temp files
          fs.unlink(wavTempPath, () => {});
          fs.unlink(srtFilename, () => {});
          fs.unlink(rawVideoPath, () => {});
          
          if (!res.headersSent) {
            res.status(500).json({ error: `FFmpeg rendering failed: ${err.message}` });
          }
        } catch (e) {
          console.error('Error in FFmpeg error handler:', e);
        }
      })
      .run();
  } catch (error) {
    console.error('Video Forge Render crash:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize render pipeline' });
  }
});

/**
 * @route POST /api/generate-long-script
 * @desc Generate long-form narration summaries of specific anime episodes using Gemini 3.5 Flash
 */
app.post('/api/generate-long-script', async (req, res) => {
  const { animeTitle, seasonNumber, episodeNumber, language, tone } = req.body;

  if (!animeTitle || !seasonNumber || !episodeNumber || !language || !tone) {
    return res.status(400).json({ error: 'Please provide animeTitle, seasonNumber, episodeNumber, language, and tone.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key is missing on the server.' });
  }

  try {
    const promptText = `You are a professional anime YouTube summary creator.
Create a highly detailed, engaging long-form narration script summarizing the ENTIRE plot of "${animeTitle}" Season ${seasonNumber} Episode ${episodeNumber}.
The script tone must be "${tone}" and in "${language}" language.
Generate exactly 8 to 12 scenes.
For each scene, provide:
1. sceneNumber: sequential index starting from 1.
2. narratorText: Comprehensive narrator voiceover explaining the plot events of this segment. If the language is Hindi, it must be written in Hindi (Devnagari script).
3. visualPrompt: A detailed visual description in English of what should be shown on screen from the episode (e.g. "Goku charging a spirit bomb, massive blue energy sphere, rocks floating, landscape shot").
4. duration: Estimated duration of this scene in seconds (usually 10 to 20 seconds).
5. episodeTimestampStart: The exact starting timestamp (integer in seconds, relative to the episode start) where this scene's events occur in the episode. Distribute these timestamps evenly across a standard 20-minute episode (between 60 and 1200 seconds) to cover the entire episode.
6. dialogues: An array of key dialogue quotes of what was said in this scene. Each dialogue contains a "character" field (the name of the character) and a "text" field (the translated quote they spoke).

Also, recommend where to find the raw episode (footageSuggestions field).

Also, generate highly optimized YouTube metadata for this long summary video under the 'metadata' field:
1. youtubeTitle: A clickbaity, high-CTR YouTube video title (under 70 characters).
2. youtubeCaption: A short clickbaity caption/hook (under 120 characters) for video sharing, shorts teaser, or title extension.
3. youtubeDescription: An SEO-optimized video description. You MUST include specific details about the anime: the Anime Name, Total Seasons of this anime series, and its official/overall Ratings (IMDb or MAL rating score e.g. "IMDb: 8.6/10"), followed by a brief overview of the plot, keywords, and a timestamp/chapter breakdown of all scenes.
4. youtubeTags: A comma-separated list of highly relevant tags.

Strictly adhere to the JSON output schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            animeTitle: { type: 'STRING' },
            language: { type: 'STRING' },
            tone: { type: 'STRING' },
            footageSuggestions: { type: 'STRING' },
            metadata: {
              type: 'OBJECT',
              properties: {
                youtubeTitle: { type: 'STRING' },
                youtubeCaption: { type: 'STRING' },
                youtubeDescription: { type: 'STRING' },
                youtubeTags: { type: 'STRING' }
              },
              required: ['youtubeTitle', 'youtubeCaption', 'youtubeDescription', 'youtubeTags']
            },
            scenes: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  sceneNumber: { type: 'INTEGER' },
                  narratorText: { type: 'STRING' },
                  visualPrompt: { type: 'STRING' },
                  duration: { type: 'INTEGER' },
                  episodeTimestampStart: { type: 'INTEGER' },
                  dialogues: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        character: { type: 'STRING' },
                        text: { type: 'STRING' }
                      },
                      required: ['character', 'text']
                    }
                  }
                },
                required: ['sceneNumber', 'narratorText', 'visualPrompt', 'duration', 'episodeTimestampStart', 'dialogues']
              }
            }
          },
          required: ['animeTitle', 'language', 'tone', 'footageSuggestions', 'metadata', 'scenes']
        }
      }
    });

    const scriptData = JSON.parse(response.text);
    const scriptPayload = {
      animeTitle: `${scriptData.animeTitle} - S${seasonNumber} Ep ${episodeNumber} Summary`,
      language: scriptData.language || language,
      tone: scriptData.tone || tone,
      videoType: 'long',
      footageSuggestions: scriptData.footageSuggestions || `Season ${seasonNumber} Episode ${episodeNumber} footage.`,
      metadata: scriptData.metadata || {
        youtubeTitle: `${scriptData.animeTitle} Summary! S${seasonNumber} E${episodeNumber}`,
        youtubeCaption: `Complete breakdown of ${scriptData.animeTitle} Season ${seasonNumber} Episode ${episodeNumber}.`,
        youtubeDescription: `Detailed episode breakdown of ${scriptData.animeTitle}. Total Seasons: ${seasonNumber}, Rating: 9/10.`,
        youtubeTags: 'anime, summary, review'
      },
      scenes: scriptData.scenes,
      createdAt: new Date()
    };

    let result;
    if (isDbConnected()) {
      const newScript = new Script(scriptPayload);
      result = await newScript.save();
      console.log('Saved long script to MongoDB');
    } else {
      result = {
        _id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        ...scriptPayload,
        audioBase64: ''
      };
      memoryDb.push(result);
      console.log('Saved long script to In-Memory DB (MongoDB is offline)');
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error generating long script:', error);
    res.status(500).json({ error: error.message || 'Failed to generate long script' });
  }
});

/**
 * @route POST /api/extract-script
 * @desc Upload video/audio or subtitle files to extract script and dialogues
 */
app.post('/api/extract-script', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { language = 'English', tone = 'Dramatic' } = req.body;
  const originalName = req.file.originalname;
  const filePath = req.file.path;
  const fileExt = path.extname(originalName).toLowerCase();

  try {
    const responseSchema = {
      type: 'OBJECT',
      properties: {
        animeTitle: { type: 'STRING' },
        language: { type: 'STRING' },
        tone: { type: 'STRING' },
        footageSuggestions: { type: 'STRING' },
        metadata: {
          type: 'OBJECT',
          properties: {
            youtubeTitle: { type: 'STRING' },
            youtubeCaption: { type: 'STRING' },
            youtubeDescription: { type: 'STRING' },
            youtubeTags: { type: 'STRING' }
          },
          required: ['youtubeTitle', 'youtubeCaption', 'youtubeDescription', 'youtubeTags']
        },
        scenes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              sceneNumber: { type: 'INTEGER' },
              narratorText: { type: 'STRING' },
              visualPrompt: { type: 'STRING' },
              duration: { type: 'INTEGER' },
              episodeTimestampStart: { type: 'INTEGER' },
              dialogues: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    character: { type: 'STRING' },
                    text: { type: 'STRING' }
                  },
                  required: ['character', 'text']
                }
              }
            },
            required: ['sceneNumber', 'narratorText', 'visualPrompt', 'duration', 'episodeTimestampStart', 'dialogues']
          }
        }
      },
      required: ['animeTitle', 'language', 'tone', 'footageSuggestions', 'metadata', 'scenes']
    };

    let scriptData;

    // If it's a subtitle/text file
    if (['.srt', '.vtt', '.txt', '.ass', '.ssa'].includes(fileExt)) {
      const rawContentText = await fs.promises.readFile(filePath, 'utf-8');
      fs.unlink(filePath, () => {});

      const animeTitle = originalName.replace(fileExt, '').replace(/[\-_]+/g, ' ');
      const promptText = `You are a professional anime YouTube summary creator.
Below is the raw subtitle text or transcript of the anime episode: "${animeTitle}".

Raw content:
${rawContentText.substring(0, 45000)}

Create a highly detailed script storyboard describing the sequence of events, dialogue highlights, and narration for this episode.
The script tone must be "${tone}" and in "${language}" language.
Generate exactly 8 to 12 scenes.
For each scene, provide:
1. sceneNumber: sequential index starting from 1.
2. narratorText: Comprehensive narrator voiceover in the target language.
3. visualPrompt: A detailed visual description in English of the scenes and storyboard cues.
4. duration: Estimated duration in seconds (usually 10 to 20 seconds).
5. episodeTimestampStart: Estimated starting timestamp in seconds.
6. dialogues: An array of key dialogue quotes of what was said in this scene. Each dialogue contains a "character" field (the name of the character) and a "text" field (the translated quote they spoke).

Also, recommend where to find the raw episode (footageSuggestions).

Also, generate highly optimized YouTube metadata:
1. youtubeTitle: A clickbaity, high-CTR YouTube video title (under 70 characters).
2. youtubeCaption: A short clickbaity caption/hook (under 120 characters).
3. youtubeDescription: An SEO-optimized video description containing anime details (seasons, ratings), timestamps, and keywords.
4. youtubeTags: Comma-separated tags.

Strictly adhere to the JSON output schema.`;

      console.log('Generating script storyboard from subtitle file...');
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema
        }
      });
      scriptData = JSON.parse(response.text);

    } else if (['.mp4', '.mkv', '.avi', '.mov', '.mp3', '.wav', '.m4a', '.webm'].includes(fileExt)) {
      let audioPath = filePath;
      const isVideo = ['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(fileExt);

      if (isVideo) {
        audioPath = path.join(tempDir, `temp_${Date.now()}_extracted.mp3`);
        await new Promise((resolve, reject) => {
          ffmpeg(filePath)
            .noVideo()
            .audioCodec('libmp3lame')
            .audioChannels(1)
            .audioBitrate(32) // Low bitrate downsampling for fast network transfer
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(audioPath);
        });
        fs.unlink(filePath, () => {});
      } else {
        // Downsample audio files as well for fast uploads
        audioPath = path.join(tempDir, `temp_${Date.now()}_downsampled.mp3`);
        await new Promise((resolve, reject) => {
          ffmpeg(filePath)
            .audioCodec('libmp3lame')
            .audioChannels(1)
            .audioBitrate(32)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(audioPath);
        });
        fs.unlink(filePath, () => {});
      }

      console.log('Generating script storyboard from media audio stream...');
      const audioBase64 = await fs.promises.readFile(audioPath, { encoding: 'base64' });
      fs.unlink(audioPath, () => {});

      const animeTitle = originalName.replace(fileExt, '').replace(/[\-_]+/g, ' ');
      const promptText = `You are a professional anime YouTube summary creator.
Listen to the attached audio track from the anime episode: "${animeTitle}".
Create a highly detailed script storyboard describing the sequence of events, dialogue highlights, and narration for this episode.

The script tone must be "${tone}" and in "${language}" language.
Generate exactly 8 to 12 scenes.
For each scene, provide:
1. sceneNumber: sequential index starting from 1.
2. narratorText: Comprehensive narrator voiceover in the target language.
3. visualPrompt: A detailed visual description in English of the scenes and storyboard cues.
4. duration: Estimated duration in seconds (usually 10 to 20 seconds).
5. episodeTimestampStart: Estimated starting timestamp in seconds.
6. dialogues: An array of key dialogue quotes of what was said in this scene. Each dialogue contains a "character" field (the name of the character) and a "text" field (the translated quote they spoke).

Also, recommend where to find the raw episode (footageSuggestions).

Also, generate highly optimized YouTube metadata:
1. youtubeTitle: A clickbaity, high-CTR YouTube video title (under 70 characters).
2. youtubeCaption: A short clickbaity caption/hook (under 120 characters).
3. youtubeDescription: An SEO-optimized video description containing details about the anime (ratings, seasons), timestamps, and keywords.
4. youtubeTags: Comma-separated tags.

Strictly adhere to the JSON output schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'audio/mp3',
              data: audioBase64
            }
          },
          promptText
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema
        }
      });
      scriptData = JSON.parse(response.text);
    } else {
      fs.unlink(filePath, () => {});
      return res.status(400).json({ error: 'Unsupported file format.' });
    }

    const scriptPayload = {
      animeTitle: `Extracted: ${scriptData.animeTitle}`,
      language: scriptData.language || language,
      tone: scriptData.tone || tone,
      videoType: 'extracted',
      footageSuggestions: scriptData.footageSuggestions || 'Use raw source footage from the uploaded file.',
      metadata: scriptData.metadata || {
        youtubeTitle: `Extracted: ${scriptData.animeTitle} Summary`,
        youtubeCaption: `Extracted episode summary of ${scriptData.animeTitle}.`,
        youtubeDescription: `Detailed plot summary breakdown.`,
        youtubeTags: 'anime, summary, extracted'
      },
      scenes: scriptData.scenes,
      createdAt: new Date()
    };

    let result;
    if (isDbConnected()) {
      const newScript = new Script(scriptPayload);
      result = await newScript.save();
    } else {
      scriptPayload._id = `extracted_${Date.now()}`;
      memoryDb.push(scriptPayload);
      result = scriptPayload;
    }

    res.json(result);
  } catch (error) {
    console.error('Extraction failed:', error);
    fs.unlink(filePath, () => {});
    res.status(500).json({ error: error.message || 'Failed to extract script from media file.' });
  }
});

/**
 * @route POST /api/generate-manga-script
 * @desc Generate script storyboard by manga chapter numbers range or uploaded panels
 */
app.post('/api/generate-manga-script', upload.array('files', 10), async (req, res) => {
  const { mangaName, startChapter, endChapter, language = 'English', tone = 'Dramatic', focusDetails = '' } = req.body;

  if (!mangaName || !startChapter || !endChapter) {
    return res.status(400).json({ error: 'Please provide mangaName, startChapter, and endChapter.' });
  }

  try {
    const uploadedFiles = req.files || [];
    let promptText = '';
    let promptContents = [];

    if (uploadedFiles.length > 0) {
      console.log(`Processing ${uploadedFiles.length} uploaded manga panels...`);
      for (const file of uploadedFiles) {
        const fileBase64 = await fs.promises.readFile(file.path, { encoding: 'base64' });
        fs.unlink(file.path, () => {});

        promptContents.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: fileBase64
          }
        });
      }

      promptText = `You are a professional manga analyst and YouTube storyteller.
Analyze the attached manga panels from "${mangaName}" Chapters ${startChapter} to ${endChapter}.
Create a highly detailed script storyboard describing the sequence of events, dialogue highlights, and narration for these chapters.
Additional context: ${focusDetails}

The script tone must be "${tone}" and in "${language}" language.
Generate exactly 8 to 12 scenes.
For each scene, provide:
1. sceneNumber: sequential index starting from 1.
2. narratorText: Comprehensive narrator voiceover in the target language.
3. visualPrompt: A detailed visual description in English of the panels and storyboard cues.
4. duration: Estimated duration in seconds (usually 10 to 20 seconds).
5. episodeTimestampStart: Estimated starting timestamp in seconds.
6. dialogues: An array of key dialogue quotes of what was said in this scene. Each dialogue contains a "character" field (the name of the character) and a "text" field (the translated quote they spoke).

Also, recommend where to find the raw manga panels (footageSuggestions).

Also, generate highly optimized YouTube metadata:
1. youtubeTitle: A clickbaity, high-CTR YouTube video title (under 70 characters).
2. youtubeCaption: A short clickbaity caption/hook (under 120 characters).
3. youtubeDescription: An SEO-optimized video description containing details about the manga (ratings, authors, chapters), timestamps, and keywords.
4. youtubeTags: Comma-separated tags.

Strictly adhere to the JSON output schema.`;

    } else {
      promptText = `You are a professional manga analyst and YouTube storyteller.
Generate a highly detailed script storyboard describing the plot, sequence of events, and narration of "${mangaName}" Chapters ${startChapter} to ${endChapter}.
Additional context: ${focusDetails}

The script tone must be "${tone}" and in "${language}" language.
Generate exactly 8 to 12 scenes.
For each scene, provide:
1. sceneNumber: sequential index starting from 1.
2. narratorText: Comprehensive narrator voiceover in the target language explaining the events.
3. visualPrompt: A detailed visual description in English of the manga scenes, panel layout, or storyboard.
4. duration: Estimated duration in seconds (usually 10 to 20 seconds).
5. episodeTimestampStart: Estimated starting timestamp in seconds.
6. dialogues: An array of key dialogue quotes of what was said in this scene. Each dialogue contains a "character" field (the name of the character) and a "text" field (the translated quote they spoke).

Also, recommend where to find the raw manga panels (footageSuggestions).

Also, generate highly optimized YouTube metadata:
1. youtubeTitle: A clickbaity, high-CTR YouTube video title (under 70 characters).
2. youtubeCaption: A short clickbaity caption/hook (under 120 characters).
3. youtubeDescription: An SEO-optimized video description containing details about the manga (ratings, authors, chapters), timestamps, and keywords.
4. youtubeTags: Comma-separated tags.

Strictly adhere to the JSON output schema.`;
    }

    promptContents.push(promptText);

    console.log(`Generating manga script via Gemini...`);
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptContents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            animeTitle: { type: 'STRING' },
            language: { type: 'STRING' },
            tone: { type: 'STRING' },
            footageSuggestions: { type: 'STRING' },
            metadata: {
              type: 'OBJECT',
              properties: {
                youtubeTitle: { type: 'STRING' },
                youtubeCaption: { type: 'STRING' },
                youtubeDescription: { type: 'STRING' },
                youtubeTags: { type: 'STRING' }
              },
              required: ['youtubeTitle', 'youtubeCaption', 'youtubeDescription', 'youtubeTags']
            },
            scenes: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  sceneNumber: { type: 'INTEGER' },
                  narratorText: { type: 'STRING' },
                  visualPrompt: { type: 'STRING' },
                  duration: { type: 'INTEGER' },
                  episodeTimestampStart: { type: 'INTEGER' },
                  dialogues: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        character: { type: 'STRING' },
                        text: { type: 'STRING' }
                      },
                      required: ['character', 'text']
                    }
                  }
                },
                required: ['sceneNumber', 'narratorText', 'visualPrompt', 'duration', 'episodeTimestampStart', 'dialogues']
              }
            }
          },
          required: ['animeTitle', 'language', 'tone', 'footageSuggestions', 'metadata', 'scenes']
        }
      }
    });

    const scriptData = JSON.parse(response.text);
    const scriptPayload = {
      animeTitle: `Manga: ${scriptData.animeTitle} - Ch ${startChapter}-${endChapter}`,
      language: scriptData.language || language,
      tone: scriptData.tone || tone,
      videoType: 'manga',
      footageSuggestions: scriptData.footageSuggestions || 'Recommend sourcing official manga digital chapters.',
      metadata: scriptData.metadata || {
        youtubeTitle: `${scriptData.animeTitle} Chapters ${startChapter} to ${endChapter} Breakdown!`,
        youtubeCaption: `Manga chapter analysis for ${scriptData.animeTitle}.`,
        youtubeDescription: `Detailed manga breakdown.`,
        youtubeTags: 'manga, review, analysis'
      },
      scenes: scriptData.scenes,
      createdAt: new Date()
    };

    let result;
    if (isDbConnected()) {
      const newScript = new Script(scriptPayload);
      result = await newScript.save();
    } else {
      scriptPayload._id = `manga_${Date.now()}`;
      memoryDb.push(scriptPayload);
      result = scriptPayload;
    }

    res.json(result);
  } catch (error) {
    console.error('Manga forge script generation failed:', error);
    if (req.files) {
      req.files.forEach(f => fs.unlink(f.path, () => {}));
    }
    res.status(500).json({ error: error.message || 'Failed to generate manga script.' });
  }
});

/**
 * @route POST /api/generate-long-audio
 * @desc Segment-by-segment TTS synthesis for long scripts (prevents API limits/timeouts)
 */
app.post('/api/generate-long-audio', async (req, res) => {
  const { scriptId, voice } = req.body;

  if (!scriptId) {
    return res.status(400).json({ error: 'Please provide scriptId.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key is missing on the server.' });
  }

  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(scriptId);
    } else {
      script = memoryDb.find(s => s._id === scriptId);
    }

    if (!script) {
      return res.status(404).json({ error: 'Script not found.' });
    }

    const selectedVoice = voice || 'Puck';
    console.log(`Generating long audio (combined + separate scene tracks, voice: ${selectedVoice}) for: ${script.animeTitle}...`);

    let finalAudioBuffer;
    let useFallback = false;
    const pcmBuffersList = [];
    const mp3BuffersList = [];

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      if (!scene.narratorText || !scene.narratorText.trim()) continue;

      // Rate limit throttle delay between Gemini calls
      if (i > 0 && !useFallback) {
        await new Promise(resolve => setTimeout(resolve, 6500));
      }

      if (!useFallback) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-tts-preview',
            contents: scene.narratorText,
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: selectedVoice
                  }
                }
              }
            }
          });

          const parts = response.candidates?.[0]?.content?.parts;
          const inlineData = parts?.find(p => p.inlineData)?.inlineData;
          if (inlineData && inlineData.data) {
            const rawPcm = Buffer.from(inlineData.data, 'base64');
            const wavBuffer = convertPcmToWav(rawPcm, 24000);
            scene.audioBase64 = wavBuffer.toString('base64');
            pcmBuffersList.push(rawPcm);
          } else {
            throw new Error('No audio data returned by Gemini API.');
          }
        } catch (apiError) {
          console.warn(`Gemini TTS failed at scene ${scene.sceneNumber}: ${apiError.message}. Switching to Translate TTS fallback for all scenes...`);
          useFallback = true;
          
          // Recovery: convert previous scenes to MP3 fallback buffers
          mp3BuffersList.length = 0; // Reset mp3 list
          for (let j = 0; j < i; j++) {
            const prevScene = script.scenes[j];
            if (!prevScene.narratorText || !prevScene.narratorText.trim()) continue;
            const prevMp3 = await getGoogleTranslateTts(prevScene.narratorText, script.language);
            prevScene.audioBase64 = prevMp3.toString('base64');
            mp3BuffersList.push(prevMp3);
          }

          // Generate translate TTS for the current scene
          const currentMp3 = await getGoogleTranslateTts(scene.narratorText, script.language);
          scene.audioBase64 = currentMp3.toString('base64');
          mp3BuffersList.push(currentMp3);
        }
      } else {
        // Direct translate TTS fallback path
        const mp3 = await getGoogleTranslateTts(scene.narratorText, script.language);
        scene.audioBase64 = mp3.toString('base64');
        mp3BuffersList.push(mp3);
      }
    }

    // Prepare the unified audio buffer
    if (!useFallback) {
      if (pcmBuffersList.length === 0) {
        return res.status(500).json({ error: 'No audio synthesized for any scene.' });
      }
      const unifiedPcm = Buffer.concat(pcmBuffersList);
      finalAudioBuffer = convertPcmToWav(unifiedPcm, 24000);
    } else {
      if (mp3BuffersList.length === 0) {
        return res.status(500).json({ error: 'No audio synthesized for any scene.' });
      }
      finalAudioBuffer = Buffer.concat(mp3BuffersList);
    }

    const audioBase64Str = finalAudioBuffer.toString('base64');
    if (isDbConnected()) {
      script.audioBase64 = audioBase64Str;
      script.markModified('scenes');
      await script.save();
    } else {
      script.audioBase64 = audioBase64Str;
    }

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': finalAudioBuffer.length
    });

    return res.send(finalAudioBuffer);
  } catch (error) {
    console.error('Error generating long audio:', error);
    res.status(500).json({ error: error.message || 'Failed to generate long audio' });
  }
});

/**
 * @route GET /api/scripts/:id/audio
 * @desc Stream synthesized audio for a script
 */
app.get('/api/scripts/:id/audio', async (req, res) => {
  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(req.params.id);
    } else {
      script = memoryDb.find(s => s._id === req.params.id);
    }

    if (!script || !script.audioBase64) {
      return res.status(404).json({ error: 'Audio track not found. Synthesize it first.' });
    }

    const audioBuffer = Buffer.from(script.audioBase64, 'base64');
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length
    });
    res.send(audioBuffer);
  } catch (err) {
    console.error('Error streaming script audio:', err);
    res.status(500).json({ error: 'Failed to stream audio.' });
  }
});

/**
 * @route GET /api/scripts/:id/audio/mp3
 * @desc Convert cached script audio (WAV) to MP3 and stream it for download
 */
app.get('/api/scripts/:id/audio/mp3', async (req, res) => {
  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(req.params.id);
    } else {
      script = memoryDb.find(s => s._id === req.params.id);
    }

    if (!script || !script.audioBase64) {
      return res.status(404).json({ error: 'Audio track not found. Synthesize it first.' });
    }

    const audioBuffer = Buffer.from(script.audioBase64, 'base64');
    const isWav = audioBuffer.toString('ascii', 0, 4) === 'RIFF';

    if (!isWav) {
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length
      });
      return res.send(audioBuffer);
    }

    const tempWavPath = path.join(tempDir, `temp_${Date.now()}_input.wav`);
    const tempMp3Path = path.join(tempDir, `temp_${Date.now()}_output.mp3`);

    await fs.promises.writeFile(tempWavPath, audioBuffer);

    ffmpeg(tempWavPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .on('end', async () => {
        try {
          const mp3Buffer = await fs.promises.readFile(tempMp3Path);
          res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': mp3Buffer.length
          });
          res.send(mp3Buffer);

          fs.unlink(tempWavPath, () => {});
          fs.unlink(tempMp3Path, () => {});
        } catch (readErr) {
          console.error('Error reading mp3 file:', readErr);
          if (!res.headersSent) res.status(500).json({ error: 'Conversion failed.' });
        }
      })
      .on('error', (ffmpegErr) => {
        console.error('FFmpeg MP3 conversion failed:', ffmpegErr);
        if (!res.headersSent) res.status(500).json({ error: 'FFmpeg conversion failed.' });
        fs.unlink(tempWavPath, () => {});
        fs.unlink(tempMp3Path, () => {});
      })
      .save(tempMp3Path);

  } catch (error) {
    console.error('Error serving MP3:', error);
    res.status(500).json({ error: 'Failed to serve MP3.' });
  }
});

/**
 * @route POST /api/scripts/:id/translate
 * @desc Translate an existing script narration and metadata using Gemini 3.5 Flash
 */
app.post('/api/scripts/:id/translate', async (req, res) => {
  const { targetLanguage } = req.body;
  if (!targetLanguage) {
    return res.status(400).json({ error: 'Please specify targetLanguage.' });
  }

  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(req.params.id);
    } else {
      script = memoryDb.find(s => s._id === req.params.id);
    }

    if (!script) {
      return res.status(404).json({ error: 'Script not found.' });
    }

    console.log(`Translating script ${script._id} narration into ${targetLanguage}...`);

    // Prepare prompt to translate each scene's narration text using Gemini
    const scenesTextToTranslate = script.scenes.map(s => `Scene #${s.sceneNumber}: ${s.narratorText}`).join('\n\n');

    let promptText = '';
    let responseSchema = {};

    if (script.metadata) {
      promptText = `You are a professional translator specializing in anime content.
Translate the narration script and YouTube metadata of the anime "${script.animeTitle}" into "${targetLanguage}".
Target Language definitions:
- Hindi: Translate the script and metadata into fluent Hindi, writing in the Devanagari script (e.g. "गोकू ने फ्रीजा को हरा दिया").
- Hinglish: Translate the script and metadata into fluent Hindi but write it using the Latin/English script characters (e.g. "Goku ne Frieza ko hara diya").
- English: Translate the script and metadata into fluent English.

Original scenes narration to translate:
${scenesTextToTranslate}

Original metadata to translate:
Title: ${script.metadata.youtubeTitle || ''}
Caption: ${script.metadata.youtubeCaption || ''}
Description: ${script.metadata.youtubeDescription || ''}

Strictly preserve the original meaning, tone, and pacing of each scene.
Output a JSON object matching this schema:
{
  "metadata": {
    "youtubeTitle": "translated title",
    "youtubeCaption": "translated caption",
    "youtubeDescription": "translated description"
  },
  "scenes": [
    {
      "sceneNumber": number,
      "narratorText": "translated narration text"
    }
  ]
}`;

      responseSchema = {
        type: 'OBJECT',
        properties: {
          metadata: {
            type: 'OBJECT',
            properties: {
              youtubeTitle: { type: 'STRING' },
              youtubeCaption: { type: 'STRING' },
              youtubeDescription: { type: 'STRING' }
            },
            required: ['youtubeTitle', 'youtubeCaption', 'youtubeDescription']
          },
          scenes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                sceneNumber: { type: 'INTEGER' },
                narratorText: { type: 'STRING' }
              },
              required: ['sceneNumber', 'narratorText']
            }
          }
        },
        required: ['metadata', 'scenes']
      };

    } else {
      promptText = `You are a professional translator specializing in anime content.
Translate the narration script of the anime "${script.animeTitle}" into "${targetLanguage}".
Target Language definitions:
- Hindi: Translate the script into fluent Hindi, writing in the Devanagari script.
- Hinglish: Translate the script into fluent Hindi but write it using the Latin/English script characters.
- English: Translate the script into fluent English.

Original scenes:
${scenesTextToTranslate}

Strictly preserve the original meaning, tone, and pacing of each scene.
Output a JSON object matching this schema:
{
  "scenes": [
    {
      "sceneNumber": number,
      "narratorText": "translated narration text"
    }
  ]
}`;

      responseSchema = {
        type: 'OBJECT',
        properties: {
          scenes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                sceneNumber: { type: 'INTEGER' },
                narratorText: { type: 'STRING' }
              },
              required: ['sceneNumber', 'narratorText']
            }
          }
        },
        required: ['scenes']
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    });

    const parsedData = JSON.parse(response.text);

    // Apply translations to scenes and clear voice caches
    parsedData.scenes.forEach(translatedScene => {
      const originalScene = script.scenes.find(s => s.sceneNumber === translatedScene.sceneNumber);
      if (originalScene) {
        originalScene.narratorText = translatedScene.narratorText;
        originalScene.audioBase64 = ''; // Reset voice track
      }
    });

    script.language = targetLanguage;
    script.audioBase64 = ''; // Reset unified voice track

    if (script.metadata && parsedData.metadata) {
      script.metadata.youtubeTitle = parsedData.metadata.youtubeTitle || script.metadata.youtubeTitle;
      script.metadata.youtubeCaption = parsedData.metadata.youtubeCaption || script.metadata.youtubeCaption;
      script.metadata.youtubeDescription = parsedData.metadata.youtubeDescription || script.metadata.youtubeDescription;
    }

    if (isDbConnected()) {
      script.markModified('scenes');
      if (script.metadata) script.markModified('metadata');
      await script.save();
    }

    res.json(script);
  } catch (error) {
    console.error('Translation failed:', error);
    res.status(500).json({ error: error.message || 'Translation pipeline failed.' });
  }
});

/**
 * @route GET /api/scripts/:id/scenes/:sceneNum/audio
 * @desc Stream synthesized audio for a specific scene segment of a long script
 */
app.get('/api/scripts/:id/scenes/:sceneNum/audio', async (req, res) => {
  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(req.params.id);
    } else {
      script = memoryDb.find(s => s._id === req.params.id);
    }

    if (!script) {
      return res.status(404).json({ error: 'Script not found.' });
    }

    const sceneNumVal = parseInt(req.params.sceneNum);
    const scene = script.scenes.find(s => s.sceneNumber === sceneNumVal);
    if (!scene || !scene.audioBase64) {
      return res.status(404).json({ error: 'Scene audio track not found. Synthesize it first.' });
    }

    const audioBuffer = Buffer.from(scene.audioBase64, 'base64');
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length
    });
    res.send(audioBuffer);
  } catch (err) {
    console.error('Error fetching scene audio:', err);
    res.status(500).json({ error: 'Failed to stream scene audio.' });
  }
});

/**
 * @route POST /api/render-long-video
 * @desc Landscape 16:9 long form YouTube video compiler (stitching & voice overlays)
 */
app.post('/api/render-long-video', upload.single('video'), async (req, res) => {
  const { scriptId, voice } = req.body;
  const uploadedFile = req.file;

  if (!scriptId) {
    return res.status(400).json({ error: 'Please provide scriptId.' });
  }

  if (!uploadedFile) {
    return res.status(400).json({ error: 'Please upload an .mp4 episode video.' });
  }

  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(scriptId);
    } else {
      script = memoryDb.find(s => s._id === scriptId);
    }

    if (!script) {
      return res.status(404).json({ error: 'Script not found.' });
    }

    const voiceActor = voice || 'Puck';

    // Synthesize segmented audio on-the-fly if not cached
    if (!script.audioBase64) {
      console.log('Audio not found in database. Triggering scene-by-scene synthesis...');
      const pcmBuffersList = [];

      for (const scene of script.scenes) {
        if (!scene.narratorText.trim()) continue;

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: scene.narratorText,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                voiceName: voiceActor
              }
            }
          }
        });

        const parts = response.candidates?.[0]?.content?.parts;
        const inlineData = parts?.find(p => p.inlineData)?.inlineData;
        if (inlineData && inlineData.data) {
          pcmBuffersList.push(Buffer.from(inlineData.data, 'base64'));
        }
      }

      if (pcmBuffersList.length === 0) {
        throw new Error('No audio synthesized for long video scenes.');
      }

      const unifiedPcm = Buffer.concat(pcmBuffersList);
      const wavBuffer = convertPcmToWav(unifiedPcm, 24000);
      script.audioBase64 = wavBuffer.toString('base64');
      if (isDbConnected()) {
        await script.save();
      }
    }

    // Write temp audio file
    const audioBuffer = Buffer.from(script.audioBase64, 'base64');
    const wavTempPath = path.join(tempDir, `temp_${Date.now()}_${scriptId}.wav`);
    fs.writeFileSync(wavTempPath, audioBuffer);

    // Write temp SRT captions file (relative path to bypass colons)
    const srtText = formatSrtText(script.scenes);
    const srtFilename = `temp_${Date.now()}_${scriptId}.srt`;
    fs.writeFileSync(srtFilename, srtText);

    // Output file config (keeps standard landscape 16:9 format)
    const outputFilename = `long_render_${Date.now()}_${scriptId}.mp4`;
    const outputPath = path.join(uploadsDir, outputFilename);
    const rawVideoPath = uploadedFile.path;

    // Build dynamic FFmpeg filters for landscape stitching & captioning
    const filterChain = [];
    const concatInputs = [];

    script.scenes.forEach((scene, index) => {
      const start = scene.episodeTimestampStart || (index * 60);
      const duration = scene.duration || 10;
      
      const trimOutput = `t${index}`;
      const ptsOutput = `v${index}`;
      
      // Cut raw episode segments matching storyboard timestamps
      filterChain.push({
        filter: 'trim',
        options: `start=${start}:duration=${duration}`,
        inputs: '0:v',
        outputs: trimOutput
      });
      
      // Reset timestamps
      filterChain.push({
        filter: 'setpts',
        options: 'PTS-STARTPTS',
        inputs: trimOutput,
        outputs: ptsOutput
      });
      
      concatInputs.push(ptsOutput);
    });

    // Concat landscape segments
    filterChain.push({
      filter: 'concat',
      options: `n=${script.scenes.length}:v=1:a=0`,
      inputs: concatInputs,
      outputs: 'stitched'
    });

    // Burn subtitles onto landscape video (FontSize=12, Alignment=2 bottom center)
    filterChain.push({
      filter: 'subtitles',
      options: {
        filename: srtFilename,
        force_style: 'FontSize=12,PrimaryColour=&H00FFFFFF,Outline=1,Alignment=2,MarginV=20'
      },
      inputs: 'stitched',
      outputs: 'v_out'
    });

    console.log(`Starting FFmpeg long video compilation:`);
    console.log(`- Video input: ${rawVideoPath}`);
    console.log(`- Audio input: ${wavTempPath}`);
    console.log(`- SRT input: ${srtFilename}`);
    console.log(`- Output path: ${outputPath}`);

    // Run FFmpeg command
    ffmpeg()
      .input(rawVideoPath)
      .input(wavTempPath)
      .complexFilter(filterChain)
      .outputOptions([
        '-map [v_out]',     // map our stitched/subtitled landscape video
        '-map 1:a',          // map our synthesized segmented voiceover audio track
        '-c:v libx264',      // H.264 video
        '-preset superfast', // processing speed preset
        '-c:a aac',          // AAC audio
        '-shortest',         // match length to vocal audio track
        '-threads 2'         // limit CPU core utilization
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('FFmpeg long render spawned successfully. Command:', cmd);
      })
      .on('end', () => {
        try {
          console.log(`FFmpeg long render completed. Output file: ${outputFilename}`);
          // Clean up temp files
          fs.unlink(wavTempPath, () => {});
          fs.unlink(srtFilename, () => {});
          fs.unlink(rawVideoPath, () => {}); // Remove uploaded raw clip to save space
          
          if (!res.headersSent) {
            res.json({
              success: true,
              videoUrl: `http://localhost:5000/uploads/${outputFilename}`
            });
          }
        } catch (err) {
          console.error('Error in FFmpeg long end handler:', err);
        }
      })
      .on('error', (err) => {
        try {
          console.error('FFmpeg long render error:', err);
          // Clean up temp files
          fs.unlink(wavTempPath, () => {});
          fs.unlink(srtFilename, () => {});
          fs.unlink(rawVideoPath, () => {});
          
          if (!res.headersSent) {
            res.status(500).json({ error: `FFmpeg long video rendering failed: ${err.message}` });
          }
        } catch (e) {
          console.error('Error in FFmpeg long error handler:', e);
        }
      })
      .run();
  } catch (error) {
    console.error('Long Video Forge Render crash:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize long render pipeline' });
  }
});

/**
 * @route GET /api/scripts
 * @desc Get all generated scripts
 */
app.get('/api/scripts', async (req, res) => {
  try {
    if (isDbConnected()) {
      const scripts = await Script.find().select('-audioBase64').sort({ createdAt: -1 });
      res.json(scripts);
    } else {
      const scripts = memoryDb.map(({ audioBase64, ...rest }) => rest).sort((a, b) => b.createdAt - a.createdAt);
      res.json(scripts);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

/**
 * @route GET /api/scripts/:id
 * @desc Get a specific script
 */
app.get('/api/scripts/:id', async (req, res) => {
  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(req.params.id);
    } else {
      script = memoryDb.find(s => s._id === req.params.id);
    }

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }
    res.json(script);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch script' });
  }
});

/**
 * @route GET /api/scripts/:id/audio
 * @desc Stream/download saved audio as WAV
 */
app.get('/api/scripts/:id/audio', async (req, res) => {
  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(req.params.id);
    } else {
      script = memoryDb.find(s => s._id === req.params.id);
    }

    if (!script || !script.audioBase64) {
      return res.status(404).json({ error: 'Audio not generated or script not found' });
    }
    const audioBuffer = Buffer.from(script.audioBase64, 'base64');
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length
    });
    res.send(audioBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to stream audio' });
  }
});

/**
 * @route GET /api/scripts/:id/audio/mp3
 * @desc Stream/download saved audio converted to MP3 on the fly
 */
app.get('/api/scripts/:id/audio/mp3', async (req, res) => {
  try {
    let script;
    if (isDbConnected()) {
      script = await Script.findById(req.params.id);
    } else {
      script = memoryDb.find(s => s._id === req.params.id);
    }

    if (!script || !script.audioBase64) {
      return res.status(404).json({ error: 'Audio not generated or script not found' });
    }

    const wavBuffer = Buffer.from(script.audioBase64, 'base64');
    const pcmBuffer = wavBuffer.subarray(44);
    
    console.log(`Converting saved WAV for script ${req.params.id} to MP3...`);
    const mp3Buffer = convertPcmToMp3(pcmBuffer, 24000);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': mp3Buffer.length
    });
    res.send(mp3Buffer);
  } catch (error) {
    console.error('Error during WAV to MP3 conversion:', error);
    res.status(500).json({ error: 'Failed to convert audio to MP3' });
  }
});

/**
 * @route DELETE /api/scripts/:id
 * @desc Delete a script
 */
app.delete('/api/scripts/:id', async (req, res) => {
  try {
    let deleted = false;
    if (isDbConnected()) {
      const result = await Script.findByIdAndDelete(req.params.id);
      deleted = !!result;
    } else {
      const index = memoryDb.findIndex(s => s._id === req.params.id);
      if (index !== -1) {
        memoryDb.splice(index, 1);
        deleted = true;
      }
    }

    if (!deleted) {
      return res.status(404).json({ error: 'Script not found' });
    }
    res.json({ success: true, message: 'Script deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
