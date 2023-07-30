import { E164PhoneNumber, E164PhoneNumberWithExtension } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { IsE164PhoneNumber, IsE164PhoneNumberWithOptionalExtension } from './phone';

class TestModelClassWithOptionalExtension {
  @Expose()
  @IsOptional()
  @IsE164PhoneNumberWithOptionalExtension()
  phone!: E164PhoneNumber | E164PhoneNumberWithExtension;
}

class TestModelClassWithNoExtension {
  @Expose()
  @IsOptional()
  @IsE164PhoneNumber()
  phone!: E164PhoneNumber;
}

describe('IsE164PhoneNumber', () => {
  it('should pass a valid IsE164PhoneNumber', async () => {
    const instance = new TestModelClassWithNoExtension();
    instance.phone = '+12345678910';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should not pass a valid IsE164PhoneNumberWithExtension', async () => {
    const instance = new TestModelClassWithNoExtension();
    instance.phone = '+12345678910#1234';

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });

  it('should not pass an invalid IsE164PhoneNumber', async () => {
    const instance = new TestModelClassWithNoExtension();
    instance.phone = '245678910' as any;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});

describe('IsE164PhoneNumberWithOptionalExtension', () => {
  it('should pass a valid IsE164PhoneNumber', async () => {
    const instance = new TestModelClassWithOptionalExtension();
    instance.phone = '+12345678910';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should pass a valid IsE164PhoneNumberWithExtension', async () => {
    const instance = new TestModelClassWithOptionalExtension();
    instance.phone = '+12345678910#1234';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should not pass an invalid IsE164PhoneNumber', async () => {
    const instance = new TestModelClassWithOptionalExtension();
    instance.phone = '245678910' as any;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
