import { Component, computed, input, ChangeDetectionStrategy, signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxSectionHeaderConfig, DbxSectionHeaderHType } from './section';
import { MatIcon } from '@angular/material/icon';

/**
 * Component used to style a section's header.
 */
@Component({
  selector: 'dbx-section-header,.dbx-section-header',
  template: `
    <div class="dbx-section-header-content">
      @if (showTitleSignal()) {
        @switch (headerConfigSignal().h ?? 1) {
          @case (1) {
            <h1 class="dbx-section-header-content-title">
              <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
            </h1>
          }
          @case (2) {
            <h2 class="dbx-section-header-content-title">
              <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
            </h2>
          }
          @case (3) {
            <h3 class="dbx-section-header-content-title">
              <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
            </h3>
          }
          @case (4) {
            <h4 class="dbx-section-header-content-title">
              <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
            </h4>
          }
          @case (5) {
            <h5 class="dbx-section-header-content-title">
              <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
            </h5>
          }
        }
        <span class="spacer"></span>
      }
      <ng-content></ng-content>
    </div>
    <!-- Show Hint Not Inline -->
    @if (headerConfigSignal().hint && !headerConfigSignal().hintInline) {
      <p class="dbx-section-hint dbx-hint">{{ headerConfigSignal().hint }}</p>
    }
    <ng-template #headerContentTitleTemplate>
      @if (headerConfigSignal().icon) {
        <mat-icon>{{ headerConfigSignal().icon }}</mat-icon>
      }
      <span class="title-text">
        {{ headerConfigSignal().header }}
        <!-- Show Hint Inline -->
        @if (headerConfigSignal().hint && headerConfigSignal().hintInline) {
          <span class="dbx-section-hint-inline dbx-hint">{{ headerConfigSignal().hint }}</span>
        }
      </span>
    </ng-template>
  `,
  standalone: true,
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.dbx-section-header-full-title]': 'headerConfigSignal().onlyHeader',
    '[class.dbx-section-header-padded]': 'headerConfigSignal().paddedHeader'
  }
})
export class DbxSectionHeaderComponent {
  readonly headerConfig = input<Maybe<DbxSectionHeaderConfig>>();

  readonly h = input<Maybe<DbxSectionHeaderHType>>();
  readonly paddedHeader = input<Maybe<boolean>>();
  readonly header = input<Maybe<string>>();
  readonly onlyHeader = input<Maybe<boolean>>();
  readonly icon = input<Maybe<string>>();
  readonly hint = input<Maybe<string>>();
  readonly hintInline = input<Maybe<boolean>>();

  readonly hintInlineDefault = signal<Maybe<boolean>>(undefined);

  readonly headerConfigSignal = computed(() => {
    const headerConfig = this.headerConfig();

    const config: DbxSectionHeaderConfig = {
      h: this.h() ?? headerConfig?.h,
      paddedHeader: this.paddedHeader() ?? headerConfig?.paddedHeader,
      header: this.header() ?? headerConfig?.header,
      onlyHeader: this.onlyHeader() ?? headerConfig?.onlyHeader,
      icon: this.icon() ?? headerConfig?.icon,
      hint: this.hint() ?? headerConfig?.hint,
      hintInline: this.hintInline() ?? headerConfig?.hintInline ?? this.hintInlineDefault()
    };

    return config;
  });

  readonly showTitleSignal = computed(() => {
    const headerConfig = this.headerConfigSignal();
    return Boolean(headerConfig.header || headerConfig.icon);
  });
}
