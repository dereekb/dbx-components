import { DownloadTextContent, DbxContentContainerDirective, DbxDownloadTextViewComponent, DbxDownloadBlobButtonConfig, DbxDownloadBlobButtonComponent } from '@dereekb/dbx-web';
import { Component } from '@angular/core';
import { randomNumberFactory, randomPhoneNumberFactory, range, waitForMs } from '@dereekb/util';
import { Observable, delay, map, of } from 'rxjs';
import { loadingStateFromObs } from '@dereekb/rxjs';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
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
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxDownloadTextViewComponent, DbxDownloadBlobButtonComponent, AsyncPipe]
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

  readonly blobDownloadConfig: DbxDownloadBlobButtonConfig = {
    loadBlob: () => new Blob([createRandomCsvFile()], { type: 'application/csv' }),
    fileName: 'abc.csv',
    buttonDisplay: {
      icon: 'cloud_download',
      text: 'Download CSV'
    },
    buttonStyle: {
      type: 'flat',
      color: 'primary'
    }
  };

  readonly blobDownloadDelayedConfig: DbxDownloadBlobButtonConfig = {
    loadBlob: () => waitForMs(4000).then(() => new Blob([createRandomCsvFile()], { type: 'application/csv' })),
    fileName: 'abc.csv',
    buttonDisplay: {
      icon: 'cloud_download',
      text: 'Download CSV (Delayed)'
    },
    buttonStyle: {
      type: 'raised',
      color: 'accent'
    }
  };
}
