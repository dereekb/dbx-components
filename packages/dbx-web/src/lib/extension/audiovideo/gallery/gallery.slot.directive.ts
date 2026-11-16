import { Directive, inject, type Signal } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxValueListItem } from '../../../layout/list/list.view.value';
import { DbxGalleryItem } from './gallery';

/**
 * Base directive for gallery slot components (presentation, top and bottom).
 *
 * Exposes the gallery item's value, list item and selected state as signals. Data passed through the slot's
 * `DbxInjectionComponentConfig.data` (such as callbacks) is available as `data`.
 *
 * @example
 * ```ts
 * @Component({
 *   template: `<span>{{ valueSignal().name }}</span>`
 * })
 * export class MyGalleryLabelComponent extends AbstractDbxGallerySlotDirective<MyItem> {}
 * ```
 */
@Directive()
export abstract class AbstractDbxGallerySlotDirective<T, D = unknown> {
  readonly galleryItem = inject(DbxGalleryItem<T>);
  readonly data = inject<Maybe<D>>(DBX_INJECTION_COMPONENT_DATA, { optional: true });

  readonly itemSignal: Signal<DbxValueListItem<T>> = this.galleryItem.itemSignal;
  readonly valueSignal: Signal<T> = this.galleryItem.valueSignal;
  readonly selectedSignal: Signal<boolean> = this.galleryItem.selectedSignal;
}
