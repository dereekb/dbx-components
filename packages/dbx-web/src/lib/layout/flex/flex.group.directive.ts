import { ScreenMediaWidthType } from '../../screen/screen';
import { DbxScreenMediaService } from '../../screen/screen.service';
import { Directive, ChangeDetectorRef, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, map, shareReplay, distinctUntilChanged, delay } from 'rxjs';
import { AbstractSubscriptionDirective, safeDetectChanges } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

/**
 * Used to declare a dbxFlexGroup.
 */
@Directive({
  selector: '[dbxFlexGroup]',
  host: {
    '[class.dbx-flex-group]': 'content',
    '[class.dbx-flex-group-break-to-column]': 'breakToColumn',
    '[class.dbx-flex-group-small]': 'small',
    '[class.dbx-flex-group-relative]': 'relative'
  }
})
export class DbxFlexGroupDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private readonly _dbxScreenMediaService = inject(DbxScreenMediaService);
  readonly cdRef = inject(ChangeDetectorRef);

  @Input()
  breakToColumn = false;

  @Input()
  content = true;

  @Input()
  relative = false;

  private _small = false;

  private _breakpoint = new BehaviorSubject<ScreenMediaWidthType>('tablet');

  readonly isSmallScreen$ = this._dbxScreenMediaService.isBreakpointActive(this._breakpoint).pipe(
    map((x) => !x),
    distinctUntilChanged(),
    shareReplay(1)
  );

  get small(): boolean {
    return this._small;
  }

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.sub = this.isSmallScreen$.pipe(delay(0)).subscribe((small) => {
      this._small = small;
      safeDetectChanges(this.cdRef);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._breakpoint.complete();
  }

  @Input()
  set breakpoint(breakpoint: Maybe<ScreenMediaWidthType>) {
    this._breakpoint.next(breakpoint ?? 'tablet');
  }
}
