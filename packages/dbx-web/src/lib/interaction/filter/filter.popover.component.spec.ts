import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ApplicationRef, Component, ElementRef, type Type, inject } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { type DestroyFunction, type Maybe } from '@dereekb/util';
import { DbxFilterPopoverComponent, type DbxFilterPopoverComponentConfig } from './filter.popover.component';
import { type DbxFilterComponentConfig } from './filter.config';
import { DbxFilterPopoverPendingChanges } from './filter.popover.pending';
import { DbxFilterPopoverViewService } from './filter.popover.view';
import { DbxPopoverComponent } from '../popover/popover.component';
import { type DbxPopoverService } from '../popover/popover.service';

interface TestFilter {
  readonly name?: string;
}

const TEST_CONTENT = {
  applyPending: vi.fn<() => void>(),
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

@Component({
  template: '',
  providers: provideFilterSourceDirective(TestPresetContentComponent)
})
class TestPresetContentComponent extends AbstractFilterSourceDirective<TestFilter> {
  readonly viewService = inject(DbxFilterPopoverViewService);
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

    it('should default closeOnTransition to false when the custom filter stays open on a filter change', () => {
      expect(openWith({ presetFilterComponentClass: TestPresetContentComponent, closeOnCustomFilterChange: false }).closeOnTransition).toBe(false);
    });

    it('should ignore closeOnCustomFilterChange for the closeOnTransition default when there is no custom filter', () => {
      expect(openWith({ customFilterComponentClass: undefined, presetFilterComponentClass: TestPresetContentComponent, closeOnCustomFilterChange: false }).closeOnTransition).toBe(true);
    });

    it('should pass closeOnCustomFilterChange in the popover data', () => {
      expect(openWith({ closeOnCustomFilterChange: false }).data.closeOnCustomFilterChange).toBe(false);
    });
  });

  describe('applying pending changes before closing', () => {
    let fixture: ComponentFixture<DbxFilterPopoverComponent<TestFilter>>;
    let stubPopover: { data: unknown; close: ReturnType<typeof vi.fn>; getClosingValueFn: unknown };

    beforeEach(async () => {
      TEST_CONTENT.applyPending = vi.fn();
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

    it('should call the registered functions synchronously when closing', () => {
      const result = (stubPopover.getClosingValueFn as () => unknown)();

      expect(result).toBeUndefined();
      expect(TEST_CONTENT.applyPending).toHaveBeenCalledTimes(1);
    });

    it('should run pending effects before calling the registered functions', () => {
      const tick = vi.spyOn(TestBed.inject(ApplicationRef), 'tick');
      TEST_CONTENT.applyPending = vi.fn(() => {
        expect(tick).toHaveBeenCalledTimes(1);
      });

      (stubPopover.getClosingValueFn as () => unknown)();

      expect(TEST_CONTENT.applyPending).toHaveBeenCalledTimes(1);
    });

    it('should still call the registered functions when a tick is already running', () => {
      vi.spyOn(TestBed.inject(ApplicationRef), 'tick').mockImplementation(() => {
        throw Object.assign(new Error('NG0101'), { code: 101 });
      });

      expect(() => (stubPopover.getClosingValueFn as () => unknown)()).not.toThrow();
      expect(TEST_CONTENT.applyPending).toHaveBeenCalledTimes(1);
    });

    it('should blur the focused input inside the popover when closing', () => {
      const input = (fixture.nativeElement as HTMLElement).querySelector('.test-filter-input') as HTMLInputElement;
      expect(input).not.toBeNull();

      input.focus();
      expect(document.activeElement).toBe(input);

      (stubPopover.getClosingValueFn as () => unknown)();

      expect(document.activeElement).not.toBe(input);
    });
  });

  describe('with a preset and a custom filter', () => {
    let fixture: ComponentFixture<DbxFilterPopoverComponent<TestFilter>>;
    let stubPopover: { data: DbxFilterComponentConfig<TestFilter>; close: ReturnType<typeof vi.fn>; getClosingValueFn: unknown };

    async function create(config: Partial<DbxFilterComponentConfig<TestFilter>>): Promise<DbxFilterPopoverComponent<TestFilter>> {
      stubPopover = {
        data: {
          customFilterComponentClass: TestFilterContentComponent,
          presetFilterComponentClass: TestPresetContentComponent,
          connector: { connectWithSource: vi.fn() },
          initialFilterObs: of({}),
          closeOnCustomFilterChange: false,
          ...config
        } as DbxFilterComponentConfig<TestFilter>,
        close: vi.fn(),
        getClosingValueFn: undefined
      };

      TestBed.configureTestingModule({
        imports: [DbxFilterPopoverComponent],
        providers: [{ provide: DbxPopoverComponent, useValue: stubPopover }]
      });

      fixture = TestBed.createComponent(DbxFilterPopoverComponent<TestFilter>);
      await render();
      return fixture.componentInstance;
    }

    async function render(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    function content<T>(type: Type<T>): T {
      return fixture.debugElement.query(By.directive(type)).componentInstance as T;
    }

    beforeEach(() => {
      TEST_CONTENT.applyPending = vi.fn();
    });

    afterEach(() => {
      fixture.destroy();
      TestBed.resetTestingModule();
    });

    it('should show the switch buttons when the preset filter is configured with presetFilterComponentConfig', async () => {
      const component = await create({ presetFilterComponentClass: undefined, presetFilterComponentConfig: { componentClass: TestPresetContentComponent } });
      expect(component.showSwitchButtons).toBe(true);
    });

    it('should close on a filter change while the preset filter is shown, without a close button', async () => {
      const component = await create({});

      expect(component.showPresetSignal()).toBe(true);
      expect(component.showCloseButtonSignal()).toBe(false);

      content(TestPresetContentComponent).setFilter({ name: 'preset' });
      expect(stubPopover.close).toHaveBeenCalledTimes(1);
    });

    it('should stay open on a filter change while the custom filter is shown, with a close button', async () => {
      const component = await create({});

      component.showCustom();
      await render();

      expect(component.showCloseButtonSignal()).toBe(true);

      content(TestFilterContentComponent).setFilter({ name: 'custom' });
      expect(stubPopover.close).not.toHaveBeenCalled();
    });

    it('should show the buttons only in the header by default', async () => {
      await create({});

      expect(fixture.debugElement.query(By.css('dbx-popover-header dbx-filter-popover-switch-button'))).not.toBeNull();
      expect(fixture.debugElement.query(By.css('.dbx-filter-popover-content-buttons'))).toBeNull();
    });

    it('should show the switch button both in the header and below the content when showButtonsBelowContent is set', async () => {
      await create({ showButtonsBelowContent: true });

      expect(fixture.debugElement.query(By.css('dbx-popover-header dbx-filter-popover-switch-button'))).not.toBeNull();
      expect(fixture.debugElement.query(By.css('dbx-popover-scroll-content .dbx-filter-popover-content-buttons dbx-filter-popover-switch-button'))).not.toBeNull();
    });

    it('should show the close button below the content too while the custom filter is shown', async () => {
      const component = await create({ showButtonsBelowContent: true, closeButtonText: 'Save' });

      component.showCustom();
      await render();

      const belowContentButtons = fixture.debugElement.queryAll(By.css('.dbx-filter-popover-content-buttons dbx-button')).map((x) => (x.nativeElement as HTMLElement).textContent?.trim());
      expect(belowContentButtons).toContain('Save');
    });

    it('should hide the header buttons when showButtonsInHeader is false', async () => {
      await create({ showButtonsInHeader: false, showButtonsBelowContent: true });

      expect(fixture.debugElement.query(By.css('dbx-popover-header dbx-filter-popover-switch-button'))).toBeNull();
      expect(fixture.debugElement.query(By.css('.dbx-filter-popover-content-buttons dbx-filter-popover-switch-button'))).not.toBeNull();
    });

    it('should let the filter content switch the view through DbxFilterPopoverViewService', async () => {
      const component = await create({});

      content(TestPresetContentComponent).viewService.showCustom();
      await render();

      expect(component.showPresetSignal()).toBe(false);
      expect(fixture.debugElement.query(By.directive(TestFilterContentComponent))).not.toBeNull();
    });

    it('should apply the custom filter pending change before switching to the presets', async () => {
      const component = await create({});

      component.showCustom();
      await render();

      component.showPresets();
      expect(TEST_CONTENT.applyPending).toHaveBeenCalledTimes(1);
    });
  });
});
