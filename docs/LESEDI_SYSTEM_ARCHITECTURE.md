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

---

## Phase 2 — Child Learning Tutor (Added)

### New Components

| Component | File | Role |
|---|---|---|
| Activity Definitions | `shared/activityDefinitions.js` | Full pedagogical metadata for all 5 activities: learning objectives, CAPS refs, curriculum skill IDs, grade applicability, misconceptions, hint sequences (levels 0–3 + F), success criteria, evidence types. |
| Scaffolding Engine | `LesediAiAgent/src/scaffoldingEngine.js` | Adaptive hint tracking. Escalates levels 0→1→2→3→F on repeated struggles. History-aware: starts at level 1 if child has needed hints 2+ times before. Detects self-corrections. Provides session summaries for the evaluation engine. |
| Evaluation Engine | `LesediAiAgent/src/evaluationEngine.js` | Maps evidence + hint usage to the 5 observation levels (DEMONSTRATED, DEVELOPING, NEEDS_FURTHER_PRACTICE, INSUFFICIENT_EVIDENCE, TEACHER_REVIEW_REQUIRED). Multi-session pattern detection for Phase 3. |
| Evidence Classification | `shared/activityEvidence.js` (enhanced) | `classifyEvidence()` maps each activity's evidence to structured types: cognitive, visual recognition, spoken production, reading accuracy, reading fluency, comprehension. Notes that maths pronunciation ≠ mathematical result, and tapping letters ≠ validated phonics score. |

### New API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/lesedi/scaffold` | POST | Real-time hint during gameplay. Returns hint text, hint level, handoff flag, praise flag. |
| `/api/lesedi/evaluate` | POST | Evaluate a completed session. Returns observation level, reason, evidence, confidence. |
| `/api/lesedi/scaffold/:sessionId` | DELETE | Clear scaffolding state for a completed session. |

### Scaffolding Levels

```
Level 0 — Independent attempt (no hint given)
Level 1 — Gentle prompt (draw attention to what the child already knows)
Level 2 — Guided hint (model a simpler version of the same problem)
Level 3 — Worked example with a DIFFERENT number/word, invite retry, offer teacher handoff
Level F — Final stage: give the learner another opportunity to solve independently
```

Adaptive rules:
- Start at level 0 (let the child try independently)
- Escalate +1 if the child struggles (wrong answer or no response)
- Never skip levels (1 → 3 is not allowed; must go 1 → 2 → 3)
- If the child succeeds at any level, reset to 0 for the next round
- If the child self-corrects (wrong then right), do NOT escalate
- If a child has needed hints 2+ times on a skill, start at level 1
- Level 3 always ends with teacher handoff invitation (never a dead end)

### Observation Levels (Internal Evidence Descriptions)

These are internal evidence descriptions, NOT official DBE achievement codes:

| Level | Meaning |
|---|---|
| DEMONSTRATED | Child completed independently (no hints, score ≥ 67%) |
| DEVELOPING | Child completed with hints or moderate score |
| NEEDS_FURTHER_PRACTICE | Child attempted but did not complete (score < 34%) |
| INSUFFICIENT_EVIDENCE | No valid evidence captured |
| TEACHER_REVIEW_REQUIRED | Anomaly (e.g. 100% on only 1 round) |

### Activity Catalog (5 Activities)

| Activity | Subject | Curriculum Skill ID | Evaluation Method | Grades |
|---|---|---|---|---|
| Reading Time | English | HL-READING-FLUENCY | Participation (null score) | R–3 |
| Number Hunt | Mathematics | MATHS-NUMBER-RECOGNITION | Objective (correct/total) | R–2 |
| Count and Pick | Mathematics | MATHS-ONE-TO-ONE-COUNTING | Objective (correct/total) | R–2 |
| Rhyme Time | English | HL-RHYME-RECOGNITION | Objective (correct/total) | R–2 |
| Sound It Out | English | HL-PHONEME-BLENDING | Participation (null score) | R–2 |

### Evidence Type Classification

Each activity classifies evidence into structured types:

