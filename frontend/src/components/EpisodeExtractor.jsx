import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, FileText, Volume2, Loader2, Play, 
  HelpCircle, Settings, CheckCircle, ListTodo, Film,
  ChevronDown, Copy, Check, Globe, Upload, Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ScriptHistory from './ScriptHistory';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://studio-8m77.onrender.com';

export default function EpisodeExtractor({ fetchScripts, scripts, activeScript, onSelectScript, onDeleteScript }) {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Dramatic & Suspenseful');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [sourceTab, setSourceTab] = useState('upload'); // 'upload' or 'online'
  const [animeName, setAnimeName] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');

  const [generatedScript, setGeneratedScript] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Audio synthesis status
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisVoice, setSynthesisVoice] = useState('Puck');

  // Copy state clips
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);

  // Translation state
  const [translationLang, setTranslationLang] = useState('Hindi');
  const [isTranslating, setIsTranslating] = useState(false);

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'title') {
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    } else if (type === 'caption') {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    } else if (type === 'desc') {
      setCopiedDesc(true);
      setTimeout(() => setCopiedDesc(false), 2000);
    } else if (type === 'tags') {
      setCopiedTags(true);
      setTimeout(() => setCopiedTags(false), 2000);
    }
  };

  // Synchronize when the user clicks an item in ScriptHistory sidebar
  useEffect(() => {
    if (activeScript && activeScript.videoType === 'extracted') {
      setGeneratedScript(activeScript);
    }
  }, [activeScript]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setError('');
    setSuccessMsg('Processing uploaded file & transcribing content...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);
    formData.append('tone', tone);

    try {
      const response = await fetch(`${BACKEND_URL}/api/extract-script`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to extract script storyboard.');
      }

      const scriptData = await response.json();
      setGeneratedScript(scriptData);
      onSelectScript(scriptData);
      setSuccessMsg('Script successfully extracted and compiled!');
      setFile(null);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ffff', '#d946ef', '#ffffff']
      });

      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error uploading file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnlineSubmit = async (e) => {
    e.preventDefault();
    if (!animeName || !episodeNumber) return;

    setIsLoading(true);
    setError('');
    setSuccessMsg(`Auto-fetching & extracting transcript online for "${animeName}" Ep ${episodeNumber}...`);

    try {
      const response = await fetch(`${BACKEND_URL}/api/extract-subtitle-online`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeName,
          episodeNumber,
          language,
          tone
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to auto-fetch subtitles online.');
      }

      const scriptData = await response.json();
      setGeneratedScript(scriptData);
      onSelectScript(scriptData);
      setSuccessMsg('Subtitles successfully fetched and script compiled!');
      
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ffff', '#d946ef', '#ffffff']
      });

      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred during subtitle retrieval.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslateScript = async () => {
    if (!generatedScript) return;
    setIsTranslating(true);
    setError('');
    setSuccessMsg(`Translating script narration into ${translationLang}...`);

    try {
      const response = await fetch(`${BACKEND_URL}/api/scripts/${generatedScript._id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLanguage: translationLang })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Translation failed.');
      }

      const updatedScript = await response.json();
      setGeneratedScript(updatedScript);
      onSelectScript(updatedScript);
      setSuccessMsg(`Script successfully translated to ${translationLang}! Re-synthesize audio below.`);

      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred during translation.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSynthesizeAudio = async () => {
    if (!generatedScript) return;
    setIsSynthesizing(true);
    setError('');
    setSuccessMsg('Synthesizing vocals for unified and separate segments...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-long-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: generatedScript._id, voice: synthesisVoice })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Audio synthesis failed.');
      }

      // Reload active script to mount players
      const reloadResponse = await fetch(`${BACKEND_URL}/api/scripts/${generatedScript._id}`);
      if (reloadResponse.ok) {
        const refreshedScript = await reloadResponse.json();
        setGeneratedScript(refreshedScript);
        onSelectScript(refreshedScript);
      }
      setSuccessMsg('Vocal tracks generated successfully!');
      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred during audio generation.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left panel - form and history log */}
      <div className="lg:col-span-5 space-y-6">
        <div className="glass-panel rounded-2xl p-6 border-cyan-500/20 shadow-neon-cyan relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-cyan/5 rounded-full blur-2xl pointer-events-none" />
          
          <h2 className="text-xl font-black text-white tracking-wide uppercase flex items-center gap-2 mb-1.5">
            <Upload className="w-5 h-5 text-cyber-cyan animate-pulse" />
            Episode Extractor
          </h2>
          <p className="text-xs text-cyber-muted mb-6 leading-relaxed">
            Simply upload your episode video, raw audio, or subtitles (SRT) to automatically forge scripts and characters dialogue timeline.
          </p>

          {/* Source Tabs Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-900 mb-4 select-none">
            <button
              type="button"
              onClick={() => setSourceTab('upload')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
                sourceTab === 'upload'
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('online')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
                sourceTab === 'online'
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Auto-Fetch Online
            </button>
          </div>

          <form onSubmit={sourceTab === 'upload' ? handleUploadSubmit : handleOnlineSubmit} className="space-y-4">
            {sourceTab === 'upload' ? (
              <>
                {/* File Drag & Drop block */}
                <div className="border border-dashed border-slate-800 hover:border-cyber-cyan/50 rounded-2xl p-6 bg-slate-950/40 text-center cursor-pointer transition-all relative group">
                  <input 
                    type="file" 
                    id="episode-file-picker" 
                    onChange={handleFileChange}
                    accept=".srt,.vtt,.txt,.mp4,.mkv,.avi,.mov,.mp3,.wav,.m4a,.webm"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-cyber-muted mx-auto group-hover:text-cyber-cyan transition-colors" />
                    <div className="text-xs font-semibold text-slate-300">
                      {file ? file.name : 'Select or drag episode file here'}
                    </div>
                    <div className="text-[10px] text-cyber-muted">
                      Supports SRT, VTT, MP4, MKV, MP3, WAV (Max 500MB)
                    </div>
                  </div>
                </div>

                {file && file.size > 50 * 1024 * 1024 && (
                  <div className="bg-amber-950/40 border border-amber-500/20 rounded-xl p-3.5 text-[11px] text-amber-200 leading-relaxed animate-fade-in text-left">
                    ⚠️ <strong>Large File Warning ({ (file.size / (1024 * 1024)).toFixed(0) }MB):</strong> Large media uploads can exceed server request timeout rules on hosted platforms like Render (30-second cap). For a fast & completely stable experience, we highly recommend uploading a lightweight <strong>subtitles file (.srt / .vtt)</strong> or a <strong>compressed audio track (.mp3)</strong> instead!
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3 animate-fade-in text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-cyber-cyan uppercase tracking-wider block">Anime Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Naruto, Jujutsu Kaisen, One Piece"
                    value={animeName}
                    onChange={(e) => setAnimeName(e.target.value)}
                    required
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyber-cyan rounded-xl px-4 py-3 text-xs text-white focus:outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-cyber-cyan uppercase tracking-wider block">Episode Number</label>
                  <input
                    type="number"
                    placeholder="e.g. 1"
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                    required
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyber-cyan rounded-xl px-4 py-3 text-xs text-white focus:outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Collapsible Settings */}
            <div className="border border-slate-900 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950/60 hover:bg-slate-950/90 text-xs font-bold text-slate-300 uppercase transition-all"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-cyber-cyan" />
                  <span>Configure Settings</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-cyber-muted transition-transform duration-300 ${showSettings ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden bg-[#0a0716]/35 border-t border-slate-900"
                  >
                    <div className="p-4 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-cyber-cyan uppercase tracking-wider block">Language</label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="English">English</option>
                          <option value="Hindi">Hindi (हिंदी)</option>
                          <option value="Hinglish">Hinglish</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-cyber-cyan uppercase tracking-wider block">Tone</label>
                        <select
                          value={tone}
                          onChange={(e) => setTone(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="Dramatic & Suspenseful">Dramatic</option>
                          <option value="Action-Packed & Hype">Action</option>
                          <option value="Lore & Explainer">Explainer</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={isLoading || (sourceTab === 'upload' ? !file : (!animeName || !episodeNumber))}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 disabled:opacity-50 text-xs font-black text-white uppercase tracking-wider py-3.5 rounded-xl shadow-lg transition-all"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
              <span>
                {isLoading 
                  ? (sourceTab === 'upload' ? 'Extracting script...' : 'Retrieving online subtitles...')
                  : (sourceTab === 'upload' ? 'Extract Script' : 'Fetch & Extract Script')
                }
              </span>
            </button>
          </form>
        </div>

        {/* Sidebar logs */}
        <ScriptHistory 
          scripts={scripts.filter(s => s.videoType === 'extracted')} 
          activeScriptId={generatedScript?._id}
          onSelect={onSelectScript}
          onDelete={onDeleteScript}
        />
      </div>

      {/* Right panel - storyboard */}
      <div className="lg:col-span-7 space-y-6">
        {error && (
          <div className="bg-red-950/60 border border-red-500/30 rounded-xl p-3.5 text-red-200 text-xs flex items-start gap-2">
            <Trash2 className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-950/60 border border-green-500/40 rounded-xl p-3 text-green-200 text-xs flex items-center gap-2">
            <CheckCircle className="w-4.5 h-4.5 text-green-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {generatedScript ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="glass-panel rounded-2xl p-5 border-purple-500/20 shadow-inner">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1.5">
                {generatedScript.animeTitle}
              </h3>
              <div className="flex gap-4 text-[10px] text-cyber-muted font-mono uppercase">
                <span>Language: {generatedScript.language}</span>
                <span>Tone: {generatedScript.tone}</span>
                <span>Type: Extracted</span>
              </div>
            </div>

            {/* Translation Actions */}
            <div className="bg-[#100b26]/60 border border-purple-500/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-cyber-cyan" />
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">Translate Script Narration</span>
                  <span className="text-[10px] text-cyber-muted">Translate scenes while preserving timestamps & visual cues</span>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <select
                  value={translationLang}
                  onChange={(e) => setTranslationLang(e.target.value)}
                  disabled={isTranslating}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Hinglish">Hinglish (Hindi in Latin script)</option>
                  <option value="English">English</option>
                </select>
                <button
                  onClick={handleTranslateScript}
                  disabled={isTranslating}
                  className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 px-4 py-2 rounded-xl text-xs font-black text-white uppercase transition-all disabled:opacity-50"
                >
                  {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
                  <span>{isTranslating ? 'Translating...' : 'Translate'}</span>
                </button>
              </div>
            </div>

            {/* YouTube Optimization Metadata Section */}
            {generatedScript.metadata && (
              <div className="glass-panel rounded-2xl p-5 border-cyan-500/20 bg-[#0d091e]/80 space-y-4 shadow-lg">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Sparkles className="w-4 h-4 text-cyber-cyan" />
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">
                    🎬 YouTube Optimization Metadata
                  </h4>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-cyber-cyan uppercase tracking-widest">Video Title</span>
                      <button
                        onClick={() => copyToClipboard(generatedScript.metadata.youtubeTitle, 'title')}
                        className="text-[9px] font-bold text-cyber-muted hover:text-cyber-cyan flex items-center gap-1 transition-all"
                      >
                        {copiedTitle ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedTitle ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-[11px] text-white font-medium select-all">
                      {generatedScript.metadata.youtubeTitle}
                    </div>
                  </div>

                  {generatedScript.metadata.youtubeCaption && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-cyber-cyan/80 uppercase tracking-widest">Caption Hook</span>
                        <button
                          onClick={() => copyToClipboard(generatedScript.metadata.youtubeCaption, 'caption')}
                          className="text-[9px] font-bold text-cyber-muted hover:text-cyber-cyan flex items-center gap-1 transition-all"
                        >
                          {copiedCaption ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCaption ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-[10px] text-slate-300 italic select-all">
                        "{generatedScript.metadata.youtubeCaption}"
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-cyber-pink uppercase tracking-widest">SEO Description</span>
                      <button
                        onClick={() => copyToClipboard(generatedScript.metadata.youtubeDescription, 'desc')}
                        className="text-[9px] font-bold text-cyber-muted hover:text-cyber-pink flex items-center gap-1 transition-all"
                      >
                        {copiedDesc ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedDesc ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={generatedScript.metadata.youtubeDescription}
                      className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-[10px] text-slate-300 font-mono resize-none focus:outline-none h-24 select-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-cyber-purple uppercase tracking-widest">Recommended Tags</span>
                      <button
                        onClick={() => copyToClipboard(generatedScript.metadata.youtubeTags, 'tags')}
                        className="text-[9px] font-bold text-cyber-muted hover:text-cyber-purple flex items-center gap-1 transition-all"
                      >
                        {copiedTags ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedTags ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-[10px] text-slate-300 select-all leading-normal break-all font-mono">
                      {generatedScript.metadata.youtubeTags}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vocal synthesizer controls */}
            <div className="glass-panel rounded-2xl p-5 border-purple-500/20 bg-[#0c0817]/70 space-y-4 shadow-md">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-900">
                <Volume2 className="w-4.5 h-4.5 text-cyber-cyan" />
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Vocal Synth Engine</h4>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1.5 w-full sm:w-auto">
                  <label className="text-[9px] font-bold text-cyber-muted uppercase tracking-wider block">Choose Voice actor</label>
                  <select
                    value={synthesisVoice}
                    onChange={(e) => setSynthesisVoice(e.target.value)}
                    disabled={isSynthesizing}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Puck">Puck (Energetic Male)</option>
                    <option value="Charon">Charon (Deep Male)</option>
                    <option value="Kore">Kore (Warm Female)</option>
                    <option value="Fenrir">Fenrir (Narrator Male)</option>
                    <option value="Aoede">Aoede (Clear Female)</option>
                  </select>
                </div>

                <button
                  onClick={handleSynthesizeAudio}
                  disabled={isSynthesizing}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-cyber-purple hover:opacity-90 px-5 py-3 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {isSynthesizing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                  <span>{isSynthesizing ? 'Synthesizing...' : 'Start Vocal Synthesis'}</span>
                </button>
              </div>
            </div>

            {/* Audio Track players */}
            {(generatedScript.audioBase64 === 'active' || (generatedScript.audioBase64 && generatedScript.audioBase64 !== 'separate')) && (
              <div className="bg-[#0b0816] border border-cyan-500/10 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded-lg text-cyber-cyan">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Vocal Narration Track</h4>
                    <p className="text-[10px] text-cyber-muted font-mono">Unified MP3 track synthesized output</p>
                  </div>
                </div>
                <audio 
                  src={`${BACKEND_URL}/api/scripts/${generatedScript._id}/audio?t=${Date.now()}`} 
                  controls 
                  className="h-9 w-full sm:w-60 focus:outline-none" 
                />
              </div>
            )}

            {/* Scrollable scene list with dialogue highlights */}
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {generatedScript.scenes.map((scene, index) => (
                <div 
                  key={index}
                  className="bg-[#0c0817]/70 border border-slate-900 rounded-xl p-4 space-y-3"
                >
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="text-xs font-bold text-cyber-purple uppercase tracking-wider">
                      Segment #{scene.sceneNumber}
                    </span>
                    <div className="flex gap-3 text-[10px] text-cyber-muted font-mono">
                      <span>Timestamp: {scene.episodeTimestampStart}s</span>
                      <span>Duration: {scene.duration}s</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[9px] font-black text-cyber-cyan uppercase tracking-widest block mb-0.5">
                        Narration text
                      </span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {scene.narratorText}
                      </p>
                    </div>

                    {/* Dialogue attribution section */}
                    {scene.dialogues && scene.dialogues.length > 0 && (
                      <div className="bg-[#05030d] border border-cyan-500/5 rounded-lg p-2.5 space-y-1.5">
                        <span className="text-[8px] font-black text-cyber-pink uppercase tracking-widest block">
                          📢 Dialogue quotes
                        </span>
                        <div className="space-y-1">
                          {scene.dialogues.map((d, dIdx) => (
                            <div key={dIdx} className="text-[10px] leading-relaxed">
                              <span className="text-cyber-cyan font-bold">{d.character}:</span>{' '}
                              <span className="text-slate-300 italic">"{d.text}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-[9px] font-black text-cyber-pink uppercase tracking-widest block mb-0.5">
                        Visual scene prompt
                      </span>
                      <p className="text-[10px] italic text-cyber-muted">
                        {scene.visualPrompt}
                      </p>
                    </div>

                    {/* Separate Audio Player */}
                    {(generatedScript.audioBase64 === 'separate' || scene.audioBase64) && (
                      <div className="mt-3 bg-[#07050f]/90 border border-purple-500/10 rounded-xl p-2.5 flex items-center justify-between gap-3 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-3.5 h-3.5 text-cyber-cyan" />
                          <span className="text-[10px] font-bold text-slate-300">Segment Audio</span>
                        </div>
                        <audio 
                          src={`${BACKEND_URL}/api/scripts/${generatedScript._id}/scenes/${scene.sceneNumber}/audio?t=${Date.now()}`}
                          controls
                          className="h-6 w-48 max-w-full focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center border-purple-500/10 min-h-[450px]">
            <Film className="w-12 h-12 text-cyber-muted/50 mb-3 animate-pulse" />
            <h3 className="text-lg font-semibold text-slate-300">Script Storyboard Output</h3>
            <p className="text-sm text-cyber-muted mt-1 max-w-sm">
              Upload your episode media or subtitle tracks to see character transcriptions and forged narrator blocks appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
