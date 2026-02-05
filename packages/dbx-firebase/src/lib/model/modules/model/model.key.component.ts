import { Component, inject, input, computed } from '@angular/core';
import { FirestoreModelKey, firestoreModelId, twoWayFlatFirestoreModelKey, firestoreModelKeyCollectionName, flatFirestoreModelKey } from '@dereekb/firebase';
import { DbxFirebaseModelTypesService, DbxFirebaseModelTypesServiceInstance } from './model.types.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of, map } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { DbxDetailBlockComponent, DbxClickToCopyTextComponent, DbxAnchorComponent, DbxButtonComponent } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';
import { tapLog } from '@dereekb/rxjs';
import { DbxButton } from '@dereekb/dbx-core';

/**
 * An interactive display for a FirestoreModelKey.
 */
@Component({
  selector: 'dbx-firebase-model-key',
  templateUrl: './model.key.component.html',
  standalone: true,
  imports: [MatIcon, DbxDetailBlockComponent, DbxButtonComponent, DbxClickToCopyTextComponent, DbxAnchorComponent]
})
export class DbxFirebaseModelKeyComponent {
  readonly dbxFirebaseModelTypesService = inject(DbxFirebaseModelTypesService);

  readonly modelKey = input<FirestoreModelKey>();
  readonly oneWayFlatModelKey = computed(() => {
    const modelKey = this.modelKey();
    return modelKey ? flatFirestoreModelKey(modelKey) : undefined;
  });

  readonly twoWayFlatModelKey = computed(() => {
    const modelKey = this.modelKey();
    return modelKey ? twoWayFlatFirestoreModelKey(modelKey) : undefined;
  });

  // Convert signal to observable for types service
  readonly modelKey$ = toObservable(this.modelKey);

  readonly modelTypeInstance$ = this.modelKey$.pipe(
    switchMap((key) => {
      let result: Maybe<DbxFirebaseModelTypesServiceInstance> = undefined;

      if (key) {
        result = this.dbxFirebaseModelTypesService.instanceForKey(key);
      }

      return of(result);
    })
  );

  readonly modelIdentity$ = this.modelTypeInstance$.pipe(switchMap((x) => x?.identity$ ?? of(undefined)));
  readonly typeInfo$ = this.modelTypeInstance$.pipe(switchMap((x) => x?.safeTypeInfo$ ?? of(undefined)));

  readonly modelTypeInstanceSignal = toSignal(this.modelTypeInstance$);
  readonly modelIdentitySignal = toSignal(this.modelIdentity$);
  readonly typeInfoSignal = toSignal(this.typeInfo$);

  readonly typeCanSegueToView = computed(() => this.typeInfoSignal()?.canSegueToView ?? false);

  readonly sref$ = this.modelTypeInstance$.pipe(switchMap((x) => x?.segueRef$ ?? of(undefined)));
  readonly srefSignal = toSignal(this.sref$);
}
