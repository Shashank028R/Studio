import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, FileText, Volume2, Loader2, Play, 
  HelpCircle, Settings, CheckCircle, ListTodo, Film,
  ChevronDown, Copy, Check, Globe, Upload, Trash2, BookOpen, Plus, Save
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ScriptHistory from './ScriptHistory';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://studio-8m77.onrender.com';

export default function MangaForge({ fetchScripts, scripts, activeScript, onSelectScript, onDeleteScript }) {
  const [mangaName, setMangaName] = useState('');
  const [startChapter, setStartChapter] = useState('');
  const [endChapter, setEndChapter] = useState('');
  const [focusDetails, setFocusDetails] = useState('');
  const [files, setFiles] = useState([]);
  
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Dramatic & Suspenseful');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [generatedScript, setGeneratedScript] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Audio synthesis status
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisVoice, setSynthesisVoice] = useState('Puck');
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
    textBlocks.push(`=== MANGA SCRIPT: ${generatedScript.animeTitle} ===`);
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

  // Copy state clips
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [copiedDisclaimer, setCopiedDisclaimer] = useState(false);

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
    } else if (type === 'disclaimer') {
      setCopiedDisclaimer(true);
      setTimeout(() => setCopiedDisclaimer(false), 2000);
    }
  };

  // Synchronize when the user clicks an item in ScriptHistory sidebar
  useEffect(() => {
    if (activeScript && activeScript.videoType === 'manga') {
      setGeneratedScript(activeScript);
    }
  }, [activeScript]);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleForgeSubmit = async (e) => {
    e.preventDefault();
    if (!mangaName || !startChapter || !endChapter) return;

    setIsLoading(true);
    setError('');
    setSuccessMsg('Generating manga chapter storyboard narrative...');

    const formData = new FormData();
    formData.append('mangaName', mangaName);
    formData.append('startChapter', startChapter);
    formData.append('endChapter', endChapter);
    formData.append('focusDetails', focusDetails);
    formData.append('language', language);
    formData.append('tone', tone);
    
    files.forEach(f => {
      formData.append('files', f);
    });

    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-manga-script`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate manga script storyboard.');
      }

      const scriptData = await response.json();
      setGeneratedScript(scriptData);
      onSelectScript(scriptData);
      setSuccessMsg('Manga script successfully forged and summarized!');
      setFiles([]);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ffff', '#d946ef', '#ffffff']
      });

      if (fetchScripts) fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred during manga script generation.');
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
        <div className="glass-panel rounded-2xl p-6 border-purple-500/20 shadow-neon-purple relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-purple/5 rounded-full blur-2xl pointer-events-none" />
          
          <h2 className="text-xl font-black text-white tracking-wide uppercase flex items-center gap-2 mb-1.5">
            <BookOpen className="w-5 h-5 text-cyber-purple animate-pulse" />
            Manga Forge
          </h2>
          <p className="text-xs text-cyber-muted mb-6 leading-relaxed">
            Summarize manga chapter intervals. Describe manga names & chapters to compile your script, or optionally upload panels.
          </p>

          <form onSubmit={handleForgeSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-cyber-purple uppercase tracking-wider block">Manga Name</label>
              <input
                type="text"
                placeholder="e.g. Solo Leveling, Jujutsu Kaisen"
                value={mangaName}
                onChange={(e) => setMangaName(e.target.value)}
                required
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyber-purple rounded-xl px-4.5 py-3 text-xs text-white focus:outline-none transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-cyber-purple uppercase tracking-wider block">Start Chapter</label>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={startChapter}
                  onChange={(e) => setStartChapter(e.target.value)}
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyber-purple rounded-xl px-4.5 py-3 text-xs text-white focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-cyber-purple uppercase tracking-wider block">End Chapter</label>
                <input
                  type="number"
                  placeholder="e.g. 10"
                  value={endChapter}
                  onChange={(e) => setEndChapter(e.target.value)}
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyber-purple rounded-xl px-4.5 py-3 text-xs text-white focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-cyber-purple uppercase tracking-wider block">Focus / Detailed Context (Optional)</label>
              <textarea
                placeholder="e.g. Focus on Jinwoo's shadow army extraction, highlight key transitions..."
                value={focusDetails}
                onChange={(e) => setFocusDetails(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyber-purple rounded-xl px-4.5 py-3 text-xs text-white focus:outline-none transition-all placeholder:text-slate-600 h-20 resize-none leading-relaxed"
              />
            </div>

            {/* Optional Manga Panels Drag & Drop block */}
            <div className="border border-dashed border-slate-800 hover:border-cyber-purple/50 rounded-2xl p-4 bg-slate-950/40 text-center cursor-pointer transition-all relative group">
              <input 
                type="file" 
                multiple
                onChange={handleFileChange}
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-1.5">
                <Upload className="w-6 h-6 text-cyber-muted mx-auto group-hover:text-cyber-purple transition-colors" />
                <div className="text-[11px] font-semibold text-slate-300">
                  {files.length > 0 ? `${files.length} manga panels selected` : 'Upload chapter panels (Optional)'}
                </div>
                <div className="text-[9px] text-cyber-muted">
                  Supports JPEG, PNG, WEBP (Max 10 images)
                </div>
              </div>
            </div>

            {/* Collapsible Settings */}
            <div className="border border-slate-900 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950/60 hover:bg-slate-950/90 text-xs font-bold text-slate-300 uppercase transition-all"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-cyber-purple" />
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
                        <label className="text-[10px] font-black text-cyber-purple uppercase tracking-wider block">Language</label>
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
                        <label className="text-[10px] font-black text-cyber-purple uppercase tracking-wider block">Tone</label>
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
              disabled={isLoading || !mangaName || !startChapter || !endChapter}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:opacity-90 disabled:opacity-50 text-xs font-black text-white uppercase tracking-wider py-3.5 rounded-xl shadow-lg transition-all"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
              <span>{isLoading ? 'Forging manga script...' : 'Forge Manga Script'}</span>
            </button>
          </form>
        </div>

        {/* Sidebar logs */}
        <ScriptHistory 
          scripts={scripts.filter(s => s.videoType === 'manga')} 
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
                  className="bg-[#0c0817]/70 border border-slate-900 rounded-xl p-5 space-y-4 relative text-left"
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
                              className="w-1/4 bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[10px] text-cyber-cyan focus:outline-none" 
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

                    {/* Separate Audio Player */}
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
            <Film className="w-12 h-12 text-cyber-muted/50 mb-3 animate-pulse" />
            <h3 className="text-lg font-semibold text-slate-300">Script Storyboard Output</h3>
            <p className="text-sm text-cyber-muted mt-1 max-w-sm">
              Forge your manga chapters using chapter numbering ranges to see narration lines appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
