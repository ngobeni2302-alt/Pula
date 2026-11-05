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
import { resolveScaffold, getSessionSummary, clearSession } from './scaffoldingEngine.js';
import { evaluateObservation } from './evaluationEngine.js';
import { aggregateLearnerEvidence, aggregateClassEvidence } from './analyticsEngine.js';
import { draftParentNote, draftTermReport, draftParentResponse } from './parentCopilot.js';
import { generateHodReport } from './hodIntelligence.js';
import { processSpeechEvidence, assessSpeechConfidence, SPEECH_CONFIDENCE } from './speechIntelligence.js';
import { getActivityDefinition, OBSERVATION_LEVELS } from '../../shared/activityDefinitions.js';

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

      // Normalize subject field: 'Mathematics' | 'English' → 'maths' | 'literacy'
      if (body.subject) {
        if (body.subject === 'Mathematics') body.subject = 'maths';
        else if (body.subject === 'English') body.subject = 'literacy';
        else if (!['maths', 'literacy'].includes(body.subject)) {
          return res.status(400).json({ ok: false, error: 'body.subject must be "Mathematics", "English", "maths", or "literacy"' });
        }
      }

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
  // POST /api/lesedi/scaffold
  // Real-time hint during gameplay. Called by the frontend when a child
  // needs a hint during an activity round.
  //
  // Required body fields:
  //   sessionId      {string}  — unique session identifier (assignment UUID)
  //   roundIndex     {number}  — 0-based round number
  //   activityId     {string}  — e.g. 'number-hunt'
  //   observedEvent  {string}  — 'correct' | 'no_response' | 'wrong_selection' | 'stuck_on_word' | etc.
  //   firstName     {string}  — child's first name
  //
  // Optional body fields:
  //   learnerId          {string}
  //   curriculumSkillId {string}
  //   subject           {string}  'English' | 'Mathematics'
  //
  // Returns:
  //   { ok, text, hintLevel, handoff, source, praise }
  // ------------------------------------------------------------------
  app.post('/api/lesedi/scaffold', async (req, res) => {
    try {
      const body = req.body ?? {};
      must(body.sessionId,     'body.sessionId is required');
      must(body.activityId,    'body.activityId is required');
      must(body.observedEvent, 'body.observedEvent is required');
      must(body.firstName,     'body.firstName is required');

      const result = resolveScaffold({
        sessionId:          body.sessionId,
        roundIndex:         body.roundIndex ?? 0,
        activityId:          body.activityId,
        learnerId:           body.learnerId ?? 'anonymous',
        curriculumSkillId:  body.curriculumSkillId ?? getActivityDefinition(body.activityId)?.curriculumSkillId,
        observedEvent:       body.observedEvent,
        firstName:           body.firstName,
        subject:             body.subject ?? getActivityDefinition(body.activityId)?.subject ?? 'English',
      });

      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/lesedi/evaluate
  // Evaluate a completed session and return the observation level.
  // Called by the frontend after a session completes (or by the draft
  // enrichment flow) to determine what level the child is at.
  //
  // Required body fields:
  //   activityId   {string}
  //   score        {number|null}  percentage 0-100, or null for participation
  //   total        {number}       total scored rounds
  //   correct      {number}       correct first choices
  //   sessionId    {string}       for scaffolding summary lookup
  //
  // Returns:
  //   { ok, level, reason, evidence, confidence }
  // ------------------------------------------------------------------
  app.post('/api/lesedi/evaluate', async (req, res) => {
    try {
      const body = req.body ?? {};
      must(body.activityId, 'body.activityId is required');

      const sessionSummary = body.sessionId
        ? getSessionSummary(body.sessionId)
        : null;

      const result = evaluateObservation({
        activityId:         body.activityId,
        score:              body.score ?? null,
        total:              body.total ?? 0,
        correct:            body.correct ?? 0,
        transcriptAvailable: body.transcriptAvailable ?? false,
        recordingCaptured:   body.recordingCaptured ?? false,
        sessionSummary,
      });

      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // DELETE /api/lesedi/scaffold/:sessionId
  // Clear scaffolding state for a completed session.
  // ------------------------------------------------------------------
  app.delete('/api/lesedi/scaffold/:sessionId', (req, res) => {
    clearSession(req.params.sessionId);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // POST /api/lesedi/analytics
  // Aggregate evidence across sessions for a single learner.
  // Returns structured analytics: skill groups, patterns, gaps, strengths.
  //
  // Required body fields:
  //   learnerId   {string}
  //   learnerName {string}
  //   subject     {string}  'English' | 'Mathematics'
  //   grade       {string}  'R' | '1' | '2' | '3'
  //   sessions    {array}   session objects with activityId, score, total,
  //                         correct, transcriptAvailable, hintsUsed,
  //                         maxHintLevel, selfCorrections, createdAt
  // ------------------------------------------------------------------
  app.post('/api/lesedi/analytics', (req, res) => {
    try {
      const body = req.body ?? {};
      must(body.learnerId, 'body.learnerId is required');
      must(body.sessions, 'body.sessions is required (array of session results)');

      const result = aggregateLearnerEvidence({
        learnerId:   body.learnerId,
        learnerName: body.learnerName ?? 'Learner',
        subject:     body.subject ?? 'English',
        grade:       body.grade ?? '2',
        sessions:    body.sessions,
      });

      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/lesedi/class-analytics
  // Aggregate evidence across all learners in a class.
  // Returns: tier distribution, common skill gaps, teaching recommendations.
  //
  // Required body fields:
  //   grade         {string}
  //   subject       {string}
  //   classroomName {string}
  //   learners      {array}  array of learner analytics objects (from /analytics)
  // ------------------------------------------------------------------
  app.post('/api/lesedi/class-analytics', (req, res) => {
    try {
      const body = req.body ?? {};
      must(body.grade, 'body.grade is required');
      must(body.learners, 'body.learners is required (array of learner analytics)');

      const result = aggregateClassEvidence({
        grade:         body.grade,
        subject:       body.subject ?? 'English',
        classroomName: body.classroomName ?? `Grade ${body.grade}`,
        learners:      body.learners,
      });

      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/lesedi/parent-report
  // Draft a term progress report for a learner using analytics.
  //
  // Required body fields:
  //   learnerName, subject, grade, term
  //   analytics — output from aggregateLearnerEvidence (or raw sessions to aggregate)
  // Optional: sessions (array) — if analytics not provided, will aggregate
  // Optional: type — 'note' (default) | 'term_report' | 'response'
  // Optional: parentQuestion — for type 'response'
  // Optional: teacherName
  // ------------------------------------------------------------------
  app.post('/api/lesedi/parent-report', (req, res) => {
    try {
      const body = req.body ?? {};
      must(body.learnerName, 'body.learnerName is required');
      must(body.subject, 'body.subject is required');

      const type = body.type ?? 'note';

      if (type === 'term_report') {
        // Aggregate sessions if analytics not provided
        let analytics = body.analytics;
        if (!analytics && body.sessions) {
          analytics = aggregateLearnerEvidence({
            learnerId: body.learnerId ?? 'auto',
            learnerName: body.learnerName,
            subject: body.subject,
            grade: body.grade ?? '2',
            sessions: body.sessions,
          });
        }
        const result = draftTermReport({
          learnerName: body.learnerName,
          subject: body.subject,
          grade: body.grade ?? '2',
          term: body.term ?? 4,
          analytics: analytics ?? { totalSessions: 0, strengths: [], skillGaps: [], observationPeriod: {} },
          teacherName: body.teacherName,
        });
        return res.json({ ok: true, ...result });
      }

      if (type === 'response') {
        must(body.parentQuestion, 'body.parentQuestion is required for type "response"');
        const result = draftParentResponse({
          learnerName: body.learnerName,
          parentQuestion: body.parentQuestion,
          analytics: body.analytics ?? null,
          subject: body.subject,
        });
        return res.json({ ok: true, ...result });
      }

      // Default: single session note
      const result = draftParentNote({
        learnerName: body.learnerName,
        activityName: body.activityName ?? 'activity',
        subject: body.subject,
        score: body.score ?? null,
        total: body.total ?? 0,
        correct: body.correct ?? 0,
        observationLevel: body.observationLevel ?? null,
        curriculumSkillId: body.curriculumSkillId ?? null,
        transcriptAvailable: body.transcriptAvailable ?? false,
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/lesedi/hod-qa
  // Generate an HOD quality assurance report for a grade and subject.
  //
  // Required body fields:
  //   grade, subject
  //   classAnalytics — array of class analytics objects (from /class-analytics)
  // Optional: context, interventionLog, consentStats
  // ------------------------------------------------------------------
  app.post('/api/lesedi/hod-qa', (req, res) => {
    try {
      const body = req.body ?? {};
      must(body.grade, 'body.grade is required');
      must(body.subject, 'body.subject is required');

      const result = generateHodReport({
        grade: body.grade,
        subject: body.subject,
        classAnalytics: body.classAnalytics ?? [],
        context: body.context ?? {},
        interventionLog: body.interventionLog ?? [],
        consentStats: body.consentStats ?? null,
      });

      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/lesedi/speech-evaluate
  // Process speech evidence with consent validation and privacy controls.
  // Never persists raw audio or transcripts.
  //
  // Required body fields:
  //   consent          — boolean (learner has general consent)
  //   expectedText     — text the child was supposed to read/say
  // Optional body fields:
  //   voiceConsent     — boolean (learner has voice consent)
  //   transcript       — speech-to-text transcript
  //   durationSeconds  — recording duration
  //   recordingCaptured — was audio captured?
  //   activityId       — which activity
  //   subject           — 'English' | 'Mathematics'
  // ------------------------------------------------------------------
  app.post('/api/lesedi/speech-evaluate', (req, res) => {
    try {
      const body = req.body ?? {};
      must(body.consent !== undefined, 'body.consent is required (boolean)');

      const result = processSpeechEvidence({
        consent:           body.consent === true,
        voiceConsent:      body.voiceConsent === true,
        expectedText:      body.expectedText ?? '',
        transcript:         body.transcript ?? '',
        durationSeconds:   body.durationSeconds ?? 0,
        recordingCaptured: body.recordingCaptured ?? false,
        activityId:         body.activityId ?? null,
        subject:            body.subject ?? 'English',
      });

      return res.json({ ok: true, ...result });
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

  console.log('[Lesedi] Routes mounted: POST /api/lesedi  POST /api/lesedi/scaffold  POST /api/lesedi/evaluate  POST /api/lesedi/analytics  POST /api/lesedi/class-analytics  POST /api/lesedi/parent-report  POST /api/lesedi/hod-qa  POST /api/lesedi/speech-evaluate  GET /api/lesedi/health');
}
