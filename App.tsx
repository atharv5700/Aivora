
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Plus, Send, Layers, Moon, Sun, Sidebar as SidebarIcon, MessageSquare, Trash2, StopCircle, Paperclip, X, FileText, Mic } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import ChatColumn from './components/ChatColumn';
import { AppSettings, ColumnConfig, ColumnState, Message, ChatSession, Attachment } from './types';
import { GeminiService, StreamResponse } from './services/geminiService';
import { OllamaService } from './services/ollamaService';
import { OpenAIService } from './services/openaiService';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  endpoints: [
    { id: 'default-gemini', type: 'gemini', name: 'Google Gemini', apiKey: '', color: '#3b82f6' },
    { id: 'default-ollama', type: 'ollama', name: 'Local Ollama', baseUrl: 'http://127.0.0.1:11434', color: '#f97316' }
  ]
};

const App: React.FC = () => {
  // --- Persistent State ---
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('aivora_settings_v3');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('aivora_history_v1');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // --- Runtime State ---
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [columnStates, setColumnStates] = useState<Record<string, ColumnState>>({});
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [focusedColumnId, setFocusedColumnId] = useState<string | null>(null);

  // Model Selector
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [customModelId, setCustomModelId] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // Refs for AbortControllers
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const recognitionRef = useRef<any>(null);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('aivora_settings_v3', JSON.stringify(settings));
    if (settings.theme === 'light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('aivora_history_v1', JSON.stringify(sessions));
  }, [sessions]);

  // Auto-Save Session
  useEffect(() => {
    if (currentSessionId && columns.length > 0 && columnStates && Object.keys(columnStates).length > 0) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? {
        ...s,
        timestamp: Date.now(),
        columns,
        columnStates: Object.keys(columnStates).reduce((acc, key) => {
          // Only save if the columnState exists
          if (columnStates[key] && columnStates[key].messages) {
            acc[key] = { messages: columnStates[key].messages, isThinking: false };
          }
          return acc;
        }, {} as Record<string, ColumnState>)
      } : s));
    }
  }, [columnStates, columns, currentSessionId]);

  // --- Voice Input Logic (STT) ---
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // --- Session Management ---
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: 'New Chat',
      timestamp: Date.now(),
      columns: [],
      columnStates: {}
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setColumns([]);
    setColumnStates({});
    setInput('');
    setAttachments([]);
    setFocusedColumnId(null);
    setIsSidebarOpen(false);
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setColumns(session.columns);
    setColumnStates(session.columnStates);
    setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setColumns([]);
      setColumnStates({});
    }
  };

  // --- Chat Logic ---

  const handleStop = () => {
    abortControllers.current.forEach(controller => controller.abort());
    abortControllers.current.clear();
    setIsThinking(false);
    // Update states
    Object.keys(columnStates).forEach(id => {
      setColumnStates(prev => ({
        ...prev,
        [id]: { ...prev[id], isThinking: false }
      }));
    });
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput !== undefined ? overrideInput : input;
    if ((!textToSend.trim() && attachments.length === 0) || columns.length === 0) return;

    // Create new session if none active
    if (!currentSessionId) createNewSession();

    // Rename session if it's the first message
    if (currentSessionId && columns.length > 0 && columnStates[columns[0].id] && columnStates[columns[0].id].messages.length === 0) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, name: textToSend.slice(0, 30) || 'Attachment Chat' } : s));
    }

    const startTime = Date.now();
    const userMsg: Message = {
      role: 'user',
      content: textToSend,
      timestamp: startTime,
      attachments: [...attachments] // Copy attachments
    };

    if (!overrideInput) {
      setInput('');
      setAttachments([]);
    }

    setIsThinking(true);

    // Initialize States
    columns.forEach(col => {
      setColumnStates(prev => ({
        ...prev,
        [col.id]: {
          ...(prev[col.id] || { messages: [], isThinking: false }),
          messages: [...(prev[col.id]?.messages || []), userMsg],
          isThinking: true,
          error: undefined,
          startTime: startTime,
          firstTokenTime: undefined
        }
      }));
    });

    // Launch Streams
    const promises = columns.map(async (col) => {
      const controller = new AbortController();
      abortControllers.current.set(col.id, controller);

      try {
        const endpoint = settings.endpoints.find(e => e.id === col.endpointId);
        if (!endpoint) throw new Error("Endpoint configuration missing");

        const history = columnStates[col.id]?.messages || [];
        let stream: AsyncGenerator<StreamResponse, void, unknown>;

        const options = {
          systemPrompt: col.systemPrompt,
          temperature: col.temperature,
          attachments: userMsg.attachments,
          signal: controller.signal,
          tools: col.tools // Pass search tools if enabled
        };

        if (endpoint.type === 'gemini') {
          stream = new GeminiService(endpoint.apiKey || '').streamChat(col.modelId, history, textToSend, options);
        } else if (endpoint.type === 'ollama') {
          stream = new OllamaService(endpoint.baseUrl || '').streamChat(col.modelId, history, textToSend, options);
        } else {
          stream = new OpenAIService(endpoint.baseUrl || '', endpoint.apiKey || '').streamChat(col.modelId, history, textToSend, options);
        }

        let accumulatedResponse = '';
        let lastMetrics = { inputTokens: 0, outputTokens: 0 };
        let firstTokenTimestamp: number | undefined = undefined;
        let lastGrounding: any = undefined;

        // Add placeholder bot message
        setColumnStates(prev => ({
          ...prev,
          [col.id]: {
            ...(prev[col.id] || { messages: [], isThinking: true }),
            messages: [...(prev[col.id]?.messages || []), { role: 'model', content: '', timestamp: Date.now() }]
          }
        }));

        for await (const chunk of stream) {
          const now = Date.now();
          if (!firstTokenTimestamp && chunk.text) firstTokenTimestamp = now;

          if (chunk.text) accumulatedResponse += chunk.text;
          if (chunk.usage) lastMetrics = chunk.usage;
          if (chunk.groundingMetadata) lastGrounding = chunk.groundingMetadata;

          // Metrics Calculation
          const durationMs = now - startTime;
          const ttftMs = firstTokenTimestamp ? firstTokenTimestamp - startTime : undefined;
          const tps = lastMetrics.outputTokens > 0 ? (lastMetrics.outputTokens / (durationMs / 1000)) : 0;

          setColumnStates(prev => {
            const currentMsgs = [...prev[col.id].messages];
            const lastMsg = currentMsgs[currentMsgs.length - 1];
            if (lastMsg.role === 'model') {
              lastMsg.content = accumulatedResponse;
              lastMsg.groundingMetadata = lastGrounding;
              lastMsg.metrics = {
                inputTokens: lastMetrics.inputTokens,
                outputTokens: lastMetrics.outputTokens,
                firstTokenTimeMs: ttftMs,
                totalTimeMs: durationMs,
                tokensPerSecond: tps
              };
            }
            return {
              ...prev,
              [col.id]: { ...prev[col.id], messages: currentMsgs }
            };
          });
        }
      } catch (e: any) {
        if (e.message !== 'Aborted by user') {
          setColumnStates(prev => ({
            ...prev,
            [col.id]: { ...prev[col.id], error: e.message }
          }));
        }
      } finally {
        setColumnStates(prev => ({
          ...prev,
          [col.id]: { ...prev[col.id], isThinking: false }
        }));
        abortControllers.current.delete(col.id);
      }
    });

    await Promise.all(promises);
    setIsThinking(false);
  };

  const handleEdit = (columnId: string, msgIndex: number, newContent: string) => {
    // Edit applies to ALL columns to maintain comparison integrity.
    columns.forEach(col => {
      setColumnStates(prev => ({
        ...prev,
        [col.id]: { ...prev[col.id], messages: prev[col.id].messages.slice(0, msgIndex) }
      }));
    });
    setInput(newContent);
    setTimeout(() => handleSend(newContent), 10);
  };

  const handleRegenerate = (columnId: string, msgIndex: number) => {
    // Determine the last user message before this bot message
    const msgs = columnStates[columnId]?.messages || [];
    const userMsgIndex = msgIndex - 1;
    if (userMsgIndex < 0) return;
    // const userMsg = msgs[userMsgIndex];

    setColumnStates(prev => ({
      ...prev,
      [columnId]: { ...prev[columnId], messages: msgs.slice(0, msgIndex) }
    }));

    // Single column regeneration logic
    const reRun = async () => {
      setIsThinking(true);
      const col = columns.find(c => c.id === columnId)!;
      setColumnStates(prev => ({
        ...prev,
        [col.id]: { ...prev[col.id], isThinking: true, error: undefined }
      }));

      try {
        const endpoint = settings.endpoints.find(e => e.id === col.endpointId);
        if (!endpoint) throw new Error("Endpoint configuration missing");
        const history = columnStates[columnId].messages.slice(0, msgIndex); // History up to bot msg
        const pastHistory = history.slice(0, -1);
        const triggerMsg = history[history.length - 1];

        const controller = new AbortController();
        abortControllers.current.set(col.id, controller);

        let stream;
        const options = {
          systemPrompt: col.systemPrompt,
          temperature: col.temperature,
          attachments: triggerMsg.attachments,
          signal: controller.signal,
          tools: col.tools
        };

        if (endpoint.type === 'gemini') stream = new GeminiService(endpoint.apiKey!).streamChat(col.modelId, pastHistory, triggerMsg.content, options);
        else if (endpoint.type === 'ollama') stream = new OllamaService(endpoint.baseUrl!).streamChat(col.modelId, pastHistory, triggerMsg.content, options);
        else stream = new OpenAIService(endpoint.baseUrl!, endpoint.apiKey!).streamChat(col.modelId, pastHistory, triggerMsg.content, options);

        let accumulated = '';
        let lastMetrics = { inputTokens: 0, outputTokens: 0 };
        let lastGrounding: any = undefined;

        setColumnStates(prev => ({
          ...prev,
          [col.id]: { ...prev[col.id], messages: [...history, { role: 'model', content: '', timestamp: Date.now() }] }
        }));

        for await (const chunk of stream) {
          if (chunk.text) accumulated += chunk.text;
          if (chunk.usage) lastMetrics = chunk.usage;
          if (chunk.groundingMetadata) lastGrounding = chunk.groundingMetadata;

          setColumnStates(prev => {
            const currentMsgs = [...prev[col.id].messages];
            const lastMsg = currentMsgs[currentMsgs.length - 1];
            lastMsg.content = accumulated;
            lastMsg.groundingMetadata = lastGrounding;
            lastMsg.metrics = {
              inputTokens: lastMetrics.inputTokens || 0,
              outputTokens: lastMetrics.outputTokens || 0
            };
            return { ...prev, [col.id]: { ...prev[col.id], messages: currentMsgs } };
          });
        }
      } catch (e: any) {
        if (e.message !== 'Aborted by user') {
          setColumnStates(prev => ({ ...prev, [col.id]: { ...prev[col.id], error: e.message } }));
        }
      } finally {
        setIsThinking(false);
        setColumnStates(prev => ({ ...prev, [col.id]: { ...prev[col.id], isThinking: false } }));
      }
    };
    reRun();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 30 * 1024 * 1024) { // 30MB Limit
        alert("File is too large. Maximum size is 30MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, { mimeType: file.type, data: base64, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const addColumn = () => {
    if (columns.length >= 4) return;
    const endpoint = settings.endpoints.find(e => e.id === selectedEndpointId);
    if (!endpoint || !customModelId) return;

    const newId = Date.now().toString();
    setColumns(prev => [...prev, {
      id: newId,
      endpointId: endpoint.id,
      modelId: customModelId,
      cachedModelName: endpoint.name
    }]);
    setColumnStates(prev => ({
      ...prev,
      [newId]: { messages: [], isThinking: false }
    }));
    setIsSelectorOpen(false);
    setCustomModelId('');
  };

  // --- Render ---
  return (
    <div className="flex h-dvh bg-background text-textMain font-sans overflow-hidden transition-colors duration-300">

      {/* Sidebar History */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-surface border-r border-border transition-all duration-300 flex flex-col overflow-hidden`}>
        <div className="p-4 flex items-center justify-between border-b border-border">
          <h2 className="font-bold text-sm tracking-wide">History</h2>
          <button onClick={createNewSession} className="p-1.5 hover:bg-surfaceHighlight rounded text-primary" title="New Chat"><Plus size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <div key={s.id} onClick={() => loadSession(s)} className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer text-sm transition-colors ${currentSessionId === s.id ? 'bg-surfaceHighlight text-primary' : 'hover:bg-surfaceHighlight text-textMuted'}`}>
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare size={14} className="flex-shrink-0" />
                <span className="truncate">{s.name}</span>
              </div>
              <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400" title="Delete Chat"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={setSettings} />

        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-surfaceHighlight rounded-md" title="Toggle Sidebar"><SidebarIcon size={18} /></button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-primaryHover flex items-center justify-center shadow-lg"><Layers size={18} className="text-white" /></div>
              <h1 className="font-bold text-lg tracking-tight hidden sm:block">Aivora</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSettings(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }))} className="p-2 hover:bg-surfaceHighlight rounded-md" title="Toggle Theme">{settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-surfaceHighlight rounded-md" title="Settings"><Settings size={18} /></button>
          </div>
        </header>

        {/* Columns */}
        <main className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide">
          {columns.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-textMuted p-8">
              <div className="w-20 h-20 rounded-2xl bg-surface flex items-center justify-center mb-6 border border-border shadow-2xl">
                <Layers size={40} className="text-primary opacity-80" />
              </div>
              <h2 className="text-xl font-bold text-textMain mb-2">Initialize Workspace</h2>
              <p className="max-w-md text-sm text-center opacity-70 mb-8">Add models to start comparing. Connect Local Ollama, Google Gemini, or any OpenAI-compatible API.</p>
              <button onClick={() => setIsSelectorOpen(true)} className="px-6 py-3 bg-primary hover:bg-primaryHover text-white font-semibold rounded-lg shadow-lg flex items-center gap-2"><Plus size={18} /> Add First Model</button>
            </div>
          ) : (
            columns.map((col) => {
              if (focusedColumnId && focusedColumnId !== col.id) return null; // Hide non-focused
              const endpoint = settings.endpoints.find(e => e.id === col.endpointId);
              return (
                <div key={col.id} className={`flex-1 ${focusedColumnId ? 'w-full max-w-none' : 'min-w-[320px] snap-center'} border-r border-border`}>
                  <ChatColumn
                    config={col}
                    state={columnStates[col.id]}
                    providerColor={endpoint?.color}
                    providerType={endpoint?.type}
                    onRemove={(id) => {
                      setColumns(prev => prev.filter(c => c.id !== id));
                      if (focusedColumnId === id) setFocusedColumnId(null);
                    }}
                    onUpdateConfig={(id, updates) => setColumns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))}
                    onRegenerate={handleRegenerate}
                    onEdit={handleEdit}
                    isFocused={focusedColumnId === col.id}
                    onToggleFocus={(id) => setFocusedColumnId(focusedColumnId === id ? null : id)}
                  />
                </div>
              );
            })
          )}
          {columns.length > 0 && columns.length < 4 && !focusedColumnId && (
            <div className="w-[60px] hidden lg:flex flex-col items-center justify-center border-r border-border hover:bg-surface cursor-pointer group" onClick={() => setIsSelectorOpen(true)}>
              <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-textMuted group-hover:text-primary"><Plus size={20} /></div>
            </div>
          )}
        </main>

        {/* Input */}
        <footer className="p-4 bg-background/80 backdrop-blur-xl border-t border-border z-20">
          <div className="max-w-4xl mx-auto space-y-2">
            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group bg-surface flex items-center justify-center">
                    {att.mimeType.startsWith('image/') ? (
                      <img src={`data:${att.mimeType};base64,${att.data}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center p-1">
                        <FileText size={20} className="text-primary mb-1" />
                        <span className="text-[8px] leading-tight text-center truncate w-full">{att.name || 'File'}</span>
                      </div>
                    )}
                    <button onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white" title="Remove Attachment"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative group flex items-end gap-2 bg-surface border border-border rounded-xl p-2 shadow-2xl">
              <label className="p-3 text-textMuted hover:text-primary cursor-pointer transition-colors" title="Attach Files">
                <Paperclip size={18} />
                {/* Removed accept attribute to allow all files */}
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>

              <button
                onClick={toggleListening}
                className={`p-3 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-textMuted hover:text-primary'}`}
                title="Voice Input (Mic)"
              >
                <Mic size={18} />
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isListening ? "Listening..." : (columns.length > 0 ? `Message ${columns.length} models...` : "Add a model...")}
                className="w-full bg-transparent text-textMain placeholder-textMuted px-2 py-3 max-h-[120px] focus:outline-none resize-none text-sm"
                rows={1}
              />
              {isThinking ? (
                <button onClick={handleStop} className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg animate-pulse" title="Stop Generating"><StopCircle size={18} /></button>
              ) : (
                <button onClick={() => handleSend()} disabled={!input.trim() && attachments.length === 0} className="p-3 bg-primary hover:bg-primaryHover text-white rounded-lg disabled:opacity-50" title="Send Message"><Send size={18} /></button>
              )}
            </div>
          </div>
        </footer>

        {/* Model Selector Modal */}
        {isSelectorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface w-full max-w-md rounded-xl border border-border shadow-2xl p-6 space-y-5">
              <div className="flex justify-between"><h3 className="font-bold">Add Model</h3><button onClick={() => setIsSelectorOpen(false)} title="Close"><X size={18} /></button></div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {settings.endpoints.map(ep => (
                  <button key={ep.id} onClick={() => { setSelectedEndpointId(ep.id); setIsFetchingModels(true); }} className={`w-full text-left p-2 rounded border ${selectedEndpointId === ep.id ? 'bg-surfaceHighlight border-primary' : 'border-border'}`}>{ep.name}</button>
                ))}
              </div>
              <input type="text" placeholder="Model ID (e.g. gemini-2.5-flash)" value={customModelId} onChange={(e) => setCustomModelId(e.target.value)} className="w-full bg-background border border-border rounded p-3" />
              <button onClick={addColumn} disabled={!customModelId} className="w-full py-3 bg-primary text-white rounded font-bold">Add Column</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
