# Lesedi Test Plan

This document describes the testing strategy for the Lesedi AI Agent and its integration with the Pula platform.

## 1. Test Layers

| Layer | Runner | Location | Count |
|---|---|---|---|
| Frontend unit/integration | Node.js `--test` | `frontend/tests/*.test.mjs` | 87 |
| Backend integration | Node.js `--test` | `backend/tests/*.test.js` | 17 |
| Lesedi engine | Manual / Jest (planned) | `LesediAiAgent/tests/` | 0 (planned) |

## 2. Frontend Tests (87 tests, all passing)

### Activity and Draft Tests (`activities.test.mjs`)

| Test | Validates |
|---|---|
| Activities navigation entry consolidates reading and games | `Dashboards.jsx` has one `<ActivitiesHub` |
| Catalog contains exactly the five core games | 5 activities in `activityCatalog.js` |
| Subject filtering offers two maths and three English | 2 Maths + 3 English activities |
| Public catalog withholds answer keys | `publicActivity()` strips `answer` field |
| Number and rhyme scores derive from first choices | `evaluateEvidence()` scores 33% for 1/3 correct |
| Reading and blending participation does not invent scores | `evaluateEvidence()` returns `null` score for participation |
| All assigned rounds required | `evaluateEvidence()` throws on incomplete rounds |
| Child activity has no private review data | `ActivitiesHub.jsx` has no `onSaveAssessment`, `MediaRecorder`, or `teacher_private_draft_analytics` |
| Historical academic records remain intact | `getLearnerAcademicRecord()` returns existing assessments |
| Legacy Lesedi review generator available | `generateActivityLesediReview()` returns finding + whatToDo, no `recommendedTier` |

### AppWorkflow Tests (`appWorkflow.test.mjs`)

| Test | Validates |
|---|---|
| Teacher launches all five games with no auth | No `auth` URL in `requests[]` |
| Child feedback excludes drafts | `complete()` returns `{kiro_state_control, lesedi_avatar_output}` |
| Approve and Send uses existing conversation | Retries don't duplicate messages |
| Rejecting a draft preserves it | Draft status = `REJECTED`, no messages sent |
| Parent progress shows only approved assessments | `/progress` returns only approved items |
| Voice permission and speech capture | Transcript not persisted to localStorage |

### Calendar, Dashboard, Messaging, Reading Tests

These test suites (calendar.test.mjs, calendarLayout.test.mjs, dashboardColors.test.mjs, dashboardData.test.mjs, learnerProfile.test.mjs, messaging.test.mjs, parentFeaturesAndNotifications.test.mjs, readingExperience.test.mjs) cover the broader Pula platform and all pass.

## 3. Backend Tests (17 tests, all passing)

| Test | Validates |
|---|---|
| Reading completion yields child fields and pending draft | Session → draft flow |
| All five activities validate real evidence and complete | Activity catalog + evidence evaluation |
| Objective scores reflect actual first choices | Score = correct/total, not fixed percentage |
| Editing and Approve and Send publishes once | Draft review → message send (idempotent) |
| Approval without send publishes no notification | `approve` action ≠ `approve-send` |
| Rejected drafts retained without notification | Rejected drafts visible but not sent |
| Missing authentication, parent drafts denied | Role-based access control |
| Learner and classroom IDs cannot be forged | Server validates IDs, not client |
| Duplicate completion creates one draft | Idempotency on session completion |
| Unauthorized child token rejected | `childToken` validation |
| Unconsented speech rejected | Voice consent gate |
| Stale edits cannot overwrite reviewed records | Version-based optimistic locking |
| Provider schema rejects malformed responses | Azure adapter validation |
| HOD registration generates unique teacher IDs | User management |
| Logout invalidates server-side session | Session management |
| Tier changes require separate explicit action | Tier change is not automatic on approval |
| Provider failure leaves no partial draft | Error handling — no orphaned records |
| Retention expires final detail text | Data retention policy |

## 4. Lesedi Engine Tests (Planned)

The following tests should be created in `LesediAiAgent/tests/` to validate the AI engine directly:

### Guardrail Tests

