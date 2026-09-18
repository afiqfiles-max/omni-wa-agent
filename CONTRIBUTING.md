# Contributing to OmniWA-Agent

Thank you for your interest in contributing to **OmniWA-Agent**! We welcome contributions from developers worldwide to help build the most reliable, lightweight, and epistemic WhatsApp AI agent.

---

## 🧭 Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat others with respect and empathy.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: `>= 20.0.0` (LTS recommended)
- **ChromaDB**: Running on `http://127.0.0.1:8000` (via Docker or local install)
- **LLM Provider**: Any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, OpenAI, etc.)

### 1. Clone & Install
```bash
git clone https://github.com/afiqfiles-max/omni-wa-agent.git
cd omni-wa-agent
npm install
```

### 2. Configure Environment
Copy the example environment file and configure your credentials:
```bash
cp .env.example .env
```

### 3. Ingest Knowledge Base
```bash
npm run ingest
```

### 4. Run Self-Diagnostics
Verify your system health before starting:
```bash
npm run doctor
```

---

## 🧪 Testing Guidelines

We enforce a strict **100% passing test rule**. Before submitting any Pull Request:

1. **Run the Master Test Suite:**
   ```bash
   npm test
   ```
2. If introducing new normalizer slang rules, update `config/normalizers/` and `tests/test-normalizer.js`.
3. If modifying escalation logic, add tests to `tests/test-escalation.js`.
4. If modifying security boundaries or routing, add adversarial cases to `tests/test-adversarial-traps.js`.

---

## 📝 Commit & PR Conventions

We follow **Conventional Commits**:
- `feat: <description>` — New features (e.g., voice note transcription, new provider preset)
- `fix: <description>` — Bug fixes
- `docs: <description>` — Documentation updates
- `test: <description>` — Adding or updating test suites
- `refactor: <description>` — Code refactoring without behavioral change
- `chore: <description>` — Dependency upgrades, CI/CD tweaks

### Security & Privacy Rules
- **NEVER** commit `.env`, `auth_info/`, `creds.json`, or real personal phone numbers.
- Ensure any added test cases use generic dummy numbers (e.g., `628123456789`).

---

## 💡 Submitting a Pull Request

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feat/my-awesome-feature
   ```
2. Make your changes with concise, clean code.
3. Verify all tests pass (`npm test`).
4. Push to your fork and submit a Pull Request targeting `main`.
5. Describe the motivation, changes made, and attach test output.

Thank you for helping make WhatsApp AI customer support accessible and bulletproof!
