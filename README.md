# ⚡ OmniWA-Agent

> **Autonomous, Universal & Multilingual WhatsApp AI Customer Support & Sales Agent.**  
> Powered by Whisper, Baileys WebSockets, ChromaDB Vector RAG, and OpenAI-Compatible LLMs.

[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![ChromaDB](https://img.shields.io/badge/VectorDB-ChromaDB-purple.svg)](https://trychroma.com)
[![Baileys](https://img.shields.io/badge/WhatsApp-WhiskeySockets%2FBaileys-emerald.svg)](https://github.com/WhiskeySockets/Baileys)

---

## 🌟 Why OmniWA-Agent?

Most WhatsApp bot solutions on GitHub rely on **headless Chromium browsers (`whatsapp-web.js`)** which swallow 800MB–1.5GB of RAM, trigger frequent out-of-memory crashes on cheap VPS instances, and hallucinate answers because they lack strict epistemic grounding.

**OmniWA-Agent** was engineered from the ground up for high reliability, minimal footprint, and zero hallucinations:

- 🚀 **Ultra-Lightweight Native WebSocket:** Powered by `@whiskeysockets/baileys` directly over WhatsApp WebSockets. Runs smoothly on **~50MB RAM** without requiring Chromium or C++ compilation.
- 🎯 **Strict Zero-Hallucination Epistemic Calibration:** Answers only from your uploaded Markdown/Text documentation. If information is absent, it politely redirects to official escalation channels rather than inventing facts.
- 🌍 **Universal & Multilingual Dynamic Mirroring:** Automatically detects and mirrors the customer's language (Indonesian, English, Spanish, Arabic, etc.) and seamlessly decodes chat slang and abbreviations (`sy mw nnya` → `saya mau bertanya`, `plz send info` → `please send information`).
- 🛡️ **Organic Anti-Ban Pacing Engine:** Simulates human behavior with per-character Gaussian typing jitter (15–25ms/char), read receipt delays, and per-sender sequential FIFO queuing to eliminate message race conditions.
- 🚨 **ITIL 4-Tier Escalation & Crisis Dispatch:** Automatic real-time detection of high-severity emergencies (fraud, security breaches, disaster, self-harm crisis) with WhatsApp alert dispatch to the on-call human supervisor (1-hour idempotency safety guard).
- 🖥️ **Built-in PWA Admin Console & Interactive Sandbox:** Test prompts, preview RAG chunk matches, review unresolved questions, and monitor real-time WhatsApp pairing directly in your browser.
- 🩺 **Built-in Doctor Diagnostic Tool:** 1-click system health check (`npm run doctor`) verifies Node, ChromaDB, model latency, and session states.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    User([Customer on WhatsApp]) -->|Inbound Message| WA[Baileys WebSocket Engine]
    WA --> FIFO[Sequential FIFO Queue]
    FIFO --> Guard{Emergency or Crisis?}
    
    Guard -->|Yes: Tier 4 Incident| Alert[WhatsApp Hotline Dispatch]
    Alert --> Hot([On-Call Human Specialist])
    
    Guard -->|No: Standard Query| Normalizer[Slang & Chat Normalizer]
    Normalizer --> Chitchat{Chitchat / Greeting?}
    Chitchat -->|Yes| Instant[Instant 0.8s Friendly Response]
    
    Chitchat -->|No: Substantive| RAG[ChromaDB Vector Retrieval]
    RAG --> Context[(Markdown Knowledge Base)]
    Context --> LLM[OpenAI-Compatible LLM Inference]
    
    LLM --> Jitter[Gaussian Typing Jitter 15-25ms/char]
    Jitter --> WA
    WA -->|Outbound Answer| User

    subgraph Management
        Admin[Web PWA Admin Dashboard] --> Ingest[Document Re-Indexer]
        Admin --> Sandbox[Interactive Prompt Sandbox]
        Admin --> AuditLog[Unanswered Audit Review]
    end
```

---

## ⚡ 30-Second Quick Start

### Option A: Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/afiqfiles-max/omni-wa-agent.git
   cd omni-wa-agent
   ```

2. Copy the environment configuration and insert your API key:
   ```bash
   cp .env.example .env
   # Edit .env and set your OPENAI_API_KEY
   ```

3. Spin up the containers:
   ```bash
   docker-compose up -d
   ```

4. Open the Web Admin Console at **`http://localhost:3001/admin`** to view system health and scan the pairing QR code.

---

### Option B: Native Node.js Setup

#### 1. Prerequisites
- **Node.js** >= 18.0.0
- **ChromaDB** running locally on port 8000:
  ```bash
  docker run -d -p 8000:8000 --name chromadb chromadb/chroma:latest
  ```

#### 2. Installation
```bash
git clone https://github.com/afiqfiles-max/omni-wa-agent.git
cd omni-wa-agent
npm install
```

#### 3. Configuration
```bash
cp .env.example .env
```
Edit `.env` with your settings:
```ini
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
BOT_NAME=Aura
ORG_NAME=My Company
DOMAIN_PRESET=saas
```

#### 4. Pre-Flight Diagnostics
Run the automated self-diagnostic tool to ensure your environment is fully operational:
```bash
npm run doctor
```

#### 5. Ingest Knowledge Base
Index your documentation into the vector store:
```bash
npm run ingest
```

#### 6. Start the Agent
```bash
npm start
```
Scan the QR code printed in the console or visit **`http://localhost:3001/admin`** to pair your WhatsApp account.

---

## 📚 Multi-Tenant Domain Presets

Configure `DOMAIN_PRESET` in your `.env` or create custom profiles in `config/presets/`:

| Preset | Target Industry | Default Capabilities |
|---|---|---|
| `saas` | Cloud Software & APIs | API troubleshooting, pricing tiers, token limits, uptime. |
| `ecommerce` | Online Retail & Stores | Order tracking, return policies, sizing guide, product FAQs. |
| `education` | Academies & Universities | Program requirements, tuition schedules, admission guidelines. |
| `services` | Agencies & Consultancies | Project scoping, service retainer plans, proposal bookings. |

---

## 🧪 Comprehensive Automated Testing Suite

OmniWA-Agent includes an extensive test suite with **20 adversarial security traps**:

```bash
npm test
```

### Verified Test Suites:
1. **Slang Normalizer:** Indonesian chat abbreviations (`sy mw nnya gmn cr dftr`), English internet shorthand (`plz info asap thx`), and character de-elongation (`kapaaannn` → `kapan`).
2. **Session Manager:** JID session isolation and sliding-window conversation history memory.
3. **Smart Router:** Instant chitchat bypass vs substantive inquiries, and context-aware query condensing.
4. **Escalation Protocol:** Emergency crisis detection (accidents, cybercrime fraud, self-harm intervention), dispatch cooldowns, and substantive complaint extraction.
5. **20 Adversarial Security Cases:** Prompt injection, DAN jailbreaks, Markdown image SSRF traps, system prompt leakage, SQL injection attempts, and Unicode formatting flood defense.

---

## 🛡️ Production Anti-Ban & Maintenance

- **Automatic Reconnection:** Handles network dropouts (Error 408/515) without deleting the `auth_info/` directory, preventing the dreaded "QR Rescan Loop".
- **Pre-Key Cache Maintenance:** Prune old session keys after 14 days without corrupting login state:
  ```bash
  node scripts/clean-auth-cache.js
  ```
- **PM2 Production Cluster:**
  ```bash
  pm2 start ecosystem.config.cjs
  pm2 logs omni-wa-agent
  ```

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome! Feel free to open an issue or submit a Pull Request.
