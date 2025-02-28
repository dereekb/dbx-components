import { type Maybe } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested, validate } from 'class-validator';
import { IsUniqueKeyed } from './unique';

class TestModelClass {
  @Expose()
  @IsArray()
  @IsUniqueKeyed((x: EmbeddedTestModelClass) => x.key)
  @ValidateNested({ each: true })
  models!: EmbeddedTestModelClass[];
}

class EmbeddedTestModelClass {
  @Expose()
  @IsOptional()
  @IsString()
  key?: Maybe<string>;

  constructor(key?: Maybe<string>) {
    this.key = key;
  }
}

describe('IsUniqueKeyed', () => {
  it('should pass if the keys of the embedded models are unique', async () => {
    const instance = new TestModelClass();
    instance.models = [new EmbeddedTestModelClass('a'), new EmbeddedTestModelClass('b'), new EmbeddedTestModelClass('c')];

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should pass if the keys of the embedded models are unique and some are undefined', async () => {
    const instance = new TestModelClass();
    instance.models = [new EmbeddedTestModelClass('a'), new EmbeddedTestModelClass('b'), new EmbeddedTestModelClass()];

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should not pass if the keys of one or more of the embedded models are not unique', async () => {
    const instance = new TestModelClass();
    instance.models = [new EmbeddedTestModelClass('a'), new EmbeddedTestModelClass('a'), new EmbeddedTestModelClass('c')];

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
