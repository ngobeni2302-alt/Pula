# Whole-app enhancement validation — 4 November 2026

The current interface uses the original app role/profile picker. No login form, email/password requirement, separate secure-workspace panel or teacher password gate is rendered.

## Checked

- Frontend production build: passed.
- Combined existing regressions, shared backend modules and app-profile workflow: **104 tests passed**.
- Browser: landing → Teacher → Grade 2 opens directly without credentials.
- Browser: Teacher Home and guidelines use the PDF yellow/navy cards, mascot, resource badges and four group colours.
- Browser: Reading Time completes without a password; a pending review appears in the existing teacher dashboard; Approve and Send adds the edited update to the existing parent conversation and reviewed learner record.
- Browser: planner editing saves the schoolwork record; a parent note can be edited, saved as a draft, reopened and explicitly sent; the item then displays Parents told.
- Browser: opened conversation, Parent Home, Parent Progress, Parent Schoolwork, and HOD quality assurance all render and work.
- Browser: HOD Teachers tab can register a teacher with a generated ID without account/password setup.
- Browser console: no application errors in the complete screen/workflow run. Password inputs: zero.
- Existing inbox rendering markup matches the original Git version byte for byte. Conversation styling remains scoped to the opened conversation.
- Screenshots of landing, Teacher, guidelines, Activities, planner, open chat, Parent, Progress, Schoolwork and HOD were inspected at 390px mobile / 1280px HOD widths. Fixed inherited legacy main padding and suppressed intrusive toast previews for already-unread historical messages.

Commands:

```bash
npm --prefix frontend run build
node --test frontend/tests/*.test.mjs backend/tests/core.test.js
```

Screenshots and temporary browser tooling are under `/tmp/pula-reference` and `/tmp/pula-browser`, not committed. No real learner data was used. Historical PostgreSQL prototype checks are separate from this app enhancement and are not required to enter or use the interface.

The new app workflow tests verify all five games using original learner IDs without authentication requests, pending/private child feedback separation, approvals updating existing learner records, rejection, idempotent parent sending, and parent-approved summaries. Updated old appearance assertions to the actual PDF palette and parent progress layout.

Live Lesedi, verified phonics recordings, a custom speech-processing backend, WhatsApp, SMS and translation are not claimed as connected. Browser microphone recording and supported browser speech recognition are connected. See [LESEDI_CORE.md](LESEDI_CORE.md) for current behaviour and limitations. No commits or pushes were made.

## Microphone restoration

- All five games display the microphone action even when older learner records lack a separate voice-permission field.
- Teacher confirmation records guardian permission in the existing learner profile; browser microphone access is requested only after confirmation.
- Real MediaRecorder audio capture and playback were checked in Chrome with its synthetic microphone test device. The external speech-recognition response was mocked for deterministic final-transcript testing; no live recognition accuracy is claimed.
- The final transcript reaches teacher review even when I’m done is tapped during recording. It stays in memory only; raw audio is released on completion or navigation.
- Unit tests cover final-result flushing, duplicate stop calls, repeated result events, blocked permission, cancellation while permission is pending, repeated recording and reset, audio-only fallback, and transcript privacy in the original app workflow.
- Browser checks also passed for actionable blocked-permission feedback and recording/playback without a speech API. Captured synthetic audio decoded and played successfully.
- Build and 104 combined tests pass.
