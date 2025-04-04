import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, shareReplay, switchMap } from 'rxjs';
import { Component, Input, OnDestroy, inject } from '@angular/core';
import { provideFormlyContext } from '@dereekb/dbx-form';
import { DbxActionContextStoreSourceInstance, DbxActionDirective } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

@Component({
  templateUrl: './action.example.tool.component.html',
  selector: 'dbx-action-example-tools',
  providers: [provideFormlyContext()]
})
export class DocActionExampleToolsComponent implements OnDestroy {
  readonly hostSourceInstance = inject(DbxActionContextStoreSourceInstance, { host: true, optional: true });

  private readonly _source = new BehaviorSubject<Maybe<DbxActionContextStoreSourceInstance>>(this.hostSourceInstance);
  readonly source$ = this._source.pipe(filterMaybe(), shareReplay(1));

  readonly state$ = this.source$.pipe(switchMap((x) => x.actionState$));
  readonly isModified$ = this.source$.pipe(switchMap((x) => x.isModified$));
  readonly canTrigger$ = this.source$.pipe(switchMap((x) => x.canTrigger$));
  readonly isModifiedAndCanTrigger$ = this.source$.pipe(switchMap((x) => x.isModifiedAndCanTrigger$));
  readonly errorCountSinceLastSuccess$ = this.source$.pipe(switchMap((x) => x.errorCountSinceLastSuccess$));
  readonly valueReady$ = this.source$.pipe(switchMap((x) => x.valueReady$));
  readonly success$ = this.source$.pipe(switchMap((x) => x.success$));
  readonly error$ = this.source$.pipe(switchMap((x) => x.error$));
  readonly disabledKeys$ = this.source$.pipe(switchMap((x) => x.disabledKeys$));
  readonly isDisabled$ = this.source$.pipe(switchMap((x) => x.isDisabled$));

  ngOnDestroy(): void {
    this._source.complete();
  }

  @Input()
  set action(action: DbxActionDirective) {
    this.source = action.sourceInstance;
  }

  @Input()
  set source(source: DbxActionContextStoreSourceInstance) {
    this._source.next(source);
  }
}
