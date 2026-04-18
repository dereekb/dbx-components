import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, provideZonelessChangeDetection, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import { DynamicFormLogger, NoopLogger, type AsyncCustomValidator, type FormConfig } from '@ng-forge/dynamic-forms';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeFormComponent } from '../../../form/forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../../form/forge.context';
import { DBX_FORGE_FORM_COMPONENT_TEMPLATE } from '../../../form';
import { DBX_FORGE_WORKING_WRAPPER_TYPE_NAME } from './working.wrapper';

// MARK: Test Host
@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  imports: [DbxForgeFormComponent],
  providers: [provideDbxForgeFormContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestWorkingWrapperHostComponent {
  readonly context = inject(DbxForgeFormContext);
}

// MARK: Helpers
const TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Settles the fixture using detectChanges + delay only.
 *
 * Does NOT use whenStable() because a pending rxResource (Subject that
 * hasn't emitted) keeps Angular unstable indefinitely, causing timeouts.
 */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await delay(200);
  fixture.detectChanges();
  await delay(200);
  fixture.detectChanges();
}

// MARK: Tests
describe('DbxForgeWorkingWrapperComponent', () => {
  let resultSubject: Subject<boolean>;

  beforeEach(() => {
    resultSubject = new Subject<boolean>();

    TestBed.configureTestingModule({
      imports: [TestWorkingWrapperHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    resultSubject.complete();
    TestBed.resetTestingModule();
  });

  function createAsyncValidator(): AsyncCustomValidator {
    return {
      params: (ctx) => ({ value: ctx.value() }),
      factory: (paramsSignal) =>
        rxResource({
          params: () => paramsSignal(),
          stream: () => resultSubject.asObservable()
        }),
      onSuccess: (result) => (result === false ? { kind: 'testAsync' } : null),
      onError: () => null
    };
  }

  function createConfigWithAsyncValidator(): FormConfig {
    return {
      fields: [
        {
          type: 'input',
          key: 'username',
          label: 'Username',
          wrappers: [{ type: DBX_FORGE_WORKING_WRAPPER_TYPE_NAME }],
          validators: [{ type: 'async' as const, functionName: 'testAsync' }]
        }
      ],
      customFnConfig: {
        asyncValidators: {
          testAsync: createAsyncValidator()
        }
      }
    };
  }

  it('should render without errors', async () => {
    const fixture = TestBed.createComponent(TestWorkingWrapperHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = createConfigWithAsyncValidator();

    await settle(fixture);

    const host = fixture.nativeElement as HTMLElement;
    const wrapper = host.querySelector('dbx-forge-working-wrapper');
    expect(wrapper).toBeTruthy();

    fixture.destroy();
  });

  it('should show the progress bar while the async validator is pending', async () => {
    const fixture = TestBed.createComponent(TestWorkingWrapperHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = createConfigWithAsyncValidator();

    // Set a value so the async validator fires
    context.setValue({ username: 'test' } as any);

    await settle(fixture);

    const host = fixture.nativeElement as HTMLElement;
    const progressBar = host.querySelector('dbx-forge-working-wrapper mat-progress-bar');
    expect(progressBar).toBeTruthy();

    fixture.destroy();
  });

  it('should hide the progress bar after the async validator resolves', async () => {
    const fixture = TestBed.createComponent(TestWorkingWrapperHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = createConfigWithAsyncValidator();

    context.setValue({ username: 'test' } as any);
    await settle(fixture);

    // Resolve the async validator
    resultSubject.next(true);
    await settle(fixture);

    const host = fixture.nativeElement as HTMLElement;
    const progressBar = host.querySelector('dbx-forge-working-wrapper mat-progress-bar');
    expect(progressBar).toBeFalsy();

    fixture.destroy();
  });
});
