# Lesedi Integration Contract

This document describes how every component of the Lesedi AI Brain integrates
with the Pula platform — what each boundary expects, what it returns, and what
the invariants are that must never be broken.

---

## 1. Integration Map

```
Browser (PWA)
├── ActivitiesHub  ──► coreApi('/assignments')          → appWorkflow.js (mock)
│                  ──► coreApi('/assignments/:id/complete') → creates draft
│                  ──► coreApi('/scaffold')              → POST /api/lesedi/scaffold
│                  ──► coreApi('/speech-evaluate')       → POST /api/lesedi/speech-evaluate
│
├── ReviewPanel    ──► coreApi('/drafts')               → appWorkflow.js
│                  ──► coreApi('/drafts/:id/lesedi')     → POST /api/lesedi (gap_explanation)
│                  ──► coreApi('/drafts/:id/review')     → appWorkflow.js (approve/reject)
│
├── teacher/App    ──► api('/lesedi')                   → POST /api/lesedi (parent_note)
│                  ──► api('/notes'), api('/assessments') → backend REST
│
└── (HOD future)   ──► coreApi('/hod-qa')               → POST /api/lesedi/hod-qa
                   ──► coreApi('/class-analytics')      → POST /api/lesedi/class-analytics

Backend (Express :4000)
├── /api/lesedi           → engine.js → azureAdapter.js → Azure AI
├── /api/lesedi/scaffold  → scaffoldingEngine.js   (no AI)
├── /api/lesedi/evaluate  → evaluationEngine.js    (no AI)
├── /api/lesedi/analytics → analyticsEngine.js     (no AI)
├── /api/lesedi/class-analytics → analyticsEngine.js (no AI)
├── /api/lesedi/parent-report   → parentCopilot.js  (no AI)
├── /api/lesedi/hod-qa          → hodIntelligence.js (no AI)
├── /api/lesedi/speech-evaluate → speechIntelligence.js (no AI)
├── /api/lesedi/outputs/:id/approve → lesediOutputs.js
└── /api/activity-sessions      → activitySessions.js

Shared modules (imported by both browser and backend)
├── shared/activityCatalog.js      — activity definitions (answers server-side only)
├── shared/activityEvidence.js     — deterministic scoring + evidence classification
└── shared/activityDefinitions.js  — pedagogical metadata, observation levels
```

---

## 2. Component Boundaries

### 2.1 Frontend → appWorkflow.js (client mock API)

| Route | Input | Output | Notes |
|---|---|---|---|
| `POST /assignments` | `{ learnerId, activityId, requestId }` | session object | Idempotent on `requestId` |
| `POST /assignments/:id/complete` | evidence object | `{ kiro_state_control, lesedi_avatar_output }` | Creates draft with `observationLevel` |
| `GET /drafts` | — | draft array | Teacher-scoped |
| `POST /drafts/:id/review` | `{ action, edited, version }` | `{ status }` | Optimistic lock on `version` |
| `POST /drafts/:id/lesedi` | — | `{ ok, lesediEnriched, draft }` | Calls real `/api/lesedi` |
| `POST /scaffold` | scaffold ctx | hint result | Calls real `/api/lesedi/scaffold` |
| `POST /evaluate` | evaluation ctx | observation level | Calls real `/api/lesedi/evaluate` |
| `POST /analytics` | learner + sessions | analytics report | Calls real `/api/lesedi/analytics` |
| `POST /class-analytics` | grade + learners | class report | Calls real `/api/lesedi/class-analytics` |
| `POST /parent-report` | learner + type | draft text | Calls real `/api/lesedi/parent-report` |
| `POST /hod-qa` | grade + classAnalytics | HOD report | Calls real `/api/lesedi/hod-qa` |
| `POST /speech-evaluate` | speech ctx | confidence result | Calls real `/api/lesedi/speech-evaluate` |

**All routes fail gracefully** — if the backend is unreachable the client mock returns a safe fallback and never throws.

---

### 2.2 Backend REST → LesediAiAgent

Every Lesedi endpoint goes through `mountLesedi(app, opts)` in `LesediAiAgent/src/index.js`.

| Endpoint | Calls | AI? | Approval required? |
|---|---|---|---|
| `POST /api/lesedi` | `engine.js → runLesedi()` | ✅ (most tasks) | task-dependent |
| `POST /api/lesedi/scaffold` | `scaffoldingEngine.js` | ❌ | ❌ |
| `POST /api/lesedi/evaluate` | `evaluationEngine.js` | ❌ | ❌ |
| `POST /api/lesedi/analytics` | `analyticsEngine.js` | ❌ | ❌ |
| `POST /api/lesedi/class-analytics` | `analyticsEngine.js` | ❌ | ❌ |
| `POST /api/lesedi/parent-report` | `parentCopilot.js` | ❌ | ✅ always |
| `POST /api/lesedi/hod-qa` | `hodIntelligence.js` | ❌ | HOD decides |
| `POST /api/lesedi/speech-evaluate` | `speechIntelligence.js` | ❌ | ❌ |

