import { Menu, Database, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ModeToggle'
import { useAppStore } from '@/store/appStore'

export function Header() {
  const { toggleSidebar, isGenerating } = useAppStore()

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background">
      {/* Left: Menu + Logo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          id="sidebar-toggle"
          aria-label="Toggle sidebar"
          className="h-12 w-12 rounded-full hover:bg-muted text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <img src="/favicon.png" alt="Logo" className="h-6 w-6 ml-1 mr-2" />
        <h1 className="text-sm font-medium text-foreground tracking-tight">
          HYBRID DATABASE AI ENGINE
        </h1>
      </div>

      {/* Right: status + theme */}
      <div className="flex items-center gap-2">
        {isGenerating && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-muted/50">
            <Sparkles className="h-3 w-3 text-violet-500 animate-spin" />
            <span>Processing…</span>
          </div>
        )}
        <ModeToggle />
      </div>
    </header>
  )
}
