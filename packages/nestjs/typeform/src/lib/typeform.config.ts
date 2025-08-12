import { TypeformClientOptions } from './typeform.type';

/**
 * Default environment variable for the Typeform API key.
 */
export const TYPEFORM_TOKEN_ENV_VAR = 'TYPEFORM_TOKEN';
export const TYPEFORM_BASE_URL_ENV_VAR = 'TYPEFORM_BASE_URL';

export interface TypeformServiceApiConfig {
  readonly config: Required<Pick<TypeformClientOptions, 'token'>> & Omit<TypeformClientOptions, 'token'>;
}

/**
 * Configuration for TypeformService
 */
export abstract class TypeformServiceConfig {
  readonly typeform!: TypeformServiceApiConfig;

  static assertValidConfig(config: TypeformServiceConfig) {
    if (!config.typeform.config.token) {
      throw new Error('No Typeform token specified.');
    }
  }
}
