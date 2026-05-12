import { create } from 'zustand'
import { generateId } from '@/lib/utils'
import type { EREntity, ERRelationship } from '@/lib/api'

// ─── Message Types ────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system'

export interface AttachedFile {
  id: string
  name: string
  size: number
  type: string
  fileId?: string       // returned by backend after upload
  uploading?: boolean
  error?: string
}

export interface ERDiagramData {
  type: 'svg' | 'png' | 'json'
  data: string
  entities?: EREntity[]
  relationships?: ERRelationship[]
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  files?: AttachedFile[]
  erDiagram?: ERDiagramData
  isLoading?: boolean
  error?: string
}

// ─── App Store ────────────────────────────────────────────────────────────────

interface AppState {
  // Theme
  theme: 'light' | 'dark'
  toggleTheme: () => void

  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  // Chat
  messages: Message[]
  sessionId: string
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, update: Partial<Message>) => void
  clearMessages: () => void

  // Pending files (staged for next message)
  pendingFiles: AttachedFile[]
  addPendingFile: (file: AttachedFile) => void
  updatePendingFile: (id: string, update: Partial<AttachedFile>) => void
  removePendingFile: (id: string) => void
  clearPendingFiles: () => void

  // ER Diagram editor
  erDiagramEditorOpen: boolean
  activeDiagram: ERDiagramData | null
  setERDiagramEditorOpen: (open: boolean) => void
  setActiveDiagram: (diagram: ERDiagramData | null) => void

  // All uploaded files in session
  sessionFiles: AttachedFile[]
  addSessionFile: (file: AttachedFile) => void

  // Loading
  isGenerating: boolean
  setIsGenerating: (v: boolean) => void

  // Model selection
  selectedModel: 'hybrid' | 'er'
  setSelectedModel: (model: 'hybrid' | 'er') => void
}

export const useAppStore = create<AppState>((set) => ({
  // Theme — persist in localStorage
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'dark',
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      return { theme: next }
    }),

  // Sidebar
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  // Chat
  messages: [],
  sessionId: generateId(),
  addMessage: (msg) => {
    const id = generateId()
    set((s) => ({
      messages: [...s.messages, { ...msg, id, timestamp: new Date() }],
    }))
    return id
  },
  updateMessage: (id, update) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...update } : m)),
    })),
  clearMessages: () => set({ messages: [], sessionId: generateId() }),

  // Pending files
  pendingFiles: [],
  addPendingFile: (file) =>
    set((s) => ({ pendingFiles: [...s.pendingFiles, file] })),
  updatePendingFile: (id, update) =>
    set((s) => ({
      pendingFiles: s.pendingFiles.map((f) =>
        f.id === id ? { ...f, ...update } : f
      ),
    })),
  removePendingFile: (id) =>
    set((s) => ({ pendingFiles: s.pendingFiles.filter((f) => f.id !== id) })),
  clearPendingFiles: () => set({ pendingFiles: [] }),

  // ER Diagram
  erDiagramEditorOpen: false,
  activeDiagram: null,
  setERDiagramEditorOpen: (open) => set({ erDiagramEditorOpen: open }),
  setActiveDiagram: (diagram) => set({ activeDiagram: diagram }),

  // Session files
  sessionFiles: [],
  addSessionFile: (file) =>
    set((s) => ({ sessionFiles: [...s.sessionFiles, file] })),

  // Loading
  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),

  // Model selection
  selectedModel: 'hybrid',
  setSelectedModel: (model) => set({ selectedModel: model }),
}))
