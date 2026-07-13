import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Film, Sparkles, Copy, Check, Cpu, Loader2, Play, 
  Tag, AlertCircle, RefreshCw, FileVideo, Download, Volume2 
} from 'lucide-react';
import confetti from 'canvas-confetti';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://studio-8m77.onrender.com';

export default function LongVideoForge({ scripts, fetchScripts }) {
  // Filter only long scripts
  const longScripts = scripts.filter(s => s.videoType === 'long');

  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgressStep, setRenderProgressStep] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  const renderSteps = [
    'Parsing episode narration...',
    'Locating start offsets inside video file...',
    'Extracting high-definition visual clips...',
    'Resetting Presentation Timestamps (PTS)...',
    'Stitching segments into landscape sequence...',
    'Blending segmented TTS voice narration track...',
    'Overlaying snappy landscape captions...',
    'Exporting final YouTube MP4 container...'
  ];

  useEffect(() => {
    if (!isRendering) {
      setRenderProgressStep(0);
      return;
    }
    const interval = setInterval(() => {
      setRenderProgressStep((prev) => (prev + 1) % renderSteps.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isRendering]);

  useEffect(() => {
    if (longScripts.length > 0 && !selectedScriptId) {
      setSelectedScriptId(longScripts[0]._id);
    }
  }, [longScripts, selectedScriptId]);

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
        setError('Only .mp4 videos are supported.');
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

  const handleRenderLongVideo = () => {
    if (!selectedScriptId) {
      setError('Please select a long script summary project.');
      return;
    }
    if (!selectedFile) {
      setError('Please upload the raw anime episode file (.mp4).');
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

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BACKEND_URL}/api/render-long-video`, true);

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
            
            confetti({
              particleCount: 150,
              spread: 90,
              colors: ['#00f0ff', '#bd00ff', '#ffffff']
            });
          } else {
            setError('Long rendering failed. Check server logs.');
          }
        } catch (e) {
          setError('Failed to parse render response.');
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          setError(errData.error || 'Server error occurred during long video rendering.');
        } catch (e) {
          setError('Server error occurred during rendering.');
        }
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setIsRendering(false);
      setError('Network error during file upload/render.');
    };

    xhr.send(formData);
  };

  const activeScript = longScripts.find(s => s._id === selectedScriptId);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
      {/* Left controls */}
      <div className="xl:col-span-5 space-y-6">
        <div className="glass-panel rounded-2xl p-6 border-purple-500/20 shadow-neon-purple">
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="w-5 h-5 text-cyber-cyan animate-spin" style={{ animationDuration: '3s' }} />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Long Video Console</h2>
          </div>

          <div className="space-y-5">
            {/* Script selector */}
            <div>
              <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">
                Select Active Long Script
              </label>
              <select
                value={selectedScriptId}
                onChange={(e) => setSelectedScriptId(e.target.value)}
                disabled={isUploading || isRendering}
                className="w-full bg-[#0d091a]/80 border border-purple-500/20 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyber-cyan transition-colors"
              >
                {longScripts.length === 0 && (
                  <option value="">No long summaries found (Forge one in Episode Summarizer first!)</option>
                )}
                {longScripts.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.animeTitle} ({s.language})
                  </option>
                ))}
              </select>
            </div>

            {/* Video File dropzone */}
            <div>
              <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">
                Upload Full Episode File (.mp4)
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
                      Drag & Drop raw full episode here
                    </span>
                    <span className="text-[10px] text-cyber-muted mt-1">
                      or click to browse local files (MP4 format)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Rendering progress bars */}
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
                      <span>Uploading full episode file...</span>
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
                        FFmpeg YouTube Pipeline Running
                      </span>
                    </div>
                    <div className="bg-[#0b0816] border border-purple-500/10 rounded-xl p-3 text-xs italic text-cyber-muted font-mono h-12 flex items-center justify-center">
                      {renderSteps[renderProgressStep]}
                    </div>
                  </motion.div>
                )}

                {!isUploading && !isRendering && (
                  <button
                    onClick={handleRenderLongVideo}
                    disabled={!selectedScriptId || !selectedFile}
                    className="relative w-full overflow-hidden rounded-xl py-3.5 px-6 font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan via-cyber-pink to-cyber-purple transition-all duration-500 group-hover:opacity-90" />
                    <div className="relative flex items-center justify-center gap-2">
                      <Film className="w-5 h-5" />
                      <span className="tracking-widest uppercase text-xs">Render Long YouTube Video</span>
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
      </div>

      {/* Right player preview */}
      <div className="xl:col-span-7 space-y-6">
        {renderedVideoUrl ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-2xl p-6 border-cyan-500/20 shadow-neon-cyan flex flex-col items-center"
          >
            <span className="text-xs font-bold text-cyber-cyan uppercase tracking-widest mb-4">
              Long Rendering Output (Landscape 16:9)
            </span>

            {/* Landscape player */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-800 shadow-2xl">
              <video
                src={renderedVideoUrl}
                controls
                className="w-full h-full object-contain"
              />
            </div>

            <a
              href={renderedVideoUrl}
              download
              className="mt-5 flex items-center justify-center gap-2 border border-cyan-500/20 hover:border-cyber-cyan bg-cyan-500/5 hover:bg-cyan-500/10 text-white rounded-xl py-2.5 px-6 text-xs font-bold transition-all duration-300"
            >
              <Download className="w-4 h-4 text-cyber-cyan" />
              Download YouTube Landscape MP4
            </a>
          </motion.div>
        ) : (
          <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center border-purple-500/10 min-h-[400px]">
            <Film className="w-12 h-12 text-cyber-muted/50 mb-3 animate-pulse" />
            <h3 className="text-lg font-semibold text-slate-300">Long Video Preview Screen</h3>
            <p className="text-sm text-cyber-muted mt-1 max-w-sm">
              Select your summaries script, upload the full episode file, and compile the landscape video with overlays and vocal tracks!
            </p>
          </div>
        )}

        {/* Source Footage Guide Banner */}
        {activeScript && !renderedVideoUrl && (
          <div className="bg-[#120a26]/70 border border-cyan-500/20 rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-cyber-cyan shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="text-[10px] font-black text-cyber-cyan uppercase tracking-widest block mb-0.5">
                Recommended Source Footage Guide
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                {activeScript.footageSuggestions || 'General action scenes and character highlights from the anime series.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
