/**
 * Exhaustive type and runtime tests for the text forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type SchemaApplicationConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, type FieldDef, withLoggerConfig } from '@ng-forge/dynamic-forms';
import type { MatInputField } from '@ng-forge/dynamic-forms-material';
import { waitForMs, type TransformStringFunctionConfig } from '@dereekb/util';
import type { FieldAutocompleteAttributeOption } from '../../../../field/field.autocomplete';
import type { DbxForgeTextFieldConfig, DbxForgeTextFieldInputType } from './text.field';
import { dbxForgeTextField } from './text.field';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { firstValueFrom } from 'rxjs';
import { FormControlStatus } from '@angular/forms';

// ============================================================================
// DbxForgeTextFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeTextFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeTextFieldDef>
    | 'key'
    | 'label'
    | 'placeholder'
    | 'value'
    | 'required'
    | 'readonly'
    | 'disabled'
    | 'hidden'
    | 'className'
    | 'meta'
    | 'logic'
    | 'props'
    | 'hint'
    | 'description'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
    | 'min'
    | 'max'
    | 'email'
    | 'validators'
    | 'validationMessages'
    | 'derivation'
    | 'schemas'
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | '__fieldDef'
    // Field-specific config
    | 'inputType'
    | 'defaultValue'
    // From FieldAutocompleteAttributeOptionRef
    | 'autocomplete'
    // From Partial<TransformStringFunctionConfigRef> + direct declaration
    | 'idempotentTransform';

  type ActualKeys = keyof DbxForgeTextFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgeTextFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('field-specific config keys', () => {
    it('inputType', () => {
      expectTypeOf<DbxForgeTextFieldConfig['inputType']>().toEqualTypeOf<DbxForgeTextFieldInputType | undefined>();
    });

    it('transform', () => {
      expectTypeOf<DbxForgeTextFieldConfig['idempotentTransform']>().toEqualTypeOf<TransformStringFunctionConfig | undefined>();
    });

    it('defaultValue', () => {
      expectTypeOf<DbxForgeTextFieldConfig['defaultValue']>().toEqualTypeOf<string | undefined>();
    });

    it('autocomplete', () => {
      expectTypeOf<DbxForgeTextFieldConfig['autocomplete']>().toEqualTypeOf<FieldAutocompleteAttributeOption | undefined>();
    });
  });

  describe('inherited optional keys', () => {
    it('label', () => {
      expectTypeOf<DbxForgeTextFieldConfig['label']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('value is string', () => {
      expectTypeOf<DbxForgeTextFieldConfig['value']>().toEqualTypeOf<string | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgeTextFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('hint', () => {
      expectTypeOf<DbxForgeTextFieldConfig['hint']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('description', () => {
      expectTypeOf<DbxForgeTextFieldConfig['description']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('validators', () => {
      expectTypeOf<DbxForgeTextFieldConfig['validators']>().toEqualTypeOf<ValidatorConfig[] | undefined>();
    });

    it('validationMessages', () => {
      expectTypeOf<DbxForgeTextFieldConfig['validationMessages']>().toEqualTypeOf<ValidationMessages | undefined>();
    });

    it('schemas', () => {
      expectTypeOf<DbxForgeTextFieldConfig['schemas']>().toEqualTypeOf<SchemaApplicationConfig[] | undefined>();
    });
  });
});

// ============================================================================
// MatInputField (String variant) - Exhaustive Whitelist
// ============================================================================

describe('MatInputField (String) - Exhaustive Whitelist', () => {
  type StringInputField = Extract<MatInputField, { props?: { type?: 'text' | 'email' | 'password' | 'tel' | 'url' } }>;

  type ExpectedKeys =
    // From FieldDef
    | 'key'
    | 'type'
    | 'label'
    | 'props'
    | 'className'
    | 'disabled'
    | 'readonly'
    | 'hidden'
    | 'tabIndex'
    | 'col'
    | 'meta'
    // Value exclusion config
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    // From FieldWithValidation
    | 'required'
    | 'email'
    | 'min'
    | 'max'
    | 'minLength'
    | 'maxLength'
    | 'pattern'
    | 'validators'
    | 'validationMessages'
    | 'logic'
    | 'derivation'
    | 'schemas'
    // From BaseValueField
    | 'value'
    | 'placeholder';

  type ActualKeys = keyof StringInputField;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<StringInputField['key']>().toEqualTypeOf<string>();
    });

    it('type is required and literal', () => {
      expectTypeOf<StringInputField['type']>().toEqualTypeOf<'input'>();
    });
  });

  describe('value type', () => {
    it('value is string for string input', () => {
      expectTypeOf<StringInputField['value']>().toEqualTypeOf<string | undefined>();
    });
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('MatInputField - Usage', () => {
  it('should accept valid text field configuration', () => {
    const field = {
      type: 'input',
      key: 'name',
      label: 'Name',
      value: 'hello',
      props: { type: 'text' }
    } as const satisfies MatInputField;

    expectTypeOf(field.type).toEqualTypeOf<'input'>();
    expectTypeOf(field.value).toEqualTypeOf<'hello'>();
  });

  it('should accept valid email field configuration', () => {
    const field = {
      type: 'input',
      key: 'email',
      props: { type: 'email', appearance: 'outline' }
    } as const satisfies MatInputField;

    expectTypeOf(field.props.type).toEqualTypeOf<'email'>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeTextField()
// ============================================================================

describe('dbxForgeTextField()', () => {
  it('should create an input field with correct type', () => {
    const field = dbxForgeTextField({ key: 'name', label: 'Name' });
    expect(field.type).toBe('input');
    expect(field.key).toBe('name');
    expect(field.label).toBe('Name');
  });

  it('should set required when specified', () => {
    const field = dbxForgeTextField({ key: 'name', required: true });
    expect(field.required).toBe(true);
  });

  it('should not include required when not specified', () => {
    const field = dbxForgeTextField({ key: 'name' });
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeTextField({ key: 'name', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set minLength and maxLength', () => {
    const field = dbxForgeTextField({ key: 'name', minLength: 2, maxLength: 50 });
    expect(field.minLength).toBe(2);
    expect(field.maxLength).toBe(50);
  });

  it('should set pattern from string', () => {
    const pattern = /^[A-Z]+$/;
    const patternString = pattern.toString();
    const field = dbxForgeTextField({ key: 'code', pattern: patternString });
    expect(field.pattern).toBe(patternString);
  });

  it('should set pattern from RegExp', () => {
    const pattern = /^[A-Z]+$/;
    const field = dbxForgeTextField({ key: 'code', pattern });
    expect(field.pattern).toBe(pattern);
  });

  it('should not include pattern when not specified', () => {
    const field = dbxForgeTextField({ key: 'name' });
    expect(field.pattern).toBeUndefined();
  });

  it('should set inputType in props', () => {
    const field = dbxForgeTextField({ key: 'pass', inputType: 'password' });
    expect(field.props?.type).toBe('password');
  });

  it('should default inputType to text', () => {
    const field = dbxForgeTextField({ key: 'name' });
    expect(field.props?.type).toBe('text');
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeTextField({ key: 'name', description: 'Enter your name' });
    expect(field.props?.hint).toBe('Enter your name');
  });

  it('should set placeholder on field', () => {
    const field = dbxForgeTextField({ key: 'name', placeholder: 'Type here' });
    expect((field as any).placeholder).toBe('Type here');
  });

  it('should not set value when not specified', () => {
    const field = dbxForgeTextField({ key: 'name' });
    expect(field.value).toBeUndefined();
  });

  it('should not set label when not specified', () => {
    const field = dbxForgeTextField({ key: 'name' });
    expect(field.label).toBeUndefined();
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeTextField({ key: 'name', logic });
    expect((field as any).logic).toEqual(logic);
  });
});

// ============================================================================
// Runtime Form Scenarios - dbxForgeTextField()
// ============================================================================

describe('scenarios', () => {
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

  describe('transform', () => {
    it('should transform the value', async () => {
      const transform = (transformValue: string) => {
        return transformValue.toUpperCase();
      };

      const field = dbxForgeTextField({ key: 'name', idempotentTransform: { transform } });

      const formConfig = { fields: [field] };
      fixture.componentInstance.config.set(formConfig);

      fixture.detectChanges();
      await fixture.whenStable();

      const fixtureFormConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);

      expect((fixtureFormConfig.fields[0] as any)._formConfig).toBeDefined();
      expect((fixtureFormConfig.fields[0] as MatInputField).logic).toHaveLength(1);
      expect((fixtureFormConfig.fields[0] as MatInputField).logic?.[0].type).toBe('derivation');

      // set the value
      const name = 'hello';

      fixture.componentInstance.setValue({ name });

      fixture.detectChanges();
      await waitForMs(0); // wait for the changes to propogate. Without this wait it will stablize before the changes have completed.
      await fixture.whenStable();

      const value = await firstValueFrom(fixture.componentInstance.getValue());
      expect(value).toEqual({ name: transform(name) });
    });
  });

  describe('validation', () => {
    it('should validate with the pattern', async () => {
      const pattern = /^[A-Z]+$/;

      const field = dbxForgeTextField({ key: 'name', pattern });

      const formConfig = { fields: [field] };
      fixture.componentInstance.config.set(formConfig);

      fixture.detectChanges();
      await fixture.whenStable();

      const fixtureFormConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);

      expect((fixtureFormConfig.fields[0] as MatInputField).validators).toHaveLength(1);

      // set the value
      const name = '123';

      fixture.componentInstance.setValue({ name });

      fixture.detectChanges();
      await waitForMs(0); // wait for the changes to propogate. Without this wait it will stablize before the changes have completed.
      await fixture.whenStable();

      const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);

      expect(streamEvent.status).toBe('INVALID' as FormControlStatus);
    });

    describe('email inputType', () => {
      it('should register an email validator when inputType is email', async () => {
        const field = dbxForgeTextField({ key: 'email', inputType: 'email' });

        const formConfig = { fields: [field] };
        fixture.componentInstance.config.set(formConfig);

        fixture.detectChanges();
        await fixture.whenStable();

        const fixtureFormConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);
        const configuredField = fixtureFormConfig.fields[0] as MatInputField;

        expect(configuredField.validators).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'email' })]));
        expect(configuredField.validationMessages?.email).toBeDefined();
      });

      it('should mark the form as invalid when the value is not a valid email', async () => {
        const field = dbxForgeTextField({ key: 'email', inputType: 'email' });

        const formConfig = { fields: [field] };
        fixture.componentInstance.config.set(formConfig);

        fixture.detectChanges();
        await fixture.whenStable();

        fixture.componentInstance.setValue({ email: 'not-an-email' });

        fixture.detectChanges();
        await waitForMs(0);
        await fixture.whenStable();

        const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
        expect(streamEvent.status).toBe('INVALID' as FormControlStatus);
      });

      it('should mark the form as valid when the value is a valid email', async () => {
        const field = dbxForgeTextField({ key: 'email', inputType: 'email' });

        const formConfig = { fields: [field] };
        fixture.componentInstance.config.set(formConfig);

        fixture.detectChanges();
        await fixture.whenStable();

        fixture.componentInstance.setValue({ email: 'user@example.com' });

        fixture.detectChanges();
        await waitForMs(0);
        await fixture.whenStable();

        const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
        expect(streamEvent.status).toBe('VALID' as FormControlStatus);
      });

      it('should not register an email validator when inputType is not email', async () => {
        const field = dbxForgeTextField({ key: 'name', inputType: 'text' });

        const formConfig = { fields: [field] };
        fixture.componentInstance.config.set(formConfig);

        fixture.detectChanges();
        await fixture.whenStable();

        const fixtureFormConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);
        const configuredField = fixtureFormConfig.fields[0] as MatInputField;

        const validators = configuredField.validators ?? [];
        expect(validators.some((v) => (v as any).type === 'email')).toBe(false);
      });
    });
  });
});
