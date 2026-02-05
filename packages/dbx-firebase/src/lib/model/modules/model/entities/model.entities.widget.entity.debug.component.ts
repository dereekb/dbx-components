import { Component } from '@angular/core';
import { AbstractDbxFirebaseModelEntitiesWidgetDirective } from './model.entities.widget.entity.abstract.directive';
import { toSignal } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';
import { DbxFirebaseModelKeyComponent } from '../model.key.component';

/**
 * A debug widget component that displays entity data and metadata.
 */
@Component({
  selector: 'dbx-firebase-model-entities-debug-widget',
  templateUrl: './model.entities.widget.entity.debug.component.html',
  standalone: true,
  imports: [DbxFirebaseModelKeyComponent, JsonPipe]
})
export class DbxFirebaseModelEntitiesDebugWidgetComponent extends AbstractDbxFirebaseModelEntitiesWidgetDirective {
  // Convert store observables to signals for template usage
  readonly currentKey = toSignal(this.store.currentKey$);
  readonly currentData = toSignal(this.data$);
  readonly loadingState = toSignal(this.store.dataLoadingState$);

  // Access model identity from entity data
  readonly modelIdentity = this.entityData.modelIdentity;
}
