import { describe, it, expect } from 'vitest';
import { forgeTextIsAvailableField, FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME } from './available';
import { of } from 'rxjs';

describe('forgeTextIsAvailableField()', () => {
  const baseConfig = {
    key: 'username',
    label: 'Username',
    checkValueIsAvailable: (value: string) => of(value !== 'taken')
  };

  it('should return a result with field, asyncValidators, and validationMessages', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    expect(result.field).toBeDefined();
    expect(result.asyncValidators).toBeDefined();
    expect(result.validationMessages).toBeDefined();
  });

  it('should create an input field with correct key and label', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    expect(result.field.type).toBe('input');
    expect(result.field.key).toBe('username');
    expect(result.field.label).toBe('Username');
  });

  it('should add async validator reference to the field', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    const validators = (result.field as any).validators;
    expect(validators).toBeDefined();
    expect(validators).toContainEqual({ type: 'async', functionName: FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME });
  });

  it('should register the async validator with the default name', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    expect(result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBeDefined();
  });

  it('should use the default error message in validationMessages', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    expect(result.validationMessages[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBe('This value is not available.');
  });

  it('should use custom error message when provided', () => {
    const result = forgeTextIsAvailableField({
      ...baseConfig,
      isNotAvailableErrorMessage: 'Username is already taken'
    });
    expect(result.validationMessages[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBe('Username is already taken');
  });

  it('should support custom validator name', () => {
    const customName = 'checkUsername';
    const result = forgeTextIsAvailableField({
      ...baseConfig,
      validatorName: customName
    });

    expect(result.asyncValidators[customName]).toBeDefined();
    expect(result.validationMessages[customName]).toBeDefined();
    const validators = (result.field as any).validators;
    expect(validators).toContainEqual({ type: 'async', functionName: customName });
  });

  it('should pass through text field config options', () => {
    const result = forgeTextIsAvailableField({
      ...baseConfig,
      required: true,
      placeholder: 'Enter username',
      description: 'Choose a unique username',
      maxLength: 20
    });

    expect(result.field.required).toBe(true);
    expect(result.field.maxLength).toBe(20);
  });

  it('should have params, factory, onSuccess, and onError on the async validator', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    const validator = result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME];
    expect(validator.params).toBeTypeOf('function');
    expect(validator.factory).toBeTypeOf('function');
    expect(validator.onSuccess).toBeTypeOf('function');
    expect(validator.onError).toBeTypeOf('function');
  });

  it('onSuccess should return null for available values', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    const validator = result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME];
    expect(validator.onSuccess!(true, {} as any)).toBeNull();
  });

  it('onSuccess should return validation error for unavailable values', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    const validator = result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME];
    const error = validator.onSuccess!(false, {} as any);
    expect(error).toEqual({ kind: FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME });
  });

  it('onError should return null (not block form on errors)', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    const validator = result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME];
    expect(validator.onError!(new Error('network'), {} as any)).toBeNull();
  });
});
