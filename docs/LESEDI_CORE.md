# Pula app enhancement

The app opens directly to the Pula landing page and existing role/profile picker. There is **no email/password login, separate secure-workspace panel, or teacher password gate** in the interface.

## Run and review

```bash
npm ci
npm ci --prefix backend
npm ci --prefix frontend
npm --prefix frontend run build
node backend/src/server.js
```

Open **http://localhost:4000**. Choose **I'm a teacher**, then a grade; choose **I'm a parent** to follow a child, or **Head of Department** for quality assurance. No credentials or account seeding are required. `npm run dev` retains the original backend watch/frontend build-watch workflow.

## Enhanced screens

- **Landing:** original PDF illustration, Pula wordmark, tagline, navy Teacher action, yellow Parent action, outlined HOD action, and direct profile selection.
- **Teacher Home, Grades R–3:** Lesedi welcome, subject switch, yellow learning-round card, upcoming planner item, colourful weekly schoolwork, four distinct reading-group colours, guidelines, parent messages, grade plan and actual pending activity-draft count.
- **Activities:** one Activities navigation item. Maths offers Number Hunt and Count and Pick; English offers Rhyme Time, Sound It Out and Reading Time. The teacher chooses an existing class learner. Game screens use large targets, rounded choices, Lesedi feedback and celebrations. No password interrupts returning to class or changing learner.
- **Guidelines:** grade-specific navy focus card, numbered teaching steps, resource badges, expandable resource guides and the existing offline save action.
- **Learners:** search, tiers, academic records and editing remain available, with the shared cream/navy/card treatment.
- **Planner:** PDF-inspired schoolwork list, filters, add/edit items, parent-note drafts, explicit approval and sending through existing in-app conversations. The original full calendar remains available using Calendar view.
- **Parent Home:** child's reading group, reading history, upcoming teacher-created schoolwork, messages and home-learning tip.
- **Parent Progress:** reading-history line chart, group journey, sounds to practise, teacher tips and teacher-reviewed activity records. No pending drafts appear here.
- **Parent Schoolwork:** the same planner records, deadlines, completed work and optional calendar view.
- **Messages:** conversation list, search, contacts, previews, badges and group listing are unchanged. Opened conversations use the PDF bubble styling, language context, editable drafts, approved Lesedi suggestions with Add actions, parent quick replies and composer draft saving.
- **HOD:** quality assurance cards, class-performance bars, CAPS tracker, teacher logs, interventions, directives and calendar retain their existing behaviour. A Teachers tab lists profiles and registers a teacher with a generated ID, without adding account/password setup.

## Existing app data and activity reviews

The interface uses the original `pula_dashboards_v1` classroom/learner/planner records and `pula_messaging_v2` conversations. These records are preserved. New activity sessions and review drafts use `pula_activity_reviews_v1` on the same browser. Nothing needs to be imported into a second set of profiles.

`frontend/src/core/appWorkflow.js` connects game completion to the selected learner, the Home pending counter, teacher review and original parent conversations. Approval adds a reviewed activity record to that learner's existing profile. **Approve and Send** also adds the edited message to that learner's parent conversation. Repeated review calls do not duplicate the message. Planner parent-note sending uses the same messaging service and records Parents told only after the in-app send action succeeds.

`shared/activityCatalog.js` and `shared/activityEvidence.js` provide shared activity definitions and evidence handling to the existing backend and frontend. Choice-recognition percentages use actual first choices; reading and blending do not invent a pronunciation score. Raw audio is not stored. Analysis consent controls whether an assessment draft is recorded; without it, games offer unrecorded practice. Every game now has a visible microphone button. Tapping it lets the teacher record guardian permission, then requests browser microphone access. Actual audio is recorded in memory with a timer, Stop, replay and Start again. Speech-to-text runs where supported; audio recording and playback still work when the browser has no speech API. Completion waits for final speech results. Transcripts are available only in the teacher review during the open app session and are not copied into parent records or persistent storage. Voice capture requires recorded guardian permission and browser permission. Verified phoneme recordings are not supplied, so Sound It Out supports teacher modelling and word playback without claiming synthesized letter names are verified phonics sounds.

The earlier backend prototype and additive migration 007 remain as unmounted source modules alongside the original Lesedi module and database code. They do not add login routes or a login dependency to the running app. The original app API remains available. The current app-profile workflow uses the existing local persistence, matching the app's original architecture. A live Lesedi service is not claimed: local draft wording is based on game evidence and editable teaching templates. Configuring a live provider remains separate integration work.

## Limits

The original role picker and browser persistence are a demonstration, not authenticated production accounts. No live WhatsApp, SMS, translation, MTN zero-rating or external reporting is claimed. Browser speech recognition may use the browser vendor’s online service; microphone recording itself does not require that service. Existing learner histories are the application's sample records. Curriculum resources require review before a compliance claim. The enhanced UI does not replace real school data with fabricated production analytics.

## Modified areas

`WelcomeScreen.jsx` and its styles; `Dashboards.jsx`; `AppScreens.jsx`; `appEnhancements.css`; Activities and its styles; activity review/context services; opened-conversation styles and suggestions; HOD dashboard/styles; shared activity modules; browser regression and workflow tests. The original planner, learner and messaging services are reused.

No commits or pushes have been made. See [VALIDATION.md](VALIDATION.md) for the latest checks.
