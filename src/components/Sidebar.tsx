import { useEffect } from 'react'
import {
  Database,
  MessageSquare,
  FileText,
  Upload,
  ChevronLeft,
  Trash2,
  FileSpreadsheet,
  Image,
  File,
  Sparkles,
  X,
  Edit3,
  BarChart2,
  GitMerge,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/appStore'
import { formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/utils'

function FileTypeIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) return <Image className="h-4 w-4 text-emerald-500" />
  if (type.includes('csv') || type.includes('sheet') || type.includes('excel'))
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />
  if (type === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />
  return <File className="h-4 w-4 text-blue-500" />
}



export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, sessionFiles, messages, clearMessages, addSessionFile, pendingFiles } =
    useAppStore()

  // Move successfully uploaded pending files to sessionFiles
  useEffect(() => {
    pendingFiles.forEach((f) => {
      if (f.fileId && !sessionFiles.find((sf) => sf.id === f.id)) {
        addSessionFile(f)
      }
    })
  }, [pendingFiles, sessionFiles, addSessionFile])

  return (
    <>
      {/* Backdrop (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-40 w-72 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 flex items-center justify-center">
              <img src="/favicon.png" alt="Logo" className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight tracking-tight">HYBRID DB AI ENGINE</p>
              <p className="text-[10px] text-muted-foreground">Database Architecture</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(false)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-5 py-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">About the Engine</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The Hybrid Database AI Engine is an intelligent tool designed to accelerate database architecture. 
                By combining natural language processing with visual diagramming, it seamlessly converts your data structures, 
                CSVs, and textual descriptions into production-ready Entity-Relationship (ER) schemas.
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">How it helps</h3>
              <ul className="text-xs text-muted-foreground leading-relaxed space-y-2 list-disc pl-4">
                <li>Automates schema generation from unstructured files.</li>
                <li>Provides real-time interactive ER diagram editing.</li>
                <li>Suggests optimal SQL/NoSQL structures and insights.</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </aside>
    </>
  )
}
