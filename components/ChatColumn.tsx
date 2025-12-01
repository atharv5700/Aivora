
import React, { useEffect, useRef, useState } from 'react';
import { ColumnState, ColumnConfig, ProviderType } from '../types';
import { Bot, User, AlertCircle, Loader2, Sparkles, X, Clock, Zap, Timer, Settings2, Maximize2, Minimize2, RefreshCw, Pencil, Image as ImageIcon, FileText, Globe, ExternalLink, Volume2, StopCircle, DollarSign } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  config: ColumnConfig;
  state: ColumnState;
  providerColor?: string;
  providerType?: ProviderType;
  onRemove: (id: string) => void;
  onUpdateConfig: (id: string, updates: Partial<ColumnConfig>) => void;
  onRegenerate: (id: string, msgIndex: number) => void;
  onEdit: (id: string, msgIndex: number, newContent: string) => void;
  isFocused: boolean;
  onToggleFocus: (id: string) => void;
}

const ChatColumn: React.FC<Props> = ({ 
  config, state, providerColor = '#f97316', providerType, 
  onRemove, onUpdateConfig, onRegenerate, onEdit, isFocused, onToggleFocus 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState<number | null>(null);

  useEffect(() => {
    if (scrollRef.current && state.isThinking) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, state.isThinking]);

  // Stop speaking when component unmounts
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleEditStart = (index: number, content: string) => {
    setEditingIndex(index);
    setEditContent(content);
  };

  const handleEditSave = () => {
    if (editingIndex !== null) {
      onEdit(config.id, editingIndex, editContent);
      setEditingIndex(null);
    }
  };

  const toggleSpeech = (index: number, text: string) => {
    if (speakingMsgIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIndex(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeakingMsgIndex(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingMsgIndex(index);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-surface/50 border-r border-border relative group backdrop-blur-sm transition-all duration-300 ${isFocused ? 'w-full' : 'min-w-[320px]'}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-background/90 backdrop-blur-md sticky top-0 z-10 h-14">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-1.5 h-6 rounded-r-full flex-shrink-0 transition-colors" style={{ backgroundColor: providerColor, boxShadow: `0 0 10px ${providerColor}40` }} />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-textMain tracking-tight truncate flex items-center gap-2">
              {config.cachedModelName || config.modelId}
            </h3>
            {config.tools?.googleSearch && (
               <div className="flex items-center gap-1 text-[9px] text-green-500 font-medium">
                 <Globe size={10} /> Web Search On
               </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onToggleFocus(config.id)} className="p-1.5 hover:bg-surfaceHighlight rounded text-textMuted hover:text-textMain" title={isFocused ? "Minimize" : "Maximize"}>
            {isFocused ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 hover:bg-surfaceHighlight rounded text-textMuted hover:text-textMain ${showSettings ? 'bg-surfaceHighlight text-primary' : ''}`} title="Parameters">
            <Settings2 size={14} />
          </button>
          <button onClick={() => onRemove(config.id)} className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded text-textMuted" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Settings Panel (Overlay) */}
      {showSettings && (
        <div className="bg-surfaceHighlight border-b border-border p-4 animate-fadeIn">
          <h4 className="text-[10px] uppercase font-bold text-textMuted mb-3 tracking-wider">Model Configuration</h4>
          <div className="space-y-3">
             {/* Gemini Exclusive: Google Search */}
             {providerType === 'gemini' && (
                <div className="flex items-center justify-between p-2 bg-background border border-border rounded">
                   <div className="flex items-center gap-2">
                     <Globe size={14} className="text-primary" />
                     <span className="text-xs font-medium text-textMain">Web Search (Grounding)</span>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={config.tools?.googleSearch || false}
                        onChange={(e) => onUpdateConfig(config.id, { tools: { ...config.tools, googleSearch: e.target.checked } })}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                   </label>
                </div>
             )}

             <div>
               <label className="block text-xs font-medium text-textMain mb-1">System Prompt</label>
               <textarea 
                 value={config.systemPrompt || ''}
                 onChange={(e) => onUpdateConfig(config.id, { systemPrompt: e.target.value })}
                 className="w-full bg-background border border-border rounded p-2 text-xs focus:border-primary outline-none resize-none h-16"
                 placeholder="You are a helpful assistant..."
               />
             </div>
             <div>
               <div className="flex justify-between mb-1">
                 <label className="text-xs font-medium text-textMain">Temperature</label>
                 <span className="text-xs text-textMuted">{config.temperature ?? 0.7}</span>
               </div>
               <input 
                 type="range" 
                 min="0" max="2" step="0.1"
                 value={config.temperature ?? 0.7}
                 onChange={(e) => onUpdateConfig(config.id, { temperature: parseFloat(e.target.value) })}
                 className="w-full h-1 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
               />
             </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        {state.messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-textMuted/30 select-none">
            <Sparkles size={40} className="mb-4 opacity-40" />
            <p className="text-xs font-medium uppercase tracking-widest">Ready</p>
          </div>
        )}

        {state.messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 animate-fadeIn ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-6 h-6 rounded bg-surfaceHighlight flex items-center justify-center flex-shrink-0 mt-1 shadow-inner border border-border" style={{ color: providerColor }}>
                <Bot size={14} />
              </div>
            )}
            
            <div className={`max-w-[90%] flex flex-col group/msg ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              
              {/* Message Bubble */}
              <div 
                className={`rounded-2xl shadow-sm backdrop-blur-sm transition-colors duration-300 relative overflow-hidden ${
                  msg.role === 'user' 
                    ? 'bg-primary/10 text-textMain border border-primary/20 rounded-tr-sm' 
                    : 'bg-surfaceHighlight/60 text-textMain border border-border rounded-tl-sm'
                }`}
              >
                {/* Image Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="p-2 flex flex-wrap gap-2">
                    {msg.attachments.map((att, i) => {
                      if (att.mimeType.startsWith('image/')) {
                        return <img key={i} src={`data:${att.mimeType};base64,${att.data}`} alt="attachment" className="max-w-full h-auto max-h-48 rounded-lg border border-border/50" />
                      }
                      return (
                         <div key={i} className="flex items-center gap-2 bg-background/50 border border-border p-2 rounded-lg">
                            <FileText size={16} className="text-primary" />
                            <span className="text-xs truncate max-w-[150px]">{att.name || 'File'}</span>
                         </div>
                      );
                    })}
                  </div>
                )}

                <div className="px-4 py-3">
                  {editingIndex === idx ? (
                    <div className="min-w-[200px]">
                      <textarea 
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-background/50 border border-primary/50 rounded p-2 text-sm outline-none resize-none"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setEditingIndex(null)} className="text-xs px-2 py-1 hover:bg-surfaceHighlight rounded">Cancel</button>
                        <button onClick={handleEditSave} className="text-xs px-2 py-1 bg-primary text-white rounded">Save</button>
                      </div>
                    </div>
                  ) : msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap font-medium text-sm">{msg.content}</div>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-background/50 prose-pre:border prose-pre:border-border prose-code:text-primary">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Grounding Sources (Search Results) */}
                {msg.role === 'model' && msg.groundingMetadata?.groundingChunks && (
                  <div className="px-4 pb-3 pt-0">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-textMuted mb-2 flex items-center gap-1">
                      <Globe size={10} /> Sources
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {msg.groundingMetadata.groundingChunks.map((chunk, i) => (
                        chunk.web && (
                          <a 
                            key={i} 
                            href={chunk.web.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2 py-1 bg-background/50 hover:bg-surfaceHighlight border border-border rounded text-[10px] text-textMain hover:text-primary transition-colors max-w-full truncate"
                          >
                            <span className="truncate max-w-[120px]">{chunk.web.title}</span>
                            <ExternalLink size={8} />
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Metrics Footer (Bot Only) */}
                {msg.role === 'model' && msg.metrics && (
                  <div className="px-4 py-1.5 border-t border-border/50 bg-black/5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-textMuted font-medium tracking-wide">
                     <span className="flex items-center gap-1"><Zap size={9} className="text-primary" /> {(msg.metrics.inputTokens + msg.metrics.outputTokens).toLocaleString()} T</span>
                     {msg.metrics.totalTimeMs && <span className="flex items-center gap-1"><Clock size={9} /> {(msg.metrics.totalTimeMs / 1000).toFixed(1)}s</span>}
                     {msg.metrics.tokensPerSecond && <span className="flex items-center gap-1"><Timer size={9} /> {Math.round(msg.metrics.tokensPerSecond)} t/s</span>}
                     {msg.metrics.cost !== undefined && msg.metrics.cost > 0 && (
                        <span className="flex items-center gap-1 text-green-400"><DollarSign size={9} /> ${msg.metrics.cost.toFixed(5)}</span>
                     )}
                  </div>
                )}
              </div>

              {/* Action Buttons (Hover) */}
              <div className="flex items-center gap-1 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity px-1">
                {msg.role === 'user' ? (
                   <button onClick={() => handleEditStart(idx, msg.content)} className="p-1 text-textMuted hover:text-primary transition-colors" title="Edit">
                     <Pencil size={12} />
                   </button>
                ) : (
                  <>
                    <button onClick={() => toggleSpeech(idx, msg.content)} className={`p-1 transition-colors ${speakingMsgIndex === idx ? 'text-primary' : 'text-textMuted hover:text-primary'}`} title="Read Aloud">
                       {speakingMsgIndex === idx ? <StopCircle size={12} /> : <Volume2 size={12} />}
                    </button>
                    <button onClick={() => onRegenerate(config.id, idx)} className="p-1 text-textMuted hover:text-primary transition-colors" title="Regenerate">
                      <RefreshCw size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {state.isThinking && (
          <div className="flex gap-3 justify-start animate-pulse">
             <div className="w-6 h-6 rounded bg-surfaceHighlight flex items-center justify-center flex-shrink-0 mt-1 border border-border">
                <Loader2 size={12} className="animate-spin text-primary" />
             </div>
             <div className="h-8 w-24 bg-surfaceHighlight/50 rounded-lg flex items-center px-3">
               <span className="text-[10px] text-textMuted font-medium tracking-wider uppercase">Thinking...</span>
             </div>
          </div>
        )}

        {state.error && (
          <div className="flex gap-3 justify-start">
             <div className="w-6 h-6 rounded bg-red-900/20 flex items-center justify-center flex-shrink-0 mt-1">
                <AlertCircle size={14} className="text-red-400" />
              </div>
              <div className="bg-red-950/30 text-red-200 border border-red-500/20 rounded-lg px-4 py-3 text-xs leading-relaxed max-w-[90%]">
                {state.error}
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatColumn;
