/**
 * azureAdapter.js
 * AI model adapter for Lesedi.
 *
 * Per-task token limits (override with LESEDI_MAX_TOKENS_<TASK> env var):
 *   gap_explanation, hod_insight  → 1500  (7-section structured output)
 *   teacher_activity, class_insight → 900
 *   parent_note                   → 400   (short, SMS-safe drafts)
 *   child_tutor (AI fallback)     → 300   (|||‑delimited three-part reply)
 *   guardrail                     → 500
 *   default                       → 800
 *
 * Global MAX_TOKENS env var still applies when no per-task var is set.
 */

// Per-task token budgets — conservative defaults that avoid truncation
const TASK_TOKEN_LIMITS = {
  gap_explanation:  1500,
  hod_insight:      1500,
  teacher_activity:  900,
  class_insight:     900,
  parent_note:       400,
  child_tutor:       300,
  guardrail:         500,
};

/**
 * Resolve the token limit for a task.
 * Checks LESEDI_MAX_TOKENS_<TASK> first, then MAX_TOKENS, then the table above.
 */
function resolveMaxTokens(task) {
  const taskKey = task?.toUpperCase().replace(/-/g, '_');
  const envKey  = taskKey ? `LESEDI_MAX_TOKENS_${taskKey}` : null;
  if (envKey && process.env[envKey]) return Number(process.env[envKey]);
  if (process.env.MAX_TOKENS)        return Number(process.env.MAX_TOKENS);
  return TASK_TOKEN_LIMITS[task] ?? 800;
}

// ---------------------------------------------------------------------------
// Lazy-load the Azure SDK so the server still starts when the package
// hasn't been installed yet (stub mode).
// ---------------------------------------------------------------------------
async function getAzureClient() {
  const { default: ModelClient, isUnexpected } = await import('@azure-rest/ai-inference');
  const { AzureKeyCredential }                 = await import('@azure/core-auth');
  return { ModelClient, isUnexpected, AzureKeyCredential };
}

// ---------------------------------------------------------------------------
// Azure provider
// ---------------------------------------------------------------------------
async function callAzure(system, user, task) {
  const endpoint  = process.env.AZURE_AI_ENDPOINT;
  const apiKey    = process.env.AZURE_AI_KEY;
  const model     = process.env.LESEDI_MODEL ?? 'claude-sonnet-4-5';
  const maxTokens = resolveMaxTokens(task);

  if (!endpoint || !apiKey) {
    throw new Error('AZURE_AI_ENDPOINT and AZURE_AI_KEY must be set in environment variables.');
  }

  const { ModelClient, isUnexpected, AzureKeyCredential } = await getAzureClient();
  const client = ModelClient(endpoint, new AzureKeyCredential(apiKey));

  const response = await client.path('/chat/completions').post({
    body: {
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
    },
  });

  if (isUnexpected(response)) {
    throw new Error(`Azure AI error ${response.status}: ${JSON.stringify(response.body)}`);
  }

  return response.body.choices[0].message.content.trim();
}

// ---------------------------------------------------------------------------
// Databricks stub — wire up when endpoint is confirmed
// ---------------------------------------------------------------------------
async function callDatabricks(system, user, task) {
  // TODO: Replace with real Databricks Model Serving endpoint when ready.
  void task; // reserved for per-task token limits once wired
  throw new Error('Databricks adapter is not yet configured. Set PROVIDER=azure or PROVIDER=stub.');
}

// ---------------------------------------------------------------------------
// Stub provider — returns deterministic text for local dev and tests
// ---------------------------------------------------------------------------
function callStub(system, user, task) {
  void task;
  console.warn('[Lesedi] Running in STUB mode — no real AI call made.');
  return Promise.resolve(
    `[STUB RESPONSE]\nSystem: ${system.slice(0, 60)}...\nUser: ${user.slice(0, 120)}...\n\nThis is a placeholder response. Set PROVIDER=azure and supply AZURE_AI_ENDPOINT + AZURE_AI_KEY to enable the real model.`
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Call the configured AI provider.
 * @param {string} system  System / preamble prompt
 * @param {string} user    User turn prompt
 * @param {string} [task]  Task name for per-task token budget (e.g. 'gap_explanation')
 * @returns {Promise<string>} The model's text response
 */
export async function callAI(system, user, task) {
  const provider = (process.env.PROVIDER ?? 'stub').toLowerCase();

  switch (provider) {
    case 'azure':       return callAzure(system, user, task);
    case 'databricks':  return callDatabricks(system, user, task);
    case 'stub':
    default:            return callStub(system, user, task);
  }
}

/**
 * Health check — confirms the adapter can reach the configured endpoint.
 * @returns {Promise<{ ok: boolean, provider: string, model: string, note?: string }>}
 */
export async function adapterHealth() {
  const provider = (process.env.PROVIDER ?? 'stub').toLowerCase();
  const model    = process.env.LESEDI_MODEL ?? 'claude-sonnet-4-5';

  if (provider === 'stub') {
    return { ok: true, provider: 'stub', model: 'none', note: 'Stub mode — no real calls made.' };
  }

  try {
    await callAI('ping', 'Reply with the single word: pong');
    return { ok: true, provider, model };
  } catch (err) {
    return { ok: false, provider, model, note: err.message };
  }
}
