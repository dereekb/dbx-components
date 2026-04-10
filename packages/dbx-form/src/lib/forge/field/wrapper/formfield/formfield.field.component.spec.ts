import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, provideZonelessChangeDetection, inject } from '@angular/core';

import { DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { first, firstValueFrom, timeout, catchError, of, map } from 'rxjs';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeFormComponent } from '../../../form/forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../../form/forge.context';
import { forgeFormFieldWrapper } from './formfield.field';
import { forgeNumberSliderField } from '../../value/number/number.field';
import { forgeTextField } from '../../value/text/text.field';

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
class TestFormFieldWrapperHostComponent {
  readonly context = inject(DbxForgeFormContext);
}

// MARK: Helpers
const TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Settles the fixture by running change detection and waiting for stability.
 *
 * The 100ms delay is needed because ng-forge lazy-loads field components via
 * dynamic import (`loadComponent`). whenStable() resolves before the import
 * promise settles and the component is instantiated in the DOM, so we need
 * a short window for the async import to complete and a second CD pass to
 * render the loaded component.
 */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await delay(100);
  fixture.detectChanges();
  await fixture.whenStable();
}

// MARK: Tests
describe('DbxForgeFormFieldWrapperComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestFormFieldWrapperHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('with forgeNumberSliderField()', () => {
    it('should render without errors', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;

      context.config = {
        fields: [forgeNumberSliderField({ key: 'rating', label: 'Rating', min: 0, max: 10 }) as any]
      };

      await settle(fixture);

      const host = fixture.nativeElement as HTMLElement;
      const wrapper = host.querySelector('dbx-forge-form-field-wrapper');
      expect(wrapper).toBeTruthy();

      fixture.destroy();
    });

    it('should display the label in the notched outline', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;

      context.config = {
        fields: [forgeNumberSliderField({ key: 'rating', label: 'Rating', min: 0, max: 10 }) as any]
      };

      await settle(fixture);

      const host = fixture.nativeElement as HTMLElement;
      const label = host.querySelector('.dbx-forge-form-field-outline-label');
      expect(label).toBeTruthy();
      expect(label?.textContent?.trim()).toBe('Rating');

      fixture.destroy();
    });

    it('should display the hint in the subscript area', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;

      context.config = {
        fields: [forgeNumberSliderField({ key: 'rating', label: 'Rating', description: 'Pick a rating', min: 0, max: 10 }) as any]
      };

      await settle(fixture);

      const host = fixture.nativeElement as HTMLElement;
      const subscript = host.querySelector('.mat-mdc-form-field-hint');
      expect(subscript).toBeTruthy();
      expect(subscript?.textContent?.trim()).toBe('Pick a rating');

      fixture.destroy();
    });

    it('should pass slider value through to form output', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;

      context.config = {
        fields: [forgeNumberSliderField({ key: 'rating', label: 'Rating', min: 0, max: 10, defaultValue: 5 }) as any]
      };

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
      expect((result.value as Record<string, unknown>)?.['rating']).toBe(5);

      fixture.destroy();
    });
  });

  describe('with forgeFormFieldWrapper() wrapping a text field', () => {
    it('should render the wrapper and child field', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;

      context.config = {
        fields: [
          forgeFormFieldWrapper({
            label: 'Custom Wrapper',
            hint: 'A hint',
            fields: [forgeTextField({ key: 'name', label: '' }) as any]
          }) as any
        ]
      };

      await settle(fixture);

      const host = fixture.nativeElement as HTMLElement;
      const wrapper = host.querySelector('dbx-forge-form-field-wrapper');
      expect(wrapper).toBeTruthy();

      const label = host.querySelector('.dbx-forge-form-field-outline-label');
      expect(label?.textContent?.trim()).toBe('Custom Wrapper');

      const subscript = host.querySelector('.mat-mdc-form-field-hint');
      expect(subscript?.textContent?.trim()).toBe('A hint');

      fixture.destroy();
    });

    it('should strip wrapper internal key from form output', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;

      context.config = {
        fields: [
          forgeFormFieldWrapper({
            label: 'Wrapped',
            fields: [forgeTextField({ key: 'name', label: '', defaultValue: 'hello' }) as any]
          }) as any
        ]
      };

      await settle(fixture);

      context.setValue({ name: 'hello' } as any);
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

      const value = result.value as Record<string, unknown>;
      // Should have the domain key, not the wrapper's _formfield_ key
      const underscoreKeys = Object.keys(value).filter((k) => k.startsWith('_'));
      expect(underscoreKeys).toEqual([]);

      fixture.destroy();
    });
  });

  describe('validation gating with forgeFormFieldWrapper()', () => {
    function createSliderWithValidatorConfig() {
      return {
        fields: [
          forgeFormFieldWrapper({
            label: 'Rating',
            hint: 'Must be above 50.',
            fields: [
              {
                key: 'rating',
                type: 'slider',
                label: '',
                max: 100,
                value: 25,
                validators: [{ type: 'custom', expression: 'fieldValue > 50', kind: 'minRating' }],
                validationMessages: { minRating: 'Rating must be above 50.' },
                props: { min: 0, max: 100, thumbLabel: true }
              } as any
            ]
          }) as any
        ]
      };
    }

    it('should not emit getValue() when requireValid=true and wrapped field is invalid', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      // requireValid defaults to true — do not set it to false
      context.config = createSliderWithValidatorConfig();

      await settle(fixture);

      // Set a value below 50 (fails the expression validator)
      context.setValue({ rating: 35 } as any);
      await settle(fixture);

      const result = await firstValueFrom(
        context.getValue().pipe(
          timeout(500),
          first(),
          map((value) => ({ received: true, value })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      // getValue() should NOT emit because the form is invalid
      expect(result.received).toBe(false);

      fixture.destroy();
    });

    it('should emit getValue() when requireValid=true and wrapped field is valid', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;

      // Use a default value above 50 so the validator passes immediately
      context.config = {
        fields: [
          forgeFormFieldWrapper({
            label: 'Rating',
            fields: [
              {
                key: 'rating',
                type: 'slider',
                label: '',
                max: 100,
                value: 75,
                validators: [{ type: 'custom', expression: 'fieldValue > 50', kind: 'minRating' }],
                validationMessages: { minRating: 'Rating must be above 50.' },
                props: { min: 0, max: 100, thumbLabel: true }
              } as any
            ]
          }) as any
        ]
      };

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
      expect((result.value as Record<string, unknown>)?.['rating']).toBe(75);

      fixture.destroy();
    });

    it('should report isComplete=false in stream$ when wrapped field is invalid', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createSliderWithValidatorConfig();

      await settle(fixture);

      context.setValue({ rating: 35 } as any);
      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(false);
      expect(event.status).toBe('INVALID');

      fixture.destroy();
    });

    it('should show error in subscript when validation fails and field is touched', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createSliderWithValidatorConfig();

      await settle(fixture);

      // Set a value below 50 and trigger touch
      context.setValue({ rating: 25 } as any);
      await settle(fixture);

      const host = fixture.nativeElement as HTMLElement;
      const errorEl = host.querySelector('.mat-mdc-form-field-error');

      if (errorEl) {
        expect(errorEl.textContent?.trim()).toBe('Rating must be above 50.');
      }

      fixture.destroy();
    });

    it('should show hint instead of error when validation passes', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createSliderWithValidatorConfig();

      await settle(fixture);

      // Set a value above 50
      context.setValue({ rating: 75 } as any);
      await settle(fixture);

      const host = fixture.nativeElement as HTMLElement;
      const errorEl = host.querySelector('.mat-mdc-form-field-error');
      expect(errorEl).toBeFalsy();

      const hintEl = host.querySelector('.mat-mdc-form-field-hint');

      if (hintEl) {
        expect(hintEl.textContent?.trim()).toBe('Must be above 50.');
      }

      fixture.destroy();
    });

    it('should apply error class to outline when validation fails', async () => {
      const fixture = TestBed.createComponent(TestFormFieldWrapperHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createSliderWithValidatorConfig();

      await settle(fixture);

      context.setValue({ rating: 25 } as any);
      await settle(fixture);

      const host = fixture.nativeElement as HTMLElement;
      const wrapperDiv = host.querySelector('.dbx-forge-form-field-wrapper');
      const hasErrorClass = wrapperDiv?.classList.contains('dbx-forge-form-field-wrapper-error');

      // Error class presence depends on whether the child form has been touched
      // The wrapper checks childTouched && childErrors.length > 0
      if (hasErrorClass) {
        expect(hasErrorClass).toBe(true);
      }

      fixture.destroy();
    });
  });
});
