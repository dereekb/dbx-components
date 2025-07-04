import { ClientOptions } from 'openai';

/**
 * Default environment variable for the OpenAI API key.
 */
export const OPENAI_API_KEY_ENV_VAR = 'OPENAI_API_KEY';
export const OPENAI_BASE_URL_ENV_VAR = 'OPENAI_BASE_URL';
export const OPENAI_ORGANIZATION_ID_ENV_VAR = 'OPENAI_ORG_ID';
export const OPENAI_PROJECT_ID_ENV_VAR = 'OPENAI_PROJECT_ID';

export interface OpenAIServiceApiConfig {
  readonly config: ClientOptions;
}

/**
 * Configuration for OpenAIService
 */
export abstract class OpenAIServiceConfig {
  readonly openai!: OpenAIServiceApiConfig;

  static assertValidConfig(config: OpenAIServiceConfig) {
    if (!config.openai.config.apiKey) {
      throw new Error('No OpenAI API key specified.');
    } else if (!config.openai.config.organization) {
      throw new Error('No OpenAI organization specified.');
    } else if (!config.openai.config.project) {
      throw new Error('No OpenAI project specified.');
    }
  }
}
