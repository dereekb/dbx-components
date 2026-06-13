import { describe, expect, it } from 'vitest';
import { deriveSetupNaming } from './naming.js';

describe('deriveSetupNaming', () => {
  it('derives every name/folder/port from the script example inputs', () => {
    const naming = deriveSetupNaming({ firebaseProjectId: 'gethapierapp', projectName: 'gethapier', codePrefix: 'getHapier', emulatorBasePort: 9300 });

    expect(naming.firebaseProjectId).toBe('gethapierapp');
    expect(naming.stagingProjectId).toBe('gethapierapp-staging');
    expect(naming.projectName).toBe('gethapier');

    expect(naming.appCodePrefix).toBe('GetHapier');
    expect(naming.appCodePrefixCamel).toBe('getHapier');
    expect(naming.appCodePrefixLower).toBe('gethapier');
    expect(naming.appCodePrefixCaps).toBe('GETHAPIER');

    expect(naming.angularComponentsName).toBe('gethapier-components');
    expect(naming.firebaseComponentsName).toBe('gethapier-firebase');
    expect(naming.angularAppName).toBe('gethapier');
    expect(naming.apiAppName).toBe('gethapier-api');
    expect(naming.e2eAppName).toBe('gethapier-e2e');
    expect(naming.dockerContainerAppName).toBe('gethapier-api-server');
    expect(naming.dockerContainerNetworkName).toBe('gethapier-api-network');

    expect(naming.angularAppFolder).toBe('apps/gethapier');
    expect(naming.apiAppFolder).toBe('apps/gethapier-api');
    expect(naming.angularComponentsFolder).toBe('components/gethapier-components');
    expect(naming.firebaseComponentsFolder).toBe('components/gethapier-firebase');
    expect(naming.angularAppDistFolder).toBe('dist/apps/gethapier');
    expect(naming.apiAppDistFolder).toBe('dist/apps/gethapier-api');
    expect(naming.angularComponentsDistFolder).toBe('dist/components/gethapier-components');
    expect(naming.firebaseComponentsDistFolder).toBe('dist/components/gethapier-firebase');

    expect(naming.emulatorUiPort).toBe(9300);
    expect(naming.emulatorHostingPort).toBe(9301);
    expect(naming.emulatorFunctionsPort).toBe(9302);
    expect(naming.emulatorAuthPort).toBe(9303);
    expect(naming.emulatorFirestorePort).toBe(9304);
    expect(naming.emulatorPubsubPort).toBe(9305);
    expect(naming.emulatorStoragePort).toBe(9306);
    expect(naming.emulatorFirestoreWebsocketPort).toBe(9308);
    expect(naming.emulatorPortRange).toBe('9300-9308');
    expect(naming.angularAppPort).toBe(9310);
    expect(naming.localhost).toBe('0.0.0.0');
  });

  it('applies the script defaults when optional inputs are omitted', () => {
    const naming = deriveSetupNaming({ firebaseProjectId: 'myapp' });
    expect(naming.projectName).toBe('myapp');
    expect(naming.codePrefix).toBe('app');
    expect(naming.appCodePrefix).toBe('App');
    expect(naming.stagingProjectId).toBe('myapp-staging');
    expect(naming.emulatorBasePort).toBe(9100);
    expect(naming.emulatorPortRange).toBe('9100-9108');
    expect(naming.angularAppPort).toBe(9110);
  });
});
