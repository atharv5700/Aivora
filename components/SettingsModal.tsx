
import React, { useState, useEffect } from 'react';
import { AppSettings, Endpoint, ProviderType } from '../types';
import { X, Save, Plus, Trash2, Globe, Database, Server, CheckCircle, AlertTriangle, RefreshCw, Box, DollarSign } from 'lucide-react';
import { OllamaService } from '../services/ollamaService';
import { GeminiService } from '../services/geminiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, onSave }) => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>(settings.endpoints);
  const [activeId, setActiveId] = useState<string | null>(settings.endpoints[0]?.id || null);
  
  // Test Status State
  const [status, setStatus] = useState<{msg: string, type: 'success' | 'error' | 'warning' | 'loading' | null}>({ msg: '', type: null });

  // Ollama Model Discovery State
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    // Reset transient states when switching endpoints
    setStatus({ msg: '', type: null });
    setOllamaModels([]);
  }, [activeId]);

  if (!isOpen) return null;

  const handleAddEndpoint = (type: ProviderType) => {
    const newEndpoint: Endpoint = {
      id: Date.now().toString(),
      type,
      name: type === 'gemini' ? 'Google Gemini' : type === 'ollama' ? 'Local Ollama' : 'Universal API',
      baseUrl: type === 'ollama' ? 'http://127.0.0.1:11434' : type === 'openai' ? 'https://api.openai.com/v1' : '',
      apiKey: '',
      pricing: { inputRate: 0, outputRate: 0 }
    };
    setEndpoints([...endpoints, newEndpoint]);
    setActiveId(newEndpoint.id);
  };

  const handleUpdate = (id: string, updates: Partial<Endpoint>) => {
    setEndpoints(prev => prev.map(ep => ep.id === id ? { ...ep, ...updates } : ep));
    // If base URL changes, clear the scanned models list as it might be invalid
    if (updates.baseUrl) {
      setOllamaModels([]);
    }
  };

  const handleDelete = (id: string) => {
    const newEndpoints = endpoints.filter(ep => ep.id !== id);
    setEndpoints(newEndpoints);
    if (activeId === id) setActiveId(newEndpoints[0]?.id || null);
  };

  const handleSave = () => {
    onSave({ ...settings, endpoints });
    onClose();
  };

  const scanOllamaModels = async (endpoint: Endpoint) => {
    if (!endpoint.baseUrl) return;
    setIsLoadingModels(true);
    setOllamaModels([]);
    try {
      const service = new OllamaService(endpoint.baseUrl);
      const models = await service.getModels();
      
      if (models.length > 0) {
        setOllamaModels(models);
        // Auto-correct URL if the service found a better one (e.g. 127.0.0.1 vs localhost)
        if (service.baseUrl !== endpoint.baseUrl) {
          handleUpdate(endpoint.id, { baseUrl: service.baseUrl });
        }
        setStatus({ msg: `Successfully scanned ${models.length} models.`, type: 'success' });
      } else {
        setStatus({ msg: 'Connected, but no models found.', type: 'warning' });
      }
    } catch (e: any) {
      setStatus({ msg: 'Failed to scan models. Check URL.', type: 'error' });
    } finally {
      setIsLoadingModels(false);
    }
  };

  const testConnection = async (endpoint: Endpoint) => {
    setStatus({ msg: 'Testing connection...', type: 'loading' });
    try {
      if (endpoint.type === 'ollama' && endpoint.baseUrl) {
        const service = new OllamaService(endpoint.baseUrl);
        const models = await service.getModels();
        if (models.length > 0) {
           if (service.baseUrl !== endpoint.baseUrl) {
             handleUpdate(endpoint.id, { baseUrl: service.baseUrl });
           }
           setStatus({ msg: `Connected! Found ${models.length} models.`, type: 'success' });
           setOllamaModels(models); // Populate list on general test too
        } else {
           setStatus({ msg: 'Connection successful, but 0 models found.', type: 'warning' });
        }
      } else if (endpoint.type === 'gemini' && endpoint.apiKey) {
        const service = new GeminiService(endpoint.apiKey);
        const valid = await service.validateKey();
        if (valid) setStatus({ msg: 'API Key is valid.', type: 'success' });
        else throw new Error('Invalid Key');
      } else if (endpoint.type === 'openai') {
        setStatus({ msg: 'Endpoint saved (Runtime validation only)', type: 'success' });
      } else {
        throw new Error('Missing configuration');
      }
    } catch (e: any) {
      setStatus({ msg: e.message || 'Connection failed', type: 'error' });
    }
  };

  const activeEndpoint = endpoints.find(e => e.id === activeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-surface w-full max-w-4xl h-[80vh] rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden text-textMain transition-colors duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-background">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Settings</h2>
            <p className="text-xs text-textMuted mt-1">Configure your AI providers. All data is stored locally.</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-primary transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar List */}
          <div className="w-1/3 bg-background border-r border-border flex flex-col">
            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {endpoints.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => { setActiveId(ep.id); setStatus({ msg: '', type: null }); }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all group relative ${
                    activeId === ep.id 
                      ? 'bg-surfaceHighlight border-primary/30 text-textMain shadow-lg' 
                      : 'bg-transparent border-transparent text-textMuted hover:bg-surfaceHighlight/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {ep.type === 'gemini' && <Globe size={18} className="text-primary" />}
                    {ep.type === 'ollama' && <Database size={18} className="text-primary" />}
                    {ep.type === 'openai' && <Server size={18} className="text-primary" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{ep.name}</div>
                      <div className="text-[10px] opacity-60 truncate">{ep.type.toUpperCase()}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-textMuted font-bold mb-2">Add New Endpoint</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleAddEndpoint('gemini')} className="flex flex-col items-center justify-center p-2 rounded bg-surfaceHighlight hover:bg-primary/20 border border-border hover:border-primary/50 transition-all">
                  <Globe size={16} className="mb-1 text-textMuted" />
                  <span className="text-[10px]">Gemini</span>
                </button>
                <button onClick={() => handleAddEndpoint('ollama')} className="flex flex-col items-center justify-center p-2 rounded bg-surfaceHighlight hover:bg-primary/20 border border-border hover:border-primary/50 transition-all">
                  <Database size={16} className="mb-1 text-textMuted" />
                  <span className="text-[10px]">Ollama</span>
                </button>
                <button onClick={() => handleAddEndpoint('openai')} className="flex flex-col items-center justify-center p-2 rounded bg-surfaceHighlight hover:bg-primary/20 border border-border hover:border-primary/50 transition-all">
                  <Server size={16} className="mb-1 text-textMuted" />
                  <span className="text-[10px]">Universal</span>
                </button>
              </div>
            </div>
          </div>

          {/* Config Area */}
          <div className="flex-1 p-8 bg-surface overflow-y-auto">
            {activeEndpoint ? (
              <div className="max-w-xl mx-auto space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-textMuted mb-1.5 uppercase tracking-wide">Friendly Name</label>
                    <input 
                      type="text" 
                      value={activeEndpoint.name} 
                      onChange={(e) => handleUpdate(activeEndpoint.id, { name: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-textMain focus:border-primary focus:outline-none transition-colors"
                      placeholder="My Endpoint"
                    />
                  </div>

                  {activeEndpoint.type !== 'gemini' && (
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1.5 uppercase tracking-wide">Base URL</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={activeEndpoint.baseUrl} 
                          onChange={(e) => handleUpdate(activeEndpoint.id, { baseUrl: e.target.value })}
                          className="w-full bg-background border border-border rounded-lg px-4 py-3 text-textMain focus:border-primary focus:outline-none transition-colors pr-20"
                          placeholder={activeEndpoint.type === 'ollama' ? "http://127.0.0.1:11434" : "https://api.openai.com/v1"}
                        />
                        {activeEndpoint.type === 'ollama' && (
                          <button 
                            onClick={() => scanOllamaModels(activeEndpoint)}
                            disabled={isLoadingModels}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-surfaceHighlight hover:bg-primary/20 text-textMuted hover:text-primary rounded border border-border text-xs font-medium transition-all flex items-center gap-2"
                          >
                            {isLoadingModels ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Scan
                          </button>
                        )}
                      </div>
                      
                      {/* Scanned Models List */}
                      {activeEndpoint.type === 'ollama' && ollamaModels.length > 0 && (
                        <div className="mt-3 p-3 bg-background/50 border border-border rounded-lg">
                          <div className="flex items-center gap-2 mb-2 text-[10px] text-textMuted uppercase font-bold tracking-wider">
                            <CheckCircle size={10} className="text-green-500" />
                            Found {ollamaModels.length} Models
                          </div>
                          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto scrollbar-thin">
                            {ollamaModels.map(model => (
                              <span key={model} className="px-2 py-1 rounded bg-surfaceHighlight border border-border text-xs text-textMain flex items-center gap-1">
                                <Box size={10} className="text-primary" /> {model}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeEndpoint.type !== 'ollama' && (
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1.5 uppercase tracking-wide">API Key</label>
                      <input 
                        type="password" 
                        value={activeEndpoint.apiKey} 
                        onChange={(e) => handleUpdate(activeEndpoint.id, { apiKey: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-textMain focus:border-primary focus:outline-none transition-colors font-mono text-sm"
                        placeholder="sk-..."
                      />
                    </div>
                  )}

                  {/* Cost Configuration */}
                  <div>
                    <label className="block text-xs font-medium text-textMuted mb-1.5 uppercase tracking-wide flex items-center gap-2">
                       <DollarSign size={12} /> Pricing (per 1 Million Tokens)
                    </label>
                    <div className="grid grid-cols-2 gap-3 bg-background/50 p-3 rounded-lg border border-border">
                       <div>
                         <label className="block text-[10px] text-textMuted mb-1">Input Price ($)</label>
                         <input 
                           type="number" 
                           step="0.01"
                           min="0"
                           value={activeEndpoint.pricing?.inputRate || ''} 
                           onChange={(e) => handleUpdate(activeEndpoint.id, { pricing: { ...activeEndpoint.pricing, inputRate: parseFloat(e.target.value) || 0, outputRate: activeEndpoint.pricing?.outputRate || 0 } })}
                           className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:border-primary outline-none"
                           placeholder="0.00"
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] text-textMuted mb-1">Output Price ($)</label>
                         <input 
                           type="number" 
                           step="0.01"
                           min="0"
                           value={activeEndpoint.pricing?.outputRate || ''} 
                           onChange={(e) => handleUpdate(activeEndpoint.id, { pricing: { ...activeEndpoint.pricing, outputRate: parseFloat(e.target.value) || 0, inputRate: activeEndpoint.pricing?.inputRate || 0 } })}
                           className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:border-primary outline-none"
                           placeholder="0.00"
                         />
                       </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  <button 
                    onClick={() => testConnection(activeEndpoint)}
                    className="px-4 py-2 bg-surfaceHighlight text-textMain rounded-lg hover:bg-primary/20 border border-border text-sm font-medium transition-colors"
                  >
                    Test Connection
                  </button>
                  <button 
                    onClick={() => handleDelete(activeEndpoint.id)}
                    className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors ml-auto"
                  >
                    <div className="flex items-center gap-2"><Trash2 size={16} /> Delete</div>
                  </button>
                </div>

                {/* Status Message */}
                {status.msg && (
                  <div className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
                    status.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                    status.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                    status.type === 'warning' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                    'bg-surfaceHighlight text-textMuted'
                  }`}>
                    {status.type === 'success' && <CheckCircle size={16} />}
                    {status.type === 'error' && <AlertTriangle size={16} />}
                    {status.type === 'warning' && <AlertTriangle size={16} />}
                    {status.msg}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-textMuted/50">
                <Plus size={48} className="mb-4" />
                <p>Select or add an endpoint to configure</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-background flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm text-textMuted hover:text-textMain transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-8 py-2.5 bg-primary hover:bg-primaryHover text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 flex items-center gap-2 transition-all"
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
