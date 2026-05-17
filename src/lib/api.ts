import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.detail || err.message || 'An error occurred'
    return Promise.reject(new Error(message))
  }
)

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UploadResponse {
  file_id: string
  filename: string
  content_type: string
  extracted_text?: string
  schema?: Record<string, unknown>
  message: string
}

export interface ChatResponse {
  message_id: string
  content: string
  er_diagram?: {
    type: 'svg' | 'png' | 'json'
    data: string           // base64 for images, raw string for SVG/JSON
    entities?: EREntity[]
    relationships?: ERRelationship[]
  }
  query_type?: 'text' | 'diagram' | 'schema' | 'query'
}

export interface EREntity {
  id: string
  name: string
  attributes: ERAttribute[]
  position?: { x: number; y: number }
}

export interface ERAttribute {
  id: string
  name: string
  type: string
  isPrimary?: boolean
  isForeign?: boolean
  isNullable?: boolean
  isMultiValued?: boolean
}

export interface ERRelationship {
  id: string
  source: string        // entity id
  target: string        // entity id
  label?: string
  cardinality?: string  // e.g. "1:N"
}

export interface ExportDiagramPayload {
  entities: EREntity[]
  relationships: ERRelationship[]
  format: 'svg' | 'png' | 'json'
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Upload a file (CSV, Excel, PDF, image, etc.) */
export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<UploadResponse>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/** Send a chat prompt (with optional file_ids context) */
export async function sendPrompt(
  prompt: string,
  fileIds: string[] = [],
  sessionId?: string
): Promise<ChatResponse> {
  try {
    const { data } = await api.post<ChatResponse>('/chat', {
      prompt,
      file_ids: fileIds,
      session_id: sessionId,
    })
    return data
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 405 || status === 404 || !status) {
      return {
        message_id: 'offline-' + Date.now(),
        content:
          '⚠️ **Backend not connected.**\n\nThe AI backend is running locally. To use ER diagram generation:\n\n1. Open a terminal and run:\n```\ncd "ER model" && uvicorn api:app --port 8000\n```\n2. Then set `VITE_API_URL=http://localhost:8000` and restart the frontend.',
      }
    }
    throw err
  }
}

/** Generate ER diagram from schema / prompt */
export async function generateERDiagram(
  prompt: string,
  fileIds: string[] = []
): Promise<ChatResponse> {
  try {
    const { data } = await api.post<ChatResponse>('/er-diagram/generate', {
      prompt,
      file_ids: fileIds,
    })
    return data
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 405 || status === 404 || !status) {
      return {
        message_id: 'offline-er-' + Date.now(),
        content:
          '⚠️ **Backend not connected.**\n\nThe NLP backend needs to be running locally to generate ER diagrams.\n\n**Start it with:**\n```\ncd "ER model"\nsource ../.venv/bin/activate\nuvicorn api:app --reload --port 8000\n```\nThen refresh and try again.',
      }
    }
    throw err
  }
}

/** Save edited ER diagram back to the backend */
export async function saveERDiagram(payload: {
  entities: EREntity[]
  relationships: ERRelationship[]
  sessionId?: string
}): Promise<{ message: string; diagram_id: string }> {
  const { data } = await api.post('/er-diagram/save', payload)
  return data
}

/** Export ER diagram in chosen format */
export async function exportERDiagram(
  payload: ExportDiagramPayload
): Promise<Blob> {
  const { data } = await api.post('/er-diagram/export', payload, {
    responseType: 'blob',
  })
  return data
}

/** Execute a natural language database query */
export async function executeQuery(
  query: string,
  fileIds: string[] = []
): Promise<{ result: unknown; sql?: string; message: string }> {
  const { data } = await api.post('/query/execute', { query, file_ids: fileIds })
  return data
}
