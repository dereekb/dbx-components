/**
 * Exhaustive type and runtime tests for the additional text forge preset fields.
 */
import { describe, it, expect, expectTypeOf, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { waitForMs } from '@dereekb/util';
import { dbxForgeNameField, dbxForgeEmailField, dbxForgeCityField, dbxForgeStateField, dbxForgeCountryField, dbxForgeZipCodeField, dbxForgeLatLngTextField, DEFAULT_FORGE_LAT_LNG_TEXT_FIELD_PLACEHOLDER } from './text.additional.field';
import type { DbxForgeEmailFieldConfig, DbxForgeStateFieldConfig } from './text.additional.field';
import type { DbxForgeTextFieldConfig } from './text.field';
import { ADDRESS_CITY_MAX_LENGTH, ADDRESS_STATE_CODE_MAX_LENGTH, ADDRESS_STATE_MAX_LENGTH, ADDRESS_COUNTRY_MAX_LENGTH, ADDRESS_ZIP_MAX_LENGTH } from '@dereekb/model';
import type { FieldAutocompleteAttributeOption } from '../../../../field/field.autocomplete';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';

// ============================================================================
// DbxForgeEmailFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeEmailFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys = 'key' | 'label' | 'placeholder' | 'required' | 'readonly' | 'description' | 'autocomplete';

  type ActualKeys = keyof DbxForgeEmailFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('optional keys', () => {
    it('key', () => {
      expectTypeOf<DbxForgeEmailFieldConfig['key']>().toEqualTypeOf<string | undefined>();
    });

    it('label', () => {
      expectTypeOf<DbxForgeEmailFieldConfig['label']>().toEqualTypeOf<string | undefined>();
    });

    it('placeholder', () => {
      expectTypeOf<DbxForgeEmailFieldConfig['placeholder']>().toEqualTypeOf<string | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgeEmailFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('readonly', () => {
      expectTypeOf<DbxForgeEmailFieldConfig['readonly']>().toEqualTypeOf<boolean | undefined>();
    });

    it('description', () => {
      expectTypeOf<DbxForgeEmailFieldConfig['description']>().toEqualTypeOf<string | undefined>();
    });

    it('autocomplete', () => {
      expectTypeOf<DbxForgeEmailFieldConfig['autocomplete']>().toEqualTypeOf<FieldAutocompleteAttributeOption | undefined>();
    });
  });
});

// ============================================================================
// DbxForgeStateFieldConfig - Type Tests
// ============================================================================

describe('DbxForgeStateFieldConfig - Type Tests', () => {
  it('should include asCode', () => {
    expectTypeOf<DbxForgeStateFieldConfig['asCode']>().toEqualTypeOf<boolean | undefined>();
  });

  it('should extend Partial<DbxForgeTextFieldConfig>', () => {
    expectTypeOf<DbxForgeStateFieldConfig>().toExtend<Partial<DbxForgeTextFieldConfig>>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeNameField()
// ============================================================================

describe('dbxForgeNameField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeNameField();
    expect(field.type).toBe('input');
  });

  it('should default key to name', () => {
    const field = dbxForgeNameField();
    expect(field.key).toBe('name');
  });

  it('should default label to Name', () => {
    const field = dbxForgeNameField();
    expect(field.label).toBe('Name');
  });

  it('should default placeholder to John Doe', () => {
    const field = dbxForgeNameField();
    expect(field.placeholder).toBe('John Doe');
  });

  it('should allow overriding key', () => {
    const field = dbxForgeNameField({ key: 'fullName' });
    expect(field.key).toBe('fullName');
  });

  it('should pass required through', () => {
    const field = dbxForgeNameField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should default required to false', () => {
    const field = dbxForgeNameField();
    expect(field.required).toBe(false);
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeEmailField()
// ============================================================================

describe('dbxForgeEmailField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeEmailField();
    expect(field.type).toBe('input');
  });

  it('should default key to email', () => {
    const field = dbxForgeEmailField();
    expect(field.key).toBe('email');
  });

  it('should default label to Email Address', () => {
    const field = dbxForgeEmailField();
    expect(field.label).toBe('Email Address');
  });

  it('should default placeholder to you@example.com', () => {
    const field = dbxForgeEmailField();
    expect(field.placeholder).toBe('you@example.com');
  });

  it('should set inputType to email in props', () => {
    const field = dbxForgeEmailField();
    expect(field.props?.type).toBe('email');
  });

  it('should allow overriding key', () => {
    const field = dbxForgeEmailField({ key: 'contactEmail' });
    expect(field.key).toBe('contactEmail');
  });

  it('should pass required through', () => {
    const field = dbxForgeEmailField({ required: true });
    expect(field.required).toBe(true);
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeCityField()
// ============================================================================

describe('dbxForgeCityField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeCityField();
    expect(field.type).toBe('input');
  });

  it('should default key to city', () => {
    const field = dbxForgeCityField();
    expect(field.key).toBe('city');
  });

  it('should default label to City', () => {
    const field = dbxForgeCityField();
    expect(field.label).toBe('City');
  });

  it('should default maxLength to ADDRESS_CITY_MAX_LENGTH', () => {
    const field = dbxForgeCityField();
    expect(field.maxLength).toBe(ADDRESS_CITY_MAX_LENGTH);
  });

  it('should allow overriding key', () => {
    const field = dbxForgeCityField({ key: 'hometown' });
    expect(field.key).toBe('hometown');
  });

  it('should pass required through', () => {
    const field = dbxForgeCityField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should default required to false', () => {
    const field = dbxForgeCityField();
    expect(field.required).toBe(false);
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeStateField()
// ============================================================================

describe('dbxForgeStateField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeStateField();
    expect(field.type).toBe('input');
  });

  it('should default key to state', () => {
    const field = dbxForgeStateField();
    expect(field.key).toBe('state');
  });

  it('should default label to State', () => {
    const field = dbxForgeStateField();
    expect(field.label).toBe('State');
  });

  it('should default maxLength to ADDRESS_STATE_MAX_LENGTH when asCode is false', () => {
    const field = dbxForgeStateField();
    expect(field.maxLength).toBe(ADDRESS_STATE_MAX_LENGTH);
  });

  it('should set maxLength to ADDRESS_STATE_CODE_MAX_LENGTH when asCode is true', () => {
    const field = dbxForgeStateField({ asCode: true });
    expect(field.maxLength).toBe(ADDRESS_STATE_CODE_MAX_LENGTH);
  });

  it('should allow overriding key', () => {
    const field = dbxForgeStateField({ key: 'province' });
    expect(field.key).toBe('province');
  });

  it('should pass required through', () => {
    const field = dbxForgeStateField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should default required to false', () => {
    const field = dbxForgeStateField();
    expect(field.required).toBe(false);
  });

  describe('scenarios', () => {
    let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [...DBX_FORGE_TEST_PROVIDERS] });
      fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
    });

    afterEach(() => {
      TestBed.resetTestingModule();
    });

    async function settle(): Promise<void> {
      fixture.detectChanges();
      await waitForMs(0);
      await fixture.whenStable();
    }

    describe('idempotentTransform', () => {
      it('should uppercase a lowercase "tx" value when asCode: true', async () => {
        const field = dbxForgeStateField({ asCode: true });

        fixture.componentInstance.config.set({ fields: [field as never] });
        fixture.detectChanges();
        await fixture.whenStable();

        fixture.componentInstance.setValue({ state: 'tx' } as never);
        await settle();

        const value = await firstValueFrom(fixture.componentInstance.getValue());
        expect(value).toEqual({ state: 'TX' });
      });

      it('should uppercase a lowercase "tx" value when an explicit idempotentTransform.toUppercase is provided', async () => {
        const field = dbxForgeStateField({ idempotentTransform: { toUppercase: true } });

        fixture.componentInstance.config.set({ fields: [field as never] });
        fixture.detectChanges();
        await fixture.whenStable();

        fixture.componentInstance.setValue({ state: 'tx' } as never);
        await settle();

        const value = await firstValueFrom(fixture.componentInstance.getValue());
        expect(value).toEqual({ state: 'TX' });
      });

      it('should leave a lowercase "tx" value untouched when neither asCode nor a transform is provided', async () => {
        const field = dbxForgeStateField();

        fixture.componentInstance.config.set({ fields: [field as never] });
        fixture.detectChanges();
        await fixture.whenStable();

        fixture.componentInstance.setValue({ state: 'tx' } as never);
        await settle();

        const value = await firstValueFrom(fixture.componentInstance.getValue());
        expect(value).toEqual({ state: 'tx' });
      });
    });
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeCountryField()
// ============================================================================

describe('dbxForgeCountryField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeCountryField();
    expect(field.type).toBe('input');
  });

  it('should default key to country', () => {
    const field = dbxForgeCountryField();
    expect(field.key).toBe('country');
  });

  it('should default label to Country', () => {
    const field = dbxForgeCountryField();
    expect(field.label).toBe('Country');
  });

  it('should default maxLength to ADDRESS_COUNTRY_MAX_LENGTH', () => {
    const field = dbxForgeCountryField();
    expect(field.maxLength).toBe(ADDRESS_COUNTRY_MAX_LENGTH);
  });

  it('should allow overriding key', () => {
    const field = dbxForgeCountryField({ key: 'nation' });
    expect(field.key).toBe('nation');
  });

  it('should pass required through', () => {
    const field = dbxForgeCountryField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should default required to false', () => {
    const field = dbxForgeCountryField();
    expect(field.required).toBe(false);
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeZipCodeField()
// ============================================================================

describe('dbxForgeZipCodeField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeZipCodeField();
    expect(field.type).toBe('input');
  });

  it('should default key to zip', () => {
    const field = dbxForgeZipCodeField();
    expect(field.key).toBe('zip');
  });

  it('should default label to Zip Code', () => {
    const field = dbxForgeZipCodeField();
    expect(field.label).toBe('Zip Code');
  });

  it('should default maxLength to ADDRESS_ZIP_MAX_LENGTH', () => {
    const field = dbxForgeZipCodeField();
    expect(field.maxLength).toBe(ADDRESS_ZIP_MAX_LENGTH);
  });

  it('should allow overriding key', () => {
    const field = dbxForgeZipCodeField({ key: 'postalCode' });
    expect(field.key).toBe('postalCode');
  });

  it('should pass required through', () => {
    const field = dbxForgeZipCodeField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should default required to false', () => {
    const field = dbxForgeZipCodeField();
    expect(field.required).toBe(false);
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeLatLngTextField()
// ============================================================================

describe('dbxForgeLatLngTextField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeLatLngTextField();
    expect(field.type).toBe('input');
  });

  it('should default key to latLng', () => {
    const field = dbxForgeLatLngTextField();
    expect(field.key).toBe('latLng');
  });

  it('should default label to Coordinates', () => {
    const field = dbxForgeLatLngTextField();
    expect(field.label).toBe('Coordinates');
  });

  it('should default placeholder to DEFAULT_FORGE_LAT_LNG_TEXT_FIELD_PLACEHOLDER', () => {
    const field = dbxForgeLatLngTextField();
    expect(field.placeholder).toBe(DEFAULT_FORGE_LAT_LNG_TEXT_FIELD_PLACEHOLDER);
  });

  it('should allow overriding key', () => {
    const field = dbxForgeLatLngTextField({ key: 'coordinates' });
    expect(field.key).toBe('coordinates');
  });
});
