import { KeyedMutator } from "swr";

export interface UseDataResult<T> {
  data?: T;
  error?: Error;
  isLoading: boolean;
  mutate: KeyedMutator<T>;
}
