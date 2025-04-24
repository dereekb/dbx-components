import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Component that formats a card-box of content.
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
