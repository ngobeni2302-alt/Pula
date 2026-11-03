/**
 * store/index.js
 * Returns the correct store based on the USE_JSON_STORE environment flag.
 *
 *   USE_JSON_STORE=true  → JsonStore  (data.json, demo/offline mode)
 *   USE_JSON_STORE=false → PgStore    (PostgreSQL)
 *
 * Usage:
 *   import { getStore } from '../store/index.js';
 *   const store = getStore();
 *   const learners = await store.getLearners(classroomId);
 */

import { JsonStore } from './JsonStore.js';
import { PgStore   } from './PgStore.js';

let _store = null;

export function getStore() {
  if (!_store) {
    const useJson = (process.env.USE_JSON_STORE ?? 'true').toLowerCase() === 'true';
    _store = useJson ? new JsonStore() : new PgStore();
    console.log(`[store] Using ${useJson ? 'JsonStore (data.json)' : 'PgStore (PostgreSQL)'}`);
  }
  return _store;
}

/** Reset the singleton — used in tests to switch between stores. */
export function resetStore() {
  _store = null;
}
