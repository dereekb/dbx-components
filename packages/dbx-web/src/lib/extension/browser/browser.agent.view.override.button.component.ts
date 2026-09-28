import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxBrowserAgentViewContext, type DbxBrowserAgentViewEntryKey } from './browser.agent.view';

/**
 * Button that opens a menu to manually select an entry of the parent {@link DbxBrowserAgentViewComponent}, or to return to the auto-detected entry.
 *
 * Rendered by the view when `showOverrideButton` is enabled, but can also be placed inside the injected content to position it manually.
 *
 * @dbxWebComponent
 * @dbxWebSlug browser-agent-view-override-button
 * @dbxWebCategory misc
 * @dbxWebRelated browser-agent-view
 * @dbxWebMinimalExample ```html
 * <dbx-browser-agent-view-override-button></dbx-browser-agent-view-override-button>
 * ```
 *
 * @example
 * ```html
 * <!-- inside a component injected by dbx-browser-agent-view -->
 * <p>Follow these steps to add the app to your home screen.</p>
 * <dbx-browser-agent-view-override-button></dbx-browser-agent-view-override-button>
 * ```
 */
@Component({
  selector: 'dbx-browser-agent-view-override-button',
  template: `
    <dbx-button class="dbx-browser-agent-view-override-button-trigger" ariaLabel="choose device" [text]="selectedEntrySignal()?.label" [icon]="selectedEntrySignal()?.icon" [matMenuTriggerFor]="menu" allowClickPropagation>
      <mat-icon aria-hidden="true">arrow_drop_down</mat-icon>
    </dbx-button>
    <mat-menu #menu>
      <button mat-menu-item class="dbx-browser-agent-view-override-auto" [class.active]="!isOverriddenSignal()" [attr.aria-current]="isOverriddenSignal() ? null : 'true'" (click)="clearOverride()">
        <mat-icon aria-hidden="true">auto_awesome</mat-icon>
        Auto-detect ({{ detectedEntrySignal()?.label }})
      </button>
      @for (entry of entriesSignal(); track entry.key) {
        <button mat-menu-item class="dbx-browser-agent-view-override-entry" [class.active]="entry.key === overrideKeySignal()" [attr.aria-current]="entry.key === overrideKeySignal() ? 'true' : null" (click)="setOverride(entry.key)">
          @if (entry.icon) {
            <mat-icon aria-hidden="true">{{ entry.icon }}</mat-icon>
          }
          {{ entry.label }}
        </button>
      }
    </mat-menu>
  `,
  host: {
    class: 'dbx-browser-agent-view-override-button'
  },
  imports: [DbxButtonComponent, MatMenu, MatMenuItem, MatMenuTrigger, MatIconModule]
})
export class DbxBrowserAgentViewOverrideButtonComponent {
  readonly context = inject(DbxBrowserAgentViewContext);

  readonly entriesSignal = this.context.entriesSignal;
  readonly detectedEntrySignal = this.context.detectedEntrySignal;
  readonly selectedEntrySignal = this.context.selectedEntrySignal;
  readonly isOverriddenSignal = this.context.isOverriddenSignal;

  readonly overrideKeySignal = computed(() => (this.isOverriddenSignal() ? this.selectedEntrySignal()?.key : undefined));

  setOverride(key: DbxBrowserAgentViewEntryKey): void {
    this.context.setOverride(key);
  }

  clearOverride(): void {
    this.context.clearOverride();
  }
}
