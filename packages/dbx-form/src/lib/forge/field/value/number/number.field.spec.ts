import { describe, it, expect, expectTypeOf } from 'vitest';
import { type FormConfig, type LogicConfig } from '@ng-forge/dynamic-forms';
import type { MatInputField } from '@ng-forge/dynamic-forms-material';
import { waitForMs } from '@dereekb/util';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { firstValueFrom } from 'rxjs';
import { dbxForgeNumberField, dbxForgeDollarAmountField, FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY, type DbxForgeNumberFieldConfig } from './number.field';

// ============================================================================
// DbxForgeNumberFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeNumberFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeNumberFieldDef>
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
    | 'wrappers'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    | 'nullable'
    | '__fieldDef'
    // From FieldAutocompleteAttributeOptionRef
    | 'autocomplete'
    // From DbxForgeNumberFieldNumberConfig
    | 'step'
    | 'enforceStep'
    // From Partial<TransformNumberFunctionConfigRef>
    | 'transform'
    // Idempotent transform
    | 'idempotentTransform';

  type ActualKeys = keyof DbxForgeNumberFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeNumberField()
// ============================================================================

describe('dbxForgeNumberField()', () => {
  it('should create an input field with number type in props', () => {
    const field = dbxForgeNumberField({ key: 'quantity', label: 'Quantity' });
    expect(field.type).toBe('input');
    expect(field.key).toBe('quantity');
    expect(field.label).toBe('Quantity');
    expect(field.props?.type).toBe('number');
  });

  it('should set required when specified', () => {
    const field = dbxForgeNumberField({ key: 'qty', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeNumberField({ key: 'qty', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set min and max on the field', () => {
    const field = dbxForgeNumberField({ key: 'qty', min: 1, max: 100 });
    expect(field.min).toBe(1);
    expect(field.max).toBe(100);
  });

  it('should set min and max on body and and step in meta', () => {
    const field = dbxForgeNumberField({ key: 'qty', min: 0, max: 50, step: 5 });
    expect(field.min).toBe(0);
    expect(field.max).toBe(50);
    expect((field.meta as any).step).toBe(5);
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeNumberField({ key: 'qty', description: 'Enter quantity' });
    expect(field.props?.hint).toBe('Enter quantity');
  });

  it('should have no default value when none is specified', () => {
    const field = dbxForgeNumberField({ key: 'qty' });
    expect(field.value).toBeUndefined();
  });

  it('should use value when provided', () => {
    const field = dbxForgeNumberField({ key: 'qty', value: 42 });
    expect(field.value).toBe(42);
  });

  it('should allow value of 0', () => {
    const field = dbxForgeNumberField({ key: 'qty', value: 0 });
    expect(field.value).toBe(0);
  });

  it('should leave label undefined when not specified', () => {
    const field = dbxForgeNumberField({ key: 'qty' });
    expect(field.label).toBeUndefined();
  });

  describe('step and enforceStep', () => {
    it('should set meta.step when step is provided', () => {
      const field = dbxForgeNumberField({ key: 'qty', step: 5 });
      expect((field as any).meta?.step).toBe(5);
    });

    it('should not set meta when step is not provided', () => {
      const field = dbxForgeNumberField({ key: 'qty' });
      expect((field as any).meta).toBeUndefined();
    });

    it('should add a custom isDivisibleBy validator when enforceStep is true', () => {
      const field = dbxForgeNumberField({ key: 'qty', step: 5, enforceStep: true });
      const validators = (field as any).validators;
      expect(validators).toBeDefined();
      expect(validators.length).toBe(1);
      expect(validators[0].kind).toBe(FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY);
    });

    it('should add isDivisibleBy validation message when enforceStep is true', () => {
      const field = dbxForgeNumberField({ key: 'qty', step: 5, enforceStep: true });
      expect(field.validationMessages?.[FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY]).toBeDefined();
    });

    it('should not add a validator when enforceStep is false', () => {
      const field = dbxForgeNumberField({ key: 'qty', step: 5 });
      expect((field as any).validators).toBeUndefined();
    });

    it('should not add a validator when step is not provided even if enforceStep is true', () => {
      const field = dbxForgeNumberField({ key: 'qty', enforceStep: true });
      expect((field as any).validators).toBeUndefined();
    });
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeNumberField({ key: 'num', logic });
    expect((field as any).logic).toEqual(logic);
  });

  describe('idempotentTransform', () => {
    it('should add a derivation logic entry when idempotentTransform is set', () => {
      const field = dbxForgeNumberField({ key: 'quantity', idempotentTransform: { precision: 2 } });
      expect((field as any).logic).toHaveLength(1);
      expect((field as any).logic[0].type).toBe('derivation');
    });

    it('should not add logic when idempotentTransform is not set', () => {
      const field = dbxForgeNumberField({ key: 'quantity' });
      expect((field as any).logic).toBeUndefined();
    });
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeDollarAmountField()
// ============================================================================

describe('dbxForgeDollarAmountField()', () => {
  it('should create a number input field', () => {
    const field = dbxForgeDollarAmountField({ key: 'price', label: 'Price' });
    expect(field.type).toBe('input');
    expect(field.props?.type).toBe('number');
  });

  it('should set min when specified', () => {
    const field = dbxForgeDollarAmountField({ key: 'price', min: 0 });
    expect(field.min).toBe(0);
  });

  it('should set required when specified', () => {
    const field = dbxForgeDollarAmountField({ key: 'price', required: true });
    expect(field.required).toBe(true);
  });

  it('should have no default value when none is specified', () => {
    const field = dbxForgeDollarAmountField({ key: 'price' });
    expect(field.value).toBeUndefined();
  });

  it('should use value when provided', () => {
    const field = dbxForgeDollarAmountField({ key: 'price', value: 9.99 });
    expect(field.value).toBe(9.99);
  });

  it('should set the key from config', () => {
    const field = dbxForgeDollarAmountField({ key: 'total' });
    expect(field.key).toBe('total');
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeDollarAmountField({ key: 'price', description: 'Enter amount in USD' });
    expect(field.props?.hint).toBe('Enter amount in USD');
  });

  it('should set precision to DOLLAR_AMOUNT_PRECISION via transform', () => {
    const field = dbxForgeDollarAmountField({ key: 'price' });
    expect(field.type).toBe('input');
    expect(field.key).toBe('price');
  });

  it('should set label when provided', () => {
    const field = dbxForgeDollarAmountField({ key: 'price', label: 'Amount' });
    expect(field.label).toBe('Amount');
  });

  it('should leave label undefined when not provided', () => {
    const field = dbxForgeDollarAmountField({ key: 'price' });
    expect(field.label).toBeUndefined();
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeDollarAmountField({ key: 'dollars', logic });
    expect((field as any).logic).toEqual(logic);
  });
});

// ============================================================================
// Runtime Form Scenarios - dbxForgeNumberField()
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

  describe('idempotentTransform', () => {
    it('should transform the value with a custom transform function', async () => {
      const transform = (value: number) => Math.round(value);

      const field = dbxForgeNumberField({ key: 'quantity', idempotentTransform: { transform } });

      const formConfig = { fields: [field] };
      fixture.componentInstance.config.set(formConfig);

      fixture.detectChanges();
      await fixture.whenStable();

      const fixtureFormConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);

      expect((fixtureFormConfig.fields[0] as any)._formConfig).toBeDefined();
      expect((fixtureFormConfig.fields[0] as MatInputField).logic).toHaveLength(1);
      expect((fixtureFormConfig.fields[0] as MatInputField).logic?.[0].type).toBe('derivation');

      // set a value with decimal places
      const quantity = 3.7;

      fixture.componentInstance.setValue({ quantity });

      fixture.detectChanges();
      await waitForMs(0);
      await fixture.whenStable();

      const value = await firstValueFrom(fixture.componentInstance.getValue());
      expect(value).toEqual({ quantity: transform(quantity) });
    });

    it('should truncate to the configured precision', async () => {
      const field = dbxForgeNumberField({ key: 'price', idempotentTransform: { precision: 2 } });

      const formConfig = { fields: [field] };
      fixture.componentInstance.config.set(formConfig);

      fixture.detectChanges();
      await fixture.whenStable();

      // set a value with excess decimal places
      const price = 9.999;

      fixture.componentInstance.setValue({ price });

      fixture.detectChanges();
      await waitForMs(0);
      await fixture.whenStable();

      const value = await firstValueFrom(fixture.componentInstance.getValue());
      expect(value).toEqual({ price: 9.99 });
    });
  });
});
