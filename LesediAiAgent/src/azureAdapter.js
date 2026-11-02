/**
 * azureAdapter.js
 * AI model adapter for Lesedi.
 *
 * Current target : Azure AI — Claude Sonnet 3.5 (claude-sonnet-4-5) via the
 *                  Azure AI Inference SDK (@azure-rest/ai-inference).
 * Databricks stub : swap PROVIDER env var to 'databricks' and fill in the
 *                   Databricks section below when the endpoint is ready.
 *
 * Environment variables (set in .env or Azure App Service config):
 *   AZURE_AI_ENDPOINT   e.g. https://<your-resource>.services.ai.azure.com/models
 *   AZURE_AI_KEY        Your Azure AI Foundry API key
 *   LESEDI_MODEL        Model deployment name (default: claude-sonnet-4-5)
 *   PROVIDER            'azure' (default) | 'databricks' | 'stub'
 *   MAX_TOKENS          Response token limit (default: 600)
 */

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
async function callAzure(system, user) {
  const endpoint = process.env.AZURE_AI_ENDPOINT;
  const apiKey   = process.env.AZURE_AI_KEY;
  const model    = process.env.LESEDI_MODEL ?? 'claude-sonnet-4-5';
  const maxTokens = Number(process.env.MAX_TOKENS ?? 600);

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
async function callDatabricks(system, user) {
  // TODO: Replace with real Databricks Model Serving endpoint when ready.
  // Databricks exposes an OpenAI-compatible /chat/completions endpoint.
  //
  // const endpoint = process.env.DATABRICKS_ENDPOINT;  // e.g. https://<workspace>.azuredatabricks.net/serving-endpoints/<name>/invocations
  // const token    = process.env.DATABRICKS_TOKEN;
  //
  // const res = await fetch(`${endpoint}`, {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  //     max_tokens: Number(process.env.MAX_TOKENS ?? 600),
  //   }),
  // });
  // const data = await res.json();
  // return data.choices[0].message.content.trim();

  throw new Error('Databricks adapter is not yet configured. Set PROVIDER=azure or PROVIDER=stub.');
}

// ---------------------------------------------------------------------------
// Stub provider — returns deterministic text for local dev and tests
// ---------------------------------------------------------------------------
function callStub(system, user) {
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
 * @returns {Promise<string>} The model's text response
 */
export async function callAI(system, user) {
  const provider = (process.env.PROVIDER ?? 'stub').toLowerCase();

  switch (provider) {
    case 'azure':       return callAzure(system, user);
    case 'databricks':  return callDatabricks(system, user);
    case 'stub':
    default:            return callStub(system, user);
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
