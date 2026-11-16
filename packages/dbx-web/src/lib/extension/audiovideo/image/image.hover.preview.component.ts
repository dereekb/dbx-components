import { ChangeDetectionStrategy, Component, InjectionToken, computed, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Data passed to a {@link DbxImageHoverPreviewComponent}.
 */
export interface DbxImageHoverPreviewData {
  readonly src: string;
  readonly alt?: Maybe<string>;
  /**
   * Max CSS width of the preview image.
   */
  readonly maxWidth?: Maybe<string>;
  /**
   * Max CSS height of the preview image.
   */
  readonly maxHeight?: Maybe<string>;
}

/**
 * Injection token for the {@link DbxImageHoverPreviewData} of a {@link DbxImageHoverPreviewComponent}.
 */
export const DBX_IMAGE_HOVER_PREVIEW_DATA = new InjectionToken<DbxImageHoverPreviewData>('DbxImageHoverPreviewData');

/**
 * Default max width of a hover preview image.
 */
export const DEFAULT_DBX_IMAGE_HOVER_PREVIEW_MAX_WIDTH = '480px';

/**
 * Default max height of a hover preview image.
 */
export const DEFAULT_DBX_IMAGE_HOVER_PREVIEW_MAX_HEIGHT = '480px';

/**
 * Panel shown in the overlay opened by {@link DbxImageHoverPreviewDirective}. Renders the larger image.
 */
@Component({
  selector: 'dbx-image-hover-preview',
  template: `
    <img class="dbx-image-hover-preview-img" [src]="data.src" [attr.alt]="data.alt ?? ''" [style.max-width]="maxWidthSignal()" [style.max-height]="maxHeightSignal()" />
  `,
  host: {
    class: 'dbx-image-hover-preview mat-elevation-z8'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxImageHoverPreviewComponent {
  readonly data = inject(DBX_IMAGE_HOVER_PREVIEW_DATA);

  readonly maxWidthSignal = computed(() => this.data.maxWidth ?? DEFAULT_DBX_IMAGE_HOVER_PREVIEW_MAX_WIDTH);
  readonly maxHeightSignal = computed(() => this.data.maxHeight ?? DEFAULT_DBX_IMAGE_HOVER_PREVIEW_MAX_HEIGHT);
}
