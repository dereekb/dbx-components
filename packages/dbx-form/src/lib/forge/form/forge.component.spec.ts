import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, signal, provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { type FormConfig, DynamicForm, EventDispatcher } from '@ng-forge/dynamic-forms';
import { first, firstValueFrom, timeout, catchError, of, map } from 'rxjs';
import { provideDbxForgeFormFieldDeclarations } from '../forge.providers';
import { provideDbxFormConfiguration } from '../../form.providers';
import { DbxForgeFormComponent } from './forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext, stripForgeInternalKeys } from './forge.context';
import { forgeTextField } from '../field/value/text/text.field';
import { forgeToggleWrapper } from '../field/wrapper/wrapper';

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
class TestForgeFormHostComponent {
  readonly context: DbxForgeFormContext;

  constructor(context: DbxForgeFormContext) {
    this.context = context;
  }
}

// MARK: Helpers
const TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), provideNoopAnimations()];
const SETTLE_TIME = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle(fixture: ComponentFixture<any>, rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    fixture.detectChanges();
    await delay(SETTLE_TIME);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  await delay(50);
  fixture.detectChanges();
}

function createRequiredFieldConfig(): FormConfig {
  return {
    fields: [forgeTextField({ key: 'name', label: 'Name', required: true }) as any]
  };
}

function createOptionalFieldConfig(): FormConfig {
  return {
    fields: [forgeTextField({ key: 'name', label: 'Name' }) as any]
  };
}

// MARK: Tests
describe('DbxForgeFormComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeFormHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('validation gating (requireValid = true)', () => {
    it('should not emit getValue() when a required field is empty', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      // getValue() should not emit because the required field is empty
      const result = await firstValueFrom(
        context.getValue().pipe(
          timeout(500),
          first(),
          map((value) => ({ received: true, value })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      expect(result.received).toBe(false);
      fixture.destroy();
    });

    it('should emit getValue() when a required field has a value', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      // Set a valid value
      context.setValue({ name: 'Test' } as any);
      await settle(fixture);

      const result = await firstValueFrom(
        context.getValue().pipe(
          timeout(500),
          first(),
          map((value) => ({ received: true, value })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      expect(result.received).toBe(true);
      expect((result.value as any)?.name).toBe('Test');
      fixture.destroy();
    });

    it('should emit getValue() for optional fields even when empty', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createOptionalFieldConfig();

      await settle(fixture);

      const result = await firstValueFrom(
        context.getValue().pipe(
          timeout(500),
          first(),
          map((value) => ({ received: true, value })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      expect(result.received).toBe(true);
      fixture.destroy();
    });

    it('should report isComplete=false in stream$ when required field is empty', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(false);
      expect(event.status).toBe('INVALID');
      fixture.destroy();
    });

    it('should report isComplete=true in stream$ when required field has a value', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      context.setValue({ name: 'Valid' } as any);
      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);
      expect(event.status).toBe('VALID');
      fixture.destroy();
    });
  });

  describe('requireValid = false', () => {
    it('should emit getValue() even when a required field is empty', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      const result = await firstValueFrom(
        context.getValue().pipe(
          timeout(500),
          first(),
          map((value) => ({ received: true, value })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      expect(result.received).toBe(true);
      fixture.destroy();
    });

    it('should still report isComplete=false in stream$ when invalid', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(false);
      fixture.destroy();
    });
  });

  describe('stripInternalKeys (default true)', () => {
    it('should strip _ prefixed keys from toggle wrapper output', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false; // let values through regardless of validation

      context.config = {
        fields: [
          forgeToggleWrapper({
            label: 'Show details',
            fields: [forgeTextField({ key: 'detail', label: 'Detail' }) as any]
          }) as any
        ]
      };

      await settle(fixture);

      const value = await firstValueFrom(context.getValue().pipe(timeout(500), first()));

      // Should not have any keys starting with _
      const keys = Object.keys(value as object);
      const underscoreKeys = keys.filter((k) => k.startsWith('_'));
      expect(underscoreKeys).toEqual([]);

      fixture.destroy();
    });

    it('should preserve domain model keys from inside wrappers', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;

      context.config = {
        fields: [
          forgeToggleWrapper({
            label: 'Show details',
            defaultOpen: true,
            fields: [forgeTextField({ key: 'name', label: 'Name' }) as any]
          }) as any
        ]
      };

      await settle(fixture);

      const value = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      expect(value).toHaveProperty('name');

      fixture.destroy();
    });
  });

  describe('stripInternalKeys = false', () => {
    it('should preserve _ prefixed keys in output', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.stripInternalKeys = false;

      context.config = {
        fields: [
          forgeToggleWrapper({
            label: 'Show details',
            fields: [forgeTextField({ key: 'detail', label: 'Detail' }) as any]
          }) as any
        ]
      };

      await settle(fixture);

      const value = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      const keys = Object.keys(value as object);
      const underscoreKeys = keys.filter((k) => k.startsWith('_'));
      expect(underscoreKeys.length).toBeGreaterThan(0);

      fixture.destroy();
    });
  });
});

// MARK: stripForgeInternalKeys unit tests
describe('stripForgeInternalKeys()', () => {
  it('should strip primitive _ keys', () => {
    const result = stripForgeInternalKeys({ _toggle_1: false, name: 'Bob' });
    expect(result).toEqual({ name: 'Bob' });
  });

  it('should unwrap object _ keys (sections)', () => {
    const result = stripForgeInternalKeys({ _section_6: { name: '' } });
    expect(result).toEqual({ name: '' });
  });

  it('should handle mixed toggle + section output', () => {
    const result = stripForgeInternalKeys({ _toggle_1: false, _section_6: { name: '' } });
    expect(result).toEqual({ name: '' });
  });

  it('should handle nested sections', () => {
    const result = stripForgeInternalKeys({
      _section_1: {
        _subsection_1: { email: 'x' },
        name: 'y'
      }
    });
    expect(result).toEqual({ email: 'x', name: 'y' });
  });

  it('should preserve non-underscore keys', () => {
    const result = stripForgeInternalKeys({ firstName: 'Alice', lastName: 'Smith' });
    expect(result).toEqual({ firstName: 'Alice', lastName: 'Smith' });
  });

  it('should preserve arrays', () => {
    const result = stripForgeInternalKeys({ items: [1, 2, 3] });
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('should return null/undefined as-is', () => {
    expect(stripForgeInternalKeys(null)).toBe(null);
    expect(stripForgeInternalKeys(undefined)).toBe(undefined);
  });

  it('should return primitives as-is', () => {
    expect(stripForgeInternalKeys('hello' as any)).toBe('hello');
    expect(stripForgeInternalKeys(42 as any)).toBe(42);
  });

  it('should recursively clean non-underscore object values', () => {
    const result = stripForgeInternalKeys({
      profile: { _toggle_1: true, name: 'Bob' }
    });
    expect(result).toEqual({ profile: { name: 'Bob' } });
  });
});
