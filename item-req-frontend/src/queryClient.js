import { QueryClient } from '@tanstack/react-query';

// Create a client
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 1 minute
            staleTime: 1000 * 60,
            // Keep unused data in cache for 5 minutes
            cacheTime: 1000 * 60 * 5,
            // Retry failed requests 1 time
            retry: 1,
            // Do not refetch on window focus by default (can be noisy during dev)
            refetchOnWindowFocus: false,
        },
    },
});
