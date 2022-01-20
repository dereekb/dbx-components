import { Type } from "@angular/core";
import { Maybe } from "@dereekb/util";
import ms from "ms";
import { ActionContextStoreSourceInstance } from "../action.store.source";

export const DEFAULT_SNACKBAR_DIRECTIVE_DURATION = ms('4s');
export const DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION = ms('30s');

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
  type: ActionSnackbarEventType;
  value?: Maybe<O>;
  error?: Maybe<any>;
}

export interface ActionSnackBarOpenConfig {
  message: string;
  action?: string;
}

export interface ActionSnackbarPopupConfig<C = any> {
  open?: ActionSnackBarOpenConfig;
  component?: Maybe<Type<any>>;
  config?: C;
}

/**
 * Performs the action on success.
 */
export type ActionSnackbarFunction<O = any, C = any> = (event: ActionSnackbarEvent<O>) => ActionSnackbarPopupConfig<C>;

export interface DbNgxActionSnackbarGetUndoConfig extends Omit<DbNgxActionSnackbarComponentConfig, 'message' | 'action'>, Partial<Pick<DbNgxActionSnackbarComponentConfig, 'message' | 'action'>> {
  duration?: number; // Optional duration override for the popup to stay open.
}

export type ActionSnackbarGetUndoConfigFunction = () => Maybe<DbNgxActionSnackbarGetUndoConfig>;

export interface DbNgxActionSnackbarComponentConfig {
  action: string;
  message?: Maybe<string>;
  actionSource: ActionContextStoreSourceInstance;
}
