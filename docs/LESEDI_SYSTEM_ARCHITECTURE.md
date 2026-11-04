# Lesedi System Architecture

## Overview

Lesedi is a CAPS-aligned AI teaching assistant integrated into the Pula school management platform. It provides 8 task types across English (Literacy) and Mathematics for Grades R–3, with guardrails that enforce CAPS policy, POPIA consent, and pedagogical best practices.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (PWA)                            │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ ActivitiesHub│  │ ReviewPanel  │  │ teacher/App.jsx       │  │
│  │ (CoreContext)│  │ (Draft review)│  │ (Legacy dashboard)    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘  │
│         │                 │                      │               │
│         ▼                 ▼                      ▼               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ appWorkflow  │  │ appWorkflow  │  │ copilotStore.js       │  │
│  │ /assignments │  │ /drafts/:id  │  │ (HTTP fetch wrapper)  │  │
│  │ /complete    │  │ /lesedi      │  └───────────┬────────────┘  │
│  └──────┬───────┘  └──────┬───────┘              │               │
│         │ localStorage    │ fetch /api/lesedi    │ fetch /api/*  │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │                 │                      │
          │                 ▼                      ▼
          │    ┌──────────────────────────────────────────┐
          │    │           Express Backend (:4000)        │
          │    │                                          │
          │    │  POST /api/lesedi  ──► mountLesedi(app)   │
          │    │  POST /api/activity-sessions             │
          │    │  PATCH /api/lesedi/outputs/:id/approve    │
          │    │  GET  /api/lesedi/outputs                │
          │    │  POST /api/assessments                    │
          │    │  POST /api/notes, PATCH /api/notes/:id    │
          │    └──────────────────┬───────────────────────┘
          │                       │
          │                       ▼
          │    ┌──────────────────────────────────────────┐
          │    │         LesediAiAgent (engine.js)        │
          │    │                                          │
          │    │  1. checkGuardrails(ctx)                  │
          │    │     └─► POPIA consent gate                 │
          │    │     └─► CAPS Grade R test block            │
          │    │     └─► Consent overdue check             │
          │    │     └─► Insufficient evidence block       │
          │    │                                          │
          │    │  2. child_hint ──► phraseBank | mathsBank  │
          │    │  3. child_tutor ─► phraseBank | AI        │
          │    │  4. All other tasks ──► Prompt builder     │
          │    │     └─► callAI(system, user, task)        │
          │    │        └─► Azure AI (Claude Sonnet)        │
          │    │        └─► Databricks (stub)               │
          │    │        └─► Stub (local dev)                │
          │    └──────────────────────────────────────────┘
          │
          ▼
    ┌──────────────────────────────────────────────────────┐
    │                  Data Layer                           │
    │                                                      │
    │  ┌─────────────┐     ┌──────────────────────────┐    │
    │  │ JsonStore    │     │ PgStore                   │    │
    │  │ data.json    │     │ Azure PostgreSQL          │    │
    │  │ (USE_JSON_   │     │ (South Africa North)       │    │
    │  │  STORE=true) │     │ (USE_JSON_STORE=false)     │    │
    │  └─────────────┘     └──────────────────────────┘    │
    │                                                      │
    │  Tables: schools, users, classrooms, learners,       │
    │  guardian_consents, tier_history, reading_progress,  │
    │  observation_items, learner_observations,            │
    │  activities, activity_skill_map, activity_sessions,  │
    │  parent_notes, terms, lesedi_outputs,                │
    │  intervention_log, audit_log                         │
    └──────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Frontend

| Component | File | Role |
|---|---|---|
| ActivitiesHub | `frontend/src/activities/ActivitiesHub.jsx` | Child-facing activity player (5 games). Uses CoreContext for session management. |
| ReviewPanel | `frontend/src/core/ReviewPanel.jsx` | Teacher draft review UI. "Ask Lesedi for analysis" button enriches drafts with real AI. |
| appWorkflow | `frontend/src/core/appWorkflow.js` | Client-side mock API. Manages sessions/drafts in localStorage. Calls real /api/lesedi for enrichment. |
| CoreContext | `frontend/src/core/CoreContext.jsx` | React context providing workspace state and the coreApi function. |
| teacher/App | `teacher/App.jsx` | Legacy teacher dashboard. Calls backend via copilotStore.js. Already calls /api/lesedi for parent notes. |
| activityCatalog | `shared/activityCatalog.js` | Server-owned activity definitions with rounds, targets, answers. |
| activityEvidence | `shared/activityEvidence.js` | Evaluates learner evidence against server rounds. Produces scores. |

### Backend

| Component | File | Role |
|---|---|---|
| server.js | `backend/src/server.js` | Express server. Mounts all routes including Lesedi. |
| activitySessions.js | `backend/src/routes/activitySessions.js` | POST /api/activity-sessions — consent-gated, idempotent session persistence. |
| lesediOutputs.js | `backend/src/routes/lesediOutputs.js` | PATCH /api/lesedi/outputs/:id/approve — teacher approval with side-effects. GET /api/lesedi/outputs — list. |
| JsonStore | `backend/src/store/JsonStore.js` | JSON file-based store (data.json). Default for development. |
| PgStore | `backend/src/store/PgStore.js` | PostgreSQL store. Azure PostgreSQL South Africa North. |
| Migrations | `backend/migrations/001–007` | Database schema + seed data. |

### Lesedi AI Agent

| Component | File | Role |
|---|---|---|
| engine.js | `LesediAiAgent/src/engine.js` | Task router. Routes to phrase banks or builds AI prompts. Calls azureAdapter. |
| guardrails.js | `LesediAiAgent/src/guardrails.js` | 11 policies (POPIA, CAPS, PROJECT, PEDAGOGY). Blocks bad requests with source-tagged responses. |
| tierRules.js | `LesediAiAgent/src/tierRules.js` | Seed/Sprout/Bloom/Tree rules for literacy and maths. Progression gates. HOD alert thresholds. |
| phraseBank.js | `LesediAiAgent/src/phraseBank.js` | Literacy hint ladder (levels 1–3). Offline, no AI. |
| mathsBank.js | `LesediAiAgent/src/mathsBank.js` | Maths hint ladder (levels 1–3). Offline, no AI. Grade-guarded events. |
| activitySchema.js | `LesediAiAgent/src/activitySchema.js` | 16 built-in activity examples for scaffolding. |
| azureAdapter.js | `LesediAiAgent/src/azureAdapter.js` | AI provider adapter. Per-task token budgets. Azure/Databricks/Stub. |
| responseTypes.js | `LesediAiAgent/src/responseTypes.js` | Shared response type contracts. Validators and normalisers. |
| index.js | `LesediAiAgent/src/index.js` | mountLesedi(app) — mounts /api/lesedi and /api/lesedi/health on the Express app. |

## Request Flow

### Activity Session Flow (New Architecture)

```
1. Teacher selects learner + activity
   └─► coreApi('/assignments', {learnerId, activityId, requestId})
       └─► appWorkflow creates session in localStorage

2. Child plays through rounds
   └─► ActivitiesHub manages game state with useVoiceCapture

3. Child finishes
   └─► coreApi('/assignments/:id/complete', {rounds, speech_transcript, ...})
       └─► appWorkflow calls evaluateEvidence()
       └─► Creates draft with analysis/intervention/parentUpdate
       └─► Returns {kiro_state_control, lesedi_avatar_output}

4. Teacher reviews draft in ReviewPanel
   └─► Teacher clicks "Ask Lesedi for analysis" (optional)
       └─► coreApi('/drafts/:id/lesedi')
           └─► appWorkflow calls fetch('/api/lesedi', {task: 'gap_explanation', ...})
               └─► Backend → engine.js → callAI() → Azure AI
               └─► Returns AI analysis text
           └─► Updates draft fields with AI content
   └─► Teacher edits, then approves/rejects/sends
       └─► coreApi('/drafts/:id/review', {action, edited, version})
```

### Direct Lesedi API Flow (Legacy)

```
1. Teacher or HOD sends request
   └─► POST /api/lesedi
       └─► index.js handler builds context object
       └─► engine.js runLesedi(ctx)
           └─► checkGuardrails(ctx) — may block early
           └─► child_hint → phraseBank/mathsBank (no AI)
           └─► child_tutor → phraseBank or AI fallback
           └─► Other tasks → prompt builder → callAI()
       └─► Response: {text, source, requiresApproval, tags, ...}
       └─► Persists to lesedi_outputs table (PgStore mode)
```

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `USE_JSON_STORE` | `true` | Use JSON file store (true) or PostgreSQL (false) |
| `PROVIDER` | `stub` | AI provider: `azure`, `databricks`, `stub` |
| `AZURE_AI_ENDPOINT` | — | Azure AI Foundry endpoint URL |
| `AZURE_AI_KEY` | — | Azure AI Foundry API key |
| `LESEDI_MODEL` | `claude-sonnet-4-5` | Model deployment name |
| `MAX_TOKENS` | per-task table | Global token limit override |
| `LESEDI_MAX_TOKENS_GAP_EXPLANATION` | 1500 | Per-task token override |
| `LESEDI_MAX_TOKENS_HOD_INSIGHT` | 1500 | Per-task token override |
| `LESEDI_MAX_TOKENS_PARENT_NOTE` | 400 | Per-task token override |
| `VITE_API_BASE` | auto | Frontend API base URL |

### Per-Task Token Budgets

| Task | Default Tokens | Reason |
|---|---|---|
| gap_explanation | 1500 | 7-section structured output |
| hod_insight | 1500 | 7-section structured output |
| teacher_activity | 900 | Full activity draft with steps |
| class_insight | 900 | Class-level analysis |
| parent_note | 400 | Short WhatsApp/SMS draft |
| child_tutor (AI) | 300 | Three-part ||| delimited reply |
| guardrail | 500 | Policy explanation |
| default | 800 | Fallback |
