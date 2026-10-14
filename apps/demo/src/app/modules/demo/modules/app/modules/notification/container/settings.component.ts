import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxRouteModelIdFromAuthUserIdDirective } from '@dereekb/dbx-core';
import { DbxFirebaseNotificationHealthCheckViewComponent, DbxFirebaseNotificationTaskBotSettingsComponent, DbxFirebaseNotificationUserDocumentStoreDirective, DbxFirebaseNotificationUserSettingsComponent } from '@dereekb/dbx-firebase';
import { DbxSectionComponent } from '@dereekb/dbx-web';
import { ProfileDocumentStore } from 'demo-components';

/**
 * The signed-in user's notification settings, the settings of their profile's bot, and the delivery health check.
 */
@Component({
  templateUrl: './settings.component.html',
  imports: [DbxRouteModelIdFromAuthUserIdDirective, DbxFirebaseNotificationUserDocumentStoreDirective, DbxSectionComponent, DbxFirebaseNotificationUserSettingsComponent, DbxFirebaseNotificationTaskBotSettingsComponent, DbxFirebaseNotificationHealthCheckViewComponent]
})
export class DemoNotificationSettingsPageComponent {
  // the layout provides the signed-in user's ProfileDocumentStore; their profile's bot is the one they own
  readonly profileDocumentStore = inject(ProfileDocumentStore);
  readonly profileKeySignal = toSignal(this.profileDocumentStore.key$);
}
