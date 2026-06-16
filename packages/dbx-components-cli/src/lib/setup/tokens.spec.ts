import { describe, expect, it } from 'vitest';
import { deriveSetupNaming } from './naming.js';
import { buildSetupTokenTable } from './tokens.js';
import { applyTokens } from './substitute.js';

const NAMING = deriveSetupNaming({ firebaseProjectId: 'gethapierapp', projectName: 'gethapier', codePrefix: 'getHapier', emulatorBasePort: 9300 });

describe('buildSetupTokenTable', () => {
  it('orders the APP_CODE_PREFIX variants before the bare token so they are not corrupted', () => {
    const table = buildSetupTokenTable(NAMING);
    const result = applyTokens('APP_CODE_PREFIX_CAPS APP_CODE_PREFIX_CAMEL APP_CODE_PREFIX_LOWER APP_CODE_PREFIX', table.global);
    expect(result).toBe('GETHAPIER getHapier gethapier GetHapier');
  });

  it('substitutes staging before the bare firebase id for .firebaserc', () => {
    const table = buildSetupTokenTable(NAMING);
    const firebaserc = table.perFile.get('.firebaserc');
    expect(firebaserc).toBeDefined();
    const result = applyTokens('FIREBASE_PROJECT_ID_STAGING FIREBASE_PROJECT_ID', firebaserc ?? []);
    expect(result).toBe('gethapierapp-staging gethapierapp');
  });

  it('orders docker-compose server/network names before the bare api name', () => {
    const table = buildSetupTokenTable(NAMING);
    const compose = table.perFile.get('root/docker-compose.yml') ?? [];
    const result = applyTokens('demo-api-server demo-api-network demo-api 9900-9908', compose);
    expect(result).toBe('gethapier-api-server gethapier-api-network gethapier-api 9300-9308');
  });

  it('deletes the undefined ANGULAR_APP_PREFIX token in the components project template', () => {
    const table = buildSetupTokenTable(NAMING);
    const tokens = table.perFile.get('components/app/project.template.json') ?? [];
    expect(tokens.some((token) => token.search === 'ANGULAR_APP_PREFIX' && token.replace === '')).toBe(true);
  });

  it('uses the supplied CI git identity for the circleci config', () => {
    const table = buildSetupTokenTable(NAMING, { ciGitUserEmail: 'bot@x.com', ciGitUserName: 'bot' });
    const tokens = table.perFile.get('.circleci/config.yml') ?? [];
    const result = applyTokens('CI_GIT_USER_EMAIL CI_GIT_USER_NAME E2E_APP_NAME', tokens);
    expect(result).toBe('bot@x.com bot gethapier-e2e');
  });
});
