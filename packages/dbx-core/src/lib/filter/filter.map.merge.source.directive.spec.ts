import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { callbackTest } from '@dereekb/util/test';
import { filter, first, of, Subject } from 'rxjs';
import { DbxFilterMapDirective } from './filter.map.directive';
import { DbxFilterMapMergeSourceDirective } from './filter.map.merge.source.directive';

interface TestMergeFilter {
  name?: string;
  minPrice?: number;
  preset?: string;
}

describe('DbxFilterMapMergeSourceDirective', () => {
  let testComponent: TestDbxFilterMapMergeSourceDirectiveComponent;
  let fixture: ComponentFixture<TestDbxFilterMapMergeSourceDirectiveComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(TestDbxFilterMapMergeSourceDirectiveComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it(
    'should merge the filters of each key.',
    callbackTest((done) => {
      const filterMap = testComponent.filterMap().filterMap;
      filterMap.addDefaultFilterObs('a', of({ name: 'a', preset: 'a' }));
      filterMap.addDefaultFilterObs('b', of({ minPrice: 100 }));

      testComponent
        .mergeSource()
        .filter$.pipe(first())
        .subscribe((x) => {
          expect(x).toEqual({ name: 'a', minPrice: 100 });
          done();
        });
    })
  );

  it(
    'should keep the fields of the other keys when one key changes.',
    callbackTest((done) => {
      const filterMap = testComponent.filterMap().filterMap;
      const writes = new Subject<TestMergeFilter>();

      filterMap.addDefaultFilterObs('a', of({ name: 'a' }));
      filterMap.addDefaultFilterObs('b', of({}));

      testComponent
        .mergeSource()
        .filter$.pipe(
          filter((x) => x.minPrice != null),
          first()
        )
        .subscribe((x) => {
          expect(x).toEqual({ name: 'a', minPrice: 200 });
          done();
        });

      filterMap.addFilterObs('b', writes);
      writes.next({ minPrice: 200 });
    })
  );
});

@Component({
  template: `
    <ng-container dbxFilterMap>
      <ng-container [dbxFilterMapMergeSource]="keys"></ng-container>
    </ng-container>
  `,
  imports: [DbxFilterMapDirective, DbxFilterMapMergeSourceDirective]
})
class TestDbxFilterMapMergeSourceDirectiveComponent {
  readonly keys = ['a', 'b'];
  readonly filterMap = viewChild.required<DbxFilterMapDirective<TestMergeFilter>>(DbxFilterMapDirective);
  readonly mergeSource = viewChild.required<DbxFilterMapMergeSourceDirective<TestMergeFilter>>(DbxFilterMapMergeSourceDirective);
}
