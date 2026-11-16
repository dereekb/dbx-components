/**
 * Type and factory tests for the layout boxes forge field.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { Component } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { of } from 'rxjs';
import { dbxForgeLayoutBoxesField } from './layoutboxes.field';
import type { DbxForgeLayoutBoxesFieldConfig, DbxForgeLayoutBoxesFieldDef, DbxForgeLayoutBoxesFieldProps } from './layoutboxes.field';
import { type DbxLayoutBoxesValue } from '../../../../field/value/layoutboxes/layoutboxes';

interface TestData {
  readonly kind: 'person' | 'thing';
  readonly label?: string;
}

@Component({ template: '' })
class TestRowComponent {}

const TEST_ITEM: DbxInjectionComponentConfig = { componentClass: TestRowComponent };

// MARK: Config
describe('DbxForgeLayoutBoxesFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeLayoutBoxesFieldDef>
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
    | 'wrappers'
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    | 'nullable'
    | 'validateWhenHidden'
    | 'addons'
    // Phantom brand
    | '__fieldDef';

  type ActualKeys = keyof DbxForgeLayoutBoxesFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('key is required', () => {
    expectTypeOf<DbxForgeLayoutBoxesFieldConfig['key']>().toEqualTypeOf<string>();
  });
});

// MARK: Field Def
describe('DbxForgeLayoutBoxesFieldDef - Exhaustive Whitelist', () => {
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
    | 'wrappers'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    // From BaseValueField
    | 'value'
    | 'placeholder'
    | 'nullable'
    | 'validateWhenHidden'
    | 'addons';

  type ActualKeys = keyof DbxForgeLayoutBoxesFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal dbx-layout-boxes', () => {
    expectTypeOf<DbxForgeLayoutBoxesFieldDef['type']>().toEqualTypeOf<'dbx-layout-boxes'>();
  });

  it('value is the layout boxes value', () => {
    expectTypeOf<DbxForgeLayoutBoxesFieldDef<TestData>['value']>().toEqualTypeOf<DbxLayoutBoxesValue<TestData> | undefined>();
  });
});

// MARK: Props
describe('DbxForgeLayoutBoxesFieldProps - Exhaustive Whitelist', () => {
  type ExpectedKeys = 'canvas' | 'imageUrl' | 'item' | 'itemStyle' | 'addOptions' | 'cap' | 'listPosition' | 'hint' | 'wrapped';
  type ActualKeys = keyof DbxForgeLayoutBoxesFieldProps;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// MARK: Usage
describe('DbxForgeLayoutBoxesFieldDef - Usage', () => {
  it('should accept a valid layout boxes field configuration', () => {
    const config = {
      key: 'boxes',
      props: {
        canvas: { width: 16, height: 9 },
        itemStyle: (item) => ({ color: item.data.kind === 'person' ? 'primary' : 'accent' }),
        addOptions: [{ text: 'Add', data: () => ({ kind: 'thing' }) }]
      }
    } satisfies DbxForgeLayoutBoxesFieldConfig<TestData>;

    expect(config.key).toBe('boxes');
  });

  it('should preserve the payload generic', () => {
    const field = dbxForgeLayoutBoxesField<TestData>({ key: 'boxes' });
    expectTypeOf(field).toExtend<{ readonly value?: DbxLayoutBoxesValue<TestData> }>();
  });
});

// MARK: Factory
describe('dbxForgeLayoutBoxesField()', () => {
  it('should return a field with type "dbx-layout-boxes"', () => {
    const field = dbxForgeLayoutBoxesField({ key: 'boxes' }) as any;
    expect(field.type).toBe('dbx-layout-boxes');
    expect(field.key).toBe('boxes');
  });

  it('should attach the form-field wrapper by default', () => {
    const field = dbxForgeLayoutBoxesField({ key: 'boxes' }) as any;
    const wrappers: Array<{ readonly type: string }> = field.wrappers ?? [];
    expect(wrappers.some((w) => w.type === 'dbx-forge-form-field-wrapper')).toBe(true);
  });

  it('should omit the form-field wrapper when wrapped is false', () => {
    const field = dbxForgeLayoutBoxesField({ key: 'boxes', props: { wrapped: false } }) as any;
    const wrappers: Array<{ readonly type: string }> = field.wrappers ?? [];
    expect(wrappers.some((w) => w.type === 'dbx-forge-form-field-wrapper')).toBe(false);
  });

  it('should map hint to props.hint', () => {
    const field = dbxForgeLayoutBoxesField({ key: 'boxes', hint: 'Draw the boxes' }) as any;
    expect(field.props?.hint).toBe('Draw the boxes');
  });

  it('should pass the props through, keeping the item config reference', () => {
    const canvas$ = of({ width: 4, height: 3 });
    const field = dbxForgeLayoutBoxesField<TestData>({ key: 'boxes', props: { item: TEST_ITEM, canvas: canvas$, listPosition: 'below', cap: { max: 2 } } }) as any;
    expect(field.props.item).toBe(TEST_ITEM);
    expect(field.props.canvas).toBe(canvas$);
    expect(field.props.listPosition).toBe('below');
    expect(field.props.cap).toEqual({ max: 2 });
  });

  it('should pass the validation and state options through', () => {
    const logic = [{ type: 'hidden' as const, condition: true }];
    const field = dbxForgeLayoutBoxesField({ key: 'boxes', minLength: 1, maxLength: 3, required: true, readonly: true, disabled: true, logic } as any) as any;
    expect(field.minLength).toBe(1);
    expect(field.maxLength).toBe(3);
    expect(field.required).toBe(true);
    expect(field.readonly).toBe(true);
    expect(field.disabled).toBe(true);
    expect(field.logic).toEqual(logic);
  });

  it('should default the value to a new empty array on each call', () => {
    const a = dbxForgeLayoutBoxesField({ key: 'boxes' }) as any;
    const b = dbxForgeLayoutBoxesField({ key: 'boxes' }) as any;
    expect(a.value).toEqual([]);
    expect(b.value).toEqual([]);
    expect(a.value).not.toBe(b.value);
  });

  it('should keep an explicit value', () => {
    const value: DbxLayoutBoxesValue<TestData> = [{ box: { x: 0, y: 0, w: 0.5, h: 0.5 }, data: { kind: 'thing' } }];
    const field = dbxForgeLayoutBoxesField<TestData>({ key: 'boxes', value }) as any;
    expect(field.value).toBe(value);
  });
});
