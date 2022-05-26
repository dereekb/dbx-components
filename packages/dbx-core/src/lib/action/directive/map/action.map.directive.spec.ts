import { DbxActionFromMapDirective } from './action.map.key.directive';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild, Input } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbxCoreActionModule } from '../../action.module';
import { DbxActionDirective } from '../context/action.directive';
import { DbxActionContextMapDirective } from './action.map.directive';
import { DbxActionMapSourceDirective } from './action.map.source.directive';

describe('DbxActionContextMapDirective', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DbxCoreActionModule, NoopAnimationsModule],
      declarations: [TestDbxActionContextMapDirectiveComponent]
    }).compileComponents();
  });

  let testComponent: TestDbxActionContextMapDirectiveComponent;

  let directive: DbxActionContextMapDirective;
  let dbxActionFromMap: DbxActionFromMapDirective;
  let dbxActionMapSource: DbxActionMapSourceDirective;
  let aActionComponent: DbxActionDirective<number, number>;
  let bActionComponent: DbxActionDirective<number, number>;

  let fixture: ComponentFixture<TestDbxActionContextMapDirectiveComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxActionContextMapDirectiveComponent);
    testComponent = fixture.componentInstance;

    directive = testComponent.map!;
    aActionComponent = testComponent.aAction!;
    bActionComponent = testComponent.bAction!;
    dbxActionMapSource = testComponent.dbxActionMapSource!;
    dbxActionFromMap = testComponent.dbxActionFromMap!;

    expect(aActionComponent).toBeDefined();
    expect(directive).toBeDefined();

    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('DbxActionMapSourceDirective', () => {
    it('should be defined.', () => {
      expect(dbxActionMapSource).toBeDefined();
    });

    describe('actionB', () => {
      it('should have the input source equal to the directive.', () => {
        expect(dbxActionFromMap).toBeDefined();
        expect(bActionComponent.inputSource).toBeDefined();
        expect(bActionComponent.inputSource).toBe(dbxActionFromMap);
      });
    });
  });

  describe('DbxActionFromMapDirective', () => {
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
class TestDbxActionContextMapDirectiveComponent {
  @Input()
  key = 'test';

  @ViewChild(DbxActionContextMapDirective, { static: true })
  map?: DbxActionContextMapDirective;

  @ViewChild(DbxActionMapSourceDirective, { static: true })
  dbxActionMapSource?: DbxActionMapSourceDirective;

  @ViewChild(DbxActionFromMapDirective, { static: true })
  dbxActionFromMap?: DbxActionFromMapDirective;

  @ViewChild('a', { static: true, read: DbxActionDirective })
  aAction?: DbxActionDirective<number, number>;

  @ViewChild('b', { static: true, read: DbxActionDirective })
  bAction?: DbxActionDirective<number, number>;
}
