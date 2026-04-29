import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type FormControlStatus } from '@angular/forms';
import { firstValueFrom, of } from 'rxjs';
import { waitForMs } from '@dereekb/util';
import { dbxForgeTextIsAvailableField, FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME } from './available';
import type { DbxForgeField } from '../form/forge.form';
import { DbxForgeAsyncConfigFormComponent } from '../form';
import { DBX_FORGE_TEST_PROVIDERS } from '../form/forge.component.spec';

// MARK: dbxForgeTextIsAvailableField
describe('dbxForgeTextIsAvailableField()', () => {
  const baseConfig = {
    key: 'username',
    label: 'Username',
    checkValueIsAvailable: (value: string) => of(value !== 'taken')
  };

  it('should create a text input field with the correct key and label', () => {
    const field = dbxForgeTextIsAvailableField(baseConfig);
    expect(field.type).toBe('input');
    expect(field.key).toBe('username');
    expect(field.label).toBe('Username');
  });

  it('should add async validator reference to the field via addValidation', () => {
    const field = dbxForgeTextIsAvailableField(baseConfig);
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
    const field = dbxForgeTextIsAvailableField(baseConfig);
    const formConfig = (field as DbxForgeField<any>)._formConfig;
    expect(formConfig?.customFnConfig?.asyncValidators).toBeDefined();
    expect(formConfig!.customFnConfig!.asyncValidators![FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBeDefined();
  });

  it('should register the default validation message in _formConfig.defaultValidationMessages', () => {
    const field = dbxForgeTextIsAvailableField(baseConfig);
    const formConfig = (field as DbxForgeField<any>)._formConfig;
    expect(formConfig?.defaultValidationMessages?.[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBe('This value is not available.');
  });

  it('should use custom error message when provided', () => {
    const field = dbxForgeTextIsAvailableField({
      ...baseConfig,
      isNotAvailableErrorMessage: 'Username is already taken'
    });

    const formConfig = (field as DbxForgeField<any>)._formConfig;
    expect(formConfig?.defaultValidationMessages?.[FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME]).toBe('Username is already taken');
  });

  it('should support custom validator name', () => {
    const customName = 'checkUsername';
    const field = dbxForgeTextIsAvailableField({
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
    const field = dbxForgeTextIsAvailableField(baseConfig);
    const validators = (field as any).validators;
    const asyncValidator = validators.find((v: any) => v.type === 'async');
    expect(asyncValidator.params).toBeDefined();
    expect(asyncValidator.params.checkValueIsAvailable).toBeDefined();
    expect(typeof asyncValidator.params.checkValueIsAvailable).toBe('function');
  });

  it('should pass through text field config options', () => {
    const field = dbxForgeTextIsAvailableField({
      ...baseConfig,
      required: true,
      maxLength: 20
    });

    expect((field as any).required).toBe(true);
    expect((field as any).maxLength).toBe(20);
  });
});

// MARK: Scenarios
describe('dbxForgeTextIsAvailableField() scenarios', () => {
  let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...DBX_FORGE_TEST_PROVIDERS]
    });
    fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function applyField(field: ReturnType<typeof dbxForgeTextIsAvailableField>) {
    fixture.componentInstance.config.set({ fields: [field] });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function setValueAndSettle(value: string) {
    fixture.componentInstance.setValue({ username: value });
    fixture.detectChanges();
    await waitForMs(100);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('should treat empty values as valid (not-required fields)', async () => {
    const field = dbxForgeTextIsAvailableField({
      key: 'username',
      checkValueIsAvailable: (value: string) => of(value !== 'taken')
    });
    await applyField(field);

    await setValueAndSettle('');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID' as FormControlStatus);
  });

  it('should report VALID when checkValueIsAvailable resolves true', async () => {
    const field = dbxForgeTextIsAvailableField({
      key: 'username',
      checkValueIsAvailable: (value: string) => of(value !== 'taken')
    });
    await applyField(field);

    await setValueAndSettle('free');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID' as FormControlStatus);
  });

  it('should report INVALID when checkValueIsAvailable resolves false', async () => {
    const field = dbxForgeTextIsAvailableField({
      key: 'username',
      checkValueIsAvailable: (value: string) => of(value !== 'taken')
    });
    await applyField(field);

    await setValueAndSettle('taken');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('INVALID' as FormControlStatus);
  });
});
