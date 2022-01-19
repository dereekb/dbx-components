import { Directive, OnInit, OnDestroy, Input, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { HookResult, Transition, TransitionService } from '@uirouter/core';
import { Observable, of, race } from 'rxjs';
import { delay, first, map, mergeMap, tap } from 'rxjs/operators';
import { ActionContextStoreSourceInstance, canTriggerAction, isIdleActionState } from '@dereekb/ngx-core';
import { DbNgxActionTransitionSafetyDialogResult, DbNgxActionUIRouterTransitionSafetyDialogComponent } from './transition.safety.dialog.component';

export enum DbNgxActionTransitionSafetyType {
  /**
   * Nothing occurs.
   */
  NONE = 'none',

  /**
   * Always show a dialog and act based on the result.
   */
  DIALOG = 'dialog',

  /**
   * Try to auto-trigger if in a triggerable state.
   *
   * If it is modified but in a non-triggerable state show a dialog.
   *
   * Should be used in conjuction with the auto-saver.
   */
  AUTO_TRIGGER = 'auto'
}

type DbNgxActionTransitionSafetyRaceResult = [boolean | undefined, HookResult | undefined];

/**
 * Context used for preventing a transition from occuring if the action is not complete or is in a modified state.
 *
 * This can be configured to auto-trigger and wait, or show a dialog and wait for the user's feedback before doing anything.
 * 
 * NOTE: This dialog only works for uirouter.
 */
@Directive({
  selector: '[dbxActionTransitionSafety]',
})
export class DbNgxActionTransitionSafetyDirective<T, O> implements OnInit, OnDestroy {

  @Input('dbxActionTransitionSafety')
  inputSafetyType?: DbNgxActionTransitionSafetyType;

  private _dialogRef?: MatDialogRef<DbNgxActionUIRouterTransitionSafetyDialogComponent, DbNgxActionTransitionSafetyDialogResult>;
  private stopWatchingTransition?: () => void;

  constructor(
    public readonly source: ActionContextStoreSourceInstance<T, O>,
    protected readonly transitionService: TransitionService,
    protected readonly viewContainerRef: ViewContainerRef,
    protected readonly dialog: MatDialog
  ) { }

  get safetyType(): DbNgxActionTransitionSafetyType {
    return this.inputSafetyType || DbNgxActionTransitionSafetyType.DIALOG;
  }

  private get _destroyed(): boolean {
    return !this.stopWatchingTransition;
  }

  ngOnInit(): void {
    this.stopWatchingTransition = this.transitionService.onStart({}, (transition: Transition) => {
      return this._handleOnBeforeTransition(transition);
    }) as any;
  }

  ngOnDestroy(): void {
    if (this.stopWatchingTransition) {
      this.stopWatchingTransition();
      delete this.stopWatchingTransition;
    }

    this._closeDialog();
  }

  protected _handleOnBeforeTransition(transition: Transition): HookResult {
    return this.source.isModified$.pipe(
      first(),
      mergeMap((isModified) => {
        if (isModified) {
          return race([
            // Watch for success to occur. At that point, close everything.
            this.source.success$.pipe(first(), map((x) => [true, undefined] as DbNgxActionTransitionSafetyRaceResult)),
            this._handleIsModifiedState(transition).pipe(first(), map((x) => [undefined, x] as DbNgxActionTransitionSafetyRaceResult))
          ]).pipe(
            map(([saveSuccess, handleResult]: DbNgxActionTransitionSafetyRaceResult) => {
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
    ).toPromise().then(x => x); // Resolve/Flatten potential promise result.
  }

  protected _handleIsModifiedState(transition: Transition): Observable<HookResult> {
    const safetyType = this.safetyType;
    let obs: Observable<HookResult>;

    // console.log('Safety type: ', safetyType);

    switch (safetyType) {
      case DbNgxActionTransitionSafetyType.NONE:
        obs = of(true); // Do nothing.
        break;
      case DbNgxActionTransitionSafetyType.DIALOG:
        obs = this._showDialog(transition);
        break;
      case DbNgxActionTransitionSafetyType.AUTO_TRIGGER:
        obs = this._autoTrigger(transition);
        break;
    }

    return obs;
  }

  private _autoTrigger(transition: Transition): Observable<HookResult> {
    return this.source.pipeStore((store) => store.state$.pipe(
      delay(20),  // Prevent racing with auto-trigger.
      first(),
      mergeMap((state) => {
        if (isIdleActionState(state.actionState)) {
          // If we're in an idle state, get ready to trigger it.
          if (canTriggerAction(state)) {
            store.trigger();  // Try and trigger it.
          }
        }

        // Watch for errors. If an error occurs, show the dialog.
        // Success will cause the race in _handleOnBeforeTransition() to trigger and close everything.
        return store.rejected$.pipe(
          first(),
          mergeMap(() => this._showDialog(transition))
        );
      })
    ));
  }

  private _showDialog(transition: Transition): Observable<HookResult> {
    if (this._destroyed) {
      return of(true);
    }

    if (!this._dialogRef) {
      this._dialogRef = this.dialog.open(DbNgxActionUIRouterTransitionSafetyDialogComponent, {
        viewContainerRef: this.viewContainerRef
      });
    }

    return this._dialogRef.afterClosed().pipe(
      first(),
      map((result: DbNgxActionTransitionSafetyDialogResult = DbNgxActionTransitionSafetyDialogResult.STAY) => {
        // Default to Stay if the user clicks outside.
        switch (result) {
          case DbNgxActionTransitionSafetyDialogResult.DISCARD:
          case DbNgxActionTransitionSafetyDialogResult.SUCCESS:
          case DbNgxActionTransitionSafetyDialogResult.NONE:
            return true;
          case DbNgxActionTransitionSafetyDialogResult.STAY:
            return false;
        }
      })
    );
  }

  private _closeDialog(): void {
    if (this._dialogRef) {
      this._dialogRef.close(DbNgxActionTransitionSafetyDialogResult.NONE);
    }

    this._dialogRef = undefined;
  }

}
