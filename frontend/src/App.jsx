import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, Film, Sparkles, AlertCircle, Cpu, 
  Volume2, FileText, Menu, X, Settings, History,
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import confetti from 'canvas-confetti';

import ScriptGeneratorForm from './components/ScriptGeneratorForm';
import ScriptViewer from './components/ScriptViewer';
import CustomAudioPlayer from './components/CustomAudioPlayer';
import ScriptHistory from './components/ScriptHistory';
import VideoForge from './components/VideoForge';
import CustomStudio from './components/CustomStudio';
import EpisodeSummarizer from './components/EpisodeSummarizer';
import LongVideoForge from './components/LongVideoForge';

const BACKEND_URL = 'http://localhost:5000';

export default function App() {
  const [activeTab, setActiveTab] = useState('script'); // 'script', 'custom', 'video', 'summarizer', 'longvideo'
  const [scripts, setScripts] = useState([]);
  const [activeScript, setActiveScript] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Mobile and Collapsing sidebar states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Fetch all scripts on load
  const fetchScripts = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/scripts`);
      if (response.ok) {
        const data = await response.json();
        setScripts(data);
      }
    } catch (err) {
      console.error('Failed to fetch scripts history:', err);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const handleGenerateScript = async (formData) => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate script.');
      }

      const script = await response.json();
      setActiveScript(script);
      
      // Trigger canvas-confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f0ff', '#bd00ff', '#ff007a', '#ffffff']
      });

      // Refresh list
      fetchScripts();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred while contacting Gemini API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectScript = async (id) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/scripts/${id}`);
      if (response.ok) {
        const script = await response.json();
        setActiveScript(script);
        setError('');
      } else {
        throw new Error('Failed to load script details.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not fetch script details.');
    }
  };

  const handleDeleteScript = async (id) => {
    if (!window.confirm('Are you sure you want to delete this script?')) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/scripts/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        if (activeScript && activeScript._id === id) {
          setActiveScript(null);
        }
        fetchScripts();
      } else {
        throw new Error('Failed to delete script.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not delete script.');
    }
  };

  const handleAudioGenerated = () => {
    if (activeScript) {
      handleSelectScript(activeScript._id);
    }
  };

  // Nav actions
  const navigateTo = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
    fetchScripts();
  };

  const navItems = [
    { id: 'script', label: 'Script Forge', icon: Sparkles, color: 'text-cyber-cyan' },
    { id: 'custom', label: 'Custom Studio', icon: Volume2, color: 'text-cyber-pink' },
    { id: 'video', label: 'Video Forge', icon: Film, color: 'text-cyber-purple' },
    { id: 'summarizer', label: 'Episode Summarizer', icon: FileText, color: 'text-cyber-cyan' },
    { id: 'longvideo', label: 'Long Video Forge', icon: Video, color: 'text-cyber-pink' }
  ];

  return (
    <div className="min-h-screen bg-[#07050f] text-slate-100 flex relative overflow-x-hidden">
      
      {/* 1. Sidebar Navigation (Left side on Desktop, Collapsible/AnimateWidth) */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 256 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`fixed top-0 left-0 h-screen z-50 bg-[#090616]/95 border-r border-purple-500/10 flex flex-col p-5 shadow-2xl ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Collapse Button (Only visible on Desktop/lg screens) */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden lg:flex absolute -right-3.5 top-8 bg-[#090616] border border-purple-500/20 hover:border-cyber-cyan text-white p-1 rounded-full shadow-lg z-50 cursor-pointer transition-colors"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4 text-cyber-cyan" /> : <ChevronLeft className="w-4 h-4 text-cyber-cyan" />}
        </button>

        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 border-b border-purple-500/10 pb-6 mb-8 overflow-hidden h-14">
          <div className="bg-gradient-to-tr from-cyber-purple via-cyber-pink to-cyber-cyan p-2 rounded-xl shadow-neon-pink shrink-0 animate-pulse">
            <Video className="w-5 h-5 text-white" />
          </div>
          
          <AnimatePresence>
            {!isSidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap"
              >
                <h1 className="text-sm font-extrabold text-white tracking-widest uppercase">
                  Anime Shorts <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-pink text-glow-cyan">Studio</span>
                </h1>
                <span className="text-[9px] text-cyber-muted font-mono tracking-wider block">YOUTUBE AI ENGINE</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Link list */}
        <nav className="flex-1 space-y-2 overflow-y-auto pr-1 select-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                title={isSidebarCollapsed ? item.label : ''}
                className={`w-full rounded-xl text-xs font-bold transition-all flex items-center relative group ${
                  isActive 
                    ? 'bg-gradient-to-r from-cyber-purple/20 to-cyber-pink/20 text-white border border-purple-500/20 shadow-inner' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/30 border border-transparent'
                } ${
                  isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/4 w-1 h-1/2 bg-cyber-pink rounded-r-md" />
                )}
                
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? item.color : 'text-slate-500 group-hover:text-slate-300'}`} />
                
                <AnimatePresence>
                  {!isSidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="truncate whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {/* Bottom utility / status */}
        <div className={`border-t border-purple-500/10 pt-4 flex items-center justify-between text-[10px] text-cyber-muted font-mono overflow-hidden ${
          isSidebarCollapsed ? 'justify-center' : ''
        }`}>
          {!isSidebarCollapsed ? (
            <>
              <span>PORT: 5000 / 5173</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                ONLINE
              </span>
            </>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      </motion.aside>

      {/* 2. Mobile navbar header */}
      <header className="lg:hidden fixed top-0 left-0 w-full z-40 bg-[#090616]/90 border-b border-purple-500/10 p-4 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Menu 
            className="w-6 h-6 text-white cursor-pointer hover:text-cyber-cyan" 
            onClick={() => setIsSidebarOpen(true)}
          />
          <span className="text-xs font-extrabold uppercase tracking-widest text-white">
            Anime Studio
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[9px] text-cyber-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>PORT 5000</span>
        </div>
      </header>

      {/* Sidebar mobile overlay background click trigger */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 3. Main content area (Margin changes based on desktop sidebar collapse state) */}
      <div className={`flex-1 min-h-screen flex flex-col p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 max-w-7xl mx-auto w-full transition-all duration-300 ${
        isSidebarCollapsed ? 'lg:pl-28' : 'lg:pl-72'
      }`}>
        
        {/* Error alert banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 bg-red-950/70 border border-red-500/40 rounded-2xl p-4 text-red-200 text-sm flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Execution Error</h4>
                <p className="mt-0.5 text-xs text-red-300">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page content view router */}
        <main className="flex-1">
          <AnimatePresence mode="wait">
            
            {activeTab === 'script' && (
              /* Shorts Script Forge View */
              <motion.div
                key="script-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
              >
                <div className="lg:col-span-4 space-y-6">
                  <ScriptGeneratorForm onSubmit={handleGenerateScript} isLoading={isLoading} />
                  <ScriptHistory 
                    scripts={scripts.filter(s => !s.videoType || s.videoType === 'short')} 
                    activeScriptId={activeScript?._id}
                    onSelect={handleSelectScript}
                    onDelete={handleDeleteScript}
                  />
                </div>

                <main className="lg:col-span-8 space-y-6 h-full flex flex-col">
                  {activeScript ? (
                    <>
                      <CustomAudioPlayer 
                        script={activeScript} 
                        onAudioGenerated={handleAudioGenerated}
                      />
                      <ScriptViewer script={activeScript} />
                    </>
                  ) : (
                    <div className="glass-panel rounded-2xl p-8 text-center border-purple-500/10 flex-1 flex flex-col items-center justify-center min-h-[450px]">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyber-purple/20 to-cyber-cyan/20 border border-cyber-purple/30 flex items-center justify-center mb-6 shadow-neon-purple animate-bounce">
                        <Sparkles className="w-10 h-10 text-cyber-cyan" />
                      </div>
                      
                      <h2 className="text-2xl font-black text-white tracking-wide mb-2 uppercase">
                        Anime Script Forge
                      </h2>
                      <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                        Forge dynamic, highly engaging shorts scripts complete with storyboard cues and custom synthetic voice narration using advanced Gemini models.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full text-left">
                        <div className="bg-[#0b0816]/50 border border-slate-900 rounded-xl p-4">
                          <div className="text-xs font-bold text-cyber-cyan uppercase tracking-wider mb-1">
                            1. Input Anime Topic
                          </div>
                          <p className="text-[11px] text-cyber-muted">
                            Type any series or lore event. Forge it in punchy Hindi or English text.
                          </p>
                        </div>

                        <div className="bg-[#0b0816]/50 border border-slate-900 rounded-xl p-4">
                          <div className="text-xs font-bold text-cyber-purple uppercase tracking-wider mb-1">
                            2. Synthesize Vocals
                          </div>
                          <p className="text-[11px] text-cyber-muted">
                            Preview voice actors, choose your script narrator, and synthesize the sound stream.
                          </p>
                        </div>

                        <div className="bg-[#0b0816]/50 border border-slate-900 rounded-xl p-4">
                          <div className="text-xs font-bold text-cyber-pink uppercase tracking-wider mb-1">
                            3. Forward to Video
                          </div>
                          <p className="text-[11px] text-cyber-muted">
                            Once script + voice is ready, hop over to the Video Forge tab to render your vertical clip!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </main>
              </motion.div>
            )}

            {activeTab === 'custom' && (
              /* Custom Studio view */
              <motion.div
                key="custom-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <CustomStudio fetchScripts={fetchScripts} />
              </motion.div>
            )}

            {activeTab === 'video' && (
              /* Shorts Video Forge view */
              <motion.div
                key="video-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <VideoForge scripts={scripts.filter(s => !s.videoType || s.videoType === 'short')} fetchScripts={fetchScripts} />
              </motion.div>
            )}

            {activeTab === 'summarizer' && (
              /* Episode Summarizer view */
              <motion.div
                key="summarizer-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <EpisodeSummarizer 
                  fetchScripts={fetchScripts} 
                  scripts={scripts}
                  activeScript={activeScript}
                  onSelectScript={handleSelectScript}
                  onDeleteScript={handleDeleteScript}
                />
              </motion.div>
            )}

            {activeTab === 'longvideo' && (
              /* Long Landscape Video Forge view */
              <motion.div
                key="longvideo-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <LongVideoForge scripts={scripts} fetchScripts={fetchScripts} />
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-purple-500/10 text-center text-xs text-cyber-muted shrink-0">
          <p>© 2026 Anime Shorts Studio. Integrated Video rendering & SEO Engine.</p>
        </footer>
      </div>

    </div>
  );
}
