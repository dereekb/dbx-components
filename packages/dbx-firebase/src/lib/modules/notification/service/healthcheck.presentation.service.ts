import { Injectable, inject } from '@angular/core';
import { type ArrayOrValue, type Maybe, asArray } from '@dereekb/util';
import { type DbxThemeColor } from '@dereekb/dbx-web';
import { type NotificationDeliveryMethod, type NotificationHealthCheckIssue, type NotificationHealthCheckIssueCode, NotificationHealthCheckStatus } from '@dereekb/firebase';
import {
  type DbxFirebaseNotificationHealthCheckIssuePresentation,
  type DbxFirebaseNotificationHealthCheckPresentationEntry,
  DEFAULT_NOTIFICATION_HEALTH_CHECK_PRESENTATION_ENTRIES,
  DbxFirebaseNotificationHealthCheckPresentationServiceConfig,
  NOTIFICATION_DELIVERY_METHOD_ICONS,
  NOTIFICATION_DELIVERY_METHOD_LABELS,
  NOTIFICATION_DELIVERY_METHOD_TEST_MESSAGE_LABELS,
  NOTIFICATION_DELIVERY_METHOD_TEST_MESSAGE_NOUNS,
  NOTIFICATION_HEALTH_CHECK_STATUS_COLORS,
  NOTIFICATION_HEALTH_CHECK_STATUS_ICONS,
  NOTIFICATION_HEALTH_CHECK_STATUS_LABELS,
  notificationHealthCheckProbeIssueLabel
} from './healthcheck.presentation';

/**
 * Registry of presentation metadata for notification health check findings.
 *
 * Health check issue codes are open-ended, so this maps a code to a label and an icon. An
 * unregistered code is not an error — it falls back to a presentation derived from the issue's
 * status, and the issue's own `m`/`f` strings carry the meaning either way.
 *
 * Apps extend the table by supplying a {@link DbxFirebaseNotificationHealthCheckPresentationServiceConfig}
 * through `provideDbxFirebaseNotifications({ healthCheckPresentation })`.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseNotificationHealthCheckPresentationService {
  private readonly _config = inject(DbxFirebaseNotificationHealthCheckPresentationServiceConfig, { optional: true });
  private readonly _entries = new Map<NotificationHealthCheckIssueCode, DbxFirebaseNotificationHealthCheckPresentationEntry>();

  constructor() {
    if (this._config?.registerDefaultEntries !== false) {
      this.register(DEFAULT_NOTIFICATION_HEALTH_CHECK_PRESENTATION_ENTRIES);
    }

    if (this._config?.entries) {
      this.register(this._config.entries);
    }
  }

  /**
   * Registers presentation entries, overriding any already registered for the same code by default.
   *
   * @param entries - The entries to register.
   * @param override - Whether to replace an existing entry for the same code. Defaults to true.
   */
  register(entries: ArrayOrValue<DbxFirebaseNotificationHealthCheckPresentationEntry>, override: boolean = true): void {
    asArray(entries).forEach((entry) => {
      if (override || !this._entries.has(entry.code)) {
        this._entries.set(entry.code, entry);
      }
    });
  }

  /**
   * The entry registered for an issue code, if any.
   *
   * @param code - The issue code to look up.
   * @returns The registered entry, or undefined when the code has none.
   */
  entryForCode(code: NotificationHealthCheckIssueCode): Maybe<DbxFirebaseNotificationHealthCheckPresentationEntry> {
    return this._entries.get(code);
  }

  /**
   * Resolves how to present a single finding.
   *
   * Pass the delivery method whose section the finding is rendered in to get a probe label that names
   * it — `Test Email Sent` rather than `Test Sent`. Every provider emits the same probe codes, so that
   * is the one label a registry entry cannot supply on its own.
   *
   * @param issue - The finding to present.
   * @param method - The delivery method the finding belongs to, when it belongs to one.
   * @returns The label, icon, and colour to render it with.
   */
  presentationForIssue(issue: NotificationHealthCheckIssue, method?: Maybe<NotificationDeliveryMethod>): DbxFirebaseNotificationHealthCheckIssuePresentation {
    const entry = this._entries.get(issue.c);
    const probeLabel = method == null ? undefined : notificationHealthCheckProbeIssueLabel(issue.c, method);

    return {
      label: probeLabel ?? entry?.label ?? this.labelForStatus(issue.s),
      icon: entry?.icon ?? this.iconForStatus(issue.s),
      color: entry?.color ?? this.colorForStatus(issue.s)
    };
  }

  /**
   * @param status - The status to colour.
   * @returns The theme colour for the status.
   */
  colorForStatus(status: NotificationHealthCheckStatus): DbxThemeColor {
    return NOTIFICATION_HEALTH_CHECK_STATUS_COLORS[status] ?? NOTIFICATION_HEALTH_CHECK_STATUS_COLORS[NotificationHealthCheckStatus.UNKNOWN];
  }

  /**
   * @param status - The status to find an icon for.
   * @returns The icon for the status.
   */
  iconForStatus(status: NotificationHealthCheckStatus): string {
    return NOTIFICATION_HEALTH_CHECK_STATUS_ICONS[status] ?? NOTIFICATION_HEALTH_CHECK_STATUS_ICONS[NotificationHealthCheckStatus.UNKNOWN];
  }

  /**
   * @param status - The status to label.
   * @returns The human-readable label for the status.
   */
  labelForStatus(status: NotificationHealthCheckStatus): string {
    return NOTIFICATION_HEALTH_CHECK_STATUS_LABELS[status] ?? NOTIFICATION_HEALTH_CHECK_STATUS_LABELS[NotificationHealthCheckStatus.UNKNOWN];
  }

  /**
   * @param method - The delivery method to label.
   * @returns The human-readable label for the delivery method.
   */
  labelForDeliveryMethod(method: NotificationDeliveryMethod): string {
    return NOTIFICATION_DELIVERY_METHOD_LABELS[method] ?? 'Notification';
  }

  /**
   * @param method - The delivery method to find an icon for.
   * @returns The icon for the delivery method.
   */
  iconForDeliveryMethod(method: NotificationDeliveryMethod): string {
    return NOTIFICATION_DELIVERY_METHOD_ICONS[method] ?? 'notifications';
  }

  /**
   * @param method - The delivery method whose test message action is being labelled.
   * @returns The label for the method's "send a test message" action, naming what it sends.
   */
  testMessageLabelForDeliveryMethod(method: NotificationDeliveryMethod): string {
    return NOTIFICATION_DELIVERY_METHOD_TEST_MESSAGE_LABELS[method] ?? 'Send Test Message';
  }

  /**
   * @param method - The delivery method whose test message is being described.
   * @returns The lowercase noun for the method's test message, for use mid-sentence.
   */
  testMessageNounForDeliveryMethod(method: NotificationDeliveryMethod): string {
    return NOTIFICATION_DELIVERY_METHOD_TEST_MESSAGE_NOUNS[method] ?? 'test message';
  }
}
