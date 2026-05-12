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
  } catch (err) {
    // Fallback mock for Vercel deployment without backend
    await new Promise(r => setTimeout(r, 1000))
    return {
      message_id: 'mock-msg-' + Date.now(),
      content: `I am the AI Architect. You said: "${prompt}"\n\nAsk me to generate an ER diagram to see the interactive canvas in action!`,
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
  } catch (err) {
    // Fallback mock for Vercel deployment without backend
    await new Promise(r => setTimeout(r, 2000))
    
    const e_emp = 'ent-emp'
    const e_dept = 'ent-dept'
    const e_proj = 'ent-proj'
    const e_dep = 'ent-dep'
    
    return {
      message_id: 'mock-er-' + Date.now(),
      content: `I have generated the Entity-Relationship (ER) diagram based on your prompt.\n\n**Entities:** Employee, Department, Project, Dependant\n**Relationships:** appoints, works_on, manages, supports`,
      er_diagram: {
        type: 'json',
        data: '{}',
        entities: [
          {
            id: e_emp,
            name: 'Employee',
            attributes: [
              { id: 'attr-emp-1', name: 'Emp_ID', type: 'VARCHAR', isPrimary: true },
              { id: 'attr-emp-2', name: 'Emp_Name', type: 'VARCHAR' },
              { id: 'attr-emp-3', name: 'Email', type: 'VARCHAR' },
              { id: 'attr-emp-4', name: 'DOB', type: 'DATE' },
              { id: 'attr-emp-5', name: 'Phone', type: 'VARCHAR', isMultiValued: true }
            ],
            position: { x: 400, y: 300 }
          },
          {
            id: e_dept,
            name: 'Department',
            attributes: [
              { id: 'attr-dept-1', name: 'Dept_ID', type: 'VARCHAR', isPrimary: true },
              { id: 'attr-dept-2', name: 'Contact', type: 'VARCHAR', isMultiValued: true },
              { id: 'attr-dept-3', name: 'Dept_Name', type: 'VARCHAR' }
            ],
            position: { x: 100, y: 100 }
          },
          {
            id: e_proj,
            name: 'Project',
            attributes: [
              { id: 'attr-proj-1', name: 'Proj_ID', type: 'VARCHAR', isPrimary: true },
              { id: 'attr-proj-2', name: 'Proj_Name', type: 'VARCHAR' },
              { id: 'attr-proj-3', name: 'Proj_Type', type: 'VARCHAR' }
            ],
            position: { x: 700, y: 100 }
          },
          {
            id: e_dep,
            name: 'Dependant',
            attributes: [
              { id: 'attr-dep-1', name: 'Relation', type: 'VARCHAR' },
              { id: 'attr-dep-2', name: 'Dpd_Name', type: 'VARCHAR' },
              { id: 'attr-dep-3', name: 'Gender', type: 'VARCHAR' }
            ],
            position: { x: 400, y: 550 }
          }
        ],
        relationships: [
          {
            id: 'rel-1',
            source: e_dept,
            target: e_emp,
            label: 'appoints',
            cardinality: '1:N'
          },
          {
            id: 'rel-2',
            source: e_emp,
            target: e_proj,
            label: 'works_on',
            cardinality: 'M:N'
          },
          {
            id: 'rel-3',
            source: e_dept,
            target: e_proj,
            label: 'manages',
            cardinality: '1:N'
          },
          {
            id: 'rel-4',
            source: e_emp,
            target: e_dep,
            label: 'supports',
            cardinality: '1:N'
          }
        ]
      }
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
