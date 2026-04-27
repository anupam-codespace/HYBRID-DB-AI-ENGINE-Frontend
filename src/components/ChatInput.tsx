import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FileUploadButton, FileIcon } from '@/components/FileUploadButton'
import { useAppStore } from '@/store/appStore'
import { sendPrompt, generateERDiagram } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/utils'


export function ChatInput() {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { addMessage, updateMessage, pendingFiles, removePendingFile, clearPendingFiles, sessionId, isGenerating, setIsGenerating, messages } =
    useAppStore()
  const { toast } = useToast()

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [text])

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || isGenerating) return

    const attachedFiles = [...pendingFiles]
    const fileIds = attachedFiles.filter((f) => f.fileId).map((f) => f.fileId!)

    // Add user message
    addMessage({ role: 'user', content: trimmed, files: attachedFiles })
    setText('')
    clearPendingFiles()

    // Add loading placeholder
    const aiId = addMessage({ role: 'assistant', content: '', isLoading: true })
    setIsGenerating(true)

    try {
      const isERPrompt = /er\s*diagram|entity\s*relation|generate.*diagram/i.test(trimmed)
      const response = isERPrompt
        ? await generateERDiagram(trimmed, fileIds)
        : await sendPrompt(trimmed, fileIds, sessionId)

      updateMessage(aiId, {
        content: response.content,
        isLoading: false,
        erDiagram: response.er_diagram
          ? {
              type: response.er_diagram.type,
              data: response.er_diagram.data,
              entities: response.er_diagram.entities,
              relationships: response.er_diagram.relationships,
            }
          : undefined,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      updateMessage(aiId, {
        content: 'I encountered an error while processing your request.',
        isLoading: false,
        error: message,
      })
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col gap-3">

      {/* Input area */}
      <div
        className={cn(
          'relative rounded-[32px] border-0 transition-all duration-200 bg-secondary',
          'focus-within:ring-2 focus-within:ring-primary/20',
          isGenerating && 'opacity-70'
        )}
      >
        {/* Pending files row */}
        {pendingFiles.length > 0 && (
          <div className="px-5 pt-4 flex flex-wrap gap-2 max-h-[120px] overflow-y-auto">
            {pendingFiles.map((f) => (
              <div
                key={f.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all bg-background',
                  f.error
                    ? 'border-destructive/50 text-destructive'
                    : 'border-border text-foreground'
                )}
              >
                {f.uploading ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <FileIcon type={f.type} />
                )}
                <span className="max-w-[150px] truncate">{f.name}</span>
                <span className="opacity-60 hidden sm:inline">{formatFileSize(f.size)}</span>
                <button
                  onClick={() => removePendingFile(f.id)}
                  className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 px-4 py-3">
          <div className="flex-shrink-0 pb-1 pl-1">
            <FileUploadButton />
          </div>

          <Textarea
            ref={textareaRef}
            id="chat-input"
            placeholder="Describe your data model or ask a query..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            rows={1}
            className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 p-2 min-h-[44px] max-h-[200px] text-[15px] resize-none"
          />

          <Button
            id="send-btn"
            size="icon"
            disabled={!text.trim() || isGenerating}
            onClick={handleSend}
            className={cn(
              'flex-shrink-0 h-10 w-10 rounded-full transition-all bg-transparent hover:bg-muted text-muted-foreground mb-0.5',
              text.trim() && !isGenerating && 'text-primary'
            )}
          >
            {isGenerating ? (
              <Sparkles className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
