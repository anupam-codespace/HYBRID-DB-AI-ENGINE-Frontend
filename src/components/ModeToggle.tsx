import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ModeToggle() {
  const { theme, toggleTheme } = useAppStore()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          id="theme-toggle"
          aria-label="Toggle theme"
          className="rounded-full relative overflow-hidden"
        >
          <span
            className="absolute inset-0 flex items-center justify-center transition-all duration-300"
            style={{
              transform: theme === 'dark' ? 'translateY(0)' : 'translateY(-100%)',
              opacity: theme === 'dark' ? 1 : 0,
            }}
          >
            <Sun className="h-4 w-4" />
          </span>
          <span
            className="absolute inset-0 flex items-center justify-center transition-all duration-300"
            style={{
              transform: theme === 'light' ? 'translateY(0)' : 'translateY(100%)',
              opacity: theme === 'light' ? 1 : 0,
            }}
          >
            <Moon className="h-4 w-4" />
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      </TooltipContent>
    </Tooltip>
  )
}
