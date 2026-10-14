import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { type FirestoreModelKey, MODEL_NOT_AVAILABLE_ERROR_CODE, NotificationFunctions, type NotificationTaskBotOptOutsResult, type NotificationTaskBotOwnerOptOutGroup, type NotificationTaskBotScriptGroupKey, notificationTaskBotKeyForModel, type UpdateNotificationTaskBotOptOutParams } from '@dereekb/firebase';
import { errorResult, isLoadingStateFinishedLoading, isLoadingStateWithError, type LoadingState, startWithBeginLoading, successResult } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { catchError, distinctUntilChanged, EMPTY, first, from, map, type Observable, of, shareReplay, switchMap, tap } from 'rxjs';

/**
 * Page state of {@link DbxFirebaseNotificationTaskBotSettingsStore}.
 *
 * - `loading`: the groups are loading.
 * - `missing`: the model has no bot, so there is nothing to opt out of.
 * - `error`: the groups failed to load.
 * - `ready`: the groups are loaded.
 */
export type DbxFirebaseNotificationTaskBotSettingsPageState = 'loading' | 'missing' | 'error' | 'ready';

/**
 * A row of the bot settings: a group the owner can opt out of, with its pending edit merged in.
 */
export interface DbxFirebaseNotificationTaskBotSettingsRow {
  readonly group: NotificationTaskBotOwnerOptOutGroup;
  /**
   * Whether the group is opted out, with the pending edit applied.
   */
  readonly optedOut: boolean;
  /**
   * Whether the row has a pending edit that differs from the saved state.
   */
  readonly modified: boolean;
}

/**
 * Pending opt-out edits keyed by group key. True means opted out.
 */
export type DbxFirebaseNotificationTaskBotSettingsEdits = Readonly<Record<NotificationTaskBotScriptGroupKey, boolean>>;

/**
 * State of {@link DbxFirebaseNotificationTaskBotSettingsStore}.
 */
export interface DbxFirebaseNotificationTaskBotSettingsStoreState {
  /**
   * Key of the model the bot is attached to.
   */
  readonly modelKey?: Maybe<FirestoreModelKey>;
  /**
   * The loading state of the groups the owner can opt out of.
   */
  readonly groupsState?: Maybe<LoadingState<NotificationTaskBotOwnerOptOutGroup[]>>;
  /**
   * Pending edits, keyed by group key.
   */
  readonly edits: DbxFirebaseNotificationTaskBotSettingsEdits;
}

/**
 * Returns true if the group is opted out in its saved state.
 *
 * @param group - The group.
 * @returns True when the group has an `optOutAt`.
 */
export function isNotificationTaskBotOwnerOptOutGroupOptedOut(group: Pick<NotificationTaskBotOwnerOptOutGroup, 'optOutAt'>): boolean {
  return group.optOutAt != null;
}

/**
 * Store behind the `dbx-firebase-notification-task-bot-settings` component: the opt-out settings the owner of a model's
 * NotificationTaskBot can change.
 *
 * Targeted by the attached model's key; the bot key is computed with `notificationTaskBotKeyForModel()`. It calls
 * `NotificationFunctions` directly rather than using a document store, since the owner can't read the bot document.
 *
 * Changes are pending until saved with {@link update}, which sends them in one `updateNotificationTaskBot.optOut()` call.
 */
@Injectable()
export class DbxFirebaseNotificationTaskBotSettingsStore extends ComponentStore<DbxFirebaseNotificationTaskBotSettingsStoreState> {
  readonly notificationFunctions = inject(NotificationFunctions);

  constructor() {
    super({ edits: {} });
  }

  readonly modelKey$ = this.select((state) => state.modelKey).pipe(distinctUntilChanged(), shareReplay(1));

  readonly botKey$: Observable<Maybe<FirestoreModelKey>> = this.modelKey$.pipe(
    map((x) => (x ? notificationTaskBotKeyForModel(x) : undefined)),
    shareReplay(1)
  );

  readonly groupsState$ = this.select((state) => state.groupsState).pipe(distinctUntilChanged(), shareReplay(1));
  readonly edits$ = this.select((state) => state.edits).pipe(distinctUntilChanged(), shareReplay(1));

