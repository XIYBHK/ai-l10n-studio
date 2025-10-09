declare module 'swr' {
  const SWR: any;
  export default SWR;
  export const SWRConfig: any;
  export type SWRConfiguration = any;
  export function mutate(...args: any[]): any;
  export function useSWR<T = any>(key: any, ...rest: any[]): {
    data: T | undefined;
    error: any;
    isLoading: boolean;
    isValidating: boolean;
    mutate: (data?: any, opts?: any) => Promise<any>;
  };
  export function useSWRMutation(...args: any[]): any;
  export function useSWRInfinite(...args: any[]): any;
}