---

### 2.3 Shared modules

`shared/` is imported by both the frontend (via Vite) and the backend (via Node
`import`). Changes to any shared file affect both layers simultaneously.

| File | Used by frontend? | Used by backend? | Contains answers? |
|---|---|---|---|
| `activityCatalog.js` | ✅ (catalog display) | ✅ (server rounds + scoring) | ✅ (server-only via `serverRounds`) |
| `activityEvidence.js` | ✅ (appWorkflow) | ✅ (core/evaluator, routes) | ❌ |
| `activityDefinitions.js` | ✅ (scaffolding, analytics) | ✅ (evaluation) | ❌ |

**Answer key rule**: `publicActivity()` strips the `answer` field before
sending rounds to the frontend. `serverRounds()` retains answers and is
called only on the backend.

---

## 3. Invariants — Never Break These

### 3.1 Consent

| Invariant | Enforcement |
|---|---|
| No consent → no learner data processing | `guardrails.js` `no_consent` policy |
| Consent overdue (>2 weeks) → block tasks | `guardrails.js` `consent_overdue` policy |
| No voice consent → no transcript/recording processing | `speechIntelligence.js` `processSpeechEvidence()` |
| Consent check is server-side | `POST /api/activity-sessions` returns 403 when consent missing |

### 3.2 Scores

| Invariant | Enforcement |
|---|---|
| Scores are computed deterministically | `evaluateEvidence()` in `shared/activityEvidence.js` |
| LLM never invents scores | `engine.js` injects verified `result.score` after AI call |
| Speech pronunciation ≠ mathematical result | `speechIntelligence.js` `mathsNote` field |
| Participation activities always return `score: null` | `evaluateEvidence()` |

### 3.3 Privacy

| Invariant | Enforcement |
|---|---|
| Raw audio never persisted | `useVoiceCapture.jsx` discards after session |
| Raw transcript never in learner history | `appWorkflow.js` `speechMemory` map (session-scoped) |
| `processSpeechEvidence()` never returns `transcript` field | `speechIntelligence.js` |
| `rawTranscriptDiscarded: true` always set | `speechIntelligence.js` |

### 3.4 Teacher authority

| Invariant | Enforcement |
|---|---|
| AI never changes a learner's tier | Tier change requires explicit `POST /learners/:id/tier` |
| Parent notes require teacher approval | `APPROVAL_REQUIRED` set in `responseTypes.js` |
| HOD reports are observations, not verdicts | `hodIntelligence.js` never says teacher is underperforming |
| Pula tiers ≠ DBE achievement codes | `hodIntelligence.js` summary never mentions DBE codes |

### 3.5 Idempotency

| Invariant | Enforcement |
|---|---|
| Duplicate session completion creates one draft | `db.drafts.some(d => d.id === s.id)` check in `appWorkflow.js` |
| Duplicate `/assignments` with same `requestId` returns existing session | `appWorkflow.js` |
| Duplicate Approve-and-Send creates one message | `category: assessment:${d.id}` dedup in messaging |

---

## 4. Data Flow: Activity Session → Draft → Approval

```
1. Teacher selects learner + activity
   coreApi('/assignments', { learnerId, activityId, requestId })
   └── appWorkflow creates session (localStorage)

2. Child plays rounds
   ActivitiesHub manages UI state
   Optional: coreApi('/scaffold', event) → real-time Lesedi hint

3. Child finishes ("I'm done")
   coreApi('/assignments/:id/complete', evidence)
   ├── evaluateEvidence() → score + evidenceClassification (deterministic)
   ├── evaluateObservation() → observationLevel (deterministic)
   └── Draft created:
       { analysis: observation.reason,   ← from evaluationEngine, not AI
         observationLevel,
         evidenceClassification,
         intervention: CAPS-aligned default,
         parentUpdate: template default }

4. Teacher opens ReviewPanel
   Optional: "Ask Lesedi for analysis" button
   └── coreApi('/drafts/:id/lesedi')
       └── POST /api/lesedi { task: 'gap_explanation', ... }
           └── runLesedi() → guardrails → AI → structured 7-section text
           └── Draft analysis/intervention/parentUpdate updated with AI text

5. Teacher edits, then chooses:
   - Save Draft     → version++ only
   - Approve        → status = 'APPROVED', adds to learnerProfile.activityAssessments
   - Approve + Send → status = 'APPROVED' + sends parentUpdate to conversation
   - Reject         → status = 'REJECTED', preserved for audit

6. Optional: Post-session evaluation
   coreApi('/evaluate', { activityId, score, total, ... })
   └── evaluateObservation() → DEMONSTRATED/DEVELOPING/NEEDS_FURTHER_PRACTICE/...

7. Optional: Multi-session analytics (Phase 3+)
   coreApi('/analytics', { learnerId, sessions })
   └── aggregateLearnerEvidence() → skill groups, gaps, strengths, trends
```

