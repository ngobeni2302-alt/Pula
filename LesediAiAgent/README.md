# Lesedi AI Agent

CAPS-aligned teaching assistant for Pula — Grades R to 3 English.

## What it does

| Task | Description |
|---|---|
| `child_hint` | Hint ladder (levels 1–2 offline from phrase bank; level 3 hands off to teacher) |
| `teacher_activity` | Drafts CAPS-aligned activities for teacher + HOD approval |
| `gap_explanation` | Explains why a learner is in a group using observation evidence |
| `parent_note` | Drafts WhatsApp / SMS notes for teacher approval |
| `guardrail` | Handles policy-blocked requests (consent, Grade R tests, PII, etc.) |

## Folder structure

```
LesediAiAgent/
  src/
    index.js          ← mounts /api/lesedi on the Pula Express app (port 4000)
    engine.js         ← task router + prompt builder
    azureAdapter.js   ← Azure AI / Databricks / stub adapter
    guardrails.js     ← CAPS policy + consent + safety checks
    phraseBank.js     ← offline fixed phrases for child hints
  ui/
    LesediChat.jsx    ← React chat panel (drop into any dashboard)
    LesediChat.css
  .env.example        ← copy to .env and fill in
  package.json
  README.md
```

## Setup

```bash
# 1. Install dependencies (from LesediAiAgent/)
npm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — set PROVIDER=azure + your AZURE_AI_ENDPOINT + AZURE_AI_KEY

# 3. Start the Pula backend (port 4000) — Lesedi mounts automatically
cd ../backend
npm run dev
```

## API endpoints

### `POST /api/lesedi`
Send a context object, get Lesedi's response.

```json
{
  "task": "teacher_activity",
  "grade": "2",
  "term": 4,
  "language": "English",
  "focus": "word families -at and -am",
  "minutes": 15
}
```

Response:
```json
{
  "ok": true,
  "task": "teacher_activity",
  "text": "Draft for teacher approval...",
  "source": "ai_model",
  "requiresApproval": true,
  "tags": ["teacher_approval_required", "caps_aligned"]
}
```

### `GET /api/lesedi/health`
Returns adapter status, provider, model name, and whether keys are set.

## Providers

| `PROVIDER` | Status | Notes |
|---|---|---|
| `stub` | ✅ Ready | Returns placeholder text. No keys needed. |
| `azure` | ✅ Ready | Set `AZURE_AI_ENDPOINT` + `AZURE_AI_KEY`. Uses `claude-sonnet-4-5`. |
| `databricks` | 🔧 Stub | Fill in `azureAdapter.js` Databricks section when endpoint is confirmed. |

## Using the chat UI

```jsx
import LesediChat from '../LesediAiAgent/ui/LesediChat.jsx';

// Inside a teacher or HOD dashboard:
<LesediChat grade="2" term={4} learner={selectedLearner} channel="WhatsApp" />
```

## Guardrails (hard rules — never bypassed)

- No parent consent → no data processed, offer consent draft
- Grade R formal tests → redirect to observation checklist
- Giving a child the answer directly → offer hint ladder instead
- Rewriting a child's work → offer self-check tools instead
- Phone numbers in request → stripped, not stored, not echoed
- Fewer than 3 observations → insufficient evidence, no explanation given
- Group placement without reading records → evidence needed first
