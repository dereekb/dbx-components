import { distinctUntilModelKeyChange } from '@dereekb/rxjs';
import { DbxModelObjectStateService, ModelViewContext } from '@dereekb/dbx-web';
import { Directive, inject, input } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';
import { combineLatestWith, first, map, switchMap } from 'rxjs';
import { DbxFirebaseDocumentStoreDirective } from '../store/store.document.directive';
import { DbxFirebaseModelTypesService } from './model.types.service';
import { Maybe, ModelKeyTypeNamePair } from '@dereekb/util';

/**
 * Used with a DbxFirebaseDocumentStoreDirective to emit model viewed events.
 */
@Directive({
  selector: '[dbxFirebaseModelViewedEvent]',
  standalone: true
})
export class DbxFirebaseModelViewedEventDirective {
  readonly dbxFirebaseDocumentStoreDirective = inject(DbxFirebaseDocumentStoreDirective);
  readonly dbxModelObjectStateService = inject(DbxModelObjectStateService);
  readonly dbxFirebaseModelTypesService = inject(DbxFirebaseModelTypesService);

  readonly modelViewContext = input<Maybe<ModelViewContext>>(undefined, { alias: 'dbxFirebaseModelViewedEvent' });

  constructor() {
    cleanSubscription(
      this.dbxFirebaseDocumentStoreDirective.data$
        .pipe(
          //
          distinctUntilModelKeyChange(),
          combineLatestWith(
            this.dbxFirebaseDocumentStoreDirective.modelIdentity$.pipe(
              switchMap((x) => this.dbxFirebaseModelTypesService.infoForType(x.modelType)),
              first()
            ),
            this.dbxFirebaseDocumentStoreDirective.key$
          ),
          map(([data, typeInfo, key]) => {
            const displayInfo = this.dbxFirebaseModelTypesService.getDisplayInfo(typeInfo, data);

            const pair: ModelKeyTypeNamePair = {
              key,
              type: typeInfo.modelType,
              name: displayInfo.title
            };

            return pair;
          })
        )
        .subscribe((modelKeyTypeNamePair) => {
          const context = this.modelViewContext();
          this.dbxModelObjectStateService.emitModelViewEvent({ modelKeyTypeNamePair, context });
        })
    );
  }
}
