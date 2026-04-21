# Kyo: TwinMind Live Suggestions Assignment

This repository is the submission for the **TwinMind Live Suggestions Assignment**. It delivers a highly responsive, browser-native AI meeting copilot—rebranded aesthetically as **Kyo**—that listens to live audio and synchronously surfaces actionable, context-aware suggestions.

## Live Demo
https://twin-mind-three.vercel.app/

**Note on running locally or on Vercel:** You must obtain a free Groq API key from [console.groq.com](https://console.groq.com/keys) to initialize the application via the Landing Page form.

---

## 1. Setup Instructions

```bash
# Clone the repository
git clone https://github.com/DHYEYPATL/Kyo.git
cd Kyo

# Install dependencies
npm install

# Start the Next.js development server
npm run dev

# Open the application
Go to http://localhost:3000
```

---

## 2. Stack Choices

The application uses a **strictly client-side (Thick Client)** architecture to guarantee zero-latency execution and absolute privacy (zero data retention). No middleware proxies were used, mitigating complex server-side streaming overhead in favor of pure browser execution.

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Best-in-class developer experience, React Server Components routing, and highly optimized static bundling for Vercel deployment. |
| **Styling** | Vanilla CSS Modules | Absolute control over the brutalist, magazine-style UI. Zero runtime CSS-in-JS overhead, preventing visual desyncs. |
| **Transcription** | Whisper Large V3 | Configured strictly to Groq's endpoints. Achieves near-real-time accuracy across multiple accents via 30s chunking. |
| **LLM** | GPT-OSS 120B | The required 120B MoE model (`openai/gpt-oss-120b`). Handled natively via Groq's endpoint for 200+ t/s rendering of contextual arrays. |
| **Persistence** | IndexedDB & `localStorage`| All live states (API keys) are kept in `localStorage`. Transcripts chunk massive history into IndexedDB via `idb-keyval` for performance scaling. |

---

## 3. Prompting Strategy & Context Windowing

The application's core logic centers on "showing the right thing at the right time." The prompting architecture isolates specific contexts to heavily mitigate hallucination and latency.

### The Suggestion Pipeline (Live Context)
The prompt forces the model to categorize the conversation and output 3 highly specific objects formatted strictly in JSON.
- **Context Constraints:** We explicitly pass only the **most recent 3,000 characters** (approx. 500 words) of transcript alongside a "Rolling Summary" of the overall meeting.
- **Design Decision:** Suggestions are forced to provide *Advantage Framing*. The JSON output forces a specific `type` badge (Fact-check, Question, Clarification) and a `preview`. The `preview` is engineered to be explicitly valuable as a stand-alone line, ensuring the user gets actionable data even without clicking to expand.

### The Detailed Expansion Pipeline
- When a user clicks a suggestion, the model is fed the exact clicked context but with an expanded **12,000 character** look-behind. This allows the model to map the targeted suggestion back to older conversational structures that might have triggered it.

### The Chat Pipeline
- The Chat window is contextually "always on." It merges the last 12,000 characters of the transcript with the last 10 specific chat turns to balance latency while maintaining conversational flow.

---

## 4. Tradeoffs

1. **Client-Side API Calls (No Backend Proxy):**
   - *Pro:* Incredible execution speed and minimal deployment infrastructure footprint. Ensures 100% data encryption locally.
   - *Con:* The API key is entered manually by the user. In a real-world enterprise SAAS, this would be proxied through a middleware layer to securely bind institutional keys to JWTs. *(We mitigate vulnerabilities by physically wiping `localStorage` natively when the user selects 'End Session'.)*
   
2. **MediaRecorder Audio Chunking:**
   - *Pro:* Chunking exactly every 30 seconds via the Web Audio API bypasses the massive complexity of persistent WebSockets natively streaming raw PCM buffers.
   - *Con:* Causes a slight structural delay (a few seconds) on transcription. We mitigate this UX friction by natively passing real-time `Web Speech API` interim text as an overlay onto the DOM before the Groq Whisper backend returns the official transcript block.

3. **Strict JSON Parsing constraints:**
   - *Pro:* Using Groq's JSON mode mathematically guarantees correct Front-End parsing rules mapping natively to TypeScript models (`SuggestionBatch`).
   - *Con:* Small token latency tax, but worth it to prevent injection crashes.

4. **Desktop Virtual Audio Cables (macOS constraints):**
   - We utilize `useAudioMixer` to explicitly request combined "System Audio + Microphone". Windows perfectly captures live Google Meet/Teams calls out of the box natively. macOS isolates user-level audio due to strict Kernel sandboxing; Mac end-users are expected to proxy virtual web meetings manually.
