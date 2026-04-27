import { useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { ChatWindow } from '@/components/ChatWindow'
import { ERDiagramCanvasEditor } from '@/components/ERDiagramCanvasEditor'
import { useAppStore } from '@/store/appStore'

export default function App() {
  const { theme } = useAppStore()

  // Sync theme class on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
        <Header />

        <div className="flex flex-1 overflow-hidden relative">
          <Sidebar />

          {/* Main content */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <ChatWindow />
          </main>
        </div>

        {/* Full-screen ER diagram editor (portal-like overlay) */}
        <ERDiagramCanvasEditor />

        {/* Global toast notifications */}
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
