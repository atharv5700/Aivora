<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Aivora - Privacy-First AI Workspace

> **Compare multiple AI models side-by-side in real-time. Your keys, your browser, your data.**

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)

Aivora is a **client-side AI workspace** that lets you chat with multiple AI models simultaneously. It's 100% privacy-first: all API calls happen directly from your browser to the AI provider, with no middleman server.

---

## ✨ Features

### Core Functionality

- **Multi-Model Comparison**: Run up to 4 models side-by-side in real-time columns
- **Universal Endpoint System**: Connect to Google Gemini, local Ollama, or any OpenAI-compatible API
- **Streaming Responses**: See answers appear in real-time as models generate them
- **Chat History**: Automatically saved to localStorage with full session management

### Advanced Capabilities

- **Multimodal Support**: Upload images, PDFs, text files, JSON, CSV, and more
- **Web Search Grounding**: Enable live web search for Gemini models with cited sources
- **Voice Mode**: Speech-to-Text input and Text-to-Speech output
- **Cost & Performance Tracking**: Monitor token usage, latency, speed (tokens/sec), and estimated costs
- **Code Previews**: Instantly preview HTML/React code artifacts within chat bubbles
- **Cross-Model Mentions**: Reference outputs from other models using `@` mentions

### User Experience

- **Focus Mode**: Expand any column to full width for easier reading
- **Dark/Light Theme**: Toggle between beautiful dark and light modes
- **Edit & Regenerate**: Fix typos in prompts or retry responses
- **Responsive Design**: Works on desktop and mobile
- **Privacy-First**: All data stays in your browser. No server, no tracking, no data collection.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- API keys for any providers you want to use (all optional):
  - [Google Gemini API Key](https://ai.google.dev/)
  - [OpenAI API Key](https://platform.openai.com/api-keys)
  - [Ollama](https://ollama.ai/) installed locally (for offline AI)

### Installation

1. **Clone or download this repository**

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **(Optional) Set up environment variables:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your API keys
   ```

   > **Note:** You can also configure API keys via the Settings UI in the app.

4. **Run the development server:**

   ```bash
   npm run dev
   ```

5. **Open your browser:**

   ```
   http://localhost:3000
   ```

---

## 📖 Usage Guide

### Adding Your First Model

1. Click the **Settings** icon (⚙️) in the top right
2. Add a new endpoint (Gemini, Ollama, or Universal API)
3. Enter your API key (for Gemini/OpenAI) or configure the base URL (for Ollama)
4. Click **Save Changes**
5. Back on the main screen, click **+ Add First Model**
6. Select your endpoint and enter the model ID (e.g., `gemini-2.0-flash-exp`)

### Comparing Multiple Models

1. Add 2-4 models using the **+** button
2. Type your question in the input box
3. Hit **Send** or press **Enter**
4. Watch all models respond simultaneously!

### Using Advanced Features

**Web Search (Gemini only):**

- Click the gear icon (⚙️) on any Gemini column
- Toggle "Web Search (Grounding)" ON
- Your prompts will now include live search results

**File Uploads:**

- Click the paperclip (📎) icon
- Select an image, PDF, text file, or any supported format
- The file will be sent with your next message

**Voice Input:**

- Click the microphone (🎤) icon
- Speak your question
- Text will appear in the input box

**Voice Output:**

- Click the speaker (🔊) icon on any bot message
- The response will be read aloud

---

## 🔧 Configuration

### Supported Providers

| Provider | Type | Example Model IDs | Notes |
|----------|------|-------------------|-------|
| **Google Gemini** | Cloud | `gemini-2.0-flash-exp`, `gemini-1.5-pro` | Supports web search, vision |
| **Ollama** | Local | `llama3.3`, `qwen2.5`, `mistral` | 100% offline, free |
| **OpenAI** | Cloud | `gpt-4`, `gpt- 3.5-turbo` | Standard OpenAI models |
| **Groq** | Cloud | `llama-3.3-70b-versatile` | Use base URL: `https://api.groq.com/openai/v1` |
| **OpenRouter** | Cloud | Any supported model | Use base URL: `https://openrouter.ai/api/v1` |

### Setting Up Ollama (Local AI)

1. **Install Ollama:** <https://ollama.ai/download>
2. **Pull a model:**

   ```bash
   ollama pull llama3.3
   ```

3. **Run Ollama:**

   ```bash
   ollama serve
   ```

4. **In Aivora Settings:**
   - Add "Ollama" endpoint
   - Base URL: `http://127.0.0.1:11434`
   - Click "Scan" to auto-detect models

---

## 📱 Deployment Guide (All-in-One Solution)

Aivora is designed to be your universal AI interface. Choose the deployment method that fits your needs:

### 1. Universal Web Link (PWA) - Recommended

**Best for:** Mobile, Tablet, and Desktop (Zero Install)

- **How it works:** Deploy the app to a URL (e.g., via Vercel/Netlify).
- **Installation:** Open the link in Chrome/Safari and tap "Add to Home Screen" or "Install App". It behaves exactly like a native app.
- **Local AI on Mobile:** To use local Ollama on your phone:
  1. Ensure your PC and Phone are on the same Wi-Fi.
  2. Run Ollama with `OLLAMA_HOST=0.0.0.0 ollama serve` on your PC.
  3. Find your PC's local IP (e.g., `192.168.1.5`).
  4. In Aivora Settings on your phone, set the Ollama URL to `http://192.168.1.5:11434`.

### 2. Desktop App (Electron)

**Best for:** Windows/Mac/Linux Power Users

- **How it works:** A standalone `.exe` or `.dmg` file.
- **Benefits:** Native performance, separate window, seamless `localhost` access for Ollama without network config.
- **Build It:** Run `npm run electron:build` to generate the installer.

---

## 🛠️ Build & Deploy

### Production Build

```bash
npm run build
```

Builds the app for production to the `dist` folder.

### Preview Production Build

```bash
npm run preview
```

### Deploy to Vercel / Netlify

**Quick Deploy:**

1. Push code to GitHub
2. Connect repo to [Vercel](https://vercel.com) or [Netlify](https://netlify.com)
3. Deploy!

No environment variables needed. Users configure their own API keys in the UI.

---

## 🔒 Privacy & Security

- **100% Client-Side**: All logic runs in your browser
- **No Backend Server**: No data passes through our servers
- **Direct API Calls**: Your browser connects directly to AI providers
- **Local Storage Only**: Chat history and settings stored in browser localStorage
- **Bring Your Own Keys**: You control your API keys and usage
- **Open Source**: Full code transparency

**⚠️ Important:** Clearing your browser cache will delete all chat history and settings. Export important conversations manually if needed.

---

## 🐛 Troubleshooting

### "Cannot connect to Ollama"

- Ensure Ollama is running: `ollama serve`
- Check the URL is correct: `http://127.0.0.1:11434`
- Try `localhost` instead of `127.0.0.1` (or vice versa)

### "Invalid API key" (Gemini/OpenAI)

- Verify your key in Settings
- Check the key hasn't expired
- Ensure the key has the correct permissions

### "Model not found"

- Double-check the model ID spelling
- For Ollama: run `ollama list` to see available models
- For Gemini: try `gemini-2.0-flash-exp` or `gemini-1.5-pro`

### Voice features not working

- Ensure your browser supports Web Speech API (Chrome, Edge work best)
- Grant microphone permissions when prompted

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- Built with [React](https://react.dev/), [Vite](https://vitejs.dev/), and [Tailwind CSS](https://tailwindcss.com/)
- Powered by the [Google Generative AI SDK](https://www.npmjs.com/package/@google/generativeai)
- Icons by [Lucide](https://lucide.dev/)

---

<div align="center">
  <p>Made with ❤️ for the AI community</p>
  <p>⭐ Star this repo if you find it useful!</p>
</div>
