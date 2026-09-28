import { describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { type BrowserAgentInfo } from '@dereekb/browser';
import { DEFAULT_DBX_BROWSER_AGENT_VIEW_OS_DISPLAY, type DbxBrowserAgentViewConfig, type DbxBrowserAgentViewEntry, findDbxBrowserAgentViewEntry, makeDbxBrowserAgentViewConfigFromOsMap, makeDbxBrowserAgentViewEntryForOs } from './browser.agent.view';

@Component({ template: 'ios' })
class TestIosComponent {}

@Component({ template: 'android' })
class TestAndroidComponent {}

@Component({ template: 'default' })
class TestDefaultComponent {}

function makeBrowserAgentInfo(info: Partial<BrowserAgentInfo>): BrowserAgentInfo {
  return {
    userAgent: '',
    os: 'unknown',
    browser: 'unknown',
    device: 'unknown',
    isStandalone: false,
    ...info
  };
}

const IOS_SAFARI_INFO = makeBrowserAgentInfo({ os: 'ios', browser: 'safari', device: 'mobile' });
const IOS_CHROME_INFO = makeBrowserAgentInfo({ os: 'ios', browser: 'chrome', device: 'mobile' });
const ANDROID_INFO = makeBrowserAgentInfo({ os: 'android', browser: 'chrome', device: 'mobile' });
const WINDOWS_INFO = makeBrowserAgentInfo({ os: 'windows', browser: 'edge', device: 'desktop' });

describe('findDbxBrowserAgentViewEntry()', () => {
  const iosSafariEntry: DbxBrowserAgentViewEntry = { key: 'ios-safari', label: 'iOS Safari', match: { os: 'ios', browser: 'safari' }, componentConfig: { componentClass: TestIosComponent } };
  const iosEntry: DbxBrowserAgentViewEntry = { key: 'ios', label: 'iOS', match: { os: 'ios' }, componentConfig: { componentClass: TestIosComponent } };
  const manualEntry: DbxBrowserAgentViewEntry = { key: 'manual', label: 'Manual', componentConfig: { componentClass: TestAndroidComponent } };
  const defaultEntry: DbxBrowserAgentViewEntry = { key: 'default', label: 'Other', match: { os: 'windows' }, componentConfig: { componentClass: TestDefaultComponent } };

  const config: DbxBrowserAgentViewConfig = {
    entries: [manualEntry, iosSafariEntry, iosEntry],
    defaultEntry
  };

  it('should return the first matching entry', () => {
    expect(findDbxBrowserAgentViewEntry(config, IOS_SAFARI_INFO)).toBe(iosSafariEntry);
    expect(findDbxBrowserAgentViewEntry(config, IOS_CHROME_INFO)).toBe(iosEntry);
  });

  it('should return the default entry when no entry matches', () => {
    expect(findDbxBrowserAgentViewEntry(config, ANDROID_INFO)).toBe(defaultEntry);
  });

  it('should skip entries without a match', () => {
    expect(findDbxBrowserAgentViewEntry({ entries: [manualEntry], defaultEntry }, ANDROID_INFO)).toBe(defaultEntry);
  });

  it('should ignore the default entry match', () => {
    expect(findDbxBrowserAgentViewEntry({ defaultEntry }, WINDOWS_INFO)).toBe(defaultEntry);
    expect(findDbxBrowserAgentViewEntry({ defaultEntry }, ANDROID_INFO)).toBe(defaultEntry);
  });

  it('should support match functions', () => {
    const functionEntry: DbxBrowserAgentViewEntry = { key: 'fn', label: 'Function', match: (info) => info.browser === 'edge', componentConfig: { componentClass: TestAndroidComponent } };
    expect(findDbxBrowserAgentViewEntry({ entries: [functionEntry], defaultEntry }, WINDOWS_INFO)).toBe(functionEntry);
  });
});

describe('makeDbxBrowserAgentViewEntryForOs()', () => {
  it('should create an entry with the default label and icon from a component config', () => {
    const componentConfig = { componentClass: TestIosComponent };
    const entry = makeDbxBrowserAgentViewEntryForOs('ios', componentConfig);

    expect(entry.key).toBe('ios');
    expect(entry.label).toBe(DEFAULT_DBX_BROWSER_AGENT_VIEW_OS_DISPLAY.ios.label);
    expect(entry.icon).toBe(DEFAULT_DBX_BROWSER_AGENT_VIEW_OS_DISPLAY.ios.icon);
    expect(entry.match).toEqual({ os: 'ios' });
    expect(entry.componentConfig).toBe(componentConfig);
  });

  it('should use a custom label and icon from an entry config', () => {
    const componentConfig = { componentClass: TestAndroidComponent };
    const entry = makeDbxBrowserAgentViewEntryForOs('android', { componentConfig, label: 'Android Phone', icon: 'smartphone' });

    expect(entry.label).toBe('Android Phone');
    expect(entry.icon).toBe('smartphone');
    expect(entry.componentConfig).toBe(componentConfig);
  });

  it('should create the default entry without a match', () => {
    const entry = makeDbxBrowserAgentViewEntryForOs('default', { componentClass: TestDefaultComponent });

    expect(entry.key).toBe('default');
    expect(entry.label).toBe(DEFAULT_DBX_BROWSER_AGENT_VIEW_OS_DISPLAY.default.label);
    expect(entry.match).toBeUndefined();
  });
});

describe('makeDbxBrowserAgentViewConfigFromOsMap()', () => {
  const config = makeDbxBrowserAgentViewConfigFromOsMap({
    android: { componentClass: TestAndroidComponent },
    ios: { componentConfig: { componentClass: TestIosComponent }, label: 'iPhone' },
    default: { componentClass: TestDefaultComponent },
    showOverrideButton: true
  });

  it('should create entries only for the configured OS types, in order', () => {
    expect(config.entries?.map((x) => x.key)).toEqual(['ios', 'android']);
    expect(config.entries?.[0].label).toBe('iPhone');
  });

  it('should create the default entry', () => {
    expect(config.defaultEntry.key).toBe('default');
    expect(config.defaultEntry.componentConfig.componentClass).toBe(TestDefaultComponent);
  });

  it('should pass through showOverrideButton', () => {
    expect(config.showOverrideButton).toBe(true);
  });

  it('should resolve the entry for the detected OS', () => {
    expect(findDbxBrowserAgentViewEntry(config, IOS_CHROME_INFO).key).toBe('ios');
    expect(findDbxBrowserAgentViewEntry(config, ANDROID_INFO).key).toBe('android');
    expect(findDbxBrowserAgentViewEntry(config, WINDOWS_INFO).key).toBe('default');
  });
});
