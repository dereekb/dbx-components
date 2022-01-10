import { Directive, Host, Input, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective } from '../subscription';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { ComponentType } from '@angular/cdk/portal';
import { map } from 'rxjs/operators';
import { merge } from 'rxjs';
import { ActionContextStoreSourceInstance } from './action';
import { DbNgxActionSnackbarComponent, DbNgxActionSnackbarComponentConfig } from './snackbar.component';
import ms from 'ms';

// TODO: Consider moving these configurations more configurable elsewhere...

export enum ActionSnackbarDefaultType {
  NONE = 'none',
  CREATE = 'create',
  SAVE = 'save',
  DELETE = 'delete',
  MERGE = 'merge',
  SEND = 'send',
  CANCEL = 'cancel',
  RESTORE = 'restore',
  REFRESH = 'refresh',
  MARK_READ = 'read',
  MARK_UNREAD = 'unread'
}

export enum ActionSnackbarEventType {
  WORKING,
  SUCCESS,
  REJECTED
}

export interface ActionSnackbarEvent<O = any> {
  value: O;
  error?: any;
  type: ActionSnackbarEventType;
}

const DEFAULT_SNACKBAR_DIRECTIVE_DURATION = ms('4s');
const DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION = ms('30s');

export interface ActionSnackBarOpenConfig {
  message: string;
  action?: string;
}

export interface ActionSnackbarPopupConfig<D = any> {
  open?: ActionSnackBarOpenConfig;
  component?: ComponentType<any>;
  config?: MatSnackBarConfig<D>;
}

/**
 * Performs the action on success.
 */
export type ActionSnackbarFunction<O> = (event: ActionSnackbarEvent<O>) => ActionSnackbarPopupConfig;

export interface DbNgxActionSnackbarGetUndoConfig extends Omit<DbNgxActionSnackbarComponentConfig, 'message' | 'action'>, Partial<Pick<DbNgxActionSnackbarComponentConfig, 'message' | 'action'>> {
  duration?: number; // Optional duration override for the popup to stay open.
}

export type ActionSnackbarGetUndoConfigFunction = () => DbNgxActionSnackbarGetUndoConfig | undefined;

/**
 * Directive that shows the snackbar when success is called.
 */
@Directive({
  selector: '[dbxActionSnackbar]',
})
export class DbNgxActionSnackbarDirective<T = any, O = any> implements OnInit {

  @Input('dbxActionSnackbar')
  snackbarFunction?: ActionSnackbarFunction<O>;

  @Input()
  snackbarDefault: ActionSnackbarDefaultType = ActionSnackbarDefaultType.NONE;

  @Input()
  snackbarUndo?: ActionSnackbarGetUndoConfigFunction;

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance<T, O>, private readonly snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.source.pipeStore((store) => merge(
      store.working$.pipe(map(() => ({ type: ActionSnackbarEventType.WORKING }))),
      store.success$.pipe(map((value) => ({ type: ActionSnackbarEventType.SUCCESS, value }))),
      store.rejected$.pipe(map((error) => ({ type: ActionSnackbarEventType.REJECTED, error }))),
    )).subscribe((event: ActionSnackbarEvent) => {
      const popupConfig = (this.snackbarFunction) ? this.snackbarFunction(event) : this._defaultSnackbarFunction(event);

      // Show snackbar top.
      popupConfig.config = {
        ...popupConfig.config,
        verticalPosition: popupConfig.config.verticalPosition ?? 'top'
      };

      if (popupConfig) {
        if (popupConfig.component) {
          this.snackBar.openFromComponent(popupConfig.component, popupConfig.config);
        } else if (popupConfig.open) {
          const { message, action } = popupConfig.open;
          this.snackBar.open(message, action, popupConfig.config);
        }
      }
    });
  }

  private _defaultSnackbarFunction(event: ActionSnackbarEvent): ActionSnackbarPopupConfig | undefined {
    let config: ActionSnackbarPopupConfig;
    let open: ActionSnackBarOpenConfig;
    let component: ComponentType<any>;
    let data: any;
    let duration: number;

    const trySetupUndo = (): void => {
      if (this.snackbarUndo) {
        const undoConfig = this.snackbarUndo();

        if (undoConfig) {
          if (!undoConfig.actionSource) {
            console.error('Action source was not provided to undo...');
          }

          component = DbNgxActionSnackbarComponent;
          data = {
            ...open,
            action: 'Undo',
            ...undoConfig
          };
          duration = data.duration ?? DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION;
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
