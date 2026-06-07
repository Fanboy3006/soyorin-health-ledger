import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './lib/auth'
import App from './App.tsx'
import AuthPage from './pages/AuthPage.tsx'
import PresetManager from './pages/PresetManager.tsx'
import Trends from './pages/Trends.tsx'
import Reports from './pages/Reports.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/presets" element={<PresetManager />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
