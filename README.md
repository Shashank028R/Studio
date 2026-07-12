# Anime Shorts & Long Video Studio (AI Engine)

Anime Shorts Studio is a premium web application designed to generate, voice over, clip, and stitch anime videos. It supports both vertical (9:16) YouTube Shorts/TikToks and landscape (16:9) long-form summaries/commentaries. It is integrated with advanced Gemini TTS voices, custom SRT parser engines, automated FFmpeg stitching consoles, and an auto-healing Translate voice fallback pipeline.

---

## 🚀 Key Features

### 1. ⚔️ Script Forge
- Generates vertical short video scripts with visual storyboard prompts and high-retention narration hooks.
- Powered by Gemini models to optimize pacing, hooks, and summaries.

### 2. 🎙️ Custom Studio
- **Quick Text-to-Speech**: Type raw text, select a voice, and synthesize high-fidelity WAV streams on the fly.
- **Custom Script Builder**: Write your own storyboard script manually, specify scene timings, visual cues, and narration segments, and save them.

### 3. 🎬 Video Forge (Shorts Compiler)
- Upload raw episode clips, and the system will automatically extract recommended parts matching script scene timestamps.
- Clips are stitched together, overlaid with custom subtitle text, and blended with the synthesized voice track.

### 4. 📖 Episode Summarizer (YouTube Long-Form)
- Provide Anime Title, Season Number, and Episode Number.
- Generates a full scene-by-scene script summary (8-12 segments) explaining the episode plot.
- **Simultaneous Vocal Synthesis**: Generates a unified voice narration track AND individual scene vocals in a single run.
- **Studio History**: Track all summary scripts, reload them instantly, and review scene timelines.

### 5. 🎥 Long Video Forge
- Upload a full episode file and automatically clip, stitch, and overlay narration and subtitles to compile a widescreen landscape YouTube video.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, Lucide React.
- **Backend**: Node.js, Express, Mongoose, Multer (multipart uploads).
- **Video Engine**: FFmpeg (via `fluent-ffmpeg` and `ffmpeg-static`).
- **Vocal Synthesis**: Gemini Multi-Modal TTS (`gemini-3.1-flash-tts-preview`) with a robust auto-switch fallback to **Google Translate TTS API** to guarantee zero rate-limit blocks.
- **Database**: MongoDB (supports Atlas or local connections, falls back gracefully to in-memory caching if offline).

---

## ⚙️ Prerequisites

Before running the studio, make sure your device has the following installed:
1. **Node.js**: Version 18.x or higher (npm included).
2. **MongoDB**: A running local MongoDB database instance or a MongoDB Atlas URI string.
3. **Gemini API Key**: Access token from Google AI Studio.

---

## 🔧 Installation & Setup

Follow these steps to run the project locally on any device:

### Step 1: Clone the Repository
```bash
git clone https://github.com/Shashank028R/Studio.git
cd Studio
```

### Step 2: Configure the Backend Environment
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create a file named `.env` in the root of the `backend` folder:
   ```bash
   touch .env
   ```
3. Open `.env` and configure the following variables:
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/anime_shorts_studio?retryWrites=true&w=majority
   GEMINI_API_KEY=AIzaSy...YourActualGeminiApiKey
   ```

### Step 3: Install Backend Dependencies & Start Server
```bash
npm install
npm start
```
*The server will boot and display: `Server running on port 5000` & `MongoDB Connected`.*

### Step 4: Install Frontend Dependencies & Start Client
1. Open a new terminal window in the root directory of the project.
2. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
3. Install packages and start the Vite dev server:
   ```bash
   npm install
   npm run dev
   ```
4. Click on the URL output in your terminal (usually `http://localhost:5173/`) to open the app!

---

## 💡 Important Local Considerations

### 1. Windows FFmpeg Drive Letter Subtitle Bug
On Windows systems, FFmpeg complex filters can fail when absolute paths with drive colons (e.g. `C:\path\subtitles.srt`) are supplied because the colon `:` is interpreted by FFmpeg as a filter separator.
- **Our Solution**: The backend automatically maps and uses relative paths (e.g., `temp/temp_1783.srt`) for the subtitles filter input, ensuring flawless compilation on Windows, Linux, and macOS without manual path rewriting.

### 2. Gemini API 429 Quota Exhaustion Fallback
Specialized audio synthesis calls to Gemini models carry tight request quotas on the free tier (10 calls). 
- **Our Solution**: If a synthesis request encounters a `RESOURCE_EXHAUSTED` (429) rate limit, the server automatically recovers by calling a custom Google Translate TTS engine, ensuring you can still preview voices and synthesize scripts immediately without code failures.

---

## 📝 License
Distributed under the MIT License. See `LICENSE` for more information.
