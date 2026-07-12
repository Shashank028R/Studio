import React from 'react';
import { motion } from 'framer-motion';
import { Film, Copy, Check, MessageSquare, Play } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0.25 } }
};

export default function ScriptViewer({ script }) {
  const [copiedIndex, setCopiedIndex] = React.useState(null);

  if (!script || !script.scenes || script.scenes.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center border-purple-500/10 min-h-[300px]">
        <Film className="w-12 h-12 text-cyber-muted/50 mb-3 animate-pulse" />
        <h3 className="text-lg font-semibold text-slate-300">No Script Active</h3>
        <p className="text-sm text-cyber-muted mt-1 max-w-xs">
          Enter an Anime title on the left to generate your custom shorts script.
        </p>
      </div>
    );
  }

  const handleCopyPrompt = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const totalDuration = script.scenes.reduce((acc, scene) => acc + (scene.duration || 0), 0);

  return (
    <div className="space-y-6">
      {/* Script Header Info */}
      <div className="glass-panel rounded-2xl p-5 border-cyan-500/20 shadow-neon-cyan flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-cyber-cyan tracking-widest uppercase block mb-1">
            Active Project
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-wide">
            {script.animeTitle}
          </h1>
          <div className="flex gap-3 mt-2 text-xs text-cyber-muted">
            <span className="bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-md">
              🌐 {script.language}
            </span>
            <span className="bg-pink-950/60 border border-pink-500/30 px-2 py-0.5 rounded-md">
              🎭 {script.tone}
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-cyber-muted block uppercase font-semibold">Total Duration</span>
          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-pink">
            {totalDuration}s
          </span>
        </div>
      </div>

      {/* Scene Storyboard Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {script.scenes.map((scene, index) => (
          <motion.div
            key={scene.sceneNumber || index}
            variants={itemVariants}
            className="glass-panel rounded-xl p-5 border-purple-500/10 hover:border-cyber-purple/30 transition-all duration-300 relative group overflow-hidden"
          >
            {/* Ambient hover glow */}
            <div className="absolute -left-16 -top-16 w-32 h-32 bg-cyber-purple/5 rounded-full blur-2xl group-hover:bg-cyber-purple/10 transition-colors" />

            <div className="relative flex flex-col md:flex-row gap-5">
              {/* Scene Number & Duration badge */}
              <div className="flex md:flex-col items-center md:items-start justify-between md:justify-start gap-2 md:w-32 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 pb-3 md:pb-0 md:pr-4">
                <div>
                  <span className="text-xs font-semibold text-cyber-muted uppercase tracking-wider block">
                    Scene
                  </span>
                  <span className="text-3xl font-black text-white text-glow-purple">
                    {String(scene.sceneNumber || (index + 1)).padStart(2, '0')}
                  </span>
                </div>
                <div className="bg-[#130f24] border border-purple-500/20 rounded-lg px-2.5 py-1 flex items-center gap-1.5 mt-1">
                  <Play className="w-3.5 h-3.5 text-cyber-pink" />
                  <span className="text-xs font-bold text-cyber-pink">{scene.duration}s</span>
                </div>
              </div>

              {/* Narrator Text and Visual Prompt */}
              <div className="flex-1 space-y-4">
                {/* Voiceover Speech Block */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold uppercase text-cyber-cyan tracking-wider">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Narrator Voiceover
                  </div>
                  <p className="text-base text-slate-100 font-medium leading-relaxed leading-extra-loose bg-[#0c091a]/40 border border-slate-900 rounded-xl p-3.5 select-all">
                    {scene.narratorText}
                  </p>
                </div>

                {/* AI Visual Prompt block */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-cyber-pink tracking-wider">
                      <Film className="w-3.5 h-3.5" />
                      Visual prompt (AI Image / Video)
                    </span>
                    <button
                      onClick={() => handleCopyPrompt(scene.visualPrompt, index)}
                      className="text-xs text-cyber-muted hover:text-cyber-cyan flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-cyber-cyan/30"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-[#0b0816]/70 border border-pink-500/10 rounded-xl p-3 text-xs italic text-slate-300 font-mono tracking-wide leading-relaxed">
                    {scene.visualPrompt}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
