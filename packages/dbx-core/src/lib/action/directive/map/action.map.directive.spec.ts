import { DbNgxActionFromMapDirective } from './action.map.key.directive';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild, Input } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbNgxCoreActionModule } from '../../action.module';
import { DbNgxActionComponent } from '../context/action.component';
import { DbNgxActionContextMapDirective } from './action.map.directive';
import { DbNgxActionMapSourceDirective } from './action.map.source.directive';

describe('DbNgxActionContextMapDirective', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        DbNgxCoreActionModule,
        NoopAnimationsModule
      ],
      declarations: [
        TestDbNgxActionContextMapDirectiveComponent
      ]
    }).compileComponents();
  });

  let testComponent: TestDbNgxActionContextMapDirectiveComponent;

  let directive: DbNgxActionContextMapDirective;
  let dbxActionFromMap: DbNgxActionFromMapDirective;
  let dbxActionMapSource: DbNgxActionMapSourceDirective;
  let aActionComponent: DbNgxActionComponent<number, number>;
  let bActionComponent: DbNgxActionComponent<number, number>;

  let fixture: ComponentFixture<TestDbNgxActionContextMapDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbNgxActionContextMapDirectiveComponent);
    testComponent = fixture.componentInstance;

    directive = testComponent.map!;
    aActionComponent = testComponent.aAction!;
    bActionComponent = testComponent.bAction!;
    dbxActionMapSource = testComponent.dbxActionMapSource!;
    dbxActionFromMap = testComponent.dbxActionFromMap!;

    fixture.detectChanges();
  });

  describe('DbNgxActionMapSourceDirective', () => {

    it('should be defined.', () => {
      expect(dbxActionMapSource).toBeDefined();
    });

    describe('actionB', () => {

      it('should have the input source equal to the directive.', () => {
        expect(bActionComponent.inputSource).toBeDefined();
        expect(bActionComponent.inputSource).toBe(dbxActionFromMap);
      });

    });

  });

  describe('DbNgxActionFromMapDirective', () => {

    it('should have a key', () => {
      expect(dbxActionFromMap.key).toBeDefined();
    });

    it('should provide a source from the map.', (done) => {
      dbxActionFromMap.store$.subscribe((store) => {
        expect(store).toBeDefined();
        done();
      });
    });

  });

});

@Component({
  template: `
    <ng-container dbxActionContextMap>
      <dbx-action #a [dbxActionMapSource]="key">
        <p>Content</p>
      </dbx-action>
      <dbx-action #b [dbxActionFromMap]="key">
        <p>Content</p>
      </dbx-action>
    </ng-container>
  `
})
class TestDbNgxActionContextMapDirectiveComponent {

  @Input()
  key = 'test';

  @ViewChild(DbNgxActionContextMapDirective, { static: true })
  map?: DbNgxActionContextMapDirective;

  @ViewChild(DbNgxActionMapSourceDirective, { static: true })
  dbxActionMapSource?: DbNgxActionMapSourceDirective;

  @ViewChild(DbNgxActionFromMapDirective, { static: true })
  dbxActionFromMap?: DbNgxActionFromMapDirective;

  @ViewChild('a', { static: true })
  aAction?: DbNgxActionComponent<number, number>;

  @ViewChild('b', { static: true })
  bAction?: DbNgxActionComponent<number, number>;

}
