import { Component, computed, forwardRef, inject, input, model } from '@angular/core';
import { type BrowserAgentInfo } from '@dereekb/browser';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxBrowserAgentViewConfig, DbxBrowserAgentViewContext, type DbxBrowserAgentViewEntry, type DbxBrowserAgentViewEntryKey, findDbxBrowserAgentViewEntry } from './browser.agent.view';
import { DbxBrowserAgentService } from './browser.agent.service';
import { DbxBrowserAgentViewOverrideButtonComponent } from './browser.agent.view.override.button.component';

/**
 * Renders the component of the first {@link DbxBrowserAgentViewEntry} whose match matches the current browser agent (OS, browser, and device), falling back to the config's default entry.
 *
 * An optional override button lets the user pick another entry. Injected components can inject {@link DbxBrowserAgentViewContext} to read the detected agent or to switch entries.
 *
 * @dbxWebComponent
 * @dbxWebSlug browser-agent-view
 * @dbxWebCategory misc
 * @dbxWebRelated widget, browser-agent-view-override-button
 * @dbxWebMinimalExample ```html
 * <dbx-browser-agent-view [config]="config"></dbx-browser-agent-view>
 * ```
 *
 * @example
 * ```typescript
 * readonly config = makeDbxBrowserAgentViewConfigFromOsMap({
 *   ios: { componentClass: IosInstructionsComponent },
 *   android: { componentClass: AndroidInstructionsComponent },
 *   default: { componentClass: BookmarkInstructionsComponent },
 *   showOverrideButton: true
 * });
 * ```
 *
 * ```html
 * <dbx-browser-agent-view [config]="config" [(overrideKey)]="savedDeviceKey"></dbx-browser-agent-view>
 * ```
 */
@Component({
  selector: 'dbx-browser-agent-view',
  template: `
    @if (showOverrideButtonSignal()) {
      <div class="dbx-browser-agent-view-override">
        <dbx-browser-agent-view-override-button></dbx-browser-agent-view-override-button>
      </div>
    }
    <dbx-injection [config]="injectionConfigSignal()"></dbx-injection>
  `,
  host: {
    class: 'dbx-browser-agent-view'
  },
  providers: [
    {
      provide: DbxBrowserAgentViewContext,
      useExisting: forwardRef(() => DbxBrowserAgentViewComponent)
    }
  ],
  imports: [DbxInjectionComponent, DbxBrowserAgentViewOverrideButtonComponent]
})
export class DbxBrowserAgentViewComponent implements DbxBrowserAgentViewContext {
  readonly agentInfo: BrowserAgentInfo = inject(DbxBrowserAgentService).agentInfo;

  readonly config = input<Maybe<DbxBrowserAgentViewConfig>>();
  readonly showOverrideButton = input<Maybe<boolean>>();

  /**
   * Key of the manually selected entry. Can be bound two-way to persist the user's choice.
   */
  readonly overrideKey = model<Maybe<DbxBrowserAgentViewEntryKey>>();

  readonly entriesSignal = computed<DbxBrowserAgentViewEntry[]>(() => {
    const config = this.config();
    return config ? [...(config.entries ?? []), config.defaultEntry] : [];
  });

  readonly detectedEntrySignal = computed<Maybe<DbxBrowserAgentViewEntry>>(() => {
    const config = this.config();
    return config ? findDbxBrowserAgentViewEntry(config, this.agentInfo) : undefined;
  });

  readonly overrideEntrySignal = computed<Maybe<DbxBrowserAgentViewEntry>>(() => {
    const entries = this.entriesSignal();
    const key = this.overrideKey();
    return key == null ? undefined : entries.find((entry) => entry.key === key);
  });

  readonly selectedEntrySignal = computed<Maybe<DbxBrowserAgentViewEntry>>(() => {
    const detectedEntry = this.detectedEntrySignal();
    return this.overrideEntrySignal() ?? detectedEntry;
  });
  readonly isOverriddenSignal = computed(() => this.overrideEntrySignal() != null);

  /**
   * Uses the entry's own config object so the injected component is only recreated when the selected entry changes.
   */
  readonly injectionConfigSignal = computed<Maybe<DbxInjectionComponentConfig>>(() => this.selectedEntrySignal()?.componentConfig);

  readonly showOverrideButtonSignal = computed(() => {
    const config = this.config();
    return this.showOverrideButton() ?? config?.showOverrideButton ?? false;
  });

  setOverride(key: Maybe<DbxBrowserAgentViewEntryKey>): void {
    this.overrideKey.set(key);
  }

  clearOverride(): void {
    this.overrideKey.set(undefined);
  }
}
