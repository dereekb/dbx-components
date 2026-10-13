import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ElementRef, inject } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { type DestroyFunction, type Maybe } from '@dereekb/util';
import { DbxFilterPopoverComponent, type DbxFilterPopoverComponentConfig } from './filter.popover.component';
import { DbxFilterPopoverPendingChanges } from './filter.popover.pending';
import { DbxPopoverComponent } from '../popover/popover.component';
import { type DbxPopoverService } from '../popover/popover.service';

interface TestFilter {
  readonly name?: string;
}

const TEST_CONTENT = {
  applyPending: vi.fn<() => Promise<void>>(),
  unregister: undefined as Maybe<DestroyFunction>
};

@Component({
  template: `
    <input class="test-filter-input" />
  `,
  providers: provideFilterSourceDirective(TestFilterContentComponent)
})
class TestFilterContentComponent extends AbstractFilterSourceDirective<TestFilter> {
  constructor() {
    super();
    TEST_CONTENT.unregister = inject(DbxFilterPopoverPendingChanges).registerApplyPending(() => TEST_CONTENT.applyPending());
  }
}

describe('DbxFilterPopoverComponent', () => {
  describe('openPopover()', () => {
    function openWith(config: Partial<DbxFilterPopoverComponentConfig<TestFilter>>) {
      const open = vi.fn();
      const popoverService = { open } as unknown as DbxPopoverService;

      DbxFilterPopoverComponent.openPopover<TestFilter>(popoverService, {
        origin: new ElementRef(null),
        connector: { connectWithSource: vi.fn() },
        customFilterComponentClass: TestFilterContentComponent,
        ...config
      });

      return open.mock.calls[0][0];
    }

    it('should pass closeOnTransition to the popover', () => {
      expect(openWith({ closeOnTransition: false }).closeOnTransition).toBe(false);
    });

    it('should default closeOnTransition to closeOnFilterChange', () => {
      expect(openWith({ closeOnFilterChange: false }).closeOnTransition).toBe(false);
    });

    it('should default closeOnTransition to true', () => {
      expect(openWith({}).closeOnTransition).toBe(true);
    });

    it('should prefer an explicit closeOnTransition over closeOnFilterChange', () => {
      expect(openWith({ closeOnFilterChange: false, closeOnTransition: true }).closeOnTransition).toBe(true);
    });

    it('should not pass closeOnTransition in the popover data', () => {
      expect(openWith({ closeOnTransition: false }).data).not.toHaveProperty('closeOnTransition');
    });
  });

  describe('applying pending changes before closing', () => {
    let fixture: ComponentFixture<DbxFilterPopoverComponent<TestFilter>>;
    let stubPopover: { data: unknown; close: ReturnType<typeof vi.fn>; getClosingValueFn: unknown };

    beforeEach(async () => {
      TEST_CONTENT.applyPending = vi.fn(() => Promise.resolve());
      TEST_CONTENT.unregister = undefined;

      stubPopover = {
        data: {
          customFilterComponentClass: TestFilterContentComponent,
          connector: { connectWithSource: vi.fn() },
          closeOnFilterChange: false
        },
        close: vi.fn(),
        getClosingValueFn: undefined
      };

      TestBed.configureTestingModule({
        imports: [DbxFilterPopoverComponent],
        providers: [{ provide: DbxPopoverComponent, useValue: stubPopover }]
      });

      fixture = TestBed.createComponent(DbxFilterPopoverComponent<TestFilter>);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    afterEach(() => {
      fixture.destroy();
      TestBed.resetTestingModule();
    });

    it('should set getClosingValueFn only while content is registered', () => {
      expect(TEST_CONTENT.unregister).toBeDefined();
      expect(stubPopover.getClosingValueFn).toBeTypeOf('function');

      TEST_CONTENT.unregister?.();
      expect(stubPopover.getClosingValueFn).toBeUndefined();
    });

    it('should await the registered functions when closing', async () => {
      let finished = false;
      TEST_CONTENT.applyPending = vi.fn(() => Promise.resolve().then(() => void (finished = true)));

      await (stubPopover.getClosingValueFn as () => Promise<unknown>)();

      expect(TEST_CONTENT.applyPending).toHaveBeenCalledTimes(1);
      expect(finished).toBe(true);
    });

    it('should blur the focused input inside the popover when closing', async () => {
      const input = (fixture.nativeElement as HTMLElement).querySelector('.test-filter-input') as HTMLInputElement;
      expect(input).not.toBeNull();

      input.focus();
      expect(document.activeElement).toBe(input);

      await (stubPopover.getClosingValueFn as () => Promise<unknown>)();

      expect(document.activeElement).not.toBe(input);
    });
  });
});
