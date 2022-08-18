import { latLngString } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { mapboxLatLngField } from '@dereekb/dbx-form/mapbox';

@Component({
  templateUrl: './mapbox.component.html'
})
export class DocExtensionMapboxComponent {
  readonly defaultLatLngFieldValue = {
    latLng: latLngString(30.5989668, -96.3831949),
    latLngDisabled: latLngString(30.5989668, -96.3831949)
  };

  readonly mapboxLatLngField: FormlyFieldConfig[] = [
    mapboxLatLngField({
      key: 'latLng',
      description: 'This is a coordinate picker.'
    }),
    mapboxLatLngField({
      key: 'latLngDisabled',
      description: 'This is a read only coordinate picker.',
      readonly: true
    })
  ];
}
