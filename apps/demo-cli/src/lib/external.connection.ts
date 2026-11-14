import { type CliExternalConnectionDataConfig, passthroughCliExternalConnectionDataAdapter } from '@dereekb/dbx-cli';
import { MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE } from '@dereekb/firebase';
import { DEMO_MICROSOFT_EXTERNAL_CONNECTION_PROVIDER_TYPE, DEMO_USER_EXTERNAL_CONNECTION_DATA_TYPES } from 'demo-firebase';

/**
 * demo-cli's connection data config (`CreateCliInput.externalConnectionData`).
 *
 * - `dataTypes` is the same registry demo-api validates against, so `connection-data set … --file` packs a file into
 *   the shape the server accepts and normalizes item keys the same way.
 * - `adapters` decides which providers' stored data rides out on `external-token`: only `microsoft`, whose stored
 *   `mail_signature` items msgraph-cli applies as default signatures (below its own config and flags). The
 *   passthrough adapter keeps the settings keys equal to the data type keys, the shape msgraph-cli reads.
 */
export const DEMO_CLI_EXTERNAL_CONNECTION_DATA_CONFIG: CliExternalConnectionDataConfig = {
  dataTypes: DEMO_USER_EXTERNAL_CONNECTION_DATA_TYPES,
  adapters: {
    [DEMO_MICROSOFT_EXTERNAL_CONNECTION_PROVIDER_TYPE]: passthroughCliExternalConnectionDataAdapter({ dataTypes: [MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE] })
  }
};
