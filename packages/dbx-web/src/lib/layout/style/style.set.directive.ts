import { cleanSubscription } from '@dereekb/dbx-core';
import { splitCommaSeparatedStringToSet, type Maybe } from '@dereekb/util';
import { Observable, distinctUntilChanged, map, shareReplay, delay, combineLatest, Subscription } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, signal, input, effect, OnDestroy } from '@angular/core';
import { DbxStyleService } from './style.service';
import { DbxStyleConfig, DbxStyleClass, DbxStyleName } from './style';
import { toObservable } from '@angular/core/rxjs-interop';

export type DbxSetStyleMode = 'both' | 'global' | 'self';

/**
 * Used to denote which app style to use for all children below this.
 *
 * Will update the parent DbxStyleService if mode is "global".
 */
@Directive({
  selector: '[dbxSetStyle]',
  host: {
    class: 'dbx-style-root',
    '[class]': 'outputStyleClassSignal()'
  },
  standalone: true
})
export class DbxSetStyleDirective implements OnDestroy {
  private readonly _styleService = inject(DbxStyleService);

  /**
   * The mode for the style.
   *
   * - global: The style will be set on the parent DbxStyleService.
   * - self: The style will be applied to the host element.
   */
  readonly setStyleMode = input<DbxSetStyleMode>('self');

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

  readonly _outputStyleClassSubscription = cleanSubscription();

  protected readonly _modeEffect = effect(() => {
    const mode = this.setStyleMode();
    let nextOutputStyleClassSubscription: Maybe<Subscription>;

    if (mode === 'self' || mode === 'both') {
      nextOutputStyleClassSubscription = this.styleClass$.pipe(delay(0)).subscribe((style) => {
        this.outputStyleClassSignal.set(style);
      });
    }

    this._outputStyleClassSubscription.setSub(nextOutputStyleClassSubscription);

    if (mode === 'global' || mode === 'both') {
      this._styleService.setConfig(this.config$);
    } else {
      this._styleService.unsetConfig(this.config$);
    }
  });

  ngOnDestroy() {
    // clear/unset this config if it is still set
    this._styleService.unsetConfig(this.config$);
  }
}
