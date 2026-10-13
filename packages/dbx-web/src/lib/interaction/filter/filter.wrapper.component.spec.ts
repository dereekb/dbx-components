import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, inject, signal, viewChild } from '@angular/core';
import { AbstractFilterSourceDirective, DbxActionValueDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { type Maybe, waitForMs } from '@dereekb/util';
import { DbxFilterWrapperComponent, DBX_FILTER_WRAPPER_APPLY_PENDING_SETTLE_TIME } from './filter.wrapper.component';
import { DbxFilterPopoverPendingChanges, DbxFilterPopoverPendingChangesInstance } from './filter.popover.pending';

interface TestFilter {
  readonly name: string;
}

const TEST_FILTER_VALUE: TestFilter = { name: 'test' };

@Component({
  template: `
    <dbx-filter-wrapper [showButtons]="showButtons()" [applyOnClose]="applyOnClose()">
      <ng-container [dbxActionValue]="value"></ng-container>
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

  readonly value = TEST_FILTER_VALUE;
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
    it('should trigger a modified action and resolve after the filter is set', async () => {
      await render();

      host.wrapper().source.setIsModified(true);
      await host.wrapper().applyPendingFilter();

      expect(host.setFilter).toHaveBeenCalledWith(TEST_FILTER_VALUE);
    });

    it('should resolve without setting the filter when nothing is modified', async () => {
      await render();

      await host.wrapper().applyPendingFilter();

      expect(host.setFilter).not.toHaveBeenCalled();
    });

    it('should restart the settle wait when the action state changes', async () => {
      await render();

      const startedAt = Date.now();
      const applied = host.wrapper().applyPendingFilter();

      await waitForMs(DBX_FILTER_WRAPPER_APPLY_PENDING_SETTLE_TIME / 2);
      host.wrapper().source.setIsModified(true);

      await applied;

      expect(host.setFilter).toHaveBeenCalledWith(TEST_FILTER_VALUE);
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(DBX_FILTER_WRAPPER_APPLY_PENDING_SETTLE_TIME * 1.5 - 5);
    });
  });

  describe('inside a filter popover', () => {
    it('should register with the popover when the Apply button is hidden', async () => {
      host.showButtons.set(false);
      await render();

      expect(host.pendingChanges.hasApplyPending).toBe(true);

      host.wrapper().source.setIsModified(true);
      await host.pendingChanges.applyPending();

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
