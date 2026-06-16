import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { first, firstValueFrom, type Observable, of } from 'rxjs';
import { type LoadingState, successResult } from '@dereekb/rxjs';
import { DbxFormLoadingSourceDirective } from './form.loading.directive';
import { DbxTestDbxFormComponent, FORM_TEST_PROVIDERS } from '../../../test';
import { type Maybe } from '@dereekb/util';

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('DbxFormLoadingSourceDirective with forge form', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestDbxFormLoadingSourceComponent],
      providers: [...FORM_TEST_PROVIDERS]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created', async () => {
    const fixture = TestBed.createComponent(TestDbxFormLoadingSourceComponent);
    await settle(fixture);
    expect(fixture.componentInstance.directive()).toBeDefined();
    fixture.destroy();
  });

  it('should pass the value of the observable to the form (and strip keys not in the form config)', async () => {
    const fixture = TestBed.createComponent(TestDbxFormLoadingSourceComponent);
    const host = fixture.componentInstance;

    const TEST_VALUE = 'TEST VALUE';
    host.source.set(of(successResult({ text: TEST_VALUE, invalidField: 0 })));
    await settle(fixture);

    const value = await firstValueFrom(host.form().getValue().pipe(first()));
    expect(value.text).toBe(TEST_VALUE);
    expect((value as Record<string, unknown>).invalidField).toBeUndefined();

    fixture.destroy();
  });
});

@Component({
  template: `
    <div>
      <dbx-test-dbx-form [dbxFormLoadingSource]="source()"></dbx-test-dbx-form>
    </div>
  `,
  imports: [DbxTestDbxFormComponent, DbxFormLoadingSourceDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestDbxFormLoadingSourceComponent {
  readonly source = signal<Maybe<Observable<LoadingState<{ text: string }>>>>(undefined);

  readonly directive = viewChild.required(DbxFormLoadingSourceDirective);
  readonly form = viewChild.required(DbxTestDbxFormComponent);
}
