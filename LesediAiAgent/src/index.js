/**
 * LesediAiAgent/src/index.js
 *
 * Lesedi agent module — mounts on the main Pula backend (port 4000).
 * Import this file from backend/src/server.js and call mountLesedi(app).
 *
 * Routes added to the Express app:
 *   POST /api/lesedi          — main inference endpoint
 *   GET  /api/lesedi/health   — adapter + guardrail health check
 */

import { runLesedi } from './engine.js';
import { adapterHealth } from './azureAdapter.js';

const must = (cond, msg) => { if (!cond) throw new Error(msg); };

/**
 * Mount all Lesedi routes onto an existing Express app.
 * Called once from backend/src/server.js.
 *
 * @param {import('express').Application} app
 * @param {{ saveNote?: (learnerId: string, text: string) => void }} [opts]
 *   Optional callbacks for in-process side effects.
 *   saveNote: called when Lesedi produces a draft that requires approval,
 *             so server.js can persist it to the DB without an HTTP round-trip.
 */
export function mountLesedi(app, opts = {}) {
  const { saveNote } = opts;

  // ------------------------------------------------------------------
  // POST /api/lesedi
  // Accepts the context object defined in the dataset v3 contract and
  // returns Lesedi's response (draft text + metadata).
  //
  // Required body fields:
  //   task     {string}  child_hint | child_tutor | teacher_activity | class_insight |
  //                      gap_explanation | hod_insight | parent_note | guardrail
  //   grade    {string}  'R' | '1' | '2' | '3'
  //   term     {number}  1–4
  //   language {string}  e.g. 'English'
  //
  // Optional body fields (vary by task):
  //   subject       {string}    'literacy' | 'maths'
  //   learner       {object}    ref, firstName, group, consent, termProgress,
  //                             observations, checkInNote, soundsToPractise,
  //                             weeksInTier, dbeCode, sessions
  //   classroom     {object}    name, tierCounts, seedProgress, noConsent,
  //                             learners, soundsToPractise (for class/HOD tasks)
  //   hintLevel     {number}    1 | 2 | 3 (child_hint)
  //   event         {string}    event key from phraseBank (child_hint / child_tutor)
  //   target        {string}    target skill or letter (child_hint / child_tutor)
  //   errorPattern  {string}    e.g. 'says d for b' (child_tutor)
  //   setting       {string}    e.g. 'one_to_one_with_Lesedi' (child_tutor)
  //   focus         {string}    activity focus (teacher_activity)
  //   minutes       {number}    duration (teacher_activity)
  //   groupSize     {number}    (teacher_activity)
  //   soundsLearnt  {string[]}  (teacher_activity)
  //   channel       {string}    'WhatsApp' | 'SMS' (parent_note)
  //   maxChars      {number}    160 for SMS (parent_note)
  //   requestText   {string}    raw teacher input, used in guardrails
  //   observations  {array}     used in guardrail checks
  //   learnerId     {string}    used by saveNote callback
  //   weeks         {number}    observation window (gap_explanation)
  // ------------------------------------------------------------------
  app.post('/api/lesedi', async (req, res) => {
    try {
      const body = req.body ?? {};

      // Basic validation
      must(body.task,   'body.task is required (child_hint | child_tutor | teacher_activity | class_insight | gap_explanation | hod_insight | parent_note | guardrail)');
      must(body.grade !== undefined, 'body.grade is required (R | 1 | 2 | 3)');
      must(body.term !== undefined,  'body.term is required (1–4)');

      // Consent is checked inside the engine/guardrails, but we surface
      // a clear error early if the field is present and explicitly false.
      if (body.learner && body.learner.consent === false && body.task !== 'guardrail') {
        return res.status(403).json({
          error:  'consent_required',
          text:   "This learner's parent consent is not yet recorded. No data can be processed.",
          source: 'guardrail',
        });
      }

      const result = await runLesedi(body);

      // Persist draft notes via the injected saveNote callback (no HTTP round-trip).
      if (result.requiresApproval && body.learnerId && typeof saveNote === 'function') {
        try { saveNote(body.learnerId, result.text); } catch { /* non-fatal */ }
      }

      return res.json({
        ok:               true,
        task:             body.task,
        grade:            body.grade,
        term:             body.term,
        learnerRef:       body.learner?.ref ?? null,
        ...result,
      });

    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // GET /api/lesedi/health
  // Returns the adapter status + environment summary (no secrets).
  // ------------------------------------------------------------------
  app.get('/api/lesedi/health', async (_req, res) => {
    const adapter = await adapterHealth();
    res.json({
      ok:               adapter.ok,
      agent:    'Lesedi',
      version:  '2.0.0',
      provider: adapter.provider,
      model:    adapter.model,
      note:     adapter.note ?? null,
      port:     4000,
      env: {
        PROVIDER:      process.env.PROVIDER      ?? 'stub',
        LESEDI_MODEL:  process.env.LESEDI_MODEL  ?? 'claude-sonnet-4-5',
        AZURE_ENDPOINT_SET: !!process.env.AZURE_AI_ENDPOINT,
        AZURE_KEY_SET:      !!process.env.AZURE_AI_KEY,
      },
    });
  });

  console.log('[Lesedi] Routes mounted: POST /api/lesedi  GET /api/lesedi/health');
}
