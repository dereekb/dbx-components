import { Component } from '@angular/core';
import { DbxRouteModelIdFromAuthUserIdDirective } from '@dereekb/dbx-core';
import { DbxFirebaseNotificationHealthCheckViewComponent, DbxFirebaseNotificationUserDocumentStoreDirective, DbxFirebaseNotificationUserSettingsComponent } from '@dereekb/dbx-firebase';
import { DbxSectionComponent } from '@dereekb/dbx-web';

/**
 * The signed-in user's notification settings, and the delivery health check.
 */
@Component({
  templateUrl: './settings.component.html',
  imports: [DbxRouteModelIdFromAuthUserIdDirective, DbxFirebaseNotificationUserDocumentStoreDirective, DbxSectionComponent, DbxFirebaseNotificationUserSettingsComponent, DbxFirebaseNotificationHealthCheckViewComponent]
})
export class DemoNotificationSettingsPageComponent {}