  readonly pageState$: Observable<DbxFirebaseNotificationTaskBotSettingsPageState> = this.groupsState$.pipe(
    map((groupsState) => {
      let pageState: DbxFirebaseNotificationTaskBotSettingsPageState;

      if (!isLoadingStateFinishedLoading(groupsState)) {
        pageState = 'loading';
      } else if (isLoadingStateWithError(groupsState)) {
        pageState = (groupsState.error as Maybe<{ readonly code?: Maybe<string> }>)?.code === MODEL_NOT_AVAILABLE_ERROR_CODE ? 'missing' : 'error';
      } else {
        pageState = 'ready';
      }

      return pageState;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly groups$: Observable<NotificationTaskBotOwnerOptOutGroup[]> = this.groupsState$.pipe(
    map((x) => x?.value ?? []),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly rows$: Observable<DbxFirebaseNotificationTaskBotSettingsRow[]> = this.select(this.groups$, this.edits$, (groups, edits) =>
    groups.map((group) => {
      const saved = isNotificationTaskBotOwnerOptOutGroupOptedOut(group);
      const edit = edits[group.key];
      const optedOut = edit ?? saved;
      return { group, optedOut, modified: optedOut !== saved };
    })
  ).pipe(shareReplay(1));

  /**
   * The update to send, or undefined when nothing differs from the saved state.
   */
  readonly updateParams$: Observable<Maybe<UpdateNotificationTaskBotOptOutParams>> = this.select(this.botKey$, this.rows$, (key, rows) => {
    const modifiedRows = rows.filter((x) => x.modified);
    let params: Maybe<UpdateNotificationTaskBotOptOutParams>;

    if (key && modifiedRows.length > 0) {
      const optOut = modifiedRows.filter((x) => x.optedOut).map((x) => x.group.key);
      const optIn = modifiedRows.filter((x) => !x.optedOut).map((x) => x.group.key);
      params = { key, ...(optOut.length > 0 ? { optOut } : {}), ...(optIn.length > 0 ? { optIn } : {}) };
    }

    return params;
  }).pipe(shareReplay(1));

  readonly isModified$: Observable<boolean> = this.rows$.pipe(
    map((rows) => rows.some((x) => x.modified)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly disabled$: Observable<boolean> = this.pageState$.pipe(
    map((x) => x !== 'ready'),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: Effects
  /**
   * Sets the attached model's key and loads its bot's groups. Pending edits are dropped when the key changes.
   */
  readonly setModelKey = this.effect((input: Observable<Maybe<FirestoreModelKey>>) =>
    input.pipe(
      distinctUntilChanged(),
      switchMap((modelKey) => {
        this._setModelKey(modelKey);
        return modelKey ? this._loadGroups(modelKey) : EMPTY;
      })
    )
  );

  /**
   * Loads the groups again for the current model key.
   */
  readonly load = this.effect((input: Observable<void>) =>
    input.pipe(
      switchMap(() =>
        this.modelKey$.pipe(
          first(),
          switchMap((modelKey) => (modelKey ? this._loadGroups(modelKey) : EMPTY))
        )
      )
    )
  );

  /**
   * Saves the update. On success the result replaces the groups, and the edits it saved are dropped.
   *
   * @param params - The update params, usually from {@link updateParams$}.
   * @returns The loading state of the save.
   */
  update(params: UpdateNotificationTaskBotOptOutParams): Observable<LoadingState<NotificationTaskBotOptOutsResult>> {
    return from(this.notificationFunctions.notificationTaskBot.updateNotificationTaskBot.optOut(params)).pipe(
      tap((result) => this._setSavedGroups(result.groups)),
      map((result) => successResult(result)),
      catchError((error) => of(errorResult<NotificationTaskBotOptOutsResult>(error))),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  private _loadGroups(modelKey: FirestoreModelKey): Observable<LoadingState<NotificationTaskBotOwnerOptOutGroup[]>> {
    return from(this.notificationFunctions.notificationTaskBot.readNotificationTaskBot.optOuts({ key: notificationTaskBotKeyForModel(modelKey) })).pipe(
      map((result) => successResult(result.groups)),
      startWithBeginLoading(),
      catchError((error) => of(errorResult<NotificationTaskBotOwnerOptOutGroup[]>(error))), // an error here would otherwise kill the effect's subscription
      tap((groupsState) => this._setGroupsState(groupsState))
    );
  }

  // MARK: Updaters
  /**
   * Sets the pending opt-out state of a group. An edit that matches the saved state is dropped.
   */
  readonly setOptedOut = this.updater((state, input: { readonly key: NotificationTaskBotScriptGroupKey; readonly optedOut: boolean }) => {
    const group = state.groupsState?.value?.find((x) => x.key === input.key);
    const { [input.key]: _, ...otherEdits } = state.edits;
    const edits = group != null && isNotificationTaskBotOwnerOptOutGroupOptedOut(group) === input.optedOut ? otherEdits : { ...otherEdits, [input.key]: input.optedOut };
    return { ...state, edits };
  });

  /**
   * Drops every pending edit.
   */
  readonly reset = this.updater((state) => ({ ...state, edits: {} }));

  private readonly _setModelKey = this.updater((state, modelKey: Maybe<FirestoreModelKey>) => (state.modelKey === modelKey ? state : { modelKey, groupsState: undefined, edits: {} }));

  private readonly _setGroupsState = this.updater((state, groupsState: LoadingState<NotificationTaskBotOwnerOptOutGroup[]>) => ({ ...state, groupsState }));

  // drops the edits that now match the saved state; edits made while the save was in flight are kept
  private readonly _setSavedGroups = this.updater((state, groups: NotificationTaskBotOwnerOptOutGroup[]) => {
    const savedByKey = new Map(groups.map((x) => [x.key, isNotificationTaskBotOwnerOptOutGroupOptedOut(x)]));
    const edits: Record<NotificationTaskBotScriptGroupKey, boolean> = {};

    Object.entries(state.edits).forEach(([key, optedOut]) => {
      const saved = savedByKey.get(key);

      if (saved != null && saved !== optedOut) {
        edits[key] = optedOut;
      }
    });

    return { ...state, groupsState: successResult(groups), edits };
  });
}
