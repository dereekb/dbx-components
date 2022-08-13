import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FORM_TEST_PROVIDERS } from '../../test/test.formly';
import { DbxTestDbxFormComponent } from '../../test/test.formly.component';

describe('DbxInputFormControlComponent', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [...FORM_TEST_PROVIDERS],
      declarations: [DbxTestDbxFormComponent]
    }).compileComponents();
  });

  let testComponent: DbxTestDbxFormComponent;
  let fixture: ComponentFixture<DbxTestDbxFormComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(DbxTestDbxFormComponent) as ComponentFixture<DbxTestDbxFormComponent>;
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(testComponent).toBeDefined();
  });

  // TODO: Test disabled
});
