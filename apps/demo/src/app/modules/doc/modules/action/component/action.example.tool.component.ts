import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { filterMaybe } from '@dereekb/rxjs';
import { shareReplay, switchMap } from 'rxjs';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { provideFormlyContext } from '@dereekb/dbx-form';
import { DbxActionContextStoreSourceInstance, DbxActionDirective } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxActionSourceDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/context/action.source.directive';
import { MatDivider } from '@angular/material/divider';
import { FlexModule } from '@ngbracket/ngx-layout/flex';
import { DbxErrorComponent } from '../../../../../../../../../packages/dbx-web/src/lib/error/error.component';
import { DbxActionErrorDirective } from '../../../../../../../../../packages/dbx-web/src/lib/error/error.action.directive';
import { JsonPipe } from '@angular/common';

@Component({
    templateUrl: './action.example.tool.component.html',
    selector: 'dbx-action-example-tools',
    providers: [provideFormlyContext()],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [DbxActionSourceDirective, MatDivider, FlexModule, DbxErrorComponent, DbxActionErrorDirective, JsonPipe]
})
export class DocActionExampleToolsComponent {
  readonly hostSourceInstance = inject(DbxActionContextStoreSourceInstance, { host: true, optional: true });

  readonly action = input<Maybe<DbxActionDirective>>(undefined);
  readonly source = input<Maybe<DbxActionContextStoreSourceInstance>>(undefined);

  readonly sourceSignal = computed(() => {
    const source = this.source();
    const action = this.action();

    return source ?? action?.sourceInstance ?? this.hostSourceInstance;
  });

  readonly source$ = toObservable(this.sourceSignal).pipe(filterMaybe(), shareReplay(1));

  readonly stateSignal = toSignal(this.source$.pipe(switchMap((x) => x.actionState$)));
  readonly isModifiedSignal = toSignal(this.source$.pipe(switchMap((x) => x.isModified$)));
  readonly canTriggerSignal = toSignal(this.source$.pipe(switchMap((x) => x.canTrigger$)));
  readonly isModifiedAndCanTriggerSignal = toSignal(this.source$.pipe(switchMap((x) => x.isModifiedAndCanTrigger$)));
  readonly errorCountSinceLastSuccessSignal = toSignal(this.source$.pipe(switchMap((x) => x.errorCountSinceLastSuccess$)));
  readonly valueReadySignal = toSignal(this.source$.pipe(switchMap((x) => x.valueReady$)));
  readonly successSignal = toSignal(this.source$.pipe(switchMap((x) => x.success$)));
  readonly errorSignal = toSignal(this.source$.pipe(switchMap((x) => x.error$)));
  readonly disabledKeysSignal = toSignal(this.source$.pipe(switchMap((x) => x.disabledKeys$)));
  readonly isDisabledSignal = toSignal(this.source$.pipe(switchMap((x) => x.isDisabled$)));
}
