import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { DbxFilterMapSourceConnectorDirective } from './filter.map.connector.directive';
import { DbxFilterMapSourceDirective } from './filter.map.source.directive';
import { DbxFilterMapDirective } from './filter.map.directive';
import { DbxCoreFilterModule } from './filter.module';

describe('dbxFilterMapDirective', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DbxCoreFilterModule],
      declarations: [TestDbxFilterMapDirectiveComponent]
    }).compileComponents();
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
  });

  it('should be created', () => {
    expect(testComponent.filterMap).toBeDefined();
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
  `
})
class TestDbxFilterMapDirectiveComponent {
  @ViewChild(DbxFilterMapDirective, { static: true })
  filterMap!: DbxFilterMapDirective<TestFilter>;

  @ViewChild(DbxFilterMapSourceConnectorDirective, { static: true })
  filterMapSourceConnector!: DbxFilterMapDirective<TestFilter>;

  @ViewChild(DbxFilterMapSourceDirective, { static: true })
  filterMapSourcer!: DbxFilterMapDirective<TestFilter>;
}
