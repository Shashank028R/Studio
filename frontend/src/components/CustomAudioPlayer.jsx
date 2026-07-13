import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, Download, Volume2, AudioLines, Sparkles, 
  RotateCcw, ShieldAlert, CheckCircle2, ChevronDown, Volume1
} from 'lucide-react';
import { generateSRT, downloadBlob } from '../utils/srtGenerator';

const VOICES = [
  { name: 'Puck', label: 'Puck (Energetic Male)' },
  { name: 'Charon', label: 'Charon (Deep Male)' },
  { name: 'Kore', label: 'Kore (Warm Female)' },
  { name: 'Fenrir', label: 'Fenrir (Narrator Male)' },
  { name: 'Aoede', label: 'Aoede (Clear Female)' }
];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://studio-8m77.onrender.com';

export default function CustomAudioPlayer({ script, onAudioGenerated }) {
  const [voice, setVoice] = useState('Puck');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  
  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [error, setError] = useState('');

  // Voice Preview state
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewAudioRef = useRef(null);

  const audioRef = useRef(null);

  // Reset states if script changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioUrl(null);
    setAudioBlob(null);
    setError('');
    
    // Stop voice preview if active
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewing(false);
    }

    // If the script already has audio cached in MongoDB, load it
    if (script && script.audioBase64) {
      const binaryStr = atob(script.audioBase64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
    }
  }, [script]);

  const handleGenerateAudio = async () => {
    if (!script || !script._id) return;
    setIsGenerating(true);
    setError('');
    
    // Stop preview if running
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewing(false);
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: script._id, voice })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to synthesize audio.');
      }

      const blob = await response.blob();
      setAudioBlob(blob);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      if (onAudioGenerated) {
        onAudioGenerated();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred during voice synthesis.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPreview = async () => {
    if (isPreviewing) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setIsPreviewing(false);
      return;
    }

    setIsPreviewing(true);
    setError('');
    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      // Add a timestamp cache buster
      previewAudioRef.current = new Audio(`${BACKEND_URL}/api/voice-preview?voice=${voice}&t=${Date.now()}`);
      
      previewAudioRef.current.onended = () => {
        setIsPreviewing(false);
      };
      
      previewAudioRef.current.onerror = () => {
        setIsPreviewing(false);
        setError('Failed to load voice actor sample.');
      };

      await previewAudioRef.current.play();
    } catch (err) {
      console.error(err);
      setIsPreviewing(false);
      setError('Could not establish preview playback.');
    }
  };

  // HTML5 audio event handlers
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Audio play failed:", e));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleProgressChange = (e) => {
    if (!audioRef.current) return;
    const seekTime = parseFloat(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const handleSpeedSelect = (rate) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  // Downloads
  const downloadAudioWav = () => {
    if (!audioBlob) return;
    const cleanTitle = script.animeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadBlob(audioBlob, `${cleanTitle}_voiceover.wav`, 'audio/wav');
  };

  const downloadAudioMp3 = async () => {
    if (!script || !script._id) return;
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/scripts/${script._id}/audio/mp3`);
      if (!response.ok) {
        throw new Error('Failed to retrieve MP3 from server.');
      }
      const blob = await response.blob();
      const cleanTitle = script.animeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      downloadBlob(blob, `${cleanTitle}_voiceover.mp3`, 'audio/mpeg');
    } catch (err) {
      console.error(err);
      setError('Could not download audio as MP3.');
    }
  };

  const downloadSrtFile = () => {
    if (!script || !script.scenes) return;
    const srtContent = generateSRT(script.scenes);
    const cleanTitle = script.animeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadBlob(srtContent, `${cleanTitle}_subtitles.srt`, 'text/plain');
  };

  const formatTime = (timeInSecs) => {
    if (isNaN(timeInSecs)) return '00:00';
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border-pink-500/20 shadow-neon-pink">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AudioLines className="w-5 h-5 text-cyber-pink" />
          <h2 className="text-lg font-bold text-white tracking-wide uppercase">
            Voice Synthesis Studio
          </h2>
        </div>
        {audioUrl && (
          <span className="flex items-center gap-1 text-xs text-green-400 font-bold bg-green-950/60 border border-green-500/30 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
          </span>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 bg-red-950/80 border border-red-500/40 rounded-xl p-3 text-red-200 text-xs flex items-start gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {!audioUrl ? (
        /* TTS Generation controls */
        <div className="space-y-4">
          <p className="text-xs text-cyber-muted">
            Choose a custom voice actor to synthesize all scenes into a high-retention audio track.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-cyber-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Voice Actor</span>
                <button 
                  onClick={handlePlayPreview}
                  disabled={isGenerating}
                  className={`text-[10px] lowercase font-bold flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded ${
                    isPreviewing 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20 hover:bg-cyber-cyan/20'
                  }`}
                >
                  <Volume1 className="w-3 h-3" />
                  {isPreviewing ? 'stop sample' : 'listen sample'}
                </button>
              </label>
              <select
                value={voice}
                onChange={(e) => {
                  setVoice(e.target.value);
                  // stop active preview
                  if (previewAudioRef.current) {
                    previewAudioRef.current.pause();
                    setIsPreviewing(false);
                  }
                }}
                disabled={isGenerating}
                className="w-full bg-[#0d091a]/80 border border-pink-500/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyber-pink"
              >
                {VOICES.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end shrink-0">
              <button
                onClick={handleGenerateAudio}
                disabled={isGenerating || !script}
                className="relative overflow-hidden rounded-xl py-2.5 px-5 text-xs font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group w-full sm:w-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-pink to-cyber-purple transition-all duration-300 group-hover:opacity-90" />
                <div className="relative flex items-center justify-center gap-2">
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Synthesizing Voice...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 animate-bounce" />
                      <span>Generate Voiceover</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Render Custom Audio Player */
        <div className="space-y-5">
          {/* Audio Node */}
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleAudioEnded}
          />

          {/* Player controls row */}
          <div className="flex items-center gap-4 bg-[#0d091a]/80 border border-slate-900 rounded-2xl p-4">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-r from-cyber-pink to-cyber-purple shadow-neon-pink text-white hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Title / Equalizer */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white truncate max-w-[150px] block">
                  Short Voiceover
                </span>
                {/* Equalizer animation */}
                <div className="flex items-end gap-0.5 h-4 select-none">
                  <div className="wave-bar" style={{ animationPlayState: isPlaying ? 'running' : 'paused' }} />
                  <div className="wave-bar" style={{ animationPlayState: isPlaying ? 'running' : 'paused' }} />
                  <div className="wave-bar" style={{ animationPlayState: isPlaying ? 'running' : 'paused' }} />
                  <div className="wave-bar" style={{ animationPlayState: isPlaying ? 'running' : 'paused' }} />
                  <div className="wave-bar" style={{ animationPlayState: isPlaying ? 'running' : 'paused' }} />
                </div>
              </div>

              {/* Time display */}
              <div className="text-[10px] text-cyber-muted mt-1 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Playback speed & reset options */}
            <div className="flex items-center gap-3 relative shrink-0">
              {/* Playback speed selector */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-cyber-cyan transition-colors flex items-center gap-1"
                >
                  {playbackRate}x <ChevronDown className="w-3 h-3" />
                </button>
                
                {showSpeedMenu && (
                  <div className="absolute right-0 bottom-full mb-2 bg-[#0e0a1f] border border-pink-500/20 rounded-xl py-1 shadow-2xl z-20 min-w-[70px]">
                    {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedSelect(rate)}
                        className={`w-full text-left px-3 py-1 text-xs hover:bg-pink-500/10 transition-colors ${
                          playbackRate === rate ? 'text-cyber-pink font-bold' : 'text-slate-300'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reset to beginning */}
              <button
                onClick={() => {
                  if (audioRef.current) audioRef.current.currentTime = 0;
                }}
                className="p-1.5 text-cyber-muted hover:text-cyber-cyan transition-colors rounded-lg bg-slate-900 border border-slate-800"
                title="Restart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Timeline and volume bar grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Timeline progress slider */}
            <div className="md:col-span-2 flex items-center gap-2">
              <span className="text-[10px] text-cyber-muted font-mono">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleProgressChange}
                className="flex-1 accent-cyber-pink h-1.5 rounded-lg appearance-none bg-slate-900 cursor-pointer focus:outline-none"
              />
              <span className="text-[10px] text-cyber-muted font-mono">{formatTime(duration)}</span>
            </div>

            {/* Volume slider */}
            <div className="flex items-center gap-2 bg-[#0c091a]/40 rounded-xl px-3 py-1.5 border border-slate-900">
              <Volume2 className="w-4 h-4 text-cyber-pink shrink-0" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 accent-cyber-pink h-1.5 rounded-lg appearance-none bg-slate-950 cursor-pointer focus:outline-none"
              />
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              onClick={downloadAudioWav}
              className="flex items-center justify-center gap-2 border border-pink-500/20 hover:border-cyber-pink bg-pink-500/5 hover:bg-pink-500/10 text-white rounded-xl py-2.5 text-xs font-bold transition-all duration-300"
            >
              <Download className="w-4 h-4 text-cyber-pink" />
              WAV Export
            </button>

            <button
              onClick={downloadAudioMp3}
              className="flex items-center justify-center gap-2 border border-pink-500/20 hover:border-cyber-pink bg-pink-500/5 hover:bg-pink-500/10 text-white rounded-xl py-2.5 text-xs font-bold transition-all duration-300"
            >
              <Download className="w-4 h-4 text-cyber-pink" />
              MP3 Export
            </button>

            <button
              onClick={downloadSrtFile}
              className="flex items-center justify-center gap-2 border border-purple-500/20 hover:border-cyber-purple bg-purple-500/5 hover:bg-purple-500/10 text-white rounded-xl py-2.5 text-xs font-bold transition-all duration-300"
            >
              <Download className="w-4 h-4 text-cyber-purple" />
              SRT Captions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
