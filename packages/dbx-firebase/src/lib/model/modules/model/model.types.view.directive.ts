import { distinctUntilModelKeyChange } from '@dereekb/rxjs';
import { DbxModelObjectStateService, ModelViewContext } from '@dereekb/dbx-web';
import { Directive, Input, NgZone, OnInit, inject } from '@angular/core';
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
  readonly dbxFirebaseDocumentStoreDirective = inject(DbxFirebaseDocumentStoreDirective);
  readonly dbxModelObjectStateService = inject(DbxModelObjectStateService);
  readonly dbxFirebaseModelTypesService = inject(DbxFirebaseModelTypesService);
  readonly ngZone = inject(NgZone);

  @Input('dbxFirebaseModelViewedEvent')
  context?: ModelViewContext | undefined;

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
        this.ngZone.run(() => this.dbxModelObjectStateService.emitModelViewEvent({ modelKeyTypeNamePair, context: this.context || undefined }));
      });
  }
}
