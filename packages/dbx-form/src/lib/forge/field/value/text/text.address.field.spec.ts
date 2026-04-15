import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, provideZonelessChangeDetection, inject } from '@angular/core';

import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { first, firstValueFrom, timeout, catchError, of, map } from 'rxjs';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeFormComponent } from '../../../form/forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../../form/forge.context';
import { forgeAddressField, forgeAddressFields, forgeAddressLineField, forgeAddressListField } from './text.address.field';
import type { WrapperField } from '@ng-forge/dynamic-forms';
import { DBX_FORGE_SECTION_WRAPPER_TYPE_NAME, type DbxForgeSectionWrapper } from '../../wrapper/section/section.wrapper';

// MARK: Test Host
@Component({
  template: `
    <dbx-forge></dbx-forge>
  `,
  standalone: true,
  imports: [DbxForgeFormComponent],
  providers: [provideDbxForgeFormContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestForgeAddressHostComponent {
  readonly context = inject(DbxForgeFormContext);
}

// MARK: Helpers
const TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Settles the fixture by running multiple change detection cycles to ensure
 * nested wrapper child forms have time to process values and validate.
 */
async function settle(fixture: ComponentFixture<any>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  // Extra cycle for wrapper child form propagation and validation
  await delay(50);
  fixture.detectChanges();
  await fixture.whenStable();
  await delay(50);
  fixture.detectChanges();
  await fixture.whenStable();
}

interface GetValueResult<T = any> {
  readonly received: boolean;
  readonly value: T | undefined;
}

async function tryGetValue<T = any>(context: DbxForgeFormContext<T>, ms = 500): Promise<GetValueResult<T>> {
  return firstValueFrom(
    context.getValue().pipe(
      timeout(ms),
      first(),
      map((value) => ({ received: true, value }) as GetValueResult<T>),
      catchError(() => of({ received: false, value: undefined } as GetValueResult<T>))
    )
  );
}

// MARK: Unit Tests
describe('forgeAddressLineField()', () => {
  it('should create a line 1 field by default', () => {
    const field = forgeAddressLineField();
    expect(field.type).toBe('input');
    expect(field.key).toBe('line1');
    expect(field.label).toBe('Line 1');
  });

  it('should create a line 2 field', () => {
    const field = forgeAddressLineField({ line: 2 });
    expect(field.key).toBe('line2');
    expect(field.label).toBe('Line 2');
  });

  it('should create a street field for line 0', () => {
    const field = forgeAddressLineField({ line: 0 });
    expect(field.key).toBe('line1');
    expect(field.label).toBe('Street');
  });

  it('should allow overriding key and label', () => {
    const field = forgeAddressLineField({ key: 'addr', label: 'Address', line: 1 });
    expect(field.key).toBe('addr');
    expect(field.label).toBe('Address');
  });

  it('should set required when specified', () => {
    const field = forgeAddressLineField({ required: true });
    expect(field.required).toBe(true);
  });
});

describe('forgeAddressFields()', () => {
  it('should create fields with line2 and country by default', () => {
    const fields = forgeAddressFields();
    expect(fields.length).toBe(5); // line1, line2, city, stateZipRow, country
  });

  it('should omit line2 when includeLine2 is false', () => {
    const fields = forgeAddressFields({ includeLine2: false });
    expect(fields.length).toBe(4); // street, city, stateZipRow, country
  });

  it('should omit country when includeCountry is false', () => {
    const fields = forgeAddressFields({ includeCountry: false });
    expect(fields.length).toBe(4); // line1, line2, city, stateZipRow
  });

  it('should omit both line2 and country when disabled', () => {
    const fields = forgeAddressFields({ includeLine2: false, includeCountry: false });
    expect(fields.length).toBe(3); // street, city, stateZipRow
  });
});

describe('forgeAddressField()', () => {
  it('should create a wrapper field with address key', () => {
    const field = forgeAddressField();
    expect(field.type).toBe('wrapper');
    expect(field.key).toBe('address');
  });

  it('should have a section wrapper config', () => {
    const field = forgeAddressField() as WrapperField;
    const wrapperConfig = field.wrappers[0] as DbxForgeSectionWrapper;
    expect(wrapperConfig.type).toBe(DBX_FORGE_SECTION_WRAPPER_TYPE_NAME);
  });

  it('should allow overriding key', () => {
    const field = forgeAddressField({ key: 'home' });
    expect(field.key).toBe('home');
  });

  it('should set header to Address by default', () => {
    const field = forgeAddressField() as WrapperField;
    const wrapperConfig = field.wrappers[0] as DbxForgeSectionWrapper;
    expect(wrapperConfig.headerConfig.header).toBe('Address');
  });

  it('should allow overriding header', () => {
    const field = forgeAddressField({ header: 'Billing Address' }) as WrapperField;
    const wrapperConfig = field.wrappers[0] as DbxForgeSectionWrapper;
    expect(wrapperConfig.headerConfig.header).toBe('Billing Address');
  });

  it('should pass child fields directly on the wrapper field', () => {
    const field = forgeAddressField() as WrapperField;
    expect(field.fields.length).toBeGreaterThan(0);
  });
});

describe('forgeAddressListField()', () => {
  it('should create an array field with addresses key', () => {
    const field = forgeAddressListField();
    expect(field.key).toBe('addresses');
  });

  it('should allow overriding key', () => {
    const field = forgeAddressListField({ key: 'locations' });
    expect(field.key).toBe('locations');
  });
});

// MARK: Integration Tests
describe('forgeAddressField() integration', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeAddressHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function createAddressConfig(config: Parameters<typeof forgeAddressField>[0] = {}): FormConfig {
    return { fields: [forgeAddressField(config) as any] };
  }

  const VALID_ADDRESS = {
    address: {
      line1: '123 Main St',
      line2: 'Apt 4',
      city: 'Springfield',
      state: 'IL',
      zip: '62704',
      country: 'US'
    }
  };

  describe('valid-to-invalid transition', () => {
    it('should not emit getValue() when form transitions from valid to invalid', async () => {
      const fixture = TestBed.createComponent(TestForgeAddressHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createAddressConfig({ required: true });

      await settle(fixture);

      // Set a fully valid address
      context.setValue(VALID_ADDRESS as any);
      await settle(fixture);

      // Verify it emits when valid
      const validResult = await tryGetValue(context);
      expect(validResult.received).toBe(true);
      expect((validResult.value as any)?.address).toBeDefined();

      // Now clear a required field (zip) to make the form invalid
      context.setValue({
        address: {
          line1: '123 Main St',
          line2: 'Apt 4',
          city: 'Springfield',
          state: 'IL',
          zip: '', // required field is now empty → invalid
          country: 'US'
        }
      } as any);
      await settle(fixture);

      // getValue() should NOT emit because the form is now invalid
      const invalidResult = await tryGetValue(context);
      expect(invalidResult.received).toBe(false);

      fixture.destroy();
    });

    it('should not emit getValue() when a required field is cleared', async () => {
      const fixture = TestBed.createComponent(TestForgeAddressHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createAddressConfig({ required: true });

      await settle(fixture);

      // Set a fully valid address
      context.setValue(VALID_ADDRESS as any);
      await settle(fixture);

      // Verify valid
      const validResult = await tryGetValue(context);
      expect(validResult.received).toBe(true);

      // Clear city (required)
      context.setValue({
        address: {
          line1: '123 Main St',
          line2: 'Apt 4',
          city: '', // required field cleared
          state: 'IL',
          zip: '62704',
          country: 'US'
        }
      } as any);
      await settle(fixture);

      const invalidResult = await tryGetValue(context);
      expect(invalidResult.received).toBe(false);

      fixture.destroy();
    });

    it('should report isComplete=false when address becomes invalid', async () => {
      const fixture = TestBed.createComponent(TestForgeAddressHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createAddressConfig({ required: true });

      await settle(fixture);

      // Set valid address
      context.setValue(VALID_ADDRESS as any);
      await settle(fixture);

      // Verify complete
      let event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);

      // Invalidate by clearing line1 (required)
      context.setValue({
        address: {
          line1: '', // required field cleared
          line2: 'Apt 4',
          city: 'Springfield',
          state: 'IL',
          zip: '62704',
          country: 'US'
        }
      } as any);
      await settle(fixture);

      event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(false);
      expect(event.status).toBe('INVALID');

      fixture.destroy();
    });

    it('should resume emitting getValue() when form becomes valid again', async () => {
      const fixture = TestBed.createComponent(TestForgeAddressHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createAddressConfig({ required: true });

      await settle(fixture);

      // Start valid
      context.setValue(VALID_ADDRESS as any);
      await settle(fixture);

      let result = await tryGetValue(context);
      expect(result.received).toBe(true);

      // Make invalid
      context.setValue({
        address: { line1: '123 Main St', line2: '', city: 'Springfield', state: 'IL', zip: '', country: 'US' }
      } as any);
      await settle(fixture);

      result = await tryGetValue(context);
      expect(result.received).toBe(false);

      // Make valid again
      context.setValue(VALID_ADDRESS as any);
      await settle(fixture);

      result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect((result.value as any)?.address).toBeDefined();

      fixture.destroy();
    });
  });

  describe('with optional fields', () => {
    it('should emit getValue() when all fields are empty and not required', async () => {
      const fixture = TestBed.createComponent(TestForgeAddressHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createAddressConfig({ required: false });

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);

      fixture.destroy();
    });
  });
});
