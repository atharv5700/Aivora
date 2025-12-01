
export type Role = 'user' | 'model';

export type ProviderType = 'gemini' | 'ollama' | 'openai';

export interface Endpoint {
  id: string;
  type: ProviderType;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  color?: string; // Brand color
  pricing?: {
    inputRate: number; // Cost per 1M tokens
    outputRate: number; // Cost per 1M tokens
  };
}

export interface Attachment {
  mimeType: string;
  data: string; // Base64
  name?: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Message {
  role: Role;
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  
  // Performance Metrics
  metrics?: {
    inputTokens: number;
    outputTokens: number;
    firstTokenTimeMs?: number;
    totalTimeMs?: number;
    tokensPerSecond?: number;
    cost?: number; // Estimated cost in USD
  };

  // Grounding (Web Search)
  groundingMetadata?: {
    searchEntryPoint?: string;
    groundingChunks?: GroundingChunk[];
  };
}

export interface AppSettings {
  endpoints: Endpoint[];
  theme?: 'light' | 'dark';
}

export interface ColumnConfig {
  id: string;
  endpointId: string;
  modelId: string;
  cachedModelName?: string;
  
  // Model Parameters
  systemPrompt?: string;
  temperature?: number;
  tools?: {
    googleSearch?: boolean;
  };
}

export interface ColumnState {
  messages: Message[];
  isThinking: boolean;
  error?: string;
  startTime?: number;
  firstTokenTime?: number;
  // Abort controller is managed in a Ref in App.tsx, not serializable state
}

export interface ChatSession {
  id: string;
  name: string;
  timestamp: number; // Last modified
  columns: ColumnConfig[];
  columnStates: Record<string, ColumnState>;
}
