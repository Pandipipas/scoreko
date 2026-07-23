declare module 'country-list' {
  export interface CountryRecord {
    code: string;
    name: string;
  }

  export const getData: () => CountryRecord[];
}
