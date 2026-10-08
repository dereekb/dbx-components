import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, inject } from '@angular/core';
import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { catchError, first, firstValueFrom, of, timeout } from 'rxjs';
import { waitForMs, type Maybe } from '@dereekb/util';
import type { ObservableOrValue } from '@dereekb/rxjs';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeFormComponent } from '../../../form/forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../../form/forge.context';
import { DbxFormSourceDirective } from '../../../../form/io/form.input.directive';
import { dbxForgePhoneField } from './phone.field';

// MARK: Interfaces
interface TestPhoneFormValue {
  readonly phone?: Maybe<string>;
}

// MARK: Test Host
@Component({
  template: `
    <dbx-forge [dbxFormSource]="source$ ?? undefined"></dbx-forge>
  `,
  imports: [DbxForgeFormComponent, DbxFormSourceDirective],
  providers: [provideDbxForgeFormContext()]
})
class TestForgePhoneHostComponent {
  readonly context = inject(DbxForgeFormContext) as DbxForgeFormContext<TestPhoneFormValue>;

  source$: Maybe<ObservableOrValue<Maybe<Partial<TestPhoneFormValue>>>>;
}

// MARK: Helpers
const TEST_PROVIDERS = [provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await waitForMs(50);
  fixture.detectChanges();
  await fixture.whenStable();
}

function createPhoneFieldConfig(): FormConfig {
  return {
    fields: [dbxForgePhoneField({ key: 'phone', label: 'Phone', required: true }) as any]
  };
}

async function getValue(context: DbxForgeFormContext<TestPhoneFormValue>): Promise<Maybe<TestPhoneFormValue>> {
  return firstValueFrom(
    context.getValue().pipe(
      timeout(500),
      first(),
      catchError(() => of(undefined))
    )
  );
}

// MARK: Tests
describe('DbxForgePhoneFieldComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgePhoneHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should keep a value that is set before the form renders', async () => {
    const fixture = TestBed.createComponent(TestForgePhoneHostComponent);
    const host = fixture.componentInstance;
    const context = host.context;

    // the value arrives with the config, before the phone field renders and enables its controls
    host.source$ = of({ phone: '+12105550123' });
    context.config = createPhoneFieldConfig();
    await settle(fixture);

    const value = await getValue(context);
    expect(value?.phone).toBe('+12105550123');

    const input = fixture.nativeElement.querySelector('ngx-mat-input-tel input') as Maybe<HTMLInputElement>;
    expect(input?.value).toContain('210');

    fixture.destroy();
  });

  it('should keep a value that is set after the form renders', async () => {
    const fixture = TestBed.createComponent(TestForgePhoneHostComponent);
    const host = fixture.componentInstance;
    const context = host.context;

    context.config = createPhoneFieldConfig();
    await settle(fixture);

    context.setValue({ phone: '+12105550123' });
    await settle(fixture);

    const value = await getValue(context);
    expect(value?.phone).toBe('+12105550123');

    fixture.destroy();
  });
});
