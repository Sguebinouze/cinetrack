import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BottomNav from './components/BottomNav'
import SearchPage from './pages/SearchPage'
import WatchlistPage from './pages/WatchlistPage'
import StatsPage from './pages/StatsPage'
import ProfilePage from './pages/ProfilePage'
import DetailPage from './pages/DetailPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="relative flex flex-col h-full max-w-lg mx-auto bg-bg">
          <main className="flex-1 overflow-hidden flex flex-col">
            <Routes>
              <Route path="/" element={<Navigate to="/search" replace />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/movie/:id" element={<DetailPage />} />
              <Route path="/tv/:id" element={<DetailPage />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