| Activity | Evidence Types |
|---|---|
| Reading Time | reading_accuracy, reading_fluency, comprehension |
| Number Hunt | visual_recognition, cognitive, (spoken_production if transcript) |
| Count and Pick | visual_recognition, cognitive |
| Rhyme Time | cognitive, visual_recognition, (spoken_production if transcript) |
| Sound It Out | cognitive, visual_recognition, (spoken_production if transcript) |

Key rules:
- A child who selects the correct number but pronounces it imperfectly should NOT receive an incorrect mathematical result
- A child correctly identifying a rhyme without speaking has demonstrated the skill
- Tapping letters in Sound It Out shows engagement but is NOT a validated phonics score
- Browser speech recognition transcripts are unverified — teacher review required

---

## Phase 3 — Learning Analytics and Teacher Copilot (Added)

### New Components

| Component | File | Role |
|---|---|---|
| Analytics Engine | `LesediAiAgent/src/analyticsEngine.js` | Evidence aggregation across sessions. Per-learner: groups by skill, detects patterns (improving, declining, stagnant), identifies gaps and strengths. Per-class: tier distribution, common skill gaps (30%+ threshold), class strengths (50%+ threshold), teaching recommendations. |

### New API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/lesedi/analytics` | POST | Per-learner analytics: aggregated evidence, skill groups, patterns, gaps, strengths. |
| `/api/lesedi/class-analytics` | POST | Class-level analytics: tier distribution, common skill gaps, teaching recommendations. |

### Enhanced Existing Components

| Component | Enhancement |
|---|---|
| `appWorkflow.js` `/assignments/:id/complete` | Drafts now include `observationLevel`, `observationConfidence`, and `evidenceClassification` from the evaluation engine. Analysis text uses the evaluation reason instead of hardcoded text. |
| `engine.js` `gap_explanation` | Accepts optional `analytics` context from the analytics engine, included in the AI prompt as verified data (not AI interpretation). |

### Analytics Data Flow

```
Session completes
  └─► evaluateEvidence() → score + evidenceClassification
  └─► evaluateObservation() → observation level (DEMONSTRATED/DEVELOPING/etc.)
  └─► Draft created with observationLevel + evidenceClassification + analysis reason

Multiple sessions accumulate
  └─► aggregateLearnerEvidence() → per-skill patterns, gaps, strengths, trends
  └─► aggregateClassEvidence() → class-level tier distribution, common gaps, recommendations

Teacher requests gap explanation
  └─► engine.js gap_explanation with analytics context
  └─► AI receives verified data + pattern analysis
  └─► AI interpretation is separate from verified scores
```

### Key Analytics Rules

- Deterministic scoring (never let the LLM invent scores)
- AI used only for interpretation and recommendations
- Repeated patterns identified, not single mistakes
- Evidence quality considered (validated scores vs participation only)
- Subject-specific learning histories preserved
- Progress and regression tracked
- AI-generated observations distinguishable from verified activity results
- Response time alone is never a measure of ability
- Where evidence is insufficient, stated explicitly

### Class-Level Recommendations

| Type | Trigger |
|---|---|
| `targeted_teaching` | 30%+ of learners struggling with a skill |
| `class_review` | Class average below 50% |
| `differentiated_grouping` | 40%+ of learners need attention |
| `enrichment` | 50%+ of learners demonstrated a skill |
| `gather_evidence` | 30%+ of learners have insufficient evidence |

---

## Phase 4 — Parent and HOD Intelligence (Added)

### New Components

| Component | File | Role |
|---|---|---|
| Parent Copilot | `LesediAiAgent/src/parentCopilot.js` | Analytics-enhanced parent communication: session notes (based on observation level), term progress reports (comprehensive summaries), parent question responses (categorised by question type). Practical home-learning activities for South African households. |
| HOD Intelligence | `LesediAiAgent/src/hodIntelligence.js` | HOD quality assurance reports: flags with supporting evidence, possible reasons (considering contextual factors), suggested actions. Consent tracking, intervention follow-up, class strengths recognition. |

### New API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/lesedi/parent-report` | POST | Draft parent note (`type: 'note'`), term report (`type: 'term_report'`), or response to parent question (`type: 'response'`). |
| `/api/lesedi/hod-qa` | POST | Generate HOD quality assurance report with flags, contextual factors, and recommendations. |

### Parent Communication Types

