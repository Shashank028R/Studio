import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, FileText, Volume2, Loader2, Play, 
  HelpCircle, Settings, CheckCircle, ListTodo, Film,
  ChevronDown, Copy, Check, Globe
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ScriptHistory from './ScriptHistory';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://studio-8m77.onrender.com';
const VOICE_ACTORS = [
  { name: 'Puck', label: 'Puck (Energetic Male)' },
  { name: 'Charon', label: 'Charon (Deep Male)' },
  { name: 'Kore', label: 'Kore (Warm Female)' },
  { name: 'Fenrir', label: 'Fenrir (Narrator Male)' },
  { name: 'Aoede', label: 'Aoede (Clear Female)' }
];

export default function EpisodeSummarizer({ 
  fetchScripts, 
  scripts = [], 
  activeScript, 
  onSelectScript, 
  onDeleteScript 
}) {
  const [animeTitle, setAnimeTitle] = useState('');
  const [seasonNumber, setSeasonNumber] = useState('1');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Dramatic');
  const [selectedVoice, setSelectedVoice] = useState('Puck');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const [generatedScript, setGeneratedScript] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);

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

  const [translationLang, setTranslationLang] = useState('Hindi');
  const [isTranslating, setIsTranslating] = useState(false);

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
      setSuccessMsg(`Script successfully translated to ${translationLang}! Re-synthesize audio below.`);

      confetti({
        particleCount: 50,
        spread: 60,
        colors: ['#00f0ff', '#bd00ff', '#ffffff']
      });

      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred during translation.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Sync with active long script selection from history sidebar
  useEffect(() => {
    if (activeScript && activeScript.videoType === 'long') {
      setGeneratedScript(activeScript);
      setError('');
      setSuccessMsg('');
    }
  }, [activeScript]);

  // Voice actor preview
  const handleVoicePreview = async () => {
    setIsPlayingPreview(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/voice-preview?voice=${selectedVoice}`);
      if (response.ok) {
        const audioBlob = await response.blob();
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.play();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to retrieve voice preview.');
      }
    } catch (e) {
      console.error(e);
      if (e.message.includes('quota') || e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED')) {
        setError('⚠️ Gemini Voice Preview Rate Limit: Quota exceeded. Please wait 30 seconds and retry.');
      } else {
        setError(e.message || 'Failed to play voice preview.');
      }
    } finally {
      setIsPlayingPreview(false);
    }
  };

  // Step 1: Create long script summary
  const handleGenerateLongScript = async () => {
    if (!animeTitle.trim() || !seasonNumber.trim() || !episodeNumber.trim()) {
      setError('Please fill in Anime Title, Season Number, and Episode Number.');
      return;
    }

    setIsLoadingScript(true);
    setError('');
    setGeneratedScript(null);
    setSuccessMsg('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-long-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeTitle,
          seasonNumber,
          episodeNumber,
          language,
          tone
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate long-form episode script.');
      }

      const script = await response.json();
      setGeneratedScript(script);
      setSuccessMsg('Episode script summary generated! Proceed to vocal synthesis below.');
      
      confetti({
        particleCount: 50,
        spread: 60,
        colors: ['#00f0ff', '#bd00ff', '#ffffff']
      });

      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred while contacting Gemini model.');
    } finally {
      setIsLoadingScript(false);
    }
  };

  // Step 2: Generate Segmented Audio Speech Track
  const handleGenerateLongAudio = async () => {
    if (!generatedScript) return;
    setIsGeneratingAudio(true);
    setError('');
    setSuccessMsg('Synthesizing speech segments... This processes scene-by-scene and compiles unified + separate audio tracks.');

    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-long-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: generatedScript._id,
          voice: selectedVoice
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Vocal synthesis failed.');
      }

      // Fetch the updated script from DB to synchronize scene-level audioBase64 fields
      const refreshedResponse = await fetch(`${BACKEND_URL}/api/scripts/${generatedScript._id}`);
      if (refreshedResponse.ok) {
        const refreshed = await refreshedResponse.json();
        setGeneratedScript(refreshed);
      } else {
        // Fallback markup
        setGeneratedScript(prev => ({
          ...prev,
          audioBase64: 'active'
        }));
      }

      setSuccessMsg(`Combined track and separate segment voiceovers synthesized successfully using actor "${selectedVoice}"!`);
      
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });

      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error generating vocal audio.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left panel - controls */}
      <div className="lg:col-span-5 space-y-6">
        <div className="glass-panel rounded-2xl p-6 border-purple-500/20 shadow-neon-purple space-y-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyber-cyan animate-pulse" />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Episode Summarizer</h2>
          </div>
          
          <p className="text-xs text-cyber-muted">
            Provide the details of a specific season and episode to generate a long narration summary script.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5">
                Anime Title
              </label>
              <input
                type="text"
                value={animeTitle}
                onChange={(e) => setAnimeTitle(e.target.value)}
                placeholder="e.g. Jujutsu Kaisen"
                disabled={isLoadingScript || isGeneratingAudio}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyber-cyan"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5">
                  Season Number
                </label>
                <input
                  type="text"
                  value={seasonNumber}
                  onChange={(e) => setSeasonNumber(e.target.value)}
                  placeholder="e.g. 1"
                  disabled={isLoadingScript || isGeneratingAudio}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyber-cyan"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5">
                  Episode Number
                </label>
                <input
                  type="text"
                  value={episodeNumber}
                  onChange={(e) => setEpisodeNumber(e.target.value)}
                  placeholder="e.g. 24"
                  disabled={isLoadingScript || isGeneratingAudio}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyber-cyan"
                />
              </div>
            </div>

            {/* Sound & Language Configurations Dropdown Settings */}
            <div className="border-t border-purple-500/10 pt-4 mt-2">
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                type="button"
                className="flex items-center justify-between w-full text-xs font-bold text-cyber-cyan hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-cyber-cyan" />
                  <span>Sound & Language Settings</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showAdvancedSettings && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-4 overflow-hidden"
                  >
                    <div>
                      <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5">
                        Language
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        disabled={isLoadingScript || isGeneratingAudio}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan"
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5">
                        Narrator Tone
                      </label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        disabled={isLoadingScript || isGeneratingAudio}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan"
                      >
                        <option value="Dramatic">Dramatic & Suspenseful</option>
                        <option value="Action-Packed">Action-Packed</option>
                        <option value="Funny & Hype">Hype & Comedic</option>
                        <option value="Lore & Explainer">Lore & Explainer</option>
                        <option value="Dark & Cyberpunk">Dark & Cyberpunk</option>
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={handleGenerateLongScript}
              disabled={isLoadingScript || isGeneratingAudio}
              className="w-full relative overflow-hidden rounded-xl py-3.5 px-6 font-bold text-white transition-all duration-300 disabled:opacity-50 group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan via-cyber-pink to-cyber-purple transition-all duration-500 group-hover:opacity-90" />
              <div className="relative flex items-center justify-center gap-2 text-xs">
                {isLoadingScript ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Summarizing Episode...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-white" />
                    <span>FORGE LONG SUMMARY SCRIPT</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Audio Vocal Synthesis Panel */}
        {generatedScript && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-2xl p-6 border-cyan-500/20 shadow-neon-cyan space-y-5"
          >
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-cyber-pink animate-pulse" />
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Vocal Synthesizer</h2>
            </div>
            
            <p className="text-xs text-cyber-muted">
              Configure your narrator voice actor and choose to synthesize either the entire narration script at once or separate scene segments.
            </p>

            <div className="space-y-4">
              {/* Voice Selection row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-cyber-muted uppercase tracking-wider mb-1">
                    Voice Actor
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    disabled={isGeneratingAudio}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan w-full"
                  >
                    {VOICE_ACTORS.map(v => (
                      <option key={v.name} value={v.name}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleVoicePreview}
                    disabled={isPlayingPreview || isGeneratingAudio}
                    className="flex items-center justify-center gap-1.5 border border-cyan-500/20 hover:border-cyber-cyan bg-cyan-500/5 hover:bg-cyan-500/10 rounded-xl py-2.5 px-3 text-[10px] font-bold text-slate-300 transition-all disabled:opacity-50 w-full"
                  >
                    {isPlayingPreview ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyber-cyan" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-cyber-cyan" />
                    )}
                    <span>Voice Preview</span>
                  </button>
                </div>
              </div>


              <button
                onClick={handleGenerateLongAudio}
                disabled={isGeneratingAudio}
                className="w-full relative overflow-hidden rounded-xl py-3.5 px-6 font-bold text-white transition-all duration-300 disabled:opacity-50 group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-purple via-cyber-pink to-cyber-cyan transition-all duration-500 group-hover:opacity-90" />
                <div className="relative flex items-center justify-center gap-2 text-xs">
                  {isGeneratingAudio ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Synthesizing Narration Tracks...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 text-white" />
                      <span>START VOCAL SYNTHESIS</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </motion.div>
        )}

        <ScriptHistory 
          scripts={scripts.filter(s => s.videoType === 'long')} 
          activeScriptId={generatedScript?._id}
          onSelect={onSelectScript}
          onDelete={onDeleteScript}
        />
      </div>

      {/* Right panel - display generated script */}
      <div className="lg:col-span-7 space-y-6">
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
                <span>Type: Long Video</span>
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
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyber-cyan"
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
                  {/* YouTube Title */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-cyber-cyan uppercase tracking-widest">
                        Optimized YouTube Video Title
                      </span>
                      <button
                        onClick={() => copyToClipboard(generatedScript.metadata.youtubeTitle, 'title')}
                        className="text-[9px] font-bold text-cyber-muted hover:text-cyber-cyan flex items-center gap-1 transition-all"
                      >
                        {copiedTitle ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedTitle ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-[11px] text-white select-all font-medium leading-relaxed">
                      {generatedScript.metadata.youtubeTitle}
                    </div>
                  </div>

                  {/* YouTube Caption/Hook */}
                  {generatedScript.metadata.youtubeCaption && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-cyber-cyan/80 uppercase tracking-widest">
                          Engaging Video Caption / Short Hook
                        </span>
                        <button
                          onClick={() => copyToClipboard(generatedScript.metadata.youtubeCaption, 'caption')}
                          className="text-[9px] font-bold text-cyber-muted hover:text-cyber-cyan flex items-center gap-1 transition-all"
                        >
                          {copiedCaption ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCaption ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-[10px] text-slate-300 select-all leading-relaxed italic">
                        "{generatedScript.metadata.youtubeCaption}"
                      </div>
                    </div>
                  )}

                  {/* YouTube Description */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-cyber-pink uppercase tracking-widest">
                        SEO Description & Timestamps
                      </span>
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
                      className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-[10px] text-slate-300 font-mono resize-none focus:outline-none h-24 select-all leading-normal"
                    />
                  </div>

                  {/* YouTube Tags */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-cyber-purple uppercase tracking-widest">
                        Recommended SEO Tags
                      </span>
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

            {/* Audio narration player (Unified) */}
            {(generatedScript.audioBase64 === 'active' || (generatedScript.audioBase64 && generatedScript.audioBase64 !== 'separate')) && (
              <div className="bg-[#0b0816] border border-cyan-500/10 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded-lg text-cyber-cyan animate-pulse">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Vocal Narration Track</h4>
                    <p className="text-[10px] text-cyber-muted font-mono">Segmented synthesis unified WAV output</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <audio 
                    src={`${BACKEND_URL}/api/scripts/${generatedScript._id}/audio?t=${Date.now()}`} 
                    controls 
                    className="h-9 w-full sm:w-60 focus:outline-none" 
                  />
                </div>
              </div>
            )}

            {/* Footage Guide */}
            {generatedScript.footageSuggestions && (
              <div className="bg-[#120a26]/70 border border-cyan-500/20 rounded-xl p-4 flex items-start gap-3">
                <Film className="w-5 h-5 text-cyber-cyan shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-black text-cyber-cyan uppercase tracking-widest block mb-0.5">
                    Recommended Episode Footage Guide
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {generatedScript.footageSuggestions}
                  </p>
                </div>
              </div>
            )}

            {/* Scenes Scrollable list */}
            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
              {generatedScript.scenes.map((scene, index) => (
                <div 
                  key={index}
                  className="bg-[#0c0817]/70 border border-slate-900 rounded-xl p-4 space-y-3 animate-fade-in"
                >
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="text-xs font-bold text-cyber-purple uppercase tracking-wider">
                      Segment #{scene.sceneNumber}
                    </span>
                    <div className="flex gap-3 text-[10px] text-cyber-muted font-mono">
                      <span>Clip start: {scene.episodeTimestampStart}s</span>
                      <span>Duration: {scene.duration}s</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[9px] font-black text-cyber-cyan uppercase tracking-widest block mb-0.5">
                        Narration summary text
                      </span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {scene.narratorText}
                      </p>
                    </div>

                    {/* Dialogue attribution section */}
                    {scene.dialogues && scene.dialogues.length > 0 && (
                      <div className="bg-[#05030d] border border-cyan-500/5 rounded-lg p-2.5 space-y-1.5 animate-fade-in">
                        <span className="text-[8px] font-black text-cyber-pink uppercase tracking-widest block">
                          📢 Dialogue quotes ("who said what")
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

                    {/* Scene-level separate voice playback */}
                    {(generatedScript.audioBase64 === 'separate' || scene.audioBase64) && (
                      <div className="mt-3 bg-[#07050f]/90 border border-purple-500/10 rounded-xl p-2.5 flex items-center justify-between gap-3 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-3.5 h-3.5 text-cyber-cyan animate-pulse" />
                          <span className="text-[10px] font-bold text-slate-300">Scene Voiceover</span>
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
            <ListTodo className="w-12 h-12 text-cyber-muted/50 mb-3 animate-pulse" />
            <h3 className="text-lg font-semibold text-slate-300">Long Script Generator</h3>
            <p className="text-sm text-cyber-muted mt-1 max-w-sm">
              Summarize entire episodes. Specify your title and episode details on the left, then click Summarize to forge your YouTube long narrative!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