---

## 5. Test Coverage by Layer

| Layer | Test File | Tests | Command |
|---|---|---|---|
| Activity catalog + evidence (core) | `activities.test.mjs` | 10 | repo root |
| appWorkflow mock API | `appWorkflow.test.mjs` | 6 | repo root |
| Calendar | `calendar.test.mjs`, `calendarLayout.test.mjs` | 19 | repo root |
| Dashboard data | `dashboardColors.test.mjs`, `dashboardData.test.mjs` | 13 | repo root |
| Learner profile | `learnerProfile.test.mjs` | 14 | repo root |
| Messaging | `messaging.test.mjs`, `parentFeaturesAndNotifications.test.mjs` | 32 | repo root |
| Reading experience | `readingExperience.test.mjs` | 7 | repo root |
| Voice capture | `voiceCapture.test.mjs` | 6 | repo root |
| Phase 2 — Child Tutor | `phase2Activities.test.mjs` | 29 | repo root |
| Phase 3 — Analytics | `phase3Analytics.test.mjs` | 18 | repo root |
| Phase 4 — Parent + HOD | `phase4ParentHod.test.mjs` | 20 | repo root |
| Phase 5 — Speech | `phase5Speech.test.mjs` | 18 | repo root |
| Backend integration | `backend/tests/core.test.js` | 17 | `backend/` |
| **Total** | | **172 frontend + 17 backend = 189** | |

### Running tests locally (matches CI exactly)

```bash
# From repo root — frontend tests
node --test --test-reporter=spec \
  frontend/tests/activities.test.mjs \
  frontend/tests/appWorkflow.test.mjs \
  frontend/tests/calendar.test.mjs \
  frontend/tests/calendarLayout.test.mjs \
  frontend/tests/dashboardColors.test.mjs \
  frontend/tests/dashboardData.test.mjs \
  frontend/tests/learnerProfile.test.mjs \
  frontend/tests/messaging.test.mjs \
  frontend/tests/parentFeaturesAndNotifications.test.mjs \
  frontend/tests/phase2Activities.test.mjs \
  frontend/tests/phase3Analytics.test.mjs \
  frontend/tests/phase4ParentHod.test.mjs \
  frontend/tests/phase5Speech.test.mjs \
  frontend/tests/readingExperience.test.mjs \
  frontend/tests/voiceCapture.test.mjs

# From backend/ — backend tests
node --test --test-reporter=spec

# Frontend build
npm run build  # from frontend/
```

---

## 6. Outstanding Limitations

| Area | Limitation | Phase |
|---|---|---|
| Speech scoring | Browser STT is unverified; no validated reading accuracy score | Phase 5 (by design) |
| Speech provider retention | Cannot declare zero-retention without verifying each provider's config | Phase 5 (by design) |
| Lesedi engine tests | No automated Jest tests for `engine.js`, `guardrails.js`, `tierRules.js` | Planned Phase 6 follow-up |
| Maths CAPS source | Some maths activities use approximate CAPS refs — full page mapping pending | Phase 1 audit item |
| Grade 3 enrichment | `formatGate('3')` returns generic enrichment text; no Grade 3-specific CAPS activities seeded | Phase 2 follow-up |
| Parent note SMS truncation | Notes over 160 chars are flagged as WhatsApp — no auto-trim for SMS | Phase 4 (future) |
| HOD dashboard UI | `hodIntelligence.js` report is generated but no HOD-specific frontend screen yet | Phase 6 follow-up |
| Consent overdue emails | `consent_overdue` guardrail fires but no automated notification to teacher | Phase 6 follow-up |
| Multi-language support | Parent notes drafted in English only; translation is a future AI task | Phase 4 (future) |

---

## 7. Environment Configuration Reference

| Variable | Required for | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL store | — (must be set) |
| `USE_JSON_STORE` | Store selection | `true` (JSON) |
| `PROVIDER` | AI provider | `stub` |
| `AZURE_AI_ENDPOINT` | Azure AI | — |
| `AZURE_AI_KEY` | Azure AI | — |
| `LESEDI_MODEL` | AI model name | `claude-sonnet-4-5` |
| `LESEDI_CORE_MODE` | Backend evaluate mode | `mock` |
| `NODE_ENV` | Environment | `development` |
| `PORT` | HTTP server port | `4000` |
| `VITE_API_BASE` | Frontend API base URL | auto-detected |