| Test | Validates |
|---|---|
| No consent blocks consent-gated tasks | `checkGuardrails()` returns `blocked: true` with `no_consent` policy |
| Consent overdue fires after 2 weeks | `checkGuardrails()` returns `blocked: true` with `consent_overdue` policy |
| Grade R test request blocked | `checkGuardrails()` blocks with `grade_r_no_test` or `no_maths_test_grade_r` |
| Phone number in request blocked | `checkGuardrails()` blocks with `no_pii` policy |
| Insufficient evidence blocks gap explanation | `checkGuardrails()` blocks with `insufficient_evidence` when observations < 3 |
| Reading group placement without evidence blocked | `checkGuardrails()` blocks with `no_reading_groups_without_evidence` |

### Tier Rule Tests

| Test | Validates |
|---|---|
| formatGate('R') returns R_to_1 gate | Progression gate text contains "Grade R → Grade 1" |
| formatGate('1') returns 1_to_2 gate | Progression gate text contains "Grade 1 → Grade 2" |
| formatGate('2') returns 2_to_3 gate | Progression gate text contains "Grade 2 → Grade 3" |
| formatGate('3') returns Grade 3 enrichment context | Not empty string; contains "Foundation Phase" |
| isSeedCritical fires at 4 weeks | `isSeedCritical('Seed', 4)` returns true |
| isStagnant fires at 6 weeks | `isStagnant(6)` returns true |

### Phrase Bank Tests

| Test | Validates |
|---|---|
| Literacy hint L3 includes worked example | `resolveChildPhrase(3, 'default', 'Thando')` text contains different word |
| Maths hint L3 includes retry invitation | `resolveMathsChildPhrase(3, 'default', 'Thando')` text contains "try" |
| Praise phrase returns correct text | `PRAISE_PHRASES.correct('Thando')` returns praise text |
| Maths praise returns correct text | `MATHS_PRAISE_PHRASES.correct('Thando')` returns maths praise |

### Engine Routing Tests

| Test | Validates |
|---|---|
| child_hint routes to mathsBank when subject=maths | Response `source` = `maths_bank` |
| child_hint routes to phraseBank when subject=literacy | Response `source` = `phrase_bank` |
| child_tutor still_using_fingers_gr3 only fires for Grade 3 | Grade 1 with this event falls through to AI or default |
| Unknown task returns engine_error | Response `source` = `engine_error` |
| Per-task token limits applied | `resolveMaxTokens('gap_explanation')` returns 1500 |

### Azure Adapter Tests

| Test | Validates |
|---|---|
| Stub mode returns placeholder | `callAI()` in stub mode returns `[STUB RESPONSE]` |
| Per-task token override via env var | `LESEDI_MAX_TOKENS_PARENT_NOTE=200` overrides table default |
| Global MAX_TOKENS override | `MAX_TOKENS=1000` overrides all tasks without per-task var |
| Health check in stub mode returns ok | `adapterHealth()` returns `{ok: true, provider: 'stub'}` |

## 5. Build Verification

### Commands

| Command | Expected Result |
|---|---|
| `npm run build` (frontend) | Vite build succeeds, PWA generated |
| `node --test frontend/tests/*.test.mjs` | 87 tests pass, 0 fail |
| `node --test backend/tests/*.test.js` | 17 tests pass, 0 fail |

### Current Status (Phase 1)

```
Frontend:  87/87 tests passing  ✓
Backend:   17/17 tests passing  ✓
Build:     Clean                ✓
```

## 6. Integration Test Scenarios (Manual)

### Scenario 1: Activity Session with Lesedi Enrichment

1. Open the teacher profile (Grade 2)
2. Launch an activity (e.g. Reading Time)
3. Complete the activity
4. Open the ReviewPanel (Lesedi drafts)
5. Click "Ask Lesedi for analysis"
6. Verify: draft fields update with AI-generated text (if backend is running)
7. Verify: draft fields remain unchanged if backend is unreachable
8. Edit the draft and approve

### Scenario 2: Parent Note Generation

1. Open the teacher dashboard (teacher/App.jsx)
2. Complete a reading assessment
3. Verify: Lesedi parent note card appears on celebration screen
4. Click "Approve and send"
5. Verify: note is sent to the parent conversation

### Scenario 3: Guardrail Block

1. Send a `POST /api/lesedi` request with `learner.consent = false` and `task = 'gap_explanation'`
2. Verify: response has `source: 'guardrail'`, `policy: 'no_consent'`, `policySource: 'POPIA'`

### Scenario 4: Consent Overdue

1. Send a `POST /api/lesedi` request with `learner.consent = null`, `learner.weeksInSystem = 3`, `task = 'gap_explanation'`
2. Verify: response has `source: 'guardrail'`, `policy: 'consent_overdue'`, `policySource: 'PROJECT'`
