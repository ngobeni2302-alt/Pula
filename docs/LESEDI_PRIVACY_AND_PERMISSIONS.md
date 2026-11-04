# Lesedi Privacy and Permissions

This document describes the privacy controls, consent model, and permission rules that govern all Lesedi AI processing.

## 1. POPIA Compliance

All Lesedi processing is governed by the South African Protection of Personal Information Act (POPIA). The following rules are enforced in code via `guardrails.js`.

### Consent Gate

| Rule | Code Location | Behaviour |
|---|---|---|
| No processing without consent | `guardrails.js` — `no_consent` policy | Blocks `child_hint`, `child_tutor`, `gap_explanation`, `parent_note`, `class_insight` when `learner.consent === false` |
| Consent overdue (> 2 weeks) | `guardrails.js` — `consent_overdue` policy | Blocks consent-gated tasks when `learner.consent == null` and `learner.weeksInSystem > 2` |
| No PII in requests | `guardrails.js` — `no_pii` policy | Blocks requests containing phone numbers (`+27`, `0[678]xxxxxxxx`) |

### Consent Scopes

The `guardian_consents` table supports per-scope consent:

| Scope | Meaning |
|---|---|
| `assessment` | Learner data can be used for assessment and tier placement |
| `voice` | Learner voice can be recorded and transcribed (microphone use) |
| `parent_messaging` | Parent can receive messages about the learner |

### Consent Lifecycle

```
1. Learner joins classroom → consent = null (unknown)
2. Teacher records guardian consent → consent = true
3. If consent is not recorded within 2 weeks → consent_overdue guardrail fires
4. If consent is explicitly denied → consent = false → no_consent guardrail fires
5. Consent can be withdrawn at any time → consent = false → all processing stops
```

## 2. Data Minimisation

| Principle | Implementation |
|---|---|
| First name only | Lesedi uses `learner.firstName` only. Surnames are never sent to the AI model. |
| No phone numbers | `no_pii` guardrail strips phone numbers from `requestText`. Parent notes are sent via the messaging system, never through the AI. |
| No raw audio persisted | `useVoiceCapture` keeps audio in memory only. `voice.discardAudio()` is called after session completion. |
| Speech transcript is transient | Browser speech transcripts are stored in `speechMemory` (a Map with max 50 entries) for the current app session only. They are never written to `localStorage` or the database. |
| Observations are structured | The AI receives structured observations (`{item, correct, of}`), not free-text teacher notes about children. |

## 3. Teacher Approval Flow

All Lesedi outputs that affect learners, parents, or tier placement require teacher approval:

| Output Type | Approval Required | Code Location |
|---|---|---|
| `teacher_activity` | Yes — teacher must review before use | `engine.js` — `TASKS_REQUIRE_APPROVAL` |
| `parent_note` | Yes — teacher must approve and send | `engine.js` — `TASKS_REQUIRE_APPROVAL` |
| `hod_insight` | Yes — HOD must review | `engine.js` — `TASKS_REQUIRE_APPROVAL` |
| `gap_explanation` | No — insight only, teacher decides | — |
| `class_insight` | No — insight only, teacher decides | — |
| `child_hint` | No — direct to child | — |
| `child_tutor` | Conditional — `parentTip` requires approval | `mathsBank.js` / `phraseBank.js` |
| `guardrail` | No — policy explanation | — |

### Approval API

```
PATCH /api/lesedi/outputs/:id/approve
Body: { action: "approved" | "rejected", editedText?: string }
```

On approval:
- `parent_note` outputs create a `parent_notes` draft (`status: 'to_review'`)
- `gap_explanation` outputs with `suggestedTier` write a `tier_history` evidence row
- An `audit_log` entry is written (PgStore mode)

## 4. Tier Change Permissions

| Action | Who Can Perform | How |
|---|---|---|
| Change reading tier | Teacher only | `POST /api/learners/:id/tier` — requires `group` and `reason` |
| Tier change audit | Automatic | Every change writes to `tier_history` with `previousTier`, `newTier`, `reason`, `changedBy`, `changedAt` |
| AI tier suggestion | Lesedi only | AI can suggest a tier in `gap_explanation` output, but it never directly changes a tier. Teacher must manually confirm. |

## 5. Voice and Microphone Permissions

| Rule | Implementation |
|---|---|
| Guardian consent required | `ActivitiesHub.jsx` shows a permission dialog. `coreApi('/learners/:id/voice-consent')` records consent. |
| Practice mode without consent | If `learner.consent` is false, the child can still play in practice mode (no microphone, no transcript, no assessment saved). |
| Browser speech recognition warning | The permission dialog warns that browser speech recognition may send voice to the browser's speech provider. |
| Audio is in-memory only | `useVoiceCapture` stores audio in a blob URL that is discarded after the activity. |
| Transcript is not persisted | Speech transcripts are kept in `speechMemory` (session-scoped Map) and never written to localStorage or the database. |

## 6. Role-Based Access

| Role | Can Access |
|---|---|
| Teacher | Own classroom only. Can create sessions, review drafts, approve/reject outputs, change tiers. |
| HOD | All classrooms in their grade band. Can view `hod_insight` outputs. Cannot directly change tiers. |
| Parent | Own child only. Can view approved assessments and parent notes. Cannot create sessions or review drafts. |

## 7. Guardrail Policy Sources

Every guardrail response includes a `policySource` tag so the teacher knows WHY a request was blocked:

| Source | Meaning | Example |
|---|---|---|
| `CAPS` | Direct CAPS curriculum requirement | "Grade R assessment is informal" |
| `POPIA` | South African law | "No consent recorded" |
| `PROJECT` | Internal Pula rule | "Too few observations to be fair" |
| `PEDAGOGY` | Teaching principle | "Don't give answers directly" |

## 8. Data Retention

| Data Type | Retention | Location |
|---|---|---|
| Activity sessions | Permanent | `activity_sessions` table |
| Observation items | Permanent | `observation_items` table |
| Lesedi outputs | Permanent (with status tracking) | `lesedi_outputs` table |
| Parent notes | Permanent (with status tracking) | `parent_notes` table |
| Speech transcripts | Session only | `speechMemory` Map (in-memory) |
| Raw audio | Session only | Blob URL in `useVoiceCapture` (discarded) |
| Audit log | Permanent | `audit_log` table (append-only) |
