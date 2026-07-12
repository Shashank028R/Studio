import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Trash2, Calendar, Languages } from 'lucide-react';

export default function ScriptHistory({ scripts, activeScriptId, onSelect, onDelete }) {
  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border-purple-500/10 shadow-neon-purple flex flex-col h-[525px]">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <History className="w-5 h-5 text-cyber-purple" />
        <h2 className="text-base font-bold text-white tracking-wide uppercase">
          Studio History
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {scripts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <History className="w-8 h-8 text-cyber-muted/30 mb-2" />
            <p className="text-xs text-cyber-muted">No scripts forged yet.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {scripts.map((script) => (
              <motion.div
                key={script._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`group border rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all duration-300 relative overflow-hidden ${
                  activeScriptId === script._id
                    ? 'bg-[#1b1236]/60 border-cyber-purple shadow-neon-purple/20'
                    : 'bg-[#0b0816]/30 border-slate-900 hover:border-purple-500/30 hover:bg-[#120a26]/40'
                }`}
                onClick={() => onSelect(script._id)}
              >
                {/* Active script border highlight */}
                {activeScriptId === script._id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-purple" />
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-cyber-cyan transition-colors">
                    {script.animeTitle}
                  </h3>
                  
                  <div className="flex items-center gap-2.5 mt-1.5 text-[10px] text-cyber-muted">
                    <span className="flex items-center gap-0.5">
                      <Languages className="w-3 h-3 text-cyber-pink" />
                      {script.language}
                    </span>
                    <span className="flex items-center gap-0.5 font-mono">
                      <Calendar className="w-3 h-3 text-cyber-cyan" />
                      {formatDate(script.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(script._id);
                  }}
                  className="p-1.5 rounded-lg text-cyber-muted hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 border border-transparent hover:border-red-500/20"
                  title="Delete Script"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
