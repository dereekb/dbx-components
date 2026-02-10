import { Component, computed, OnDestroy, Signal } from '@angular/core';
import { AbstractDbxFirebaseModelEntityWidgetDirective } from './model.entities.widget.entity.abstract.directive';
import { toSignal } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';
import { DbxFirebaseModelKeyComponent } from '../model.key.component';
import { DbxClickToCopyTextComponent, DbxContentPitDirective, DbxDownloadTextViewComponent, DbxLoadingComponent, DownloadTextContent } from '@dereekb/dbx-web';
import { loadingStateContext } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { twoWayFlatFirestoreModelKey } from '@dereekb/firebase';

/**
 * A debug widget component that displays entity data and metadata.
 */
@Component({
  selector: 'dbx-firebase-model-entities-debug-widget',
  templateUrl: './model.entities.widget.entity.debug.component.html',
  standalone: true,
  imports: [DbxFirebaseModelKeyComponent, DbxClickToCopyTextComponent, DbxContentPitDirective, DbxDownloadTextViewComponent, DbxLoadingComponent, JsonPipe]
})
export class DbxFirebaseModelEntitiesDebugWidgetComponent extends AbstractDbxFirebaseModelEntityWidgetDirective implements OnDestroy {
  // Convert store observables to signals for template usage
  readonly currentKey = toSignal(this.store.currentKey$);
  readonly currentData = toSignal(this.data$);

  readonly contentSignal: Signal<Maybe<DownloadTextContent>> = computed(() => {
    const key = this.currentKey();
    const data = this.currentData();

    let content: Maybe<DownloadTextContent>;

    if (key && data) {
      const flattenKey = twoWayFlatFirestoreModelKey(key);

      content = {
        content: JSON.stringify(data, null, 2),
        name: `${flattenKey}.json`
      };
    }

    return content;
  });

  readonly context = loadingStateContext(this.store.dataLoadingState$);

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
