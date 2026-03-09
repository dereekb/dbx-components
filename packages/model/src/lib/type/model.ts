import { type } from 'arktype';

/**
 * ArkType schema for a model key (non-empty string).
 */
export const modelKeyType = type('string > 0');

/**
 * ArkType schema for a model id (non-empty string).
 */
export const modelIdType = type('string > 0');

/**
 * ArkType schema for target model params with a required `key` field.
 */
export const targetModelParamsType = type({
  key: modelKeyType
});

/**
 * ArkType schema for target model id params with a required `id` field.
 */
export const targetModelIdParamsType = type({
  id: modelIdType
});
