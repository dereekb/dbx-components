import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, inject, signal, viewChild } from '@angular/core';
import { AbstractFilterSourceDirective, DbxActionValueDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxFilterWrapperComponent } from './filter.wrapper.component';
import { DbxFilterPopoverPendingChanges, DbxFilterPopoverPendingChangesInstance } from './filter.popover.pending';

interface TestFilter {
  readonly name: string;
}

const TEST_FILTER_VALUE: TestFilter = { name: 'test' };

@Component({
  template: `
    <dbx-filter-wrapper [showButtons]="showButtons()" [applyOnClose]="applyOnClose()">
      <ng-container [dbxActionValue]="value()"></ng-container>
    </dbx-filter-wrapper>
  `,
  imports: [DbxFilterWrapperComponent, DbxActionValueDirective],
  providers: [provideFilterSourceDirective(TestFilterWrapperHostComponent), { provide: DbxFilterPopoverPendingChanges, useFactory: () => new DbxFilterPopoverPendingChangesInstance() }]
})
class TestFilterWrapperHostComponent extends AbstractFilterSourceDirective<TestFilter> {
  readonly pendingChanges = inject(DbxFilterPopoverPendingChanges) as DbxFilterPopoverPendingChangesInstance;
  readonly wrapper = viewChild.required(DbxFilterWrapperComponent<TestFilter>);

  readonly showButtons = signal<boolean>(true);
  readonly applyOnClose = signal<Maybe<boolean>>(undefined);

  readonly value = signal<Maybe<TestFilter>>(TEST_FILTER_VALUE);
}

describe('DbxFilterWrapperComponent', () => {
  let fixture: ComponentFixture<TestFilterWrapperHostComponent>;
  let host: TestFilterWrapperHostComponent;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [TestFilterWrapperHostComponent] });
    fixture = TestBed.createComponent(TestFilterWrapperHostComponent);
    host = fixture.componentInstance;
    vi.spyOn(host, 'setFilter');
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  describe('applyPendingFilter()', () => {
    it('should set the value the action would ready, synchronously', async () => {
      await render();

      host.wrapper().applyPendingFilter();

      expect(host.setFilter).toHaveBeenCalledWith(TEST_FILTER_VALUE);
    });

    it('should not set the filter when it already equals the value', async () => {
      await render();
      host.setFilter({ ...TEST_FILTER_VALUE });
      vi.mocked(host.setFilter).mockClear();

      host.wrapper().applyPendingFilter();

      expect(host.setFilter).not.toHaveBeenCalled();
    });

    it('should not set the filter when the action has no value', async () => {
      host.value.set(undefined);
      await render();

      host.wrapper().applyPendingFilter();

      expect(host.setFilter).not.toHaveBeenCalled();
    });
  });

  describe('inside a filter popover', () => {
    it('should register with the popover when the Apply button is hidden', async () => {
      host.showButtons.set(false);
      await render();

      expect(host.pendingChanges.hasApplyPending).toBe(true);

      host.pendingChanges.applyPending();

      expect(host.setFilter).toHaveBeenCalledWith(TEST_FILTER_VALUE);
    });

    it('should not register when the Apply button is shown', async () => {
      await render();
      expect(host.pendingChanges.hasApplyPending).toBe(false);
    });

    it('should register when applyOnClose is true with the Apply button shown', async () => {
      host.applyOnClose.set(true);
      await render();
      expect(host.pendingChanges.hasApplyPending).toBe(true);
    });

    it('should unregister when applyOnClose turns off', async () => {
      host.applyOnClose.set(true);
      await render();
      expect(host.pendingChanges.hasApplyPending).toBe(true);

      host.applyOnClose.set(false);
      await render();
      expect(host.pendingChanges.hasApplyPending).toBe(false);
    });
  });
});
