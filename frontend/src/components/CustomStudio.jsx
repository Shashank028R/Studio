import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Volume2, Sparkles, PlusCircle, CheckCircle, 
  HelpCircle, Settings, Play, Download, Loader2, ListPlus 
} from 'lucide-react';
import confetti from 'canvas-confetti';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const VOICE_ACTORS = [
  { name: 'Puck', label: 'Puck (Energetic Male)' },
  { name: 'Charon', label: 'Charon (Deep Male)' },
  { name: 'Kore', label: 'Kore (Warm Female)' },
  { name: 'Fenrir', label: 'Fenrir (Narrator Male)' },
  { name: 'Aoede', label: 'Aoede (Clear Female)' }
];

export default function CustomStudio({ fetchScripts }) {
  const [activeSubTab, setActiveSubTab] = useState('quick-tts'); // 'quick-tts' or 'custom-script'
  
  // Quick TTS states
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState('Puck');
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [ttsMsg, setTtsMsg] = useState('');

  // Custom Script states
  const [animeTitle, setAnimeTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Epic');
  const [footageSuggestions, setFootageSuggestions] = useState('');
  const [scenes, setScenes] = useState([
    { sceneNumber: 1, narratorText: '', visualPrompt: '', duration: 6, episodeTimestampStart: 120 }
  ]);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [scriptSuccessMsg, setScriptSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Voice Preview synthesis
  const handleVoicePreview = async () => {
    setIsPlayingPreview(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/voice-preview?voice=${ttsVoice}`);
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

  // Quick TTS synthesis
  const handleGenerateQuickTts = async () => {
    if (!ttsText.trim()) {
      setError('Please enter some text to synthesize.');
      return;
    }
    setIsGeneratingTts(true);
    setError('');
    setTtsAudioUrl(null);
    setTtsMsg('Synthesizing speech buffer...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/quick-tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText, voice: ttsVoice })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to synthesize speech.');
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setTtsAudioUrl(url);
      setTtsMsg('Speech synthesized successfully!');
      
      confetti({
        particleCount: 30,
        spread: 40,
        colors: ['#00f0ff', '#bd00ff']
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error generating custom speech.');
    } finally {
      setIsGeneratingTts(false);
    }
  };

  // Scene handlers
  const handleAddScene = () => {
    setScenes([
      ...scenes,
      { 
        sceneNumber: scenes.length + 1, 
        narratorText: '', 
        visualPrompt: '', 
        duration: 6, 
        episodeTimestampStart: 120 + (scenes.length * 60) 
      }
    ]);
  };

  const handleRemoveScene = (idx) => {
    if (scenes.length === 1) return;
    const nextScenes = scenes.filter((_, i) => i !== idx).map((s, i) => ({
      ...s,
      sceneNumber: i + 1
    }));
    setScenes(nextScenes);
  };

  const handleSceneChange = (idx, field, val) => {
    const nextScenes = [...scenes];
    nextScenes[idx][field] = val;
    setScenes(nextScenes);
  };

  // Save Custom Script & Trigger vocal synthesis
  const handleSaveCustomScript = async () => {
    if (!animeTitle.trim()) {
      setError('Please provide an Anime Title.');
      return;
    }
    const emptyNarrator = scenes.some(s => !s.narratorText.trim());
    if (emptyNarrator) {
      setError('Please write narrator script text for all scenes.');
      return;
    }

    setIsSavingScript(true);
    setError('');
    setScriptSuccessMsg('');

    try {
      // 1. Save script details
      const response = await fetch(`${BACKEND_URL}/api/custom-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeTitle,
          language,
          tone,
          footageSuggestions,
          scenes
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save script.');
      }

      const script = await response.json();

      // 2. Automatically trigger TTS vocal synthesis for this new script
      const ttsResponse = await fetch(`${BACKEND_URL}/api/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: script._id, voice: ttsVoice })
      });

      if (!ttsResponse.ok) {
        throw new Error('Script saved, but failed to synthesize custom vocal track.');
      }

      setScriptSuccessMsg(`Successfully saved script and generated voiceover (Voice: ${ttsVoice})!`);
      
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      // Clear fields
      setAnimeTitle('');
      setFootageSuggestions('');
      setScenes([{ sceneNumber: 1, narratorText: '', visualPrompt: '', duration: 6, episodeTimestampStart: 120 }]);
      
      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred while saving script.');
    } finally {
      setIsSavingScript(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Sidebar - Mode Switching */}
      <div className="lg:col-span-3 space-y-4">
        <div className="glass-panel rounded-2xl p-4 border-purple-500/10">
          <span className="text-[10px] font-black text-cyber-muted uppercase tracking-widest block mb-4">
            Studio Modes
          </span>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setActiveSubTab('quick-tts');
                setError('');
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
                activeSubTab === 'quick-tts'
                  ? 'bg-gradient-to-r from-cyber-purple to-cyber-pink text-white shadow-neon-purple'
                  : 'bg-slate-950/40 hover:bg-[#120a26]/40 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Volume2 className="w-4 h-4 text-cyber-cyan" />
              Quick Text-to-Speech
            </button>

            <button
              onClick={() => {
                setActiveSubTab('custom-script');
                setError('');
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
                activeSubTab === 'custom-script'
                  ? 'bg-gradient-to-r from-cyber-cyan to-cyber-purple text-white shadow-neon-cyan'
                  : 'bg-slate-950/40 hover:bg-[#120a26]/40 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListPlus className="w-4 h-4 text-cyber-pink" />
              Custom Script Builder
            </button>
          </div>
        </div>

        {/* Global Voice Actor Panel */}
        <div className="glass-panel rounded-2xl p-4 border-purple-500/10">
          <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-widest mb-3">
            Narration Voice Actor
          </label>
          <div className="space-y-3">
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyber-cyan"
            >
              {VOICE_ACTORS.map(v => (
                <option key={v.name} value={v.name}>{v.label}</option>
              ))}
            </select>
            
            <button
              onClick={handleVoicePreview}
              disabled={isPlayingPreview}
              className="w-full flex items-center justify-center gap-2 border border-purple-500/20 hover:border-cyber-purple bg-purple-500/5 hover:bg-purple-500/10 rounded-xl py-2 px-3 text-[10px] font-bold text-slate-300 transition-all disabled:opacity-50"
            >
              {isPlayingPreview ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-cyber-purple" />
                  <span>Synthesizing Sample...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-cyber-pink" />
                  <span>Preview Selected Voice</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="lg:col-span-9 space-y-6">
        {error && (
          <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-3 text-red-200 text-xs flex items-center gap-2 animate-shake">
            <Settings className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeSubTab === 'quick-tts' ? (
            /* Quick TTS layout */
            <motion.div
              key="quick-tts-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-panel rounded-2xl p-6 border-purple-500/20 shadow-neon-purple space-y-5"
            >
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-cyber-cyan animate-pulse" />
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Quick Text-to-Speech</h2>
              </div>
              <p className="text-xs text-cyber-muted">
                Paste any text snippet, script paragraph, or quote to synthesize high-quality voice audio immediately.
              </p>

              <div>
                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Paste your script text here..."
                  className="w-full h-44 bg-[#0d091a]/80 border border-purple-500/20 rounded-xl p-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyber-cyan transition-colors resize-none leading-relaxed"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <span className="text-[10px] text-cyber-muted font-mono">
                  Characters: {ttsText.length} • Words: {ttsText.split(/\s+/).filter(w => w).length}
                </span>

                <button
                  onClick={handleGenerateQuickTts}
                  disabled={isGeneratingTts}
                  className="w-full sm:w-auto relative overflow-hidden rounded-xl py-3 px-6 font-bold text-white transition-all duration-300 disabled:opacity-50 group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan via-cyber-pink to-cyber-purple transition-all duration-500 group-hover:opacity-90" />
                  <div className="relative flex items-center justify-center gap-2">
                    {isGeneratingTts ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span className="tracking-wider uppercase text-xs">Synthesizing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-white" />
                        <span className="tracking-wider uppercase text-xs">Generate Audio</span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* Quick TTS Audio Player View */}
              {ttsAudioUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#0b0816] border border-purple-500/20 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded-lg text-cyber-cyan animate-pulse">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Quick Synthesis Output</h4>
                      <p className="text-[10px] text-cyber-muted font-mono">Format: WAV stream • Sample Rate: 24kHz</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <audio src={ttsAudioUrl} controls className="h-9 w-full sm:w-60 focus:outline-none" />
                    <a
                      href={ttsAudioUrl}
                      download={`quick_speech_${Date.now()}.wav`}
                      className="bg-slate-900 border border-slate-800 hover:border-cyber-cyan p-2.5 rounded-lg text-slate-300 hover:text-cyber-cyan transition-colors"
                      title="Download WAV file"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* Custom Script Builder layout */
            <motion.div
              key="custom-script-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {scriptSuccessMsg && (
                <div className="bg-green-950/60 border border-green-500/40 rounded-xl p-3 text-green-200 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span>{scriptSuccessMsg}</span>
                </div>
              )}

              {/* Meta Inputs Card */}
              <div className="glass-panel rounded-2xl p-6 border-cyan-500/20 shadow-neon-cyan space-y-4">
                <div className="flex items-center gap-2">
                  <ListPlus className="w-5 h-5 text-cyber-pink animate-pulse" />
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">Custom Script Builder</h2>
                </div>
                <p className="text-xs text-cyber-muted">
                  Create your own storyboard script manually. Fill in the dialogue, storyboard prompts, and clip timings.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5">
                      Anime Title
                    </label>
                    <input
                      type="text"
                      value={animeTitle}
                      onChange={(e) => setAnimeTitle(e.target.value)}
                      placeholder="e.g. Demon Slayer"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyber-cyan"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan"
                    >
                      <option value="English">English</option>
                      <option value="Hindi">Hindi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5">
                      Tone
                    </label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan"
                    >
                      <option value="Dramatic">Dramatic & Suspenseful</option>
                      <option value="Action-Packed">Action-Packed</option>
                      <option value="Funny & Hype">Hype & Comedic</option>
                      <option value="Lore & Explainer">Lore & Explainer</option>
                      <option value="Dark & Cyberpunk">Dark & Cyberpunk</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    Recommended Source Footage (Guides the user on which clips to seek out)
                  </label>
                  <input
                    type="text"
                    value={footageSuggestions}
                    onChange={(e) => setFootageSuggestions(e.target.value)}
                    placeholder="e.g. We recommend downloading clips from Season 1, Episode 19 (Hinokami scene)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
              </div>

              {/* Dynamic Scenes List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Storyboard Scenes</span>
                  
                  <button
                    onClick={handleAddScene}
                    className="flex items-center gap-1.5 text-xs font-bold text-cyber-cyan hover:text-white transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Scene</span>
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {scenes.map((scene, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      className="glass-panel rounded-xl p-5 border-purple-500/10 hover:border-purple-500/20 transition-all relative group"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-cyber-purple uppercase tracking-wider">
                          Scene #{scene.sceneNumber}
                        </span>

                        {scenes.length > 1 && (
                          <button
                            onClick={() => handleRemoveScene(index)}
                            className="text-cyber-muted hover:text-red-400 transition-colors"
                            title="Remove Scene"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Narrator Text script */}
                        <div className="md:col-span-7">
                          <label className="block text-[9px] font-black text-cyber-muted uppercase tracking-wider mb-1">
                            Narrator Script Text (Vocal Speech)
                          </label>
                          <textarea
                            value={scene.narratorText}
                            onChange={(e) => handleSceneChange(index, 'narratorText', e.target.value)}
                            placeholder="Write narration lines that the voice actor will speak..."
                            className="w-full h-20 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyber-cyan resize-none"
                          />
                        </div>

                        {/* Visual directions & timings */}
                        <div className="md:col-span-5 space-y-2.5">
                          <div>
                            <label className="block text-[9px] font-black text-cyber-muted uppercase tracking-wider mb-1">
                              Visual Prompt (Clip directions)
                            </label>
                            <input
                              type="text"
                              value={scene.visualPrompt}
                              onChange={(e) => handleSceneChange(index, 'visualPrompt', e.target.value)}
                              placeholder="e.g. Tanjiro drawing fire sword"
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-cyan"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-black text-cyber-muted uppercase tracking-wider mb-1">
                                Duration (sec)
                              </label>
                              <input
                                type="number"
                                value={scene.duration}
                                onChange={(e) => handleSceneChange(index, 'duration', parseInt(e.target.value) || 6)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black text-cyber-muted uppercase tracking-wider mb-1">
                                Ep 1 Offset (sec)
                              </label>
                              <input
                                type="number"
                                value={scene.episodeTimestampStart}
                                onChange={(e) => handleSceneChange(index, 'episodeTimestampStart', parseInt(e.target.value) || 60)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                                title="Timestamp in Episode 1 to clip from"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Submit Script */}
              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSaveCustomScript}
                  disabled={isSavingScript}
                  className="w-full sm:w-auto relative overflow-hidden rounded-xl py-3.5 px-10 font-bold text-white transition-all duration-300 disabled:opacity-50 group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-pink transition-all duration-500 group-hover:opacity-90" />
                  <div className="relative flex items-center justify-center gap-2">
                    {isSavingScript ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span className="tracking-wider uppercase text-xs">Forging Script & Vocals...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-white" />
                        <span className="tracking-wider uppercase text-xs">Save Custom Script & Voiceover</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
