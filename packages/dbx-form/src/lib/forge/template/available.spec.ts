import { describe, it, expect } from 'vitest';
import { forgeTextIsAvailableField, FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME } from './available';
import { of } from 'rxjs';
import type { DbxForgeField } from '../form/forge.form';

// MARK: forgeTextIsAvailableField
describe('forgeTextIsAvailableField()', () => {
  const baseConfig = {
    key: 'username',
    label: 'Username',
    checkValueIsAvailable: (value: string) => of(value !== 'taken')
  };

  it('should create a text input field with the correct key and label', () => {
    const field = forgeTextIsAvailableField(baseConfig);
    expect(field.type).toBe('input');
    expect(field.key).toBe('username');
    expect(field.label).toBe('Username');
  });

  it('should add async validator reference to the field via addValidation', () => {
    const field = forgeTextIsAvailableField(baseConfig);
    const validators = (field as any).validators;
    expect(validators).toBeDefined();

    const asyncValidator = validators.find((v: any) => v.type === 'async');
    expect(asyncValidator).toBeDefined();
    expect(asyncValidator.functionName).toBe(FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME);
    // fn and reusableDefinition should be removed during finalization
    expect(asyncValidator.fn).toBeUndefined();
    expect(asyncValidator.reusableDefinition).toBeUndefined();
  });

  it('should register the async validator in _formConfig.customFnConfig.asyncValidators', () => {
    const field = forgeTextIsAvailableField(baseConfig);
    const formConfig = (field as DbxForgeField<any>)._formConfig;
    expect(formConfig?.customFnConfig?.asyncValidators).toBeDefined();
    expect(formConfig!.customFnConfig!.asyncValidators![FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBeDefined();
  });

  it('should register the default validation message in _formConfig.defaultValidationMessages', () => {
    const field = forgeTextIsAvailableField(baseConfig);
    const formConfig = (field as DbxForgeField<any>)._formConfig;
    expect(formConfig?.defaultValidationMessages?.[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBe('This value is not available.');
  });

  it('should use custom error message when provided', () => {
    const field = forgeTextIsAvailableField({
      ...baseConfig,
      isNotAvailableErrorMessage: 'Username is already taken'
    });

    const formConfig = (field as DbxForgeField<any>)._formConfig;
    expect(formConfig?.defaultValidationMessages?.[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBe('Username is already taken');
  });

  it('should support custom validator name', () => {
    const customName = 'checkUsername';
    const field = forgeTextIsAvailableField({
      ...baseConfig,
      validatorName: customName
    });

    const validators = (field as any).validators;
    const asyncValidator = validators.find((v: any) => v.type === 'async');
    expect(asyncValidator.functionName).toBe(customName);

    const formConfig = (field as DbxForgeField<any>)._formConfig;
    expect(formConfig?.customFnConfig?.asyncValidators?.[customName]).toBeDefined();
    expect(formConfig?.defaultValidationMessages?.[customName]).toBeDefined();
  });

  it('should pass field-specific params containing checkValueIsAvailable to the validator', () => {
    const field = forgeTextIsAvailableField(baseConfig);
    const validators = (field as any).validators;
    const asyncValidator = validators.find((v: any) => v.type === 'async');
    expect(asyncValidator.params).toBeDefined();
    expect(asyncValidator.params.checkValueIsAvailable).toBeDefined();
    expect(typeof asyncValidator.params.checkValueIsAvailable).toBe('function');
  });

  it('should pass through text field config options', () => {
    const field = forgeTextIsAvailableField({
      ...baseConfig,
      required: true,
      maxLength: 20
    });

    expect((field as any).required).toBe(true);
    expect((field as any).maxLength).toBe(20);
  });
});
