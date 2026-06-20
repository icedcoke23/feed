import { SWRConfiguration } from "swr";

export const defaultSwrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryCount: 2,
  shouldRetryOnError: (err) => {
    if (err && typeof err === "object" && "status" in err) {
      const status = (err as { status?: number }).status;
      if (status && status >= 400 && status < 500) return false;
    }
    return true;
  },
};
