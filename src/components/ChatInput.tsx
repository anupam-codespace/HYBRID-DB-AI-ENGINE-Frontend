import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { Send, Sparkles, X, Mic, MicOff, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FileUploadButton, FileIcon } from '@/components/FileUploadButton'
import { useAppStore } from '@/store/appStore'
import { sendPrompt, generateERDiagram } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ─── Model Options ────────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: 'hybrid', label: 'Hybrid Database Model' },
  { value: 'er',     label: 'ER Model' },
] as const

type ModelValue = typeof MODEL_OPTIONS[number]['value']

// ─── Model Selector Dropdown ──────────────────────────────────────────────────

function ModelSelector() {
  const { selectedModel, setSelectedModel } = useAppStore()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // close on outside click
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  const current = MODEL_OPTIONS.find((o) => o.value === selectedModel) ?? MODEL_OPTIONS[0]

  return (
    <div ref={wrapperRef} className="relative">
      <button
        id="model-selector-btn"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all select-none',
          'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60',
          open && 'bg-muted text-foreground'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[160px] truncate">{current.label}</span>
        <ChevronDown
          className={cn('h-3 w-3 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute bottom-full left-0 mb-2 w-52 rounded-2xl border border-border bg-card shadow-xl z-50',
            'animate-fade-in overflow-hidden'
          )}
          role="listbox"
        >
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Select model
            </p>
          </div>
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={selectedModel === opt.value}
              onClick={() => {
                setSelectedModel(opt.value as ModelValue)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors',
                'hover:bg-muted/70 text-left',
                selectedModel === opt.value ? 'text-primary font-medium' : 'text-foreground'
              )}
            >
              <span>{opt.label}</span>
              {selectedModel === opt.value && <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />}
            </button>
          ))}
          <div className="h-2" />
        </div>
      )}
    </div>
  )
}

// ─── Mic Button (Web Speech API) ──────────────────────────────────────────────

function MicButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const { toast } = useToast()

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const startListening = useCallback(() => {
    if (!supported) {
      toast({ title: 'Not supported', description: 'Speech recognition is not available in this browser.', variant: 'destructive' })
      return
    }

    const SRClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition: SpeechRecognition = new SRClass()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = (e) => {
      setListening(false)
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast({ title: 'Mic error', description: e.error, variant: 'destructive' })
      }
    }
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      onTranscript(transcript)
    }

    recognition.start()
  }, [supported, onTranscript, toast])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const toggleMic = () => {
    if (listening) stopListening()
    else startListening()
  }

  return (
    <Button
      id="mic-btn"
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleMic}
      aria-label={listening ? 'Stop recording' : 'Start voice input'}
      className={cn(
        'flex-shrink-0 h-10 w-10 rounded-full transition-all mb-0.5',
        listening
          ? 'text-red-500 bg-red-500/10 animate-pulse-glow'
          : 'bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
      )}
    >
      {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </Button>
  )
}

// ─── Main Chat Input ──────────────────────────────────────────────────────────

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

  // Append transcript to existing text
  const handleTranscript = (transcript: string) => {
    setText((prev) => (prev ? prev + ' ' + transcript : transcript))
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-2">

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

          {/* Mic Button */}
          <MicButton onTranscript={handleTranscript} />

          {/* Send Button */}
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

      {/* Bottom toolbar: Model selector */}
      <div className="flex items-center gap-2 px-2">
        <ModelSelector />
      </div>
    </div>
  )
}
