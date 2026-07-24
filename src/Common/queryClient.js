import { QueryClient } from 'react-query'

// Shared react-query client. Kept in its own module (rather than App.js) so feature
// code can import it for cache invalidation without creating a circular dependency
// through the App → navigation → screens import chain.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 1000 * 60 * 60 * 24 // 1 day
    }
  }
})

export default queryClient
