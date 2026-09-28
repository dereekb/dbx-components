import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Component, inject, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type BrowserAgentInfo } from '@dereekb/browser';
import { type Maybe } from '@dereekb/util';
import { type DbxBrowserAgentViewConfig, DbxBrowserAgentViewContext, makeDbxBrowserAgentViewConfigFromOsMap } from './browser.agent.view';
import { DbxBrowserAgentService } from './browser.agent.service';
import { DbxBrowserAgentViewComponent } from './browser.agent.view.component';

@Component({ template: '<span class="test-ios">iOS</span>' })
class TestIosComponent {}

@Component({ template: '<span class="test-android">Android</span>' })
class TestAndroidComponent {}

@Component({ template: '<span class="test-default">Default</span>' })
class TestDefaultComponent {}

@Component({ template: '<span class="test-context">{{ context.selectedEntrySignal()?.key }}</span>' })
class TestContextComponent {
  readonly context = inject(DbxBrowserAgentViewContext);
}

const TEST_CONFIG: DbxBrowserAgentViewConfig = makeDbxBrowserAgentViewConfigFromOsMap({
  ios: { componentClass: TestIosComponent },
  android: { componentClass: TestAndroidComponent },
  default: { componentClass: TestDefaultComponent }
});

@Component({
  template: `
    <dbx-browser-agent-view [config]="config()" [showOverrideButton]="showOverrideButton()" [(overrideKey)]="overrideKey"></dbx-browser-agent-view>
  `,
  imports: [DbxBrowserAgentViewComponent]
})
class TestHostComponent {
  readonly config = signal<Maybe<DbxBrowserAgentViewConfig>>(TEST_CONFIG);
  readonly showOverrideButton = signal<Maybe<boolean>>(undefined);
  readonly overrideKey = signal<Maybe<string>>(undefined);
}

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

describe('DbxBrowserAgentViewComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  async function setup(agentInfo: BrowserAgentInfo): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: DbxBrowserAgentService, useValue: { agentInfo } }]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function update(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function query(selector: string): Maybe<Element> {
    return (fixture.nativeElement as HTMLElement).querySelector(selector);
  }

  function viewComponent(): DbxBrowserAgentViewComponent {
    return fixture.debugElement.children[0].componentInstance as DbxBrowserAgentViewComponent;
  }

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  describe('ios agent', () => {
    beforeEach(async () => {
      await setup(makeBrowserAgentInfo({ os: 'ios', browser: 'safari', device: 'mobile' }));
    });

    it('should render the matching component', () => {
      expect(query('.test-ios')).toBeTruthy();
      expect(query('.test-android')).toBeNull();
      expect(viewComponent().detectedEntrySignal()?.key).toBe('ios');
      expect(viewComponent().isOverriddenSignal()).toBe(false);
    });

    it('should switch components when overrideKey is set, and switch back when cleared', async () => {
      host.overrideKey.set('android');
      await update();

      expect(query('.test-android')).toBeTruthy();
      expect(query('.test-ios')).toBeNull();
      expect(viewComponent().isOverriddenSignal()).toBe(true);

      host.overrideKey.set(undefined);
      await update();

      expect(query('.test-ios')).toBeTruthy();
      expect(query('.test-android')).toBeNull();
    });

    it('should update the bound overrideKey when setOverride() and clearOverride() are called', async () => {
      viewComponent().setOverride('default');
      await update();

      expect(host.overrideKey()).toBe('default');
      expect(query('.test-default')).toBeTruthy();

      viewComponent().clearOverride();
      await update();

      expect(host.overrideKey()).toBeUndefined();
      expect(query('.test-ios')).toBeTruthy();
    });

    it('should fall back to the detected entry for an unknown override key', async () => {
      host.overrideKey.set('unknown-key');
      await update();

      expect(query('.test-ios')).toBeTruthy();
      expect(viewComponent().isOverriddenSignal()).toBe(false);
    });

    it('should only show the override button when enabled', async () => {
      expect(query('dbx-browser-agent-view-override-button')).toBeNull();

      host.showOverrideButton.set(true);
      await update();

      expect(query('dbx-browser-agent-view-override-button')).toBeTruthy();
    });

    it('should render nothing when no config is set', async () => {
      host.config.set(undefined);
      await update();

      expect(query('.test-ios')).toBeNull();
      expect(query('.test-default')).toBeNull();
      expect(viewComponent().selectedEntrySignal()).toBeUndefined();
    });
  });

  describe('unmatched agent', () => {
    beforeEach(async () => {
      await setup(makeBrowserAgentInfo({ os: 'windows', browser: 'edge', device: 'desktop' }));
    });

    it('should render the default component', () => {
      expect(query('.test-default')).toBeTruthy();
      expect(viewComponent().detectedEntrySignal()?.key).toBe('default');
    });
  });

  describe('injected context', () => {
    beforeEach(async () => {
      await setup(makeBrowserAgentInfo({ os: 'android', browser: 'chrome', device: 'mobile' }));
    });

    it('should provide the DbxBrowserAgentViewContext to injected components', async () => {
      host.config.set({ entries: TEST_CONFIG.entries, defaultEntry: { key: 'context', label: 'Context', componentConfig: { componentClass: TestContextComponent } } });
      host.overrideKey.set('context');
      await update();

      expect(query('.test-context')?.textContent).toBe('context');
    });
  });
});
