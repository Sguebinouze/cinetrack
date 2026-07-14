import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import BottomNav from './components/BottomNav'
import SearchPage from './pages/SearchPage'
import WatchlistPage from './pages/WatchlistPage'
import ProfilePage from './pages/ProfilePage'
import DetailPage from './pages/DetailPage'
import JournalPage from './pages/JournalPage'
import WrappedPage from './pages/WrappedPage'
import UpdateNotification from './components/UpdateNotification'
import { ToastProvider } from './components/Toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // retry: false — un retry automatique pouvait laisser une requête en échec
      // bloquée indéfiniment en fetchStatus 'paused' (jamais 'error'), affichant
      // une page vide au lieu du message d'erreur. Un échec direct est plus fiable
      // qu'un retry silencieux pour cette app.
      retry: false,
      refetchOnWindowFocus: false,
      networkMode: 'always',
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
  'watchlist', 'stats', 'seasons', 'lists', 'journal', 'wrapped', 'detail', 'next-episode',
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
        <ToastProvider>
          <div className="relative flex flex-col h-full max-w-lg mx-auto bg-bg">
            <main className="flex-1 overflow-hidden flex flex-col">
              <Routes>
                {/* Ma liste est l'accueil : on ouvre l'app sur ce qu'on peut regarder ce soir. */}
                <Route path="/" element={<Navigate to="/watchlist" replace />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/watchlist" element={<WatchlistPage />} />
                {/* Stats a fusionné dans « Moi ». Redirection pour ne pas casser un
                    raccourci PWA ou un onglet déjà ouvert sur l'ancienne URL. */}
                <Route path="/stats" element={<Navigate to="/profile" replace />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/journal" element={<JournalPage />} />
                <Route path="/wrapped" element={<WrappedPage />} />
                <Route path="/:type/:id" element={<DetailPage />} />
              </Routes>
            </main>
            <BottomNav />
            <UpdateNotification />
          </div>
        </ToastProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  )
}
