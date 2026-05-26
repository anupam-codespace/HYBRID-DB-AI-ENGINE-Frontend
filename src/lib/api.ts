import axios from 'axios'
import { extractERFromText } from './erExtractor'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)   // pass original AxiosError through unchanged
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
  isWeak?: boolean
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
  } catch {
    // Backend offline — try extracting ER diagram anyway
    const result = extractERFromText(prompt)
    if (result) {
      return {
        message_id: 'local-er-' + Date.now(),
        content: `Here is the ER diagram generated from your prompt:\n\n${result.summary}`,
        er_diagram: {
          type: 'json',
          data: '{}',
          entities: result.entities,
          relationships: result.relationships,
        },
      }
    }
    // Completely fallback
    return {
      message_id: 'local-' + Date.now(),
      content:
        `You said: "${prompt}"\n\nTo generate an ER diagram, try a sentence like: _"A student can enroll in many courses"_.`,
    }
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
  } catch {
    // Backend offline — use client-side NLP extraction
    const result = extractERFromText(prompt)
    if (result) {
      return {
        message_id: 'local-er-' + Date.now(),
        content:
          `Here is the ER diagram generated from your prompt:\n\n${result.summary}`,
        er_diagram: {
          type: 'json',
          data: '{}',
          entities: result.entities,
          relationships: result.relationships,
        },
      }
    }
    return {
      message_id: 'local-er-fail-' + Date.now(),
      content:
        'Could not detect enough entities in your sentence. Try: _"A student can enroll in many courses"_',
    }
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
