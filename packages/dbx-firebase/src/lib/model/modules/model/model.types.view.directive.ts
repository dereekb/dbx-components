import { distinctUntilModelKeyChange } from '@dereekb/rxjs';
import { DbxModelObjectStateService } from '@dereekb/dbx-web';
import { Directive, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { combineLatestWith, first, map, switchMap } from 'rxjs';
import { DbxFirebaseDocumentStoreDirective } from '../store/store.document.directive';
import { DbxFirebaseModelTypesService } from './model.types.service';
import { ModelKeyTypeNamePair } from '@dereekb/util';

/**
 * Used with a DbxFirebaseDocumentStoreDirective to emit model viewed events.
 */
@Directive({
  selector: '[dbxFirebaseModelViewedEvent]'
})
export class DbxfirebaseModelViewedEventDirective extends AbstractSubscriptionDirective implements OnInit {
  constructor(readonly dbxFirebaseDocumentStoreDirective: DbxFirebaseDocumentStoreDirective, readonly dbxModelObjectStateService: DbxModelObjectStateService, readonly dbxFirebaseModelTypesService: DbxFirebaseModelTypesService) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.dbxFirebaseDocumentStoreDirective.data$
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
        this.dbxModelObjectStateService.emitModelViewEvent({ modelKeyTypeNamePair });
      });
  }
}
