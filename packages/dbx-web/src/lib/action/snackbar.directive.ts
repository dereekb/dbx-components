import { DbxActionSnackbarComponent } from './action.snackbar.component';
import { Directive, Host, Input, OnInit, Type } from '@angular/core';
import { map } from 'rxjs/operators';
import { merge } from 'rxjs';
import { AbstractSubscriptionDirective, ActionContextStoreSourceInstance, ActionSnackbarFunction, ActionSnackbarDefaultType, ActionSnackbarGetUndoConfigFunction, ActionSnackbarEventType, ActionSnackbarEvent, ActionSnackbarPopupConfig, ActionSnackBarOpenConfig, DbxActionSnackbarComponentConfig } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import ms from 'ms';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

// TODO: Consider moving these configurations more configurable elsewhere...

const DEFAULT_SNACKBAR_DIRECTIVE_DURATION = ms('4s');
const DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION = ms('30s');

/**
 * Abstract directive that shows a snackbar when success is called.
 */
@Directive()
export class DbxActionSnackbarDirective<T = any, O = any> extends AbstractSubscriptionDirective implements OnInit {

  @Input('dbxActionSnackbar')
  snackbarFunction?: ActionSnackbarFunction<O, MatSnackBarConfig>;

  @Input()
  snackbarDefault: ActionSnackbarDefaultType = ActionSnackbarDefaultType.NONE;

  @Input()
  snackbarUndo?: ActionSnackbarGetUndoConfigFunction;

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance<T, O>, readonly snackBar: MatSnackBar) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.pipeStore((store) => merge(
      store.working$.pipe(map(() => ({ type: ActionSnackbarEventType.WORKING }))),
      store.success$.pipe(map((value) => ({ type: ActionSnackbarEventType.SUCCESS, value }))),
      store.rejected$.pipe(map((error) => ({ type: ActionSnackbarEventType.REJECTED, error }))),
    )).subscribe((event: ActionSnackbarEvent) => {
      const popupConfig = (this.snackbarFunction) ? this.snackbarFunction(event) : this._defaultSnackbarFunction(event);

      if (popupConfig) {

        // Set default position.
        popupConfig.config = {
          ...popupConfig.config,
          verticalPosition: popupConfig.config?.verticalPosition ?? 'top'
        };

        if (popupConfig.component) {
          this.snackBar.openFromComponent(popupConfig.component, popupConfig.config);
        } else if (popupConfig.open) {
          const { message, action } = popupConfig.open;
          this.snackBar.open(message, action, popupConfig.config);
        }
      }
    });
  }

  private _defaultSnackbarFunction(event: ActionSnackbarEvent): Maybe<ActionSnackbarPopupConfig<MatSnackBarConfig>> {
    let config: Maybe<ActionSnackbarPopupConfig<MatSnackBarConfig>>;
    let open: Maybe<ActionSnackBarOpenConfig>;
    let component: Maybe<Type<any>>;
    let duration: Maybe<number>;
    let data: Maybe<DbxActionSnackbarComponentConfig>;

    const trySetupUndo = (): void => {
      if (this.snackbarUndo) {
        const undoConfig = this.snackbarUndo();

        if (undoConfig) {
          if (!undoConfig.actionSource) {
            console.error('Action source was not provided to undo...');
          }

          component = DbxActionSnackbarComponent;
          data = {
            ...open,
            action: 'Undo',
            ...undoConfig
          };

          duration = undoConfig?.duration ?? DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION;
        }
      }
    };

    const panelClass = (event.type === ActionSnackbarEventType.REJECTED) ? 'dbx-action-snackbar-failure' : undefined;

    switch (this.snackbarDefault) {
      case ActionSnackbarDefaultType.CREATE:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Creating...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Created'
            };
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Create Failed'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.SAVE:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Saving...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Saved'
            };
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Save Failed'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.MERGE:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Merging...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Merged'
            };
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Merge Failed'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.SEND:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Sending...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Sent'
            };
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Sending Failed'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.DELETE:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Deleting...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Deleted'
            };
            trySetupUndo();
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Delete Failed'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.CANCEL:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Cancelling...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Canceled'
            };
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Cancel Failed'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.RESTORE:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Restoring...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Restored'
            };
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Restore Failed'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.REFRESH:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Refreshing...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Refreshed'
            };
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Refresh Failed'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.MARK_READ:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Marking as Read...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Marked Read'
            };
            trySetupUndo();
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Failed Marking as Read'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.MARK_UNREAD:
        switch (event.type) {
          case ActionSnackbarEventType.WORKING:
            open = {
              message: 'Marking as Unread...'
            };
            break;
          case ActionSnackbarEventType.SUCCESS:
            open = {
              action: 'Ok',
              message: 'Marked Unread'
            };
            break;
          case ActionSnackbarEventType.REJECTED:
            open = {
              action: 'X',
              message: 'Failed Marking as Unread'
            };
            break;
        }
        break;
      case ActionSnackbarDefaultType.NONE:
      default:
        console.warn('[dbxActionSnackbar] neither the function nor snackbarDefault was specified!');
        break;
    }

    // If open is set/provided, show content.
    if (open) {
      config = {
        config: {
          duration: duration ?? DEFAULT_SNACKBAR_DIRECTIVE_DURATION,
          panelClass,
          data
        },
        open,
        component
      };
    }

    return config;
  }

}

export interface DbxActionSnackbarDirectiveSnackbarPopupData {
  duration?: Maybe<number>;
  data?: Maybe<DbxActionSnackbarComponentConfig>;
  component?: Maybe<Type<any>>;
}
