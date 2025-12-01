
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Attachment, GroundingChunk } from "../types";

export interface StreamResponse {
  text?: string;
  usage?: { inputTokens: number; outputTokens: number };
  groundingMetadata?: { groundingChunks: GroundingChunk[] };
}

export class GeminiService {
  private client: GoogleGenAI | null = null;

  constructor(apiKey: string) {
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
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
      tools?: { googleSearch?: boolean };
    }
  ): AsyncGenerator<StreamResponse, void, unknown> {
    if (!this.client) {
      throw new Error("Google API Key not configured.");
    }

    try {
      // 1. Configure System Instruction, Generation Config & Tools
      const config: any = {};
      if (options?.systemPrompt) {
        config.systemInstruction = options.systemPrompt;
      }
      if (options?.temperature !== undefined) {
        config.temperature = options.temperature;
      }

      // Add Tools (Google Search)
      if (options?.tools?.googleSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      // 2. Prepare History
      const chatHistory = history.map(msg => {
        const parts: any[] = [];
        if (msg.attachments) {
           msg.attachments.forEach(att => {
             // Gemini supports generic files via inlineData with names for context
             parts.push({ 
               inlineData: { mimeType: att.mimeType, data: att.data } 
             });
           });
        }
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        return {
          role: msg.role,
          parts: parts
        };
      });

      // 3. Create Chat
      const chat = this.client.chats.create({
        model: modelId,
        history: chatHistory,
        config: config
      });

      // 4. Prepare New Message
      const newParts: any[] = [];
      if (options?.attachments) {
        options.attachments.forEach(att => {
          newParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
        });
      }
      newParts.push({ text: newMessage });

      // 5. Send Stream
      const resultStream = await chat.sendMessageStream({ 
        message: { parts: newParts }
      });

      for await (const chunk of resultStream) {
        if (options?.signal?.aborted) {
          throw new Error("Aborted by user");
        }

        const responseChunk = chunk as GenerateContentResponse;
        const result: StreamResponse = {};
        
        if (responseChunk.text) {
          result.text = responseChunk.text;
        }

        if (responseChunk.usageMetadata) {
          result.usage = {
            inputTokens: responseChunk.usageMetadata.promptTokenCount || 0,
            outputTokens: responseChunk.usageMetadata.candidatesTokenCount || 0
          };
        }

        // Extract Grounding Metadata (Search Results)
        if (responseChunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          // The SDK might return slightly different shapes, we map it safely
          const chunks = responseChunk.candidates[0].groundingMetadata.groundingChunks as any[];
          const cleanChunks: GroundingChunk[] = chunks.map(c => ({
            web: c.web ? { uri: c.web.uri, title: c.web.title } : undefined
          })).filter(c => c.web);
          
          if (cleanChunks.length > 0) {
             result.groundingMetadata = { groundingChunks: cleanChunks };
          }
        }

        yield result;
      }
    } catch (error: any) {
      if (error.message === "Aborted by user") {
         return; // Silent exit
      }
      console.error("Gemini Error:", error);
      throw new Error(error.message || "Gemini API Error");
    }
  }

  async validateKey(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "ping",
      });
      return true;
    } catch (e) {
      return false;
    }
  }
}
