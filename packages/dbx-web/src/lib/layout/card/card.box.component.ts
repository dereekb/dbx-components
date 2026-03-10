import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Displays a card-style box with an optional section header, icon, and projected content.
 *
 * Supports a named content slot `[sectionHeader]` for custom header actions beside the title.
 *
 * @example
 * ```html
 * <dbx-card-box [header]="'Settings'" [icon]="'settings'">
 *   <button sectionHeader mat-icon-button><mat-icon>edit</mat-icon></button>
 *   <p>Card body content goes here.</p>
 * </dbx-card-box>
 * ```
 */
@Component({
  selector: 'dbx-card-box',
  template: `
    <div class="dbx-card-box">
      <div class="dbx-section-header">
        <div class="dbx-section-header-content">
          <h4 class="dbx-section-header-content-title">
            @if (icon()) {
              <mat-icon>{{ icon() }}</mat-icon>
            }
            @if (header()) {
              <span class="title-text">{{ header() }}</span>
            }
          </h4>
          <span class="spacer"></span>
          <ng-content select="[sectionHeader]"></ng-content>
        </div>
      </div>
      <div class="dbx-card-box-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxCardBoxComponent {
  readonly header = input<string>();
  readonly icon = input<string>();
}
