import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, FileText, Volume2, Loader2, Play, 
  HelpCircle, Settings, CheckCircle, ListTodo, Film,
  ChevronDown, Copy, Check, Globe, Plus, Trash2, Save
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
  const [narrativeMode, setNarrativeMode] = useState('standard'); // 'standard' or 'deep'
  const [isSaving, setIsSaving] = useState(false);

  const handleSceneFieldChange = (index, field, value) => {
    if (!generatedScript) return;
    const updatedScenes = [...generatedScript.scenes];
    updatedScenes[index] = { ...updatedScenes[index], [field]: value };
    setGeneratedScript({ ...generatedScript, scenes: updatedScenes });
  };

  const handleDialogueChange = (sceneIndex, dialogueIndex, field, value) => {
    if (!generatedScript) return;
    const updatedScenes = [...generatedScript.scenes];
    const updatedDialogues = [...updatedScenes[sceneIndex].dialogues];
    updatedDialogues[dialogueIndex] = { ...updatedDialogues[dialogueIndex], [field]: value };
    updatedScenes[sceneIndex] = { ...updatedScenes[sceneIndex], dialogues: updatedDialogues };
    setGeneratedScript({ ...generatedScript, scenes: updatedScenes });
  };

  const handleAddDialogue = (sceneIndex) => {
    if (!generatedScript) return;
    const updatedScenes = [...generatedScript.scenes];
    const updatedDialogues = [...(updatedScenes[sceneIndex].dialogues || [])];
    updatedDialogues.push({ character: 'Character', text: 'New Quote line' });
    updatedScenes[sceneIndex] = { ...updatedScenes[sceneIndex], dialogues: updatedDialogues };
    setGeneratedScript({ ...generatedScript, scenes: updatedScenes });
  };

  const handleRemoveDialogue = (sceneIndex, dialogueIndex) => {
    if (!generatedScript) return;
    const updatedScenes = [...generatedScript.scenes];
    const updatedDialogues = [...updatedScenes[sceneIndex].dialogues];
    updatedDialogues.splice(dialogueIndex, 1);
    updatedScenes[sceneIndex] = { ...updatedScenes[sceneIndex], dialogues: updatedDialogues };
    setGeneratedScript({ ...generatedScript, scenes: updatedScenes });
  };

  const handleAddScene = () => {
    if (!generatedScript) return;
    const updatedScenes = [...generatedScript.scenes];
    const newSceneNumber = updatedScenes.length > 0 ? Math.max(...updatedScenes.map(s => s.sceneNumber)) + 1 : 1;
    const lastTimestamp = updatedScenes.length > 0 ? updatedScenes[updatedScenes.length - 1].episodeTimestampStart + 15 : 60;
    
    updatedScenes.push({
      sceneNumber: newSceneNumber,
      narratorText: 'Enter segment narration summary details...',
      visualPrompt: 'Visual scene illustration description...',
      duration: 15,
      episodeTimestampStart: lastTimestamp,
      dialogues: []
    });
    setGeneratedScript({ ...generatedScript, scenes: updatedScenes });
  };

  const handleRemoveScene = (index) => {
    if (!generatedScript) return;
    const updatedScenes = [...generatedScript.scenes];
    updatedScenes.splice(index, 1);
    const reindexed = updatedScenes.map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));
    setGeneratedScript({ ...generatedScript, scenes: reindexed });
  };

  const handleSaveScript = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMsg('Saving manually edited scenes and metadata...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/scripts/${generatedScript._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatedScript)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save script changes.');
      }

      const updated = await response.json();
      setGeneratedScript(updated);
      onSelectScript(updated);
      setSuccessMsg('All script changes successfully saved to database! Re-synthesize audio below to update the voice tracks.');

      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred while saving script.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyWholeScript = () => {
    if (!generatedScript) return;
    const textBlocks = [];
    textBlocks.push(`=== EPISODE SUMMARY: ${generatedScript.animeTitle} ===`);
    textBlocks.push(`Language: ${generatedScript.language} | Tone: ${generatedScript.tone}`);
    if (generatedScript.metadata) {
      textBlocks.push(`\n[YOUTUBE METADATA]`);
      textBlocks.push(`Title: ${generatedScript.metadata.youtubeTitle}`);
      textBlocks.push(`Caption: ${generatedScript.metadata.youtubeCaption}`);
      textBlocks.push(`Description:\n${generatedScript.metadata.youtubeDescription}`);
      textBlocks.push(`Disclaimer: ${generatedScript.metadata.youtubeDisclaimer || 'Fair Use copyright disclaimer'}`);
      textBlocks.push(`Tags: ${generatedScript.metadata.youtubeTags}`);
    }
    textBlocks.push(`\n[SCENE TIMELINE STORYBOARD]`);
    generatedScript.scenes.forEach(s => {
      textBlocks.push(`\n--- Scene #${s.sceneNumber} (Clip Start: ${s.episodeTimestampStart}s | Duration: ${s.duration}s) ---`);
      textBlocks.push(`Visuals: ${s.visualPrompt}`);
      textBlocks.push(`Narration: ${s.narratorText}`);
      if (s.dialogues && s.dialogues.length > 0) {
        textBlocks.push(`Dialogues:`);
        s.dialogues.forEach(d => {
          textBlocks.push(`  * ${d.character}: "${d.text}"`);
        });
      }
    });
    navigator.clipboard.writeText(textBlocks.join('\n'));
    setSuccessMsg('Entire script compiled and copied to clipboard successfully!');
  };

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
  const [copiedDisclaimer, setCopiedDisclaimer] = useState(false);

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
    } else if (type === 'disclaimer') {
      setCopiedDisclaimer(true);
      setTimeout(() => setCopiedDisclaimer(false), 2000);
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
          tone,
          narrativeMode
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

            <div>
              <label className="block text-[10px] font-black text-cyber-muted uppercase tracking-wider mb-1.5">
                Summary Mode / Explainer Option
              </label>
              <select
                value={narrativeMode}
                onChange={(e) => setNarrativeMode(e.target.value)}
                disabled={isLoadingScript || isGeneratingAudio}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyber-cyan"
              >
                <option value="standard">Standard Third-Person Summary (plot summary & dialogues)</option>
                <option value="deep">Deep Frame-by-Frame Explainer (comprehensive, 8-10 mins+ long)</option>
              </select>
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
            <div className="glass-panel rounded-2xl p-5 border-purple-500/20 shadow-inner flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1.5">
                  {generatedScript.animeTitle}
                </h3>
                <div className="flex gap-4 text-[10px] text-cyber-muted font-mono uppercase">
                  <span>Language: {generatedScript.language}</span>
                  <span>Tone: {generatedScript.tone}</span>
                  <span>Segments: {generatedScript.scenes.length}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopyWholeScript}
                  className="flex items-center justify-center gap-1 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-cyber-cyan text-[10px] font-black text-cyber-cyan uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Script</span>
                </button>

                <button
                  onClick={handleSaveScript}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-1 bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 disabled:opacity-50 text-[10px] font-black text-white uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all shadow-md"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
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

                  {/* Copyright Disclaimer */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">
                        Fair Use Copyright Disclaimer
                      </span>
                      <button
                        onClick={() => copyToClipboard(generatedScript.metadata.youtubeDisclaimer || 'Copyright Disclaimer Under Section 107 of the Copyright Act 1976, allowance is made for "fair use" for purposes such as criticism, comment, news reporting, teaching, scholarship, and research. Fair use is a use permitted by copyright statute that might otherwise be infringing. Non-profit, educational or personal use tips the balance in favor of fair use. No copyright infringement intended.', 'disclaimer')}
                        className="text-[9px] font-bold text-cyber-muted hover:text-amber-500 flex items-center gap-1 transition-all"
                      >
                        {copiedDisclaimer ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedDisclaimer ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={generatedScript.metadata.youtubeDisclaimer || 'Copyright Disclaimer Under Section 107 of the Copyright Act 1976, allowance is made for "fair use" for purposes such as criticism, comment, news reporting, teaching, scholarship, and research. Fair use is a use permitted by copyright statute that might otherwise be infringing. Non-profit, educational or personal use tips the balance in favor of fair use. No copyright infringement intended.'}
                      className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-[10px] text-slate-400 font-mono resize-none focus:outline-none h-20 select-all leading-normal"
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
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {generatedScript.scenes.map((scene, index) => (
                <div 
                  key={index}
                  className="bg-[#0c0817]/70 border border-slate-900 rounded-xl p-5 space-y-4 animate-fade-in relative text-left"
                >
                  {/* Scene Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-cyber-purple uppercase tracking-wider">
                        Segment #{scene.sceneNumber}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[10px] text-cyber-muted font-mono">
                        <span>Start:</span>
                        <input
                          type="number"
                          value={scene.episodeTimestampStart}
                          onChange={(e) => handleSceneFieldChange(index, 'episodeTimestampStart', parseInt(e.target.value) || 0)}
                          className="w-14 bg-slate-950/80 border border-slate-800 rounded px-1.5 py-0.5 text-center text-white focus:outline-none"
                        />
                        <span>s</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-cyber-muted font-mono">
                        <span>Duration:</span>
                        <input
                          type="number"
                          value={scene.duration}
                          onChange={(e) => handleSceneFieldChange(index, 'duration', parseInt(e.target.value) || 0)}
                          className="w-12 bg-slate-950/80 border border-slate-800 rounded px-1.5 py-0.5 text-center text-white focus:outline-none"
                        />
                        <span>s</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveScene(index)}
                        className="text-red-400 hover:text-red-500 transition-colors p-1"
                        title="Remove segment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Scene Fields */}
                  <div className="space-y-3">
                    {/* Narration summary text */}
                    <div>
                      <span className="text-[9px] font-black text-cyber-cyan uppercase tracking-widest block mb-1">
                        Narration summary text
                      </span>
                      <textarea
                        value={scene.narratorText}
                        onChange={(e) => handleSceneFieldChange(index, 'narratorText', e.target.value)}
                        rows={3}
                        className="w-full bg-slate-950/50 border border-slate-900 focus:border-cyber-cyan/50 rounded-xl px-3 py-2 text-[11px] text-slate-200 leading-relaxed focus:outline-none transition-all resize-y"
                      />
                    </div>

                    {/* Dialogue Quotes ("who said what") */}
                    <div className="bg-[#05030d] border border-cyan-500/5 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-cyber-pink uppercase tracking-widest block">
                          📢 Dialogue quotes ("who said what")
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddDialogue(index)}
                          className="flex items-center gap-1 text-[8px] font-black text-cyber-cyan hover:text-cyber-pink uppercase tracking-wider transition-all"
                        >
                          <Plus className="w-2.5 h-2.5" /> Add Quote
                        </button>
                      </div>

                      <div className="space-y-2">
                        {scene.dialogues && scene.dialogues.map((d, dIdx) => (
                          <div key={dIdx} className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              placeholder="Speaker"
                              className="w-1/4 bg-slate-950 border border-slate-900 rounded-lg p-1.5 text-[10px] text-cyber-cyan focus:outline-none" 
                              value={d.character} 
                              onChange={(e) => handleDialogueChange(index, dIdx, 'character', e.target.value)}
                            />
                            <input 
                              type="text" 
                              placeholder="Dialogue quote text"
                              className="w-3/4 bg-slate-950 border border-slate-900 rounded-lg p-1.5 text-[10px] text-slate-300 focus:outline-none" 
                              value={d.text} 
                              onChange={(e) => handleDialogueChange(index, dIdx, 'text', e.target.value)}
                            />
                            <button 
                              type="button" 
                              onClick={() => handleRemoveDialogue(index, dIdx)} 
                              className="text-red-400 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Visual Scene Prompt */}
                    <div>
                      <span className="text-[9px] font-black text-cyber-pink uppercase tracking-widest block mb-1">
                        Visual scene prompt
                      </span>
                      <textarea
                        value={scene.visualPrompt}
                        onChange={(e) => handleSceneFieldChange(index, 'visualPrompt', e.target.value)}
                        rows={2}
                        className="w-full bg-slate-950/50 border border-slate-900 focus:border-cyber-pink/50 rounded-xl px-3 py-2 text-[10px] italic text-cyber-muted focus:outline-none transition-all resize-y"
                      />
                    </div>

                    {/* Scene-level separate voice playback */}
                    {(generatedScript.audioBase64 === 'separate' || scene.audioBase64) && (
                      <div className="mt-3 bg-[#07050f]/90 border border-purple-500/10 rounded-xl p-2.5 flex items-center justify-between gap-3">
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

              <button 
                type="button" 
                onClick={handleAddScene} 
                className="w-full py-3.5 border border-dashed border-purple-500/30 rounded-xl hover:border-purple-500/60 text-xs font-black text-cyber-purple hover:text-cyber-pink uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add New Segment
              </button>
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
