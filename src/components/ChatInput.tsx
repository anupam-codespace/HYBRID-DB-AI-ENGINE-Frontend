import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'

// ─── Web Speech API type shim ─────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition
    webkitSpeechRecognition: new () => ISpeechRecognition
  }
}
interface ISpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null
}

import { ArrowUp, Sparkles, X, Mic, MicOff, ChevronDown, Check, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FileUploadButton, FileIcon } from '@/components/FileUploadButton'
import { useAppStore } from '@/store/appStore'
import { sendPrompt, generateERDiagram } from '@/lib/api'
import { Database, GitBranch } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ─── Model Options ────────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: 'er',     label: 'ER Model',             desc: 'Entity-Relationship diagrams' },
  { value: 'hybrid', label: 'Hybrid Database Model', desc: 'Multi-model schema design' },
] as const

type ModelValue = typeof MODEL_OPTIONS[number]['value']

// ─── Model Selector Dropdown ──────────────────────────────────────────────────

function ModelSelector() {
  const { selectedModel, setSelectedModel } = useAppStore()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  const current = MODEL_OPTIONS.find((o) => o.value === selectedModel)
  const label = current?.label ?? 'Select model'

  return (
    <div ref={wrapperRef} className="relative">
      <button
        id="model-selector-btn"
        onClick={() => setOpen((v) => !v)}
        className="model-pill flex items-center gap-1.5 px-3 py-1.5 select-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown
          className={cn('h-3 w-3 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-60 rounded-2xl border border-border bg-card shadow-2xl z-50 animate-scale-in overflow-hidden"
          role="listbox"
        >
          <div className="px-3 pt-3 pb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Choose Model
            </p>
          </div>
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={selectedModel === opt.value}
              onClick={() => { setSelectedModel(opt.value as ModelValue); setOpen(false) }}
              className={cn(
                'w-full flex items-start justify-between gap-2 px-3 py-3 text-sm transition-colors hover:bg-muted/60 text-left',
                selectedModel === opt.value ? 'text-primary' : 'text-foreground'
              )}
            >
              <div>
                <p className="font-medium leading-tight">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
              {selectedModel === opt.value && <Check className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-primary" />}
            </button>
          ))}
          <div className="h-1.5" />
        </div>
      )}
    </div>
  )
}

// ─── Mic Button ───────────────────────────────────────────────────────────────

function MicButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const { toast } = useToast()

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const startListening = useCallback(() => {
    if (!supported) {
      toast({ title: 'Not supported', description: 'Speech recognition is not available in this browser.', variant: 'destructive' })
      return
    }
    const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition: ISpeechRecognition = new SRClass()
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
    recognition.onresult = (e) => { onTranscript(e.results[0][0].transcript) }
    recognition.start()
  }, [supported, onTranscript, toast])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return (
    <button
      id="mic-btn"
      type="button"
      onClick={listening ? stopListening : startListening}
      aria-label={listening ? 'Stop recording' : 'Start voice input'}
      className={cn(
        'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all',
        listening
          ? 'text-red-500 bg-red-500/10 animate-pulse-glow'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
      )}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  )
}

// ─── Main Chat Input ──────────────────────────────────────────────────────────

export function ChatInput() {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const {
    addMessage, updateMessage, pendingFiles, removePendingFile,
    clearPendingFiles, sessionId, isGenerating, setIsGenerating,
    selectedModel,
  } = useAppStore()
  const { toast } = useToast()

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [text])

  // Placeholder text changes based on mode
  const placeholder = selectedModel === 'er'
    ? 'e.g. "A student can enroll in many courses" — describe any entity relationship…'
    : 'Describe your database schema or ask a query…'

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || isGenerating) return

    const attachedFiles = [...pendingFiles]
    const fileIds = attachedFiles.filter((f) => f.fileId).map((f) => f.fileId!)

    addMessage({ role: 'user', content: trimmed, files: attachedFiles })
    setText('')
    clearPendingFiles()

    const aiId = addMessage({ role: 'assistant', content: '', isLoading: true })
    setIsGenerating(true)

    try {
      // Route to ER diagram endpoint when ER model is selected OR prompt matches ER keywords
      const isERMode = selectedModel === 'er'
      const isERKeyword = /er\s*diagram|entity.{0,10}relation|generate.*diagram/i.test(trimmed)
      const response = (isERMode || isERKeyword)
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

  const handleTranscript = (transcript: string) => {
    setText((prev) => (prev ? prev + ' ' + transcript : transcript))
    textareaRef.current?.focus()
  }

  const canSend = text.trim() && !isGenerating

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="px-1 flex flex-wrap gap-2 max-h-[100px] overflow-y-auto">
          {pendingFiles.map((f) => (
            <div
              key={f.id}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium bg-card transition-all',
                f.error ? 'border-destructive/50 text-destructive' : 'border-border text-foreground'
              )}
            >
              {f.uploading
                ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                : <FileIcon type={f.type} />
              }
              <span className="max-w-[140px] truncate">{f.name}</span>
              <span className="opacity-50 hidden sm:inline text-[10px]">{formatFileSize(f.size)}</span>
              <button
                onClick={() => removePendingFile(f.id)}
                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                aria-label="Remove file"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input container — premium glassmorphism card */}
      <div className={cn('chat-input-container', isGenerating && 'opacity-80 pointer-events-none')}>

        {/* Mode badge strip at top */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-0">
          {selectedModel === 'er' ? (
            <span className="chat-mode-badge chat-mode-badge--er">
              <GitBranch className="h-2.5 w-2.5" />
              ER Model — describe any entity relationship
            </span>
          ) : (
            <span className="chat-mode-badge chat-mode-badge--hybrid">
              <Database className="h-2.5 w-2.5" />
              Hybrid Database Model
            </span>
          )}
        </div>

        {/* Textarea row */}
        <div className="flex items-end gap-2 px-4 pt-2 pb-2">
          <textarea
            ref={textareaRef}
            id="chat-input"
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            rows={1}
            className="chat-textarea flex-1 min-h-[44px] max-h-[200px] text-[14px] sm:text-[15px] w-full leading-relaxed"
          />
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-border/40" />

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-1">
            {/* File upload */}
            <FileUploadButton />
            {/* Mic */}
            <MicButton onTranscript={handleTranscript} />
            {/* Model selector */}
            <ModelSelector />
          </div>

          {/* Send button */}
          <button
            id="send-btn"
            disabled={!canSend}
            onClick={handleSend}
            aria-label="Send message"
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0',
              canSend
                ? 'send-btn-active'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isGenerating
              ? <Sparkles className="h-4 w-4 animate-spin" />
              : <ArrowUp className="h-4 w-4" />
            }
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground/60 select-none">
        Press <kbd className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">Enter</kbd> to send &nbsp;·&nbsp; <kbd className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  )
}
