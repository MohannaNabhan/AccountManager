import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import SidebarLayout from './layout/SidebarLayout'
import VaultGate from './components/custom/VaultGate'
import Projects from './pages/Projects'
import ProjectAccounts from './pages/ProjectAccounts'
import ProjectTrash from './pages/ProjectTrash'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import AutoForm from './pages/AutoForm'
import WindowFrame from './components/custom/WindowFrame'
function App() {
  return (
    <WindowFrame>
      <HashRouter>
        <Toaster theme="dark" richColors />
        <VaultGate>
          <SidebarLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/autoform" element={<AutoForm />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectAccounts />} />
              <Route path="/projects/:id/trash" element={<ProjectTrash />} />
            </Routes>
          </SidebarLayout>
        </VaultGate>
      </HashRouter>
    </WindowFrame>
  )
}

export default App
