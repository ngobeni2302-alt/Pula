# Teacher Copilot — Pula (fresh PWA MVP)

A mobile-first, installable teacher reading companion inspired by the supplied UI screenshots and data-flow diagram.

## Phase 1 project structure

```text
Pula/
├── teacher/
│   ├── App.jsx
│   ├── style.css
│   └── services/
│       └── copilotStore.js
├── hod/
│   └── README.md
├── parent/
│   └── README.md
├── frontend/
│   ├── public/icon.png
│   ├── src/ (main.jsx, RoleEntry.jsx, roleEntry.css)
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json
│   ├── package.json
│   └── package-lock.json
├── backend/
│   ├── data.json
│   ├── src/server.js
│   ├── package.json
│   └── package-lock.json
├── package.json
├── package-lock.json
├── vercel.json
├── README.md
└── .gitignore
```

The root-level `teacher/` module contains the existing application, unchanged.
`frontend/src/main.jsx` mounts a three-way role selection screen. Teacher opens
the existing application, with a Switch role button to return. Parent and HOD
open coming-soon placeholders. This is role selection only; account authentication
and access control are not implemented.
The frontend retains Vite, public assets, and PWA configuration. Vite permits
access only to the frontend and Teacher directories and resolves the Teacher
module's packages from the frontend installation.

`hod/` and `parent/` contain documentation placeholders only. Their dashboards
and planned responsibilities will be developed in later phases.

The backend stays in `backend/`, with its existing API and JSON persistence.
Future integration will connect Teacher, HOD, and Parent to this shared backend
and a shared database through authorised access. Cross-role integration,
authentication and new shared services are not implemented.

## 🚀 Live Deployment

- **Vercel URL:** [https://pula-delta.vercel.app/](https://pula-delta.vercel.app/)

## Run locally (Node.js 20+ recommended)

```bash
cd Pula
npm install
npm run install:all
npm run dev
```

Open **http://localhost:5173**. The frontend proxies `/api` to the Express API at port 4000.

**Important:** Run these commands from the `Pula` folder (the one containing the root `package.json`).

## What's implemented

- Mobile-first screens: Pula welcome, class setup and demo class code, dashboard, reading selection, reading screen, completion, groups, activities, parent notes, learner management, assessment history.
- Working Express API and local JSON-file persistence in `backend/data.json` (created automatically on first write).
- Parent consent gate; learner editing and moving between four reading groups.
- Browser Web Speech API transcription **where supported**; manual transcript correction/fallback; word-match accuracy using longest common subsequence and rough words-per-minute estimate.
- Teacher approval before applying a suggested reading group.
- CAPS-inspired **editable activity templates**, not AI-generated or verified curriculum resources.
- Parent note drafts, editing and approval; **no actual SMS/WhatsApp sending**.
- Installable PWA manifest and offline caching of the frontend shell. API actions require a connection to the backend.

## Demo / privacy limitations

This is a **functional local demonstration MVP**, not a production-ready system for real learner records. Sample learners are fictional. Do not enter real child or parent information. There is **no authentication**, encryption-at-rest, multi-tenant access control, production-grade consent verification, certified speech scoring, AI service, or external school/MTN integration. Browser speech recognition may send audio to a browser vendor; do not use it with real children without appropriate safeguards and consent. Accuracy is an approximation of text overlap, not a validated literacy assessment. `backend/data.json` is not suitable for production.

The supplied designs specify that children should not see scores: the result card is labelled **Teacher-only assessment**, so the teacher should take the device back before viewing it. For a production implementation, separate teacher authentication and student-mode access controls are required.

## Next production steps

Add secure authentication/roles, a proper database, parental consent workflow, privacy controls, validated on-device or consented speech assessment, real CAPS content review, secure messaging provider and school-system integration.

## Build

```bash
npm run build
```

Vite writes production frontend assets to `frontend/dist`. Deploy frontend and backend together with appropriate HTTPS and API routing.

For a production-style local run after installing dependencies:

```bash
npm start
```

This builds the frontend and starts Express at **http://localhost:4000**, serving
both the production frontend and the existing API. To build only with dependencies
already installed, run `npm --prefix frontend run build`.

## Grade and role dashboards (November 2026)

The role entry now opens interactive Teacher, Parent and HOD dashboards in
`frontend/src/Dashboards.jsx`, styled in `frontend/src/dashboards.css`.
`frontend/src/dashboardData.js` seeds four independent classes (R–3), totalling
148 fictional learners. Choose a teacher or parent demo profile, or the HOD.

- Teachers see their grade's home, guidelines/resources, reading groups, manual
  reading assessments, planner and messaging hub. Lesedi uses editable template
  drafts. Whole-class, group and individual recipients are resolved within the
  selected class. Messages require explicit teacher approval.
- Parent Home, Progress, Schoolwork and Messages use the same device-local data.
  Groups are read-only. Switch profiles to follow a conversation or planner item.
- HOD has five working tabs, confidential observation records, editable lesson
  logs, intervention strategies/review dates, and directives with status updates.
- Saving guidelines offline stores the weekly plan and built-in teaching guides.
  The existing PWA caches the app shell after a production build; install/load it
  online first. No external downloadable curriculum files are bundled.
- The original speech-reading application remains accessible from Teacher Read
  as a separate legacy demo. Its existing records are preserved and are not
  merged into the new dashboard dataset.

New dashboard state uses `pula_dashboards_v1` in localStorage, with offline plans
under `pula_offline_plans`. It is not synced to the Express API. Data changes
survive reloads on the same browser. These are demo profiles, not authenticated
accounts: grade scoping and hidden observation UI do not enforce security.
Production authentication, server-side authorization, cross-device persistence,
live AI, WhatsApp/SMS providers and translation remain unconnected. All external
sending is explicitly simulated. Sample CAPS/ATP guidance needs curriculum review.

Validation:

```bash
node --test frontend/tests/dashboardData.test.mjs
npm --prefix frontend run build
```
