import { Expose } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import { TransformCommaSeparatedValueToArray, TransformCommaSeparatedStringValueToArray, TransformCommaSeparatedNumberValueToArray, TransformStringValueToBoolean } from './type.annotation';

class TestCommaSeparatedDto {
  @Expose()
  @TransformCommaSeparatedStringValueToArray()
  strings?: string[];

  @Expose()
  @TransformCommaSeparatedNumberValueToArray()
  numbers?: number[];
}

class TestCustomMapDto {
  @Expose()
  @TransformCommaSeparatedValueToArray((x) => x.toUpperCase())
  values?: string[];
}

class TestBooleanDto {
  @Expose()
  @TransformStringValueToBoolean()
  active?: boolean;
}

describe('TransformCommaSeparatedStringValueToArray', () => {
  it('should split a comma-separated string into a string array', () => {
    const result = plainToInstance(TestCommaSeparatedDto, { strings: 'a,b,c' }, { excludeExtraneousValues: true });
    expect(result.strings).toEqual(['a', 'b', 'c']);
  });
});

describe('TransformCommaSeparatedNumberValueToArray', () => {
  it('should split a comma-separated string into a number array', () => {
    const result = plainToInstance(TestCommaSeparatedDto, { numbers: '1,2,3' }, { excludeExtraneousValues: true });
    expect(result.numbers).toEqual([1, 2, 3]);
  });
});

describe('TransformCommaSeparatedValueToArray()', () => {
  it('should split and map values using the custom function', () => {
    const result = plainToInstance(TestCustomMapDto, { values: 'hello,world' }, { excludeExtraneousValues: true });
    expect(result.values).toEqual(['HELLO', 'WORLD']);
  });
});

describe('TransformStringValueToBoolean', () => {
  it('should convert a string "true" to boolean true', () => {
    const result = plainToInstance(TestBooleanDto, { active: 'true' }, { excludeExtraneousValues: true });
    expect(result.active).toBe(true);
  });

  it('should convert a string "false" to boolean false', () => {
    const result = plainToInstance(TestBooleanDto, { active: 'false' }, { excludeExtraneousValues: true });
    expect(result.active).toBe(false);
  });
});
