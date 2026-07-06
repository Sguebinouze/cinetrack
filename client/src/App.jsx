import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import BottomNav from './components/BottomNav'
import SearchPage from './pages/SearchPage'
import WatchlistPage from './pages/WatchlistPage'
import StatsPage from './pages/StatsPage'
import ProfilePage from './pages/ProfilePage'
import DetailPage from './pages/DetailPage'
import JournalPage from './pages/JournalPage'
import WrappedPage from './pages/WrappedPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Les données restent affichables 24h avant d'être jugées "obsolètes" —
      // au-delà, react-query retente un fetch réseau dès qu'il est disponible,
      // mais continue d'afficher la version en cache pendant ce temps (pas d'écran vide).
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'cinetrack-query-cache',
})

// N'écrit dans localStorage que les données perso réutilisables hors-ligne
// (watchlist, stats, épisodes, listes, journal, wrapped, détail déjà consulté).
// On exclut volontairement 'search'/'trending' : résultats TMDB temps réel,
// aucune valeur à rejouer offline et ça gonflerait le cache pour rien.
const PERSISTED_QUERY_PREFIXES = [
  'watchlist', 'stats', 'seasons', 'lists', 'journal', 'wrapped', 'detail',
]

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h — au-delà, cache jeté au lieu de resservir une donnée trop vieille
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            PERSISTED_QUERY_PREFIXES.includes(query.queryKey[0]) && query.state.status === 'success',
        },
      }}
    >
      <BrowserRouter>
        <div className="relative flex flex-col h-full max-w-lg mx-auto bg-bg">
          <main className="flex-1 overflow-hidden flex flex-col">
            <Routes>
              <Route path="/" element={<Navigate to="/search" replace />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/journal" element={<JournalPage />} />
              <Route path="/wrapped" element={<WrappedPage />} />
              <Route path="/:type/:id" element={<DetailPage />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </BrowserRouter>
    </PersistQueryClientProvider>
  )
}