| Type | When | Content |
|---|---|---|
| `note` | After a single session | Short, warm message with observation level, home activity |
| `term_report` | End of term | Comprehensive: overview, strengths, areas for growth, home activities, teacher closing |
| `response` | When parent asks a question | Categorised response based on question type (progress, help, concern, general) |

### HOD Report Structure

Each flag includes:
- `issue` — what was observed
- `evidence` — supporting data
- `timePeriod` — when observed
- `curriculumArea` — which skill/subject
- `possibleReasons` — contextual factors considered (never blames teacher)
- `suggestedActions` — support actions for HOD
- `severity` — high, medium, or low

### Contextual Factors Considered

| Factor | Effect on Interpretation |
|---|---|
| Class size > 35 | Individual attention harder |
| Attendance < 80% | Reduced practice opportunities |
| Resources limited | Affects activity variety |
| Additional language | May affect pace |
| Teacher experience | Newer teachers need more support |

### Key Principles

- Parent notes never compare to other children
- Parent notes never diagnose learning difficulties
- HOD reports never conclude a teacher is underperforming solely because scores are low
- HOD reports always consider contextual factors (class size, attendance, resources, language)
- Pula's learning tiers are NOT equated with official DBE achievement codes
- All parent communications require teacher approval before sending
- The HOD is responsible for all decisions and interventions

---

## Phase 5 — Speech Intelligence (Added)

### New Components

| Component | File | Role |
|---|---|---|
| Speech Intelligence | `LesediAiAgent/src/speechIntelligence.js` | Consent-gated speech processing with child-speech-aware confidence assessment. Handles stuttering, self-correction, pauses, incomplete words, language switching. Produces structured evidence — never returns raw transcript or audio. |

### New API Endpoint

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/lesedi/speech-evaluate` | POST | Process speech evidence with consent validation, child-speech pattern detection, and privacy controls. Returns structured confidence assessment. |

### Enhanced Existing Components

| Component | Enhancement |
|---|---|
| `activityEvidence.js` `classifyEvidence()` | Reading Time classification now uses Speech Intelligence to assess transcript match percentage, fluency estimate, and child speech patterns (stuttering, self-correction) instead of raw word counts. |

### Child Speech Patterns Handled

| Pattern | Detection | Teacher Guidance |
|---|---|---|
| Stuttering | Consecutive repeated words ("the the cat") | NOT evidence of a learning difficulty. Common in young children. |
| Self-correction | Word followed by "no/sorry/wait" + different word | POSITIVE sign — shows child monitors their reading. |
| Long pauses | Very short transcript relative to recording duration | Inconclusive — child may need encouragement, not correction. |
| Incomplete words | Very short tokens not matching common short words | Hesitation or uncertainty — teacher should listen directly. |
| Language switching | Words not in expected text and not common English | NOT an error. Common in SA multilingual classrooms. Do not mark as incorrect. |

### Confidence Levels

| Level | Meaning |
|---|---|
| `high` | ≥ 80% word match, ≤ 2 self-corrections |
| `medium` | 50–79% word match |
| `low` | > 0% but < 50% word match — browser may have failed |
| `inconclusive` | No transcript, long pauses, or consent blocked |

### Key Separations

The spec requires separating:

| Measured Separately | Explanation |
|---|---|
| Cognitive understanding vs spoken production | A child may understand a concept but struggle to say it |
| Visual recognition vs spoken production | A child may identify a number visually but mispronounce it |
| Reading accuracy vs reading fluency vs comprehension | Each requires separate evidence |
| Phonics knowledge vs speech-to-text accuracy | Browser STT is not a validated measure of phonics ability |

### Privacy Rules (Enforced in Code)

| Rule | Enforcement |
|---|---|
| Consent required before any processing | `processSpeechEvidence()` checks `consent === true` first |
| Voice consent required if recording captured | `voiceConsent === true` required when `recordingCaptured === true` |
| Raw transcript never returned | Result object never includes `transcript`, `audio`, `audioUrl` |
| Audio always discarded | `audioDiscarded: true` in all results |
| `rawTranscriptDiscarded: true` | Always set in result — caller must clear buffers |
| Third-party providers NOT declared zero-retention | Notes say "browser speech recognition may send voice to its speech provider" |
