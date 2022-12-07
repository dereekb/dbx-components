import { Expose } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { IsFirestoreModelId, IsFirestoreModelKey } from './model.validator';

class TestModelClass {
  @Expose()
  @IsOptional()
  @IsFirestoreModelId()
  id!: string;

  @Expose()
  @IsOptional()
  @IsFirestoreModelKey()
  key!: string;
}

describe('IsFirestoreModelKey', () => {
  it('should pass valid keys', async () => {
    const instance = new TestModelClass();
    instance.key = 'valid/key';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid keys', async () => {
    const instance = new TestModelClass();
    instance.key = 'invalid';

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});

describe('IsFirestoreModelId', () => {
  it('should pass valid ids', async () => {
    const instance = new TestModelClass();
    instance.id = 'validid';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid ids', async () => {
    const instance = new TestModelClass();
    instance.id = 'invalid/id';

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
