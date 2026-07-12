import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Film, Sparkles, Copy, Check, Cpu, Loader2, Play, 
  Tag, AlertCircle, RefreshCw, FileVideo, Download, Volume2 
} from 'lucide-react';
import confetti from 'canvas-confetti';

const BACKEND_URL = 'http://localhost:5000';

export default function VideoForge({ scripts, fetchScripts }) {
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgressStep, setRenderProgressStep] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState(null);
  
  // Metadata states
  const [metadata, setMetadata] = useState(null);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  // Sync steps for rendering
  const renderSteps = [
    'Parsing storyboard captions...',
    'Analyzing uploaded raw clip...',
    'Cropping to vertical 9:16 aspect ratio...',
    'Writing subtitles track...',
    'Burning captions into video pixels...',
    'Merging high-fidelity voice track...',
    'Exporting final MP4 container...'
  ];

  useEffect(() => {
    if (!isRendering) {
      setRenderProgressStep(0);
      return;
    }
    const interval = setInterval(() => {
      setRenderProgressStep((prev) => (prev + 1) % renderSteps.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isRendering]);

  // Set default selected script
  useEffect(() => {
    if (scripts && scripts.length > 0 && !selectedScriptId) {
      setSelectedScriptId(scripts[0]._id);
    }
  }, [scripts, selectedScriptId]);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (isUploading || isRendering) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'video/mp4') {
        setSelectedFile(file);
        setError('');
      } else {
        setError('Only .mp4 videos are supported for cropping.');
      }
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setError('');
    }
  };

  const triggerFileSelect = () => {
    if (isUploading || isRendering) return;
    fileInputRef.current?.click();
  };

  const handleGenerateMetadata = async () => {
    if (!selectedScriptId) {
      setError('Please select a script project first.');
      return;
    }
    setIsGeneratingMetadata(true);
    setError('');
    setMetadata(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: selectedScriptId })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate SEO metadata.');
      }

      const data = await response.json();
      setMetadata(data);
      
      // Fun mini confetti
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#00f0ff', '#bd00ff']
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error generating metadata.');
    } finally {
      setIsGeneratingMetadata(false);
    }
  };

  const handleRenderVideo = () => {
    if (!selectedScriptId) {
      setError('Please select a script project first.');
      return;
    }
    if (!selectedFile) {
      setError('Please upload a raw .mp4 video file first.');
      return;
    }

    setIsUploading(true);
    setIsRendering(false);
    setUploadProgress(0);
    setRenderedVideoUrl(null);
    setError('');

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('scriptId', selectedScriptId);

    // Using XMLHttpRequest to track upload progress nicely
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BACKEND_URL}/api/render-video`, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percentComplete);
        if (percentComplete === 100) {
          setIsUploading(false);
          setIsRendering(true);
        }
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      setIsRendering(false);
      
      if (xhr.status === 200) {
        try {
          const resData = JSON.parse(xhr.responseText);
          if (resData.success && resData.videoUrl) {
            setRenderedVideoUrl(resData.videoUrl);
            
            // Full render success celebration
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.5 },
              colors: ['#00f0ff', '#bd00ff', '#ff007a', '#ffffff']
            });
          } else {
            setError('Rendering failed. Check server logs.');
          }
        } catch (e) {
          setError('Failed to parse render response.');
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          setError(errData.error || 'Server error occurred during rendering.');
        } catch (e) {
          setError('Server error occurred during rendering.');
        }
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setIsRendering(false);
      setError('Network error occurred during upload/render.');
    };

    xhr.send(formData);
  };

  const handleCopyText = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const activeScript = scripts.find(s => s._id === selectedScriptId);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
      {/* Left panel - controls & uploads */}
      <div className="xl:col-span-5 space-y-6">
        {/* Render Control Card */}
        <div className="glass-panel rounded-2xl p-6 border-purple-500/20 shadow-neon-purple">
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="w-5 h-5 text-cyber-cyan animate-spin" style={{ animationDuration: '3s' }} />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Video Forge Console</h2>
          </div>

          <div className="space-y-5">
            {/* Project dropdown selection */}
            <div>
              <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">
                Select Active Script Project
              </label>
              <select
                value={selectedScriptId}
                onChange={(e) => {
                  setSelectedScriptId(e.target.value);
                  setMetadata(null);
                }}
                disabled={isUploading || isRendering}
                className="w-full bg-[#0d091a]/80 border border-purple-500/20 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyber-cyan transition-colors"
              >
                {scripts.length === 0 && (
                  <option value="">No script projects found</option>
                )}
                {scripts.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.animeTitle} ({s.language} • {s.tone})
                  </option>
                ))}
              </select>
            </div>

            {/* Source Footage Guide Banner */}
            {activeScript && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#120a26]/70 border border-purple-500/20 rounded-xl p-3.5 flex items-start gap-2.5 shadow-inner"
              >
                <div className="bg-purple-950/80 border border-purple-500/30 rounded-lg p-1.5 text-cyber-cyan shrink-0 mt-0.5 animate-pulse">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-cyber-cyan uppercase tracking-widest block mb-0.5">
                    Recommended Source Footage
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {activeScript.footageSuggestions || 'Search for highlights and key character action scenes from this anime series.'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Drag & Drop uploader */}
            <div>
              <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">
                Raw Anime Clip Upload (.mp4)
              </label>
              
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                  selectedFile 
                    ? 'border-cyber-cyan/50 bg-cyber-cyan/5' 
                    : 'border-slate-800 hover:border-cyber-purple/50 bg-[#07050f]/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="video/mp4"
                  className="hidden"
                />

                {selectedFile ? (
                  <>
                    <FileVideo className="w-10 h-10 text-cyber-cyan mb-2" />
                    <span className="text-xs font-bold text-white truncate max-w-[220px]">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] text-cyber-muted mt-1 font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • MP4 format
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-cyber-muted mb-2 animate-bounce" />
                    <span className="text-xs font-bold text-slate-300">
                      Drag & Drop raw anime file here
                    </span>
                    <span className="text-[10px] text-cyber-muted mt-1">
                      or click to browse local files (MP4 format only)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Render Button / Progress bars */}
            <div className="pt-2">
              <AnimatePresence mode="wait">
                {isUploading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex justify-between text-xs font-bold text-cyber-cyan">
                      <span>Uploading raw video clip...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-cyber-cyan/20">
                      <div 
                        className="bg-gradient-to-r from-cyber-cyan to-cyber-purple h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </motion.div>
                )}

                {isRendering && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 text-center py-2"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 text-cyber-purple animate-spin" />
                      <span className="text-sm font-bold text-white text-glow-purple">
                        FFmpeg Pipeline Running
                      </span>
                    </div>
                    <div className="bg-[#0b0816] border border-purple-500/10 rounded-xl p-3 text-xs italic text-cyber-muted font-mono h-12 flex items-center justify-center">
                      {renderSteps[renderProgressStep]}
                    </div>
                  </motion.div>
                )}

                {!isUploading && !isRendering && (
                  <button
                    onClick={handleRenderVideo}
                    disabled={!selectedScriptId || !selectedFile}
                    className="relative w-full overflow-hidden rounded-xl py-3.5 px-6 font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan via-cyber-pink to-cyber-purple transition-all duration-500 group-hover:opacity-90" />
                    <div className="relative flex items-center justify-center gap-2">
                      <Film className="w-5 h-5" />
                      <span className="tracking-widest uppercase">Render Final Short</span>
                    </div>
                  </button>
                )}
              </AnimatePresence>

              {error && (
                <div className="mt-4 bg-red-950/60 border border-red-500/40 rounded-xl p-3 text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic YouTube SEO Engine card */}
        <div className="glass-panel rounded-2xl p-6 border-purple-500/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyber-pink animate-pulse" />
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">SEO Metadata Engine</h2>
            </div>
            
            <button
              onClick={handleGenerateMetadata}
              disabled={isGeneratingMetadata || !selectedScriptId || isUploading || isRendering}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg p-2 transition-colors disabled:opacity-50"
              title="Generate Metadata"
            >
              <RefreshCw className={`w-4 h-4 text-cyber-cyan ${isGeneratingMetadata ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <p className="text-xs text-cyber-muted mb-4">
            Generate high-engagement descriptions, SEO tag lists, and legal disclaimers tailored to the anime short.
          </p>

          {!metadata ? (
            <button
              onClick={handleGenerateMetadata}
              disabled={isGeneratingMetadata || !selectedScriptId || isUploading || isRendering}
              className="w-full bg-[#120a26]/40 hover:bg-[#1b1236]/60 border border-purple-500/20 text-slate-300 text-xs font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isGeneratingMetadata ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-cyber-cyan" />
                  <span>Consulting SEO Expert...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyber-pink" />
                  <span>Generate Metadata</span>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-4">
              <span className="text-[10px] font-black text-cyber-pink uppercase tracking-widest block">
                Metadata Generated Successfully
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right panel - player & metadata display */}
      <div className="xl:col-span-7 space-y-6 flex flex-col">
        {/* Render Result Player */}
        {renderedVideoUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-2xl p-6 border-cyan-500/20 shadow-neon-cyan flex flex-col items-center"
          >
            <span className="text-xs font-bold text-cyber-cyan uppercase tracking-widest mb-4">
              Render Result (Vertical 9:16)
            </span>
            
            {/* Vertical Video wrapper */}
            <div className="relative w-[280px] h-[497px] rounded-xl overflow-hidden bg-black border border-slate-800 shadow-2xl">
              <video
                src={renderedVideoUrl}
                controls
                className="w-full h-full object-cover"
              />
            </div>

            <a
              href={renderedVideoUrl}
              download
              className="mt-4 flex items-center justify-center gap-2 border border-cyan-500/20 hover:border-cyber-cyan bg-cyan-500/5 hover:bg-cyan-500/10 text-white rounded-xl py-2.5 px-6 text-xs font-bold transition-all duration-300"
            >
              <Download className="w-4 h-4 text-cyber-cyan" />
              Download Rendered MP4
            </a>
          </motion.div>
        )}

        {/* Metadata Details cards */}
        {metadata && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Catchy Description card */}
            <div className="glass-panel rounded-2xl p-5 border-purple-500/10 relative group">
              <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2.5">
                <span className="text-xs font-bold text-cyber-purple tracking-widest uppercase">
                  Catchy Shorts Description
                </span>
                
                <button
                  onClick={() => handleCopyText(metadata.description, 'desc')}
                  className="text-xs text-cyber-muted hover:text-cyber-cyan flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-slate-950 border border-slate-900"
                >
                  {copiedField === 'desc' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Description</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-300 font-sans whitespace-pre-line leading-relaxed leading-extra-loose bg-[#07050f]/30 border border-slate-900/40 p-4 rounded-xl">
                {metadata.description}
              </p>
            </div>

            {/* SEO Tag List card */}
            <div className="glass-panel rounded-2xl p-5 border-purple-500/10">
              <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2.5">
                <span className="text-xs font-bold text-cyber-cyan tracking-widest uppercase flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> SEO Tags
                </span>

                <button
                  onClick={() => handleCopyText(metadata.tags, 'tags')}
                  className="text-xs text-cyber-muted hover:text-cyber-cyan flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-slate-950 border border-slate-900"
                >
                  {copiedField === 'tags' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy tags</span>
                    </>
                  )}
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-1">
                {metadata.tags.split(',').map((tag, idx) => (
                  <span
                    key={idx}
                    className="bg-cyan-950/30 text-cyber-cyan border border-cyan-500/20 px-2.5 py-1 rounded-lg text-xs font-bold select-all"
                  >
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            </div>

            {/* Fair Use Disclaimer card */}
            <div className="glass-panel rounded-2xl p-5 border-purple-500/10">
              <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2.5">
                <span className="text-xs font-bold text-cyber-pink tracking-widest uppercase">
                  Fair Use Disclaimer
                </span>

                <button
                  onClick={() => handleCopyText(metadata.disclaimer, 'disclaim')}
                  className="text-xs text-cyber-muted hover:text-cyber-cyan flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-slate-950 border border-slate-900"
                >
                  {copiedField === 'disclaim' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Disclaimer</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-[#0b0816]/70 border border-pink-500/10 rounded-xl p-4 text-[10px] italic text-slate-400 font-mono tracking-wide leading-relaxed max-h-[120px] overflow-y-auto">
                {metadata.disclaimer}
              </div>
            </div>
          </motion.div>
        )}

        {!renderedVideoUrl && !metadata && (
          <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center border-purple-500/10 min-h-[400px] flex-1">
            <Film className="w-12 h-12 text-cyber-muted/50 mb-3 animate-pulse" />
            <h3 className="text-lg font-semibold text-slate-300">Video Forge Inactive</h3>
            <p className="text-sm text-cyber-muted mt-1 max-w-sm">
              Select your script project on the left, upload a raw landscape video clip, and click Render to watch the magic happen!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
