import { Directive, OnInit, OnDestroy, ViewContainerRef, inject, input, effect } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { HookResult, Transition, TransitionService } from '@uirouter/core';
import { Observable, of, race, delay, first, map, mergeMap, tap, BehaviorSubject, combineLatest, firstValueFrom } from 'rxjs';
import { DbxActionContextStoreSourceInstance, canTriggerAction, isIdleActionState } from '@dereekb/dbx-core';
import { DbxActionTransitionSafetyDialogResult, DbxActionUIRouterTransitionSafetyDialogComponent } from './transition.safety.dialog.component';
import { Maybe } from '@dereekb/util';

/**
 * How to handle transitions.
 *
 * Values:
 * - none: Nothing occurs.
 * - dialog: Always show a dialog and act based on the result.
 * - auto: Try to auto-trigger if in a triggerable state. If it is modified but in a non-triggerable state, show a dialog. Should be used in conjuction with the auto-saver.
 */
export type DbxActionTransitionSafetyType = 'none' | 'dialog' | 'auto';

/**
 * Context used for preventing a transition from occuring if the action is not complete or is in a modified state.
 *
 * This can be configured to auto-trigger and wait, or show a dialog and wait for the user's feedback before doing anything.
 *
 * NOTE: This dialog only works for uirouter.
 */
@Directive({
  selector: '[dbxActionTransitionSafety]',
  standalone: true
})
export class DbxActionTransitionSafetyDirective<T, O> implements OnInit, OnDestroy {
  protected readonly _safetyType = new BehaviorSubject<Maybe<DbxActionTransitionSafetyType>>(undefined);

  readonly dbxActionTransitionSafety = input<DbxActionTransitionSafetyType>();

  protected readonly transitionService = inject(TransitionService);
  protected readonly viewContainerRef = inject(ViewContainerRef);
  protected readonly dialog = inject(MatDialog);

  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>);
  readonly safetyType$ = this._safetyType.pipe(map((x) => x ?? 'dialog'));

  private readonly _dbxActionTransitionSafetyUpdateEffect = effect(() => this._safetyType.next(this.dbxActionTransitionSafety()));

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
    this._dbxActionTransitionSafetyUpdateEffect.destroy();
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
                if (saveSuccess) {
                  return true;
                } else {
                  return handleResult;
                }
              }),
              tap(() => this._closeDialog()), // Close dialog if it is still open.
              delay(10) // Delay to allow dialog to close before transition.
            );
          } else {
            return of(true);
          }
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
          if (isIdleActionState(state.actionState)) {
            // If we're in an idle state, get ready to trigger it.
            if (canTriggerAction(state)) {
              store.trigger(); // Try and trigger it.
            }
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

  private _showDialog(transition: Transition): Observable<HookResult> {
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
