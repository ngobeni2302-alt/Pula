# Lesedi Data Contracts

This document defines the data contracts between Lesedi AI, the backend API, and the frontend consumers.

## 1. POST /api/lesedi — Request Contract

### Request Body

```json
{
  "task": "gap_explanation",
  "subject": "English | Mathematics",
  "grade": "R | 1 | 2 | 3",
  "term": 1,
  "language": "English",
  "learner": {
    "ref": "learner-uuid-or-id",
    "firstName": "Thando",
    "group": "Seed | Sprout | Bloom | Tree",
    "consent": true,
    "weeksInTier": 3,
    "weeksInSystem": 5,
    "dbeCode": 5,
    "observations": [
      { "item": "Sound Hunt", "correct": 8, "of": 10 },
      { "item": "Blend a Word", "correct": 5, "of": 8 },
      { "item": "Talk & Turn", "result": "participated" }
    ],
    "termProgress": [
      { "term": 1, "wpm": 18, "accuracy": 72 },
      { "term": 2, "wpm": 24, "accuracy": 80 }
    ],
    "checkInNote": "Teacher free-text note",
    "soundsToPractise": ["sh", "ch"],
    "mathsSkillsToWork": ["bridging through 10"]
  },
  "classroom": {
    "name": "Grade 2 — Mrs Khumalo",
    "tierCounts": { "Seed": 3, "Sprout": 8, "Bloom": 4, "Tree": 1 },
    "noConsent": 2,
    "learners": 16,
    "seedProgress": [{ "wpmChange": 6 }],
    "soundsToPractise": { "sh": 5, "ch": 3 },
    "mathsSkillGaps": { "bridging": 6, "place_value": 2 }
  },
  "weeks": 4,
  "hintLevel": 2,
  "event": "no_response",
  "target": "addition",
  "errorPattern": "counts all from 1",
  "sessions": 3,
  "channel": "WhatsApp | SMS",
  "maxChars": 160,
  "focus": "blending CVC words",
  "minutes": 15,
  "groupSize": 6,
  "tier": "Sprout",
  "soundsLearnt": ["s", "a", "t", "p", "i", "n"],
  "mathsConcept": "number bonds to 10",
  "requestText": "Teacher's raw typed question"
}
```

### Task-Specific Required Fields

| Task | Required Fields |
|---|---|
| `child_hint` | `hintLevel`, `event`, `learner.firstName`, `subject` |
| `child_tutor` | `event`, `learner.firstName`, `subject`, `grade` |
| `teacher_activity` | `grade`, `term`, `subject`, `focus` or `mathsConcept` |
| `class_insight` | `grade`, `term`, `subject`, `classroom` |
| `gap_explanation` | `grade`, `term`, `subject`, `learner` with `observations` |
| `hod_insight` | `grade`, `term`, `subject`, `classroom`, optional `learner` |
| `parent_note` | `grade`, `term`, `subject`, `learner`, `channel` |
| `guardrail` | `grade`, `subject`, `requestText` |

## 2. POST /api/lesedi — Response Contract

### Standard Response

```json
{
  "ok": true,
  "text": "Thando: [summary]. What the data shows: ... Why they are in [tier]: ...",
  "source": "ai_model | phrase_bank | maths_bank | guardrail | engine_error",
  "requiresApproval": true,
  "tags": ["teacher_approval_required", "caps_aligned", "English"],
  "handoff": false,
  "teacherFlag": "Optional flag for teacher dashboard",
  "parentTip": "Optional parent tip draft",
  "confidence": "low | medium | medium-high | high",
  "lesediOutputId": "uuid-of-persisted-output",
  "capsRef": "CAPS HL Gr 1 p.56",
  "policySource": "CAPS | POPIA | PROJECT | PEDAGOGY"
}
```

### Guardrail Block Response

```json
{
  "ok": true,
  "text": "Policy refusal text explaining why the request cannot be fulfilled.",
  "source": "guardrail",
  "requiresApproval": false,
  "tags": ["consent_required", "no_processing_without_consent", "teacher_approval_required"],
  "handoff": false,
  "capsRef": null,
  "policySource": "POPIA"
}
```

