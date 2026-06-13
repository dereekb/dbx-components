/**
 * Pure derivation of every name / folder / dist path / port the setup process
 * computes. This is the deterministic foundation the token table, scaffold
 * engine, manifest writer, and validator all build on.
 *
 * Formulas are ported verbatim from `setup/setup-project.sh:101-148`.
 */

import { type Maybe } from '@dereekb/util';

/**
 * Raw setup inputs, mirroring the positional arguments of `setup-project.sh`.
 * Optional fields apply the same defaults the script does.
 */
export interface SetupNamingInputs {
  /**
   * Firebase project id (script arg 1, required).
   */
  readonly firebaseProjectId: string;
  /**
   * Project name (script arg 2). Defaults to `firebaseProjectId`.
   */
  readonly projectName?: Maybe<string>;
  /**
   * Single-word camelCase code prefix (script arg 3). Defaults to `app`.
   */
  readonly codePrefix?: Maybe<string>;
  /**
   * Base emulator port (script arg 4). Defaults to `9100`.
   */
  readonly emulatorBasePort?: Maybe<number>;
  /**
   * Staging firebase project id (script arg 6). Defaults to `<firebaseProjectId>-staging`.
   */
  readonly stagingProjectId?: Maybe<string>;
}

/**
 * The fully-derived naming object: every value the script computes from its
 * inputs, as one flat readonly record consumed by the token table + scaffold.
 */
export interface SetupNaming {
  readonly firebaseProjectId: string;
  readonly stagingProjectId: string;
  readonly projectName: string;
  /**
   * The raw camelCase code prefix as supplied (e.g. `getHapier`).
   */
  readonly codePrefix: string;
  /**
   * PascalCase prefix: first char upper-cased, remainder as-is (e.g. `GetHapier`).
   */
  readonly appCodePrefix: string;
  /**
   * camelCase prefix, identical to the supplied `codePrefix`.
   */
  readonly appCodePrefixCamel: string;
  /**
   * Fully lower-cased prefix (e.g. `gethapier`).
   */
  readonly appCodePrefixLower: string;
  /**
   * Fully upper-cased prefix (e.g. `GETHAPIER`).
   */
  readonly appCodePrefixCaps: string;

  readonly angularComponentsName: string;
  readonly firebaseComponentsName: string;
  readonly angularAppName: string;
  readonly apiAppName: string;
  readonly e2eAppName: string;
  readonly dockerContainerAppName: string;
  readonly dockerContainerNetworkName: string;

  readonly appsFolder: string;
  readonly angularAppFolder: string;
  readonly apiAppFolder: string;
  readonly e2eAppFolder: string;
  readonly componentsFolder: string;
  readonly angularComponentsFolder: string;
  readonly firebaseComponentsFolder: string;
  readonly appsDistFolder: string;
  readonly angularAppDistFolder: string;
  readonly apiAppDistFolder: string;
  readonly componentsDistFolder: string;
  readonly angularComponentsDistFolder: string;
  readonly firebaseComponentsDistFolder: string;

  readonly emulatorBasePort: number;
  readonly emulatorUiPort: number;
  readonly emulatorHostingPort: number;
  readonly emulatorFunctionsPort: number;
  readonly emulatorAuthPort: number;
  readonly emulatorFirestorePort: number;
  readonly emulatorPubsubPort: number;
  readonly emulatorStoragePort: number;
  readonly emulatorFirestoreWebsocketPort: number;
  readonly localhost: string;
  readonly emulatorPortRange: string;
  readonly angularAppPort: number;
}

const DEFAULT_CODE_PREFIX = 'app';
const DEFAULT_EMULATOR_BASE_PORT = 9100;

/**
 * Derives the complete {@link SetupNaming} record from raw inputs, applying the
 * same defaults and formulas as `setup-project.sh`.
 *
 * @param inputs - Raw setup inputs.
 * @returns The derived naming object.
 */
export function deriveSetupNaming(inputs: SetupNamingInputs): SetupNaming {
  const firebaseProjectId = inputs.firebaseProjectId;
  const projectName = inputs.projectName ?? firebaseProjectId;
  const codePrefix = inputs.codePrefix ?? DEFAULT_CODE_PREFIX;
  const stagingProjectId = inputs.stagingProjectId ?? `${firebaseProjectId}-staging`;
  const emulatorBasePort = inputs.emulatorBasePort ?? DEFAULT_EMULATOR_BASE_PORT;

  const appCodePrefix = `${codePrefix.charAt(0).toUpperCase()}${codePrefix.slice(1)}`;
  const angularComponentsName = `${projectName}-components`;
  const firebaseComponentsName = `${projectName}-firebase`;
  const angularAppName = projectName;
  const apiAppName = `${projectName}-api`;
  const e2eAppName = `${projectName}-e2e`;

  const emulatorUiPort = emulatorBasePort;
  const emulatorFirestoreWebsocketPort = emulatorBasePort + 8;

  return {
    firebaseProjectId,
    stagingProjectId,
    projectName,
    codePrefix,
    appCodePrefix,
    appCodePrefixCamel: codePrefix,
    appCodePrefixLower: codePrefix.toLowerCase(),
    appCodePrefixCaps: codePrefix.toUpperCase(),

    angularComponentsName,
    firebaseComponentsName,
    angularAppName,
    apiAppName,
    e2eAppName,
    dockerContainerAppName: `${apiAppName}-server`,
    dockerContainerNetworkName: `${apiAppName}-network`,

    appsFolder: 'apps',
    angularAppFolder: `apps/${angularAppName}`,
    apiAppFolder: `apps/${apiAppName}`,
    e2eAppFolder: `apps/${e2eAppName}`,
    componentsFolder: 'components',
    angularComponentsFolder: `components/${angularComponentsName}`,
    firebaseComponentsFolder: `components/${firebaseComponentsName}`,
    appsDistFolder: 'dist/apps',
    angularAppDistFolder: `dist/apps/${angularAppName}`,
    apiAppDistFolder: `dist/apps/${apiAppName}`,
    componentsDistFolder: 'dist/components',
    angularComponentsDistFolder: `dist/components/${angularComponentsName}`,
    firebaseComponentsDistFolder: `dist/components/${firebaseComponentsName}`,

    emulatorBasePort,
    emulatorUiPort,
    emulatorHostingPort: emulatorBasePort + 1,
    emulatorFunctionsPort: emulatorBasePort + 2,
    emulatorAuthPort: emulatorBasePort + 3,
    emulatorFirestorePort: emulatorBasePort + 4,
    emulatorPubsubPort: emulatorBasePort + 5,
    emulatorStoragePort: emulatorBasePort + 6,
    emulatorFirestoreWebsocketPort,
    localhost: '0.0.0.0',
    emulatorPortRange: `${emulatorUiPort}-${emulatorFirestoreWebsocketPort}`,
    angularAppPort: emulatorBasePort + 10
  };
}
