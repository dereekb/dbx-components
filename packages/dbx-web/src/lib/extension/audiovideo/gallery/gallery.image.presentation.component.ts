import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxImageHoverPreviewDirective, type DbxImageHoverPreviewInput } from '../image/image.hover.preview.directive';
import { type DbxGalleryImageValue } from './gallery';
import { AbstractDbxGallerySlotDirective } from './gallery.slot.directive';

/**
 * Data for {@link DbxGalleryImagePresentationComponent}, passed through the slot's injection config `data`.
 */
export interface DbxGalleryImagePresentationData {
  /**
   * CSS `object-fit` of the image. Defaults to `cover`.
   */
  readonly fit?: Maybe<'cover' | 'contain' | 'fill' | 'none' | 'scale-down'>;
  /**
   * Whether to show a larger preview of the image while hovering it.
   */
  readonly hoverPreview?: Maybe<boolean>;
}

/**
 * Built-in gallery presentation that renders a {@link DbxGalleryImageValue} as a lazily loaded image.
 *
 * This is the gallery's default presentation when none is configured.
 *
 * @dbxWebComponent
 * @dbxWebSlug gallery-image-presentation
 * @dbxWebCategory list
 * @dbxWebRelated gallery, image-hover-preview
 * @dbxWebMinimalExample ```ts
 * galleryConfig: DbxGalleryConfig<DbxGalleryImageValue> = {
 *   presentation: { componentClass: DbxGalleryImagePresentationComponent, data: { fit: 'contain', hoverPreview: true } }
 * };
 * ```
 */
@Component({
  selector: 'dbx-gallery-image-presentation',
  template: `
    @let value = valueSignal();
    <img class="dbx-gallery-image-presentation-img" loading="lazy" [src]="value.thumbnailSrc ?? value.src" [attr.alt]="value.alt ?? ''" [style.object-fit]="fitSignal()" [dbxImageHoverPreview]="hoverPreviewSignal()" />
  `,
  host: {
    class: 'dbx-gallery-image-presentation'
  },
  imports: [DbxImageHoverPreviewDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxGalleryImagePresentationComponent<T extends DbxGalleryImageValue = DbxGalleryImageValue> extends AbstractDbxGallerySlotDirective<T, DbxGalleryImagePresentationData> {
  readonly fitSignal = computed(() => this.data?.fit ?? 'cover');

  readonly hoverPreviewSignal = computed<Maybe<DbxImageHoverPreviewInput>>(() => {
    const value = this.valueSignal();
    return this.data?.hoverPreview ? { src: value.src, alt: value.alt } : undefined;
  });
}
