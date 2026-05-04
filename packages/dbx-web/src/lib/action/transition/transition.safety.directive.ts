import { Directive, type OnInit, type OnDestroy, ViewContainerRef, inject, input, effect } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { type HookResult, type Transition, TransitionService } from '@uirouter/core';
import { type Observable, of, race, delay, first, map, mergeMap, tap, BehaviorSubject, combineLatest, firstValueFrom } from 'rxjs';
import { DbxActionContextStoreSourceInstance, canTriggerAction, isIdleActionState, completeOnDestroy } from '@dereekb/dbx-core';
import { type DbxActionTransitionSafetyDialogResult, DbxActionUIRouterTransitionSafetyDialogComponent } from './transition.safety.dialog.component';
import { type Maybe } from '@dereekb/util';

/**
 * Strategy for handling route transitions when the action has unsaved changes.
 *
 * - `'none'` - Allow the transition without any prompt.
 * - `'dialog'` - Always show a confirmation dialog and act based on the user's choice.
 * - `'auto'` - Attempt to auto-trigger the action if possible. If modified but not triggerable, fall back to showing a dialog. Best used with an auto-save mechanism.
 */
export type DbxActionTransitionSafetyType = 'none' | 'dialog' | 'auto';

/**
 * Prevents UI Router transitions when the action has unsaved changes. Depending on the
 * configured safety type, it can auto-trigger the action, show a confirmation dialog,
 * or allow the transition without intervention.
 *
 * NOTE: This directive only works with UI-Router (not Angular Router).
 *
 * @dbxWebComponent
 * @dbxWebSlug action-transition-safety
 * @dbxWebCategory action
 * @dbxWebRelated action-confirm
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <form [dbxActionTransitionSafety]></form>
 * ```
 *
 * @example
 * ```html
 * <form [dbxAction]="formAction" dbxActionTransitionSafety>...</form>
 * ```
 */
@Directive({
  selector: '[dbxActionTransitionSafety]',
  standalone: true
})
export class DbxActionTransitionSafetyDirective<T, O> implements OnInit, OnDestroy {
  protected readonly _safetyType = completeOnDestroy(new BehaviorSubject<Maybe<DbxActionTransitionSafetyType>>(undefined));

  readonly dbxActionTransitionSafety = input<DbxActionTransitionSafetyType>();

  protected readonly transitionService = inject(TransitionService);
  protected readonly viewContainerRef = inject(ViewContainerRef);
  protected readonly dialog = inject(MatDialog);

  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>);
  readonly safetyType$ = this._safetyType.pipe(map((x) => x ?? 'dialog'));

  protected readonly _dbxActionTransitionSafetyUpdateEffect = effect(() => this._safetyType.next(this.dbxActionTransitionSafety()));

  private _currentDialogRef?: MatDialogRef<DbxActionUIRouterTransitionSafetyDialogComponent, DbxActionTransitionSafetyDialogResult>;
  private stopWatchingTransition?: () => void;

  private checkIsDestroyed(): boolean {
    return !this.stopWatchingTransition;
  }

  ngOnInit(): void {
    this.stopWatchingTransition = this.transitionService.onStart({}, (transition: Transition) => {
      return this._handleOnBeforeTransition(transition);
    }) as () => void;
  }

  ngOnDestroy(): void {
    if (this.stopWatchingTransition) {
      this.stopWatchingTransition();
      delete this.stopWatchingTransition;
    }

    this._closeDialog();
  }

  protected _handleOnBeforeTransition(transition: Transition): HookResult {
    type DbxActionTransitionSafetyRaceResult = [boolean | undefined, HookResult | undefined];

    return firstValueFrom(
      combineLatest([this.source.isModified$, this.safetyType$]).pipe(
        first(),
        mergeMap(([isModified, safetyType]) => {
          if (isModified) {
            return race([
              // Watch for success to occur. At that point, close everything.
              this.source.success$.pipe(
                first(),
                map(() => [true, undefined] as DbxActionTransitionSafetyRaceResult)
              ),
              this._handleIsModifiedState(transition, safetyType).pipe(
                first(),
                map((x) => [undefined, x] as DbxActionTransitionSafetyRaceResult)
              )
            ]).pipe(
              map(([saveSuccess, handleResult]: DbxActionTransitionSafetyRaceResult) => {
                return saveSuccess ? true : handleResult;
              }),
              tap(() => this._closeDialog()), // Close dialog if it is still open.
              delay(10) // Delay to allow dialog to close before transition.
            );
          }

          return of(true);
        })
      )
    ).then((x) => x); // Resolve/Flatten potential promise result.
  }

  protected _handleIsModifiedState(transition: Transition, safetyType: DbxActionTransitionSafetyType): Observable<HookResult> {
    let obs: Observable<HookResult>;

    // console.log('Safety type: ', safetyType);

    switch (safetyType) {
      case 'none':
        obs = of(true); // Do nothing.
        break;
      case 'auto':
        obs = this._autoTrigger(transition);
        break;
      default:
      case 'dialog':
        obs = this._showDialog(transition);
        break;
    }

    return obs;
  }

  private _autoTrigger(transition: Transition): Observable<HookResult> {
    return this.source.pipeStore((store) =>
      store.state$.pipe(
        delay(20), // Prevent racing with auto-trigger.
        first(),
        mergeMap((state) => {
          if (
            isIdleActionState(state.actionState) && // If we're in an idle state, get ready to trigger it.
            canTriggerAction(state)
          ) {
            store.trigger(); // Try and trigger it.
          }

          // Watch for errors. If an error occurs, show the dialog.
          // Success will cause the race in _handleOnBeforeTransition() to trigger and close everything.
          return store.rejected$.pipe(
            first(),
            mergeMap(() => this._showDialog(transition))
          );
        })
      )
    );
  }

  private _showDialog(_transition: Transition): Observable<HookResult> {
    if (this.checkIsDestroyed()) {
      return of(true);
    }

    if (!this._currentDialogRef) {
      this._currentDialogRef = this.dialog.open(DbxActionUIRouterTransitionSafetyDialogComponent, {
        viewContainerRef: this.viewContainerRef
      });
    }

    return this._currentDialogRef.afterClosed().pipe(
      first(),
      map((result: DbxActionTransitionSafetyDialogResult | undefined = 'stay') => {
        // Default to Stay if the user clicks outside.
        switch (result) {
          case 'discard':
          case 'success':
          case 'none':
            return true;
          case 'stay':
            return false;
        }
      })
    );
  }

  private _closeDialog(): void {
    if (this._currentDialogRef) {
      this._currentDialogRef.close('none');
    }

    this._currentDialogRef = undefined;
  }
}
