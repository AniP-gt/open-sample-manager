export type FreesoundCredentialStatus = {
  readonly configured: boolean;
};

export type FreesoundSound = {
  readonly id: number;
  readonly name: string;
  readonly uploader: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly pageUrl: string;
  readonly previewUrl: string;
};

export type FreesoundSearchResponse = {
  readonly page: number;
  readonly pageSize: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly sounds: readonly FreesoundSound[];
  readonly totalCount: number;
};
