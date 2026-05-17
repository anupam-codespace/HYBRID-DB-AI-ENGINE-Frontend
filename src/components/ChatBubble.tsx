import { useState } from 'react'
import { Bot, User, Copy, Check, Edit3, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore, type Message } from '@/store/appStore'
import { cn } from '@/lib/utils'

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  )
}

function ERDiagramPreviewInline({ message }: { message: Message }) {
  const { setActiveDiagram, setERDiagramEditorOpen } = useAppStore()
  const diagram = message.erDiagram!

  return (
    <div className="mt-3 rounded-xl border border-border overflow-hidden bg-muted/30">
      {/* Diagram viewer */}
      <div className="relative group max-h-64 overflow-hidden flex items-center justify-center bg-white dark:bg-slate-900 p-4">
        {diagram.type === 'svg' ? (
          <div
            className="w-full"
            dangerouslySetInnerHTML={{ __html: diagram.data }}
          />
        ) : diagram.type === 'json' ? (
          <div className="w-full h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ZoomIn className="h-8 w-8 opacity-50" />
            <span className="text-sm font-medium">Interactive Diagram Generated</span>
            <span className="text-xs">Click Edit to view and modify</span>
          </div>
        ) : (
          <img
            src={
              diagram.type === 'png'
                ? `data:image/png;base64,${diagram.data}`
                : diagram.data
            }
            alt="ER Diagram"
            className="max-w-full max-h-56 object-contain"
          />
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg"
            onClick={() => {
              setActiveDiagram(diagram, message.id)
              setERDiagramEditorOpen(true)
            }}
          >
            <ZoomIn className="h-3.5 w-3.5 mr-1.5" />
            View Full
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">ER Diagram</Badge>
          {diagram.entities && (
            <span className="text-xs text-muted-foreground">
              {diagram.entities.length} entities
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={() => {
            setActiveDiagram(diagram, message.id)
            setERDiagramEditorOpen(true)
          }}
          id={`edit-er-${message.id}`}
        >
          <Edit3 className="h-3 w-3" />
          Edit Diagram
        </Button>
      </div>
    </div>
  )
}

function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={copy}
      aria-label="Copy message"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

export function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isLoading = message.isLoading

  return (
    <div
      className={cn(
        'flex gap-3 group',
        isUser ? 'flex-row-reverse animate-slide-in-right' : 'flex-row animate-slide-in-left'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-gradient-to-br from-violet-500 to-blue-500 text-white'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[78%] flex flex-col gap-1',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Attached files (user only) */}
        {isUser && message.files && message.files.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end mb-1">
            {message.files.map((f) => (
              <Badge key={f.id} variant="secondary" className="text-xs gap-1">
                <span className="max-w-[100px] truncate">{f.name}</span>
              </Badge>
            ))}
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border border-border rounded-tl-sm'
          )}
        >
          {isLoading ? (
            <TypingIndicator />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {message.error && (
            <p className="mt-2 text-xs text-destructive opacity-80">
              ⚠ {message.error}
            </p>
          )}
        </div>

        {/* ER Diagram preview */}
        {!isLoading && message.erDiagram && (
          <div className="w-full">
            <ERDiagramPreviewInline message={message} />
          </div>
        )}

        {/* Timestamp + copy */}
        <div className="flex items-center gap-2 px-1">
          <time className="text-[10px] text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
          {!isUser && !isLoading && (
            <MessageActions content={message.content} />
          )}
        </div>
      </div>
    </div>
  )
}
