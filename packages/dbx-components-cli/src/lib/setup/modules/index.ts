/**
 * Registry of the seven setup modules, keyed by id, plus the canonical id order.
 */

import { type SetupModule, type SetupModuleId } from '../module.js';
import { WORKSPACE_MODULE } from './workspace.module.js';
import { FIREBASE_COMPONENTS_MODULE } from './firebase-components.module.js';
import { APP_COMPONENTS_MODULE } from './app-components.module.js';
import { API_MODULE } from './api.module.js';
import { APP_MODULE } from './app.module.js';
import { ROOT_MODULE } from './root-config.module.js';
import { INTEGRATIONS_MODULE } from './integrations.module.js';

/**
 * Every setup module keyed by its id.
 */
export const SETUP_MODULES: Readonly<Record<SetupModuleId, SetupModule>> = {
  workspace: WORKSPACE_MODULE,
  'firebase-components': FIREBASE_COMPONENTS_MODULE,
  'app-components': APP_COMPONENTS_MODULE,
  api: API_MODULE,
  app: APP_MODULE,
  root: ROOT_MODULE,
  integrations: INTEGRATIONS_MODULE
};

/**
 * The module ids in canonical (per-module command + validation) order.
 */
export const SETUP_MODULE_IDS: readonly SetupModuleId[] = ['workspace', 'firebase-components', 'app-components', 'api', 'app', 'root', 'integrations'];

/**
 * The subset of module ids that produce scaffolded files (workspace produces none).
 */
export const SCAFFOLDING_MODULE_IDS: readonly SetupModuleId[] = ['firebase-components', 'app-components', 'api', 'app', 'root', 'integrations'];

export { WORKSPACE_MODULE, FIREBASE_COMPONENTS_MODULE, APP_COMPONENTS_MODULE, API_MODULE, APP_MODULE, ROOT_MODULE, INTEGRATIONS_MODULE };