### Error Response

```json
{
  "ok": false,
  "error": "Unknown task type: 'invalid_task'. Supported: ..."
}
```

## 3. POST /api/activity-sessions — Request Contract

```json
{
  "id": "client-generated-uuid",
  "learnerId": "learner-uuid",
  "activityId": "sound-hunt",
  "subject": "English | Mathematics",
  "term": 4,
  "academicYear": 2026,
  "score": 8,
  "maxScore": 10,
  "hintsUsed": 2,
  "attempts": 3,
  "completedAt": "2026-11-04T12:00:00.000Z",
  "stepData": {
    "correct": 8,
    "total": 10,
    "attempts": 3,
    "hintsUsed": 2
  }
}
```

### Response

```json
{
  "ok": true,
  "session": {
    "id": "uuid",
    "learnerId": "learner-uuid",
    "activityId": "sound-hunt",
    "score": 8,
    "maxScore": 10,
    "createdAt": "2026-11-04T12:00:00.000Z"
  },
  "observations": [
    {
      "skill": "phonological awareness — initial sound recognition",
      "item": "identifies the target sound across saying, finding and reading stages",
      "result": "DEMONSTRATED",
      "capsRef": "CAPS HL Gr R p.34; CAPS HL Gr 1 p.56"
    }
  ]
}
```

## 4. PATCH /api/lesedi/outputs/:id/approve — Request Contract

```json
{
  "action": "approved | rejected",
  "editedText": "Optional edited output text",
  "editedOutput": { "optional": "edited JSON output" }
}
```

### Response

```json
{
  "ok": true,
  "output": {
    "id": "uuid",
    "task": "gap_explanation | parent_note | ...",
    "status": "approved | rejected",
    "approvedBy": "teacher-uuid",
    "approvedAt": "2026-11-04T12:00:00.000Z",
    "teacherEdited": true,
    "learnerId": "learner-uuid",
    "subject": "English",
    "output": { "text": "...", "suggestedTier": "Sprout" }
  }
}
```

### Side Effects on Approval

| Output Task | Side Effect |
|---|---|
| `parent_note` | Creates a `parent_notes` row with `status: 'to_review'` |
| `gap_explanation` with `suggestedTier` | Writes a `tier_history` row (evidence only, not a final change) |
| Any task | Writes an `audit_log` entry (PgStore mode only) |

## 5. GET /api/lesedi/outputs — Query Parameters

| Parameter | Type | Purpose |
|---|---|---|
| `classroomId` | UUID | Filter by classroom |
| `learnerId` | UUID | Filter by learner |
| `status` | string | Filter by status: `draft`, `approved`, `rejected` |
| `task` | string | Filter by task type |

## 6. Database Tables (Lesedi-Related)

| Table | Migration | Purpose |
|---|---|---|
| `activities` | 003 | Activity library (seeded in 007) |
| `activity_skill_map` | 003 | Activity → skill mapping (seeded in 007) |
| `activity_sessions` | 003 | Session results with consent gate + idempotency |
| `observation_items` | 002 | Structured evidence from sessions |
| `lesedi_outputs` | 004 | All AI drafts with status tracking |
| `parent_notes` | 004 | Drafts + approval queue |
| `tier_history` | 002 | Subject-specific tier changes (audit trail) |
| `audit_log` | 001 | Append-only change trail |
| `guardian_consents` | 001 | POPIA consent per scope |
| `intervention_log` | 004 | Teacher interventions |

## 7. Observation Result Levels

The spec requires these result levels for `observation_items`:

| Level | Meaning |
|---|---|
| `DEMONSTRATED` | Child completed independently |
| `DEVELOPING` | Child completed with hints or support |
| `NEEDS_FURTHER_PRACTICE` | Child attempted but did not complete |
| `INSUFFICIENT_EVIDENCE` | No valid evidence captured |
| `TEACHER_REVIEW_REQUIRED` | Anomaly or unexpected result |

Currently the `POST /api/activity-sessions` endpoint maps scores to `on_own` / `with_help` / `not_yet`. The migration to the spec's five levels is a Phase 2 task.
