# Teacher Copilot — Pula (fresh PWA MVP)

A mobile-first, installable teacher reading companion inspired by the supplied UI screenshots and data-flow diagram.

## 🚀 Live Deployment

- **Vercel URL:** [https://pula-delta.vercel.app/](https://pula-delta.vercel.app/)

## Run locally (Node.js 20+ recommended)

```bash
cd teacher-copilot
npm install
npm run install:all
npm run dev
```

Open **http://localhost:5173**. The frontend proxies `/api` to the Express API at port 4000.

**Important:** Run these commands from the `teacher-copilot` folder (the one containing the root `package.json`).

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
