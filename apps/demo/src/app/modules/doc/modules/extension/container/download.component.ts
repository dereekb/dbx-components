import { DownloadTextContent } from '@dereekb/dbx-web';
import { Component } from '@angular/core';
import { randomNumberFactory, randomPhoneNumberFactory, range } from '@dereekb/util';
import { Observable, delay, map, of } from 'rxjs';
import { loadingStateFromObs } from '@dereekb/rxjs';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxDownloadTextViewComponent } from '@dereekb/dbx-web';
import { AsyncPipe } from '@angular/common';

function createRandomData() {
  const randomNumber = randomNumberFactory({ min: 100000, max: 10000000 - 1, round: 'round' });
  const randomPhoneFactory = randomPhoneNumberFactory();

  const items = range(0, 1000).map((id) => {
    return {
      id,
      firstname: randomNumber(),
      lastname: randomNumber(),
      number: randomNumber(),
      phone: randomPhoneFactory()
    };
  });

  return items;
}

function createRandomCsvFile() {
  const headers = 'id,firstname,lastname,phone,value';
  const randomItems = createRandomData();

  const items = randomItems.map((x) => {
    return `${x.id},${x.firstname},${x.lastname},${x.phone},${x.number}`;
  });

  return [headers, ...items].join('\n');
}

@Component({
  templateUrl: './download.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxDownloadTextViewComponent, AsyncPipe]
})
export class DocExtensionDownloadComponent {
  readonly csvContent: DownloadTextContent = {
    content: createRandomCsvFile(),
    name: 'abc.csv',
    mimeType: 'application/csv'
  };

  readonly jsonContent$: Observable<DownloadTextContent> = of(createRandomData()).pipe(
    delay(3000),
    map((x) => {
      const content = JSON.stringify(x, undefined, 3);
      return {
        content,
        name: 'xyz.json',
        mimeType: 'application/json'
      };
    })
  );

  readonly jsonContentState$ = loadingStateFromObs(this.jsonContent$);
}
