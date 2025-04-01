import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { splitCommaSeparatedStringToSet, type Maybe } from '@dereekb/util';
import { Observable, distinctUntilChanged, map, shareReplay, delay, combineLatest } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { Directive, OnDestroy, OnInit, inject, signal, input } from '@angular/core';
import { DbxStyleService } from './style.service';
import { DbxStyleConfig, DbxStyleClass, DbxStyleName } from './style';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Used to denote which app style to use for all children below this.
 *
 * Will update the parent DbxStyleService.
 */
@Directive({
  selector: '[dbxSetStyle]',
  host: {
    class: 'dbx-style-root',
    '[class]': 'outputStyleClassSignal()'
  },
  standalone: true
})
export class DbxSetStyleDirective extends AbstractSubscriptionDirective implements OnDestroy, OnInit {
  private readonly _styleService = inject(DbxStyleService);

  /**
   * The input DbxStyleName to style the host element with.
   */
  readonly dbxSetStyle = input<DbxStyleName>();

  /**
   * The input suffixes to allow to be applied to the
   */
  readonly suffixes = input<Maybe<string>>(undefined);

  /**
   * The output style class to apply to the host element.
   */
  readonly outputStyleClassSignal = signal<DbxStyleClass>('');

  readonly style$ = toObservable(this.dbxSetStyle).pipe(filterMaybe());
  readonly suffixes$ = toObservable(this.suffixes).pipe(distinctUntilChanged(), map(splitCommaSeparatedStringToSet));

  readonly config$: Observable<DbxStyleConfig> = combineLatest([this.style$, this.suffixes$]).pipe(
    map(([style, suffixes]) => ({ style, suffixes })),
    shareReplay(1)
  );

  readonly styleClass$: Observable<DbxStyleClass> = this._styleService.getStyleClassWithConfig(this.config$);

  ngOnInit(): void {
    this._styleService.setConfig(this.config$);
    this.sub = this.styleClass$.pipe(delay(0)).subscribe((style) => {
      this.outputStyleClassSignal.set(style);
    });
  }
}
