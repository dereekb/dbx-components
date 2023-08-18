import { WebsiteUrl, WebsiteUrlWithPrefix } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { IsWebsiteUrl, IsWebsiteUrlWithPrefix } from '.';

class TestModelClassWithPrefix {
  @Expose()
  @IsOptional()
  @IsWebsiteUrlWithPrefix()
  url!: WebsiteUrlWithPrefix;
}

class TestModelClassWithOptionalPrefix {
  @Expose()
  @IsOptional()
  @IsWebsiteUrl()
  url!: WebsiteUrl;
}

describe('IsWebsiteUrl', () => {
  it('should pass a valid website url', async () => {
    const instance = new TestModelClassWithOptionalPrefix();
    instance.url = 'dereekb.com/test';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should pass a valid website url with prefix', async () => {
    const instance = new TestModelClassWithOptionalPrefix();
    instance.url = 'https://dereekb.com/test/test?test=1';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should not pass an invalid IsWebsiteUrl', async () => {
    const instance = new TestModelClassWithOptionalPrefix();
    instance.url = '245678910' as any;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});

describe('IsWebsiteUrlWithPrefix', () => {
  it('should not pass a valid website url', async () => {
    const instance = new TestModelClassWithPrefix();
    instance.url = 'dereekb.com/test';

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });

  it('should pass a valid website url with prefix', async () => {
    const instance = new TestModelClassWithPrefix();
    instance.url = 'https://dereekb.com/test/test?test=1';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should not pass an invalid IsWebsiteUrl', async () => {
    const instance = new TestModelClassWithPrefix();
    instance.url = '245678910' as any;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
