# Kyo // Local Audio Cognition

A stark, hyper-fast, browser-native semantic engine that interprets your meetings in real time. 
Constructed with Next.js and powered directly by Groq inference infrastructure for sub-second analysis.

## Core Directives
1. **Absolute Privacy:** Audio is processed client-side. Transcripts and conversational arrays are held entirely in volatile RAM. Zero server databases. Zero logs.
2. **Infinite Context:** Dual-track whisper processing (Web Speech API seamlessly overwritten by Groq Whisper outputs). Kyo auto-indexes concepts, surfacing facts before you need them.
3. **No Middleware:** Uses your LPU key to connect directly to the Groq inference tier.

## Initialization

```bash
# Clone the repository
git clone https://github.com/your-username/Kyo.git
cd Kyo

# Install dependencies
npm install

# Launch Development Environment
npm run dev
# Go to http://localhost:3000
```

## Security
Vulnerabilities Mitigated:
- **No Hardcoded Keys:** Your code contains zero backend files, zero `.env` dependencies, and zero hardcoded API keys. 
- **Encryption:** When a user initializes the Kyo runtime, their key is stored in their encrypted LocalStorage context. 
- **Direct Edge Routing:** Operates entirely as a "Thick Client". Your platform host serves only the static HTML/JS bundle. 
- **Sanitized Headers:** HTTP CSP protections (like `X-XSS-Protection`) prevent cross-site memory probing natively.

## Architecture Structure
Kyo employs a stateless functional React loop, prioritizing audio ref-pointers over heavy dom rerenders.

```
src/
├── app/                  # Route boundaries and global styles
├── components/           # The active cognitive panels (Transcripts, Intel, Chat)
├── context/              # LocalStorage memory bindings
├── hooks/                # Complex Web Audio and MediaRecorder processing models
├── lib/                  # Inference orchestration (Groq integration)
└── types/                # Typescript schemas
```
