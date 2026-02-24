import { DbxActionFromMapDirective } from './action.map.key.directive';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, viewChild, model } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbxCoreActionModule } from '../../action.module';
import { DbxActionDirective } from '../context/action.directive';
import { DbxActionContextMapDirective } from './action.map.directive';
import { DbxActionMapSourceDirective } from './action.map.source.directive';
import { callbackTest } from '@dereekb/util/test';

describe('DbxActionContextMapDirective', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule]
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

    directive = testComponent.map();
    aActionComponent = testComponent.aAction();
    bActionComponent = testComponent.bAction();
    dbxActionMapSource = testComponent.dbxActionMapSource();
    dbxActionFromMap = testComponent.dbxActionFromMap();

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

    it(
      'should provide a source from the map.',
      callbackTest((done) => {
        dbxActionFromMap.store$.subscribe((store) => {
          expect(store).toBeDefined();
          done();
        });
      })
    );
  });
});

@Component({
  template: `
    <ng-container dbxActionContextMap>
      <dbx-action #a [dbxActionMapSource]="key()">
        <p>Content</p>
      </dbx-action>
      <dbx-action #b [dbxActionFromMap]="key()">
        <p>Content</p>
      </dbx-action>
    </ng-container>
  `,
  standalone: true,
  imports: [DbxActionDirective, DbxActionContextMapDirective, DbxActionMapSourceDirective, DbxActionFromMapDirective]
})
class TestDbxActionContextMapDirectiveComponent {
  readonly key = model<string>('test');
  readonly map = viewChild.required(DbxActionContextMapDirective);
  readonly dbxActionMapSource = viewChild.required(DbxActionMapSourceDirective);
  readonly dbxActionFromMap = viewChild.required(DbxActionFromMapDirective);
  readonly aAction = viewChild.required<DbxActionDirective<number, number>>('a', { read: DbxActionDirective });
  readonly bAction = viewChild.required<DbxActionDirective<number, number>>('b', { read: DbxActionDirective });
}
