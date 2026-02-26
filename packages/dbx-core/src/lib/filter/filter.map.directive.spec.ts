import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { DbxFilterMapSourceConnectorDirective } from './filter.map.connector.directive';
import { DbxFilterMapSourceDirective } from './filter.map.source.directive';
import { DbxFilterMapDirective } from './filter.map.directive';

describe('dbxFilterMapDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  let testComponent: TestDbxFilterMapDirectiveComponent;
  let fixture: ComponentFixture<TestDbxFilterMapDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxFilterMapDirectiveComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(testComponent.filterMap()).toBeDefined();
  });
});

export interface TestFilter {
  test?: boolean;
}

@Component({
  template: `
    <ng-container #map dbxFilterMap>
      <ng-container #connector dbxFilterMapSourceConnector="a"></ng-container>
      <ng-container #source dbxFilterMapSource="a"></ng-container>
    </ng-container>
  `,
  standalone: true,
  imports: [DbxFilterMapDirective, DbxFilterMapSourceConnectorDirective, DbxFilterMapSourceDirective]
})
class TestDbxFilterMapDirectiveComponent {
  readonly filterMap = viewChild.required<DbxFilterMapDirective<TestFilter>>(DbxFilterMapDirective);
  readonly filterMapSourceConnector = viewChild.required<DbxFilterMapSourceConnectorDirective<TestFilter>>(DbxFilterMapSourceConnectorDirective);
  readonly filterMapSourcer = viewChild.required<DbxFilterMapSourceDirective<TestFilter>>(DbxFilterMapSourceDirective);
}
