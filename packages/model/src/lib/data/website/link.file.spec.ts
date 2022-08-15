import { decodeWebsiteLinkEncodedDataToWebsiteFileLink, encodeWebsiteFileLinkToWebsiteLinkEncodedData, WebsiteFileLink, websiteFileLinkToWebsiteLink, websiteLinkToWebsiteLinkFile, WEBSITE_FILE_LINK_WEBSITE_LINK_TYPE } from './link.file';

const exampleWithAll: WebsiteFileLink = {
  type: 't',
  mime: 'test/test',
  name: 'test-name',
  data: 'https://components.dereekb.com/'
};

const exampleWithOnlyData: WebsiteFileLink = {
  data: exampleWithAll.data
};

describe('websiteFileLinkToWebsiteLink', () => {
  it('should convert the input to a WebsiteLink', () => {
    const result = websiteFileLinkToWebsiteLink(exampleWithAll);
    expect(result).toBeDefined();
    expect(result.t).toBe(WEBSITE_FILE_LINK_WEBSITE_LINK_TYPE);
    expect(result.d).toBe(encodeWebsiteFileLinkToWebsiteLinkEncodedData(exampleWithAll));
  });
});

describe('websiteLinkToWebsiteLinkFile', () => {
  it('should convert the input to a WebsiteLinkFile', () => {
    const encoded = websiteFileLinkToWebsiteLink(exampleWithAll);
    const decoded = websiteLinkToWebsiteLinkFile(encoded);
    expect(decoded).toBeDefined();

    expect(decoded.type).toBe(exampleWithAll.type);
    expect(decoded.mime).toBe(exampleWithAll.mime);
    expect(decoded.name).toBe(exampleWithAll.name);
    expect(decoded.data).toBe(exampleWithAll.data);
  });
});

describe('encodeWebsiteFileLinkToWebsiteLinkEncodedData', () => {
  it('should encode the link to a string', () => {
    const result = encodeWebsiteFileLinkToWebsiteLinkEncodedData(exampleWithAll);

    expect(result).toContain(exampleWithAll.type);
    expect(result).toContain(exampleWithAll.mime);
    expect(result).toContain(exampleWithAll.name);
    expect(result).toContain(exampleWithAll.data);
  });

  it('should encode the data-only link to a string', () => {
    const result = encodeWebsiteFileLinkToWebsiteLinkEncodedData(exampleWithOnlyData);
    expect(result).toContain(exampleWithAll.data);
  });
});

describe('decodeWebsiteLinkEncodedDataToWebsiteFileLink', () => {
  it('should decode the link', () => {
    const encoded = encodeWebsiteFileLinkToWebsiteLinkEncodedData(exampleWithAll);
    const decoded = decodeWebsiteLinkEncodedDataToWebsiteFileLink(encoded);

    expect(decoded.type).toBe(exampleWithAll.type);
    expect(decoded.mime).toBe(exampleWithAll.mime);
    expect(decoded.name).toBe(exampleWithAll.name);
    expect(decoded.data).toBe(exampleWithAll.data);
  });

  it('should decode the data-only link', () => {
    const result = encodeWebsiteFileLinkToWebsiteLinkEncodedData(exampleWithOnlyData);
    const decoded = decodeWebsiteLinkEncodedDataToWebsiteFileLink(result);

    expect(decoded.type).toBeUndefined();
    expect(decoded.mime).toBeUndefined();
    expect(decoded.name).toBeUndefined();
    expect(decoded.data).toBe(exampleWithOnlyData.data);
  });
});
