import { describe, it, expect } from 'vitest';
import { forgeTextIsAvailableField, forgeFieldValueIsAvailableValidator, FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME } from './available';
import { of } from 'rxjs';
import type { WrapperField } from '@ng-forge/dynamic-forms';
import { DBX_FORGE_WORKING_WRAPPER_TYPE_NAME } from '../field/wrapper/working/working.wrapper';

// MARK: forgeFieldValueIsAvailableValidator
describe('forgeFieldValueIsAvailableValidator()', () => {
  const baseConfig = {
    checkValueIsAvailable: (value: string) => of(value !== 'taken')
  };

  it('should return validatorName, asyncValidators, and validationMessages', () => {
    const result = forgeFieldValueIsAvailableValidator(baseConfig);
    expect(result.validatorName).toBe(FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME);
    expect(result.asyncValidators).toBeDefined();
    expect(result.validationMessages).toBeDefined();
  });

  it('should register the async validator with the default name', () => {
    const result = forgeFieldValueIsAvailableValidator(baseConfig);
    expect(result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBeDefined();
  });

  it('should use the default error message', () => {
    const result = forgeFieldValueIsAvailableValidator(baseConfig);
    expect(result.validationMessages[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBe('This value is not available.');
  });

  it('should use custom error message when provided', () => {
    const result = forgeFieldValueIsAvailableValidator({
      ...baseConfig,
      isNotAvailableErrorMessage: 'Username is already taken'
    });
    expect(result.validationMessages[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBe('Username is already taken');
  });

  it('should support custom validator name', () => {
    const customName = 'checkUsername';
    const result = forgeFieldValueIsAvailableValidator({
      ...baseConfig,
      validatorName: customName
    });

    expect(result.validatorName).toBe(customName);
    expect(result.asyncValidators[customName]).toBeDefined();
    expect(result.validationMessages[customName]).toBeDefined();
  });

  it('should have params, factory, onSuccess, and onError on the async validator', () => {
    const result = forgeFieldValueIsAvailableValidator(baseConfig);
    const validator = result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME];
    expect(validator.params).toBeTypeOf('function');
    expect(validator.factory).toBeTypeOf('function');
    expect(validator.onSuccess).toBeTypeOf('function');
    expect(validator.onError).toBeTypeOf('function');
  });

  it('onSuccess should return null for available values', () => {
    const result = forgeFieldValueIsAvailableValidator(baseConfig);
    const validator = result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME];
    expect(validator.onSuccess!(true, {} as any)).toBeNull();
  });

  it('onSuccess should return validation error for unavailable values', () => {
    const result = forgeFieldValueIsAvailableValidator(baseConfig);
    const validator = result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME];
    const error = validator.onSuccess!(false, {} as any);
    expect(error).toEqual({ kind: FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME });
  });

  it('onError should return null (not block form on errors)', () => {
    const result = forgeFieldValueIsAvailableValidator(baseConfig);
    const validator = result.asyncValidators[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME];
    expect(validator.onError!(new Error('network'), {} as any)).toBeNull();
  });
});

// MARK: forgeTextIsAvailableField
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

  it('should wrap the text field in a working wrapper', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    expect(result.field.type).toBe('wrapper');
    const wrapperField = result.field as WrapperField;
    expect(wrapperField.wrappers[0].type).toBe(DBX_FORGE_WORKING_WRAPPER_TYPE_NAME);
  });

  it('should contain the text field with the correct key inside the wrapper', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    const wrapperField = result.field as WrapperField;
    const childFields = wrapperField.fields;
    expect(childFields).toBeDefined();
    expect(childFields).toHaveLength(1);

    const textField = childFields[0];
    expect(textField.type).toBe('input');
    expect(textField.key).toBe('username');
    expect(textField.label).toBe('Username');
  });

  it('should add async validator reference to the inner text field', () => {
    const result = forgeTextIsAvailableField(baseConfig);
    const textField = (result.field as WrapperField).fields?.[0];
    const validators = (textField as any).validators;
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

    const textField = (result.field as WrapperField).fields?.[0];
    const validators = (textField as any).validators;
    expect(validators).toContainEqual({ type: 'async', functionName: customName });
  });

  it('should pass through text field config options to the inner text field', () => {
    const result = forgeTextIsAvailableField({
      ...baseConfig,
      required: true,
      placeholder: 'Enter username',
      description: 'Choose a unique username',
      maxLength: 20
    });

    const textField = (result.field as WrapperField).fields?.[0] as any;
    expect(textField?.required).toBe(true);
    expect(textField?.maxLength).toBe(20);
  });
});
