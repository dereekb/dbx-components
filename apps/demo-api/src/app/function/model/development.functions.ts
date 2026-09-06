import { DEMO_APP_BACKFILL_USER_EXTERNAL_CONNECTION_KEYS_DEVELOPMENT_FUNCTION_SPECIFIER, DEMO_APP_BACKFILL_USER_EXTERNAL_CONNECTION_LOGINS_DEVELOPMENT_FUNCTION_SPECIFIER, DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER, DEMO_APP_SEED_OPENROUTER_PROMPTS_DEVELOPMENT_FUNCTION_SPECIFIER } from 'demo-firebase';
import { exampleDevelopmentFunction } from '../example/example.development';
import { seedOpenRouterPromptsDevelopmentFunction } from '../openrouter/openrouter.development';
import { backfillUserExternalConnectionExternalAccountKeysDevelopmentFunction, backfillUserExternalConnectionLoginsDevelopmentFunction } from '../userexternalconnection/userexternalconnection.development';
import { type DemoOnCallDevelopmentFunctionMap } from '../function.context';

export const DEMO_DEVELOPMENT_FUNCTION_MAP: DemoOnCallDevelopmentFunctionMap = {
  [DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER]: exampleDevelopmentFunction,
  [DEMO_APP_SEED_OPENROUTER_PROMPTS_DEVELOPMENT_FUNCTION_SPECIFIER]: seedOpenRouterPromptsDevelopmentFunction,
  // the two one-off jobs the connection model's docblocks say to expose here rather than on any
  // user-reachable route: both walk the whole collection and are operator actions
  [DEMO_APP_BACKFILL_USER_EXTERNAL_CONNECTION_KEYS_DEVELOPMENT_FUNCTION_SPECIFIER]: backfillUserExternalConnectionExternalAccountKeysDevelopmentFunction,
  [DEMO_APP_BACKFILL_USER_EXTERNAL_CONNECTION_LOGINS_DEVELOPMENT_FUNCTION_SPECIFIER]: backfillUserExternalConnectionLoginsDevelopmentFunction
};
