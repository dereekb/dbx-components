import { ScreenMediaWidthType } from '../../screen/screen';
import { DbxScreenMediaService } from '../../screen/screen.service';
import { Directive, inject, input } from '@angular/core';
import { map, distinctUntilChanged, shareReplay } from 'rxjs';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

/**
 * Used to declare a dbxFlexGroup.
 */
@Directive({
  selector: '[dbxFlexGroup]',
  host: {
    '[class.dbx-flex-group]': 'content()',
    '[class.dbx-flex-group-break-to-column]': 'breakToColumn()',
    '[class.dbx-flex-group-relative]': 'relative()',
    '[class.dbx-flex-group-small]': 'smallSignal()'
  },
  standalone: true
})
export class DbxFlexGroupDirective extends AbstractSubscriptionDirective {
  private readonly _dbxScreenMediaService = inject(DbxScreenMediaService);

  readonly content = input<boolean>(true);
  readonly breakToColumn = input<boolean>(false);
  readonly relative = input<boolean>(false);

  readonly breakpoint = input<ScreenMediaWidthType, Maybe<ScreenMediaWidthType>>('tablet', { transform: (x) => x ?? 'tablet' });

  readonly isSmallScreen$ = this._dbxScreenMediaService.isBreakpointActive(toObservable(this.breakpoint)).pipe(
    map((x) => !x),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly smallSignal = toSignal(this.isSmallScreen$, { initialValue: false });
}
