
import { Message, Attachment } from "../types";

export interface StreamResponse {
  text?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export class OllamaService {
  private _baseUrl: string;

  constructor(baseUrl: string) {
    let url = baseUrl.trim().replace(/\/$/, "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "http://" + url;
    }
    this._baseUrl = url;
  }

  get baseUrl(): string {
    return this._baseUrl;
  }

  async getModels(): Promise<string[]> {
    const urlsToTry = [this._baseUrl];
    if (this._baseUrl.includes('localhost')) {
      urlsToTry.push(this._baseUrl.replace('localhost', '127.0.0.1'));
    } else if (this._baseUrl.includes('127.0.0.1')) {
      urlsToTry.push(this._baseUrl.replace('127.0.0.1', 'localhost'));
    }

    let lastError;
    for (const url of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`${url}/api/tags`, {
          method: 'GET',
          mode: 'cors',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          this._baseUrl = url;
          const data = await response.json();
          return data?.models?.map((m: any) => m.name) || [];
        }
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Connection Failed");
  }

  // Helper to format message with attachments
  private formatMessage(role: string, content: string, attachments?: Attachment[]): any {
     const msg: any = { role, content };
     
     if (attachments && attachments.length > 0) {
        const images: string[] = [];
        let textAppendix = "";

        attachments.forEach(att => {
           if (att.mimeType.startsWith('image/')) {
              images.push(att.data);
           } else if (
              att.mimeType.startsWith('text/') || 
              att.mimeType.includes('json') || 
              att.mimeType.includes('javascript') ||
              att.mimeType.includes('xml') ||
              att.mimeType.includes('html') ||
              att.mimeType.includes('csv')
           ) {
              try {
                const text = new TextDecoder().decode(Uint8Array.from(atob(att.data), c => c.charCodeAt(0)));
                textAppendix += `\n\n--- Attachment: ${att.name || 'File'} ---\n${text}\n--- End Attachment ---\n`;
              } catch (e) {
                 throw new Error(`Failed to decode text file ${att.name}`);
              }
           } else {
              throw new Error(`Ollama models do not support ${att.mimeType} files (${att.name}).`);
           }
        });

        if (images.length > 0) msg.images = images;
        if (textAppendix) msg.content += textAppendix;
     }

     return msg;
  }

  async *streamChat(
    modelId: string,
    history: Message[],
    newMessage: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      attachments?: Attachment[];
      signal?: AbortSignal;
    }
  ): AsyncGenerator<StreamResponse, void, unknown> {
    
    // 1. Build Messages
    let messages: any[] = [];
    try {
       messages = history.map(m => this.formatMessage(m.role, m.content, m.attachments));
       messages.push(this.formatMessage("user", newMessage, options?.attachments));
    } catch (e: any) {
       throw e; // Propagate unsupported file errors
    }

    // 2. Prep Request
    const urlsToTry = [this._baseUrl];
    if (this._baseUrl.includes('localhost')) {
      urlsToTry.push(this._baseUrl.replace('localhost', '127.0.0.1'));
    } else if (this._baseUrl.includes('127.0.0.1')) {
      urlsToTry.push(this._baseUrl.replace('127.0.0.1', 'localhost'));
    }

    let response: Response | undefined;
    let lastError: any;

    const requestBody: any = {
      model: modelId,
      messages: messages,
      stream: true,
      options: {}
    };

    if (options?.systemPrompt) {
      requestBody.system = options.systemPrompt;
    }
    if (options?.temperature !== undefined) {
      requestBody.options.temperature = options.temperature;
    }

    for (const url of urlsToTry) {
        if (options?.signal?.aborted) throw new Error("Aborted by user");
        try {
            const res = await fetch(`${url}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                mode: 'cors',
                body: JSON.stringify(requestBody),
                signal: options?.signal
            });

            if (res.ok) {
                response = res;
                this._baseUrl = url;
                break;
            } else {
                throw new Error(`Ollama API Error: ${res.statusText}`);
            }
        } catch (e) {
            lastError = e;
        }
    }

    if (!response || !response.body) {
        let msg = lastError?.message || "Failed to communicate with local Ollama instance.";
        if (lastError?.name === 'AbortError' || msg === 'Aborted by user') return; // Silent exit
        if (msg.includes("Failed to fetch") || lastError?.name === 'TypeError') {
            msg = "Connection failed. Please ensure Ollama is running and CORS is enabled.";
        }
        throw new Error(msg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            
            if (json.message?.content) {
              yield { 
                text: json.message.content
              };
            }

            if (json.done && json.prompt_eval_count && json.eval_count) {
               yield {
                 usage: {
                   inputTokens: json.prompt_eval_count,
                   outputTokens: json.eval_count
                 }
               };
            }
          } catch (e) { }
        }
      }
    } catch (error: any) {
       if (error.name === 'AbortError') return;
       throw error;
    }
  }
}
