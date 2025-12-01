
import { Message, Attachment } from "../types";

export interface StreamResponse {
  text?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export class OpenAIService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private processContent(content: string, attachments?: Attachment[]): any[] {
     if (!attachments || attachments.length === 0) {
        return [{ type: 'text', text: content }];
     }

     const contentParts: any[] = [{ type: 'text', text: content }];

     attachments.forEach(att => {
        if (att.mimeType.startsWith('image/')) {
           // Images: Send as image_url
           contentParts.push({
              type: 'image_url',
              image_url: { url: `data:${att.mimeType};base64,${att.data}` }
           });
        } else if (
           att.mimeType.startsWith('text/') || 
           att.mimeType.includes('json') || 
           att.mimeType.includes('javascript') ||
           att.mimeType.includes('xml') ||
           att.mimeType.includes('html') ||
           att.mimeType.includes('csv')
        ) {
           // Text-based files: Decode and append as text context
           try {
             const text = new TextDecoder().decode(Uint8Array.from(atob(att.data), c => c.charCodeAt(0)));
             contentParts.push({ 
               type: 'text', 
               text: `\n\n--- Attachment: ${att.name || 'File'} ---\n${text}\n--- End Attachment ---\n` 
             });
           } catch (e) {
             throw new Error(`Failed to decode text file ${att.name}`);
           }
        } else {
           // Binaries: Throw error
           throw new Error(`Model endpoint does not support ${att.mimeType} files (${att.name}).`);
        }
     });

     return contentParts;
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
    
    const messages: any[] = [];

    // 1. System Prompt
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    // 2. History
    try {
      history.forEach(m => {
        const role = m.role === 'model' ? 'assistant' : 'user';
        const content = this.processContent(m.content, m.attachments);
        messages.push({ role, content });
      });

      // 3. New Message
      const content = this.processContent(newMessage, options?.attachments);
      messages.push({ role: 'user', content });

    } catch (e: any) {
       throw e; // Propagate unsupported file errors
    }

    try {
      const requestBody: any = {
        model: modelId,
        messages: messages,
        stream: true,
        stream_options: { include_usage: true }
      };

      if (options?.temperature !== undefined) {
        requestBody.temperature = options.temperature;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: options?.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed === 'data: [DONE]') return;
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const result: StreamResponse = {};
              const content = json.choices?.[0]?.delta?.content;
              
              if (content) {
                result.text = content;
              }
              if (json.usage) {
                result.usage = {
                  inputTokens: json.usage.prompt_tokens,
                  outputTokens: json.usage.completion_tokens
                };
              }

              if (result.text || result.usage) {
                yield result;
              }
            } catch (e) { }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      throw new Error(error.message || "Endpoint Error");
    }
  }
}
