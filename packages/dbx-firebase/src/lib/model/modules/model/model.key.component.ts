import { Component, inject, input, computed } from '@angular/core';
import { FirestoreModelKey, firestoreModelId, firestoreModelKeyCollectionName } from '@dereekb/firebase';
import { DbxFirebaseModelTypesService } from './model.types.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { MatIcon } from '@angular/material/icon';

/**
 * An interactive display for a FirestoreModelKey.
 */
@Component({
  selector: 'dbx-firebase-model-key',
  templateUrl: './model.key.component.html',
  standalone: true,
  imports: [MatIcon]
})
export class DbxFirebaseModelKeyComponent {
  readonly dbxFirebaseModelTypesService = inject(DbxFirebaseModelTypesService);

  readonly modelKey = input<FirestoreModelKey>();

  // Convert signal to observable for types service
  readonly modelKey$ = toObservable(this.modelKey);

  // Computed signals for synchronous extractions
  readonly documentId = computed(() => {
    const key = this.modelKey();
    return key ? firestoreModelId(key) : undefined;
  });

  readonly collectionName = computed(() => {
    const key = this.modelKey();
    return key ? firestoreModelKeyCollectionName(key) : undefined;
  });

  // Use types service to get model type display info (icon and title)
  readonly displayInfo = toSignal(
    this.modelKey$.pipe(
      switchMap((key) => {
        if (!key) return of(undefined);
        const instance = this.dbxFirebaseModelTypesService.instanceForKey(key);
        return instance.displayInfo$;
      })
    )
  );
}
