import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DbxFilterPopoverViewService, type DbxFilterPopoverViewServiceConfig } from './filter.popover.view';

function createService(config?: Partial<DbxFilterPopoverViewServiceConfig>): DbxFilterPopoverViewService {
  TestBed.configureTestingModule({ providers: [DbxFilterPopoverViewService] });
  const service = TestBed.inject(DbxFilterPopoverViewService);

  service.init({
    initialView: 'preset',
    canSwitchViews: true,
    customizeButtonText: 'Custom',
    presetsButtonText: 'Presets',
    switchButtonStyle: {},
    ...config
  });

  return service;
}

describe('DbxFilterPopoverViewService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should show the initial view', () => {
    expect(createService({ initialView: 'custom' }).viewSignal()).toBe('custom');
  });

  it('should switch views and show the matching switch button text', () => {
    const service = createService();
    expect(service.showPresetSignal()).toBe(true);
    expect(service.switchButtonTextSignal()).toBe('Custom');

    service.switchView();
    expect(service.viewSignal()).toBe('custom');
    expect(service.switchButtonTextSignal()).toBe('Presets');

    service.switchView();
    expect(service.viewSignal()).toBe('preset');
  });

  it('should call beforeViewChange before the view changes, and not when the view is already shown', () => {
    const viewsWhenCalled: string[] = [];
    const service: DbxFilterPopoverViewService = createService({
      beforeViewChange: () => viewsWhenCalled.push(service.viewSignal())
    });

    service.showPresets();
    expect(viewsWhenCalled).toEqual([]);

    service.showCustom();
    expect(service.viewSignal()).toBe('custom');
    expect(viewsWhenCalled).toEqual(['preset']);
  });

  it('should not be able to switch views before it is configured', () => {
    TestBed.configureTestingModule({ providers: [DbxFilterPopoverViewService] });
    expect(TestBed.inject(DbxFilterPopoverViewService).canSwitchViewsSignal()).toBe(false);
  });
});
