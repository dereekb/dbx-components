import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { FORGE_EXPAND_FIELD_TYPE_NAME, type DbxForgeExpandFieldDef, type DbxForgeExpandFieldProps, type DbxForgeExpandButtonType } from './expand.field';

// ============================================================================
// DbxForgeExpandFieldDef - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeExpandFieldDef - Exhaustive Whitelist', () => {
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
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | 'wrappers'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
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
    | 'placeholder'
    | 'nullable';

  type ActualKeys = keyof DbxForgeExpandFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is the literal dbx-forge-expand', () => {
    expectTypeOf<DbxForgeExpandFieldDef['type']>().toEqualTypeOf<'dbx-forge-expand'>();
  });

  it('value is boolean or undefined', () => {
    expectTypeOf<DbxForgeExpandFieldDef['value']>().toEqualTypeOf<boolean | undefined>();
  });

  it('props is DbxForgeExpandFieldProps or undefined', () => {
    expectTypeOf<DbxForgeExpandFieldDef['props']>().toEqualTypeOf<DbxForgeExpandFieldProps | undefined>();
  });
});

// ============================================================================
// DbxForgeExpandFieldProps - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeExpandFieldProps - Exhaustive Whitelist', () => {
  type ExpectedKeys = 'buttonType' | 'expandLabel';

  type ActualKeys = keyof DbxForgeExpandFieldProps;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// ============================================================================
// DbxForgeExpandButtonType - Type Assertions
// ============================================================================

describe('DbxForgeExpandButtonType', () => {
  it('should be button or text', () => {
    expectTypeOf<DbxForgeExpandButtonType>().toEqualTypeOf<'button' | 'text'>();
  });
});

// ============================================================================
// Usage / Satisfies
// ============================================================================

describe('Usage', () => {
  it('should accept valid expand field definition', () => {
    const field = {
      type: 'dbx-forge-expand',
      key: 'showMore',
      props: { buttonType: 'text', expandLabel: 'Show more' }
    } as const satisfies DbxForgeExpandFieldDef;

    expectTypeOf(field.type).toEqualTypeOf<'dbx-forge-expand'>();
  });
});

// ============================================================================
// Runtime Constant Tests
// ============================================================================

describe('FORGE_EXPAND_FIELD_TYPE_NAME', () => {
  it('FORGE_EXPAND_FIELD_TYPE_NAME should be dbx-forge-expand', () => {
    expect(FORGE_EXPAND_FIELD_TYPE_NAME).toBe('dbx-forge-expand');
  });
});
