import type { ValidationMessages } from '@ng-forge/dynamic-forms';
import { DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput } from './field';

export interface DbxForgePatternValidatorConfig {
  pattern: string | RegExp;
  message?: ValidationMessages['pattern'];
}

export function dbxForgePatternValidator(config: DbxForgePatternValidatorConfig): DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput {
  const { pattern, message } = config;

  return {
    validators: [
      {
        type: 'pattern',
        value: pattern
      }
    ],
    validationMessages: {
      pattern: message
    }
  };
}
