import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type DbxFirebaseNotificationBoxSettingsMode, type DbxFirebaseNotificationUserSettingsNotificationBoxConfig } from '../service/notification.settings';

/**
 * A NotificationBox context provided to the views inside it, such as by `dbx-firebase-notification-box-context-toggle`. While the context
 * is on, those views target the box; while it is off, they target the user's global settings for the same template types.
 *
 * Whether the context is on only matters in `perBox` mode (see {@link DbxFirebaseNotificationBoxSettingsMode}). In `global` mode, the views
 * always edit the global settings for the box's template types.
 */
export abstract class DbxFirebaseNotificationBoxContext {
  /**
   * The box the context is about. Stays set while the context is off, so views keep showing the box's template types.
   */
  abstract readonly notificationBox$: Observable<Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>>;
  /**
   * Whether the context is on, meaning views edit the box's settings instead of the global settings.
   */
  abstract readonly enabled$: Observable<boolean>;
  /**
   * Called by a view inside the context with whether it has pending changes. The context's toggle is locked while any are pending.
   *
   * @param locked - Whether the view has pending changes.
   */
  abstract setLocked(locked: boolean): void;
}
