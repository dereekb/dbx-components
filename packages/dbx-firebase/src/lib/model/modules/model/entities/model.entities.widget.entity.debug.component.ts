import { Component, OnDestroy } from '@angular/core';
import { AbstractDbxFirebaseModelEntitiesWidgetDirective } from './model.entities.widget.entity.abstract.directive';
import { toSignal } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';
import { DbxFirebaseModelKeyComponent } from '../model.key.component';
import { DbxClickToCopyTextComponent, DbxContentPitDirective, DbxLoadingComponent } from '@dereekb/dbx-web';
import { loadingStateContext } from '@dereekb/rxjs';

/**
 * A debug widget component that displays entity data and metadata.
 */
@Component({
  selector: 'dbx-firebase-model-entities-debug-widget',
  templateUrl: './model.entities.widget.entity.debug.component.html',
  standalone: true,
  imports: [DbxFirebaseModelKeyComponent, DbxClickToCopyTextComponent, DbxContentPitDirective, DbxLoadingComponent, JsonPipe]
})
export class DbxFirebaseModelEntitiesDebugWidgetComponent extends AbstractDbxFirebaseModelEntitiesWidgetDirective implements OnDestroy {
  // Convert store observables to signals for template usage
  readonly currentKey = toSignal(this.store.currentKey$);
  readonly currentData = toSignal(this.data$);

  readonly context = loadingStateContext(this.store.dataLoadingState$);

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
