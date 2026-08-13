import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { createIdbPersister, PERSIST_BUSTER, queryClient } from './lib/queryClient'
import './index.css'

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: createIdbPersister(),
        maxAge: 1000 * 60 * 60 * 24 * 30,
        buster: PERSIST_BUSTER,
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>,
)