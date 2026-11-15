import { microsoftMailSignatureUserExternalConnectionDataTypeConfig, type MicrosoftUserExternalConnectionDataTypes, type UserExternalConnectionDataTypeConfig, type UserExternalConnectionDataTypings } from '@dereekb/firebase';
import { DEMO_MICROSOFT_EXTERNAL_CONNECTION_PROVIDER_TYPE } from './externalconnection';

/**
 * The connection data types the demo allows (`UserExternalConnectionData`).
 *
 * The same list goes to the API's UserExternalConnection module (validation) and to demo-cli (packing files and
 * normalizing keys), so both sides agree on what may be stored.
 */
export const DEMO_USER_EXTERNAL_CONNECTION_DATA_TYPES: readonly UserExternalConnectionDataTypeConfig[] = [microsoftMailSignatureUserExternalConnectionDataTypeConfig(DEMO_MICROSOFT_EXTERNAL_CONNECTION_PROVIDER_TYPE)];

/**
 * The demo's connection data typings: provider type → data type → value shape.
 */
export interface DemoUserExternalConnectionDataTypings extends UserExternalConnectionDataTypings {
  readonly microsoft: MicrosoftUserExternalConnectionDataTypes;
}
