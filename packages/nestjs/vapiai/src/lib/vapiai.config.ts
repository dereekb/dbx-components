import { VapiClient } from '@vapi-ai/server-sdk';

export const VAPI_AI_SECRET_TOKEN_ENV_VAR = 'VAPI_AI_SECRET_TOKEN';

export interface VapiAiServiceApiConfig {
  readonly config: VapiClient.Options;
}

/**
 * Configuration for VapiAiService
 */
export abstract class VapiAiServiceConfig {
  readonly vapiai!: VapiAiServiceApiConfig;

  static assertValidConfig(config: VapiAiServiceConfig) {
    if (!config.vapiai.config.token) {
      throw new Error('No Vapi.ai secret/token specified.');
    }
  }
}
