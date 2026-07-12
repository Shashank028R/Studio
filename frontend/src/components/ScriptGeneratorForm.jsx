import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';

const TONES = [
  { value: 'Action-Packed', label: '⚔️ Action-Packed' },
  { value: 'Dramatic & Suspenseful', label: '🎬 Dramatic & Suspenseful' },
  { value: 'Funny & Hype', label: '🔥 Hype & Comedic' },
  { value: 'Lore & Explainer', label: '📖 Lore & Explainer' },
  { value: 'Dark & Cyberpunk', label: '👾 Dark & Cyberpunk' }
];

export default function ScriptGeneratorForm({ onSubmit, isLoading }) {
  const [animeTitle, setAnimeTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Action-Packed');

  // Interactive loading status quotes to show dynamic changes
  const [loadingStep, setLoadingStep] = useState(0);

  React.useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const loadingTexts = [
    'Accessing Otaku Databanks...',
    'Analyzing power levels...',
    'Writing high-retention hook and scenes...',
    'Structuring visual storyboard...'
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!animeTitle.trim()) return;
    onSubmit({ animeTitle, language, tone });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel rounded-2xl p-6 shadow-neon-purple border-purple-500/20"
    >
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-6 h-6 text-cyber-purple animate-pulse" />
        <h2 className="text-xl font-bold text-white tracking-wide uppercase">
          AI Short Script Generator
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Anime Title */}
        <div>
          <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">
            Anime Title / Topic
          </label>
          <input
            type="text"
            required
            value={animeTitle}
            onChange={(e) => setAnimeTitle(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. Eren Yeager's Rumbling, Gojo vs Sukuna"
            className="w-full bg-[#0d091a]/80 border border-purple-500/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan transition duration-200"
          />
        </div>

        {/* Layout for Language and Tone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Language Selection */}
          <div>
            <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isLoading}
              className="w-full bg-[#0d091a]/80 border border-purple-500/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyber-cyan transition duration-200"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi (हिंदी)</option>
            </select>
          </div>

          {/* Tone Selection */}
          <div>
            <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">
              Script Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              disabled={isLoading}
              className="w-full bg-[#0d091a]/80 border border-purple-500/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyber-cyan transition duration-200"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !animeTitle.trim()}
          className="relative w-full overflow-hidden rounded-xl py-3.5 px-6 font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {/* Dynamic background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-purple via-cyber-pink to-cyber-cyan transition-all duration-500 group-hover:opacity-90" />
          
          <div className="relative flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm tracking-wide">
                  {loadingTexts[loadingStep]}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span className="tracking-wide uppercase">Forge Script</span>
              </>
            )}
          </div>
        </button>
      </form>
    </motion.div>
  );
}
