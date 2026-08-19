// stub for vitest — UTApi constructor throws in non-server environments
export class UTApi {
  uploadFiles() {
    return Promise.resolve([]);
  }
  deleteFiles() {
    return Promise.resolve({});
  }
}
export class UTFile {}
export const utapi = new UTApi();
