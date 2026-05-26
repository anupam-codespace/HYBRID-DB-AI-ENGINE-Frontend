import { useCallback, useRef, useState, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  Panel,
  Handle,
  Position,
  getRectOfNodes,
  getTransformForBounds,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { toPng, toSvg } from 'html-to-image'
import { Plus, Save, X, Download, AlertTriangle, ShieldAlert, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import { saveERDiagram } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type { EREntity, ERRelationship, ERAttribute } from '@/lib/api'
import { generateId, cn } from '@/lib/utils'

// ─── Inline-editable label ────────────────────────────────────────────────────
function InlineLabel({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={e => { if (e.key === 'Enter') setEditing(false); if (e.key === 'Escape') setEditing(false) }}
        className={cn('bg-white dark:bg-zinc-900 border border-primary/40 rounded px-2 outline-none text-center focus:ring-2 focus:ring-primary/20 w-full text-zinc-900 dark:text-zinc-100', className)}
        style={{ minWidth: 80 }}
      />
    )
  }
  return (
    <span
      onDoubleClick={() => setEditing(true)}
      title="Double-click to rename"
      className={cn('cursor-text select-none hover:opacity-75 transition-opacity', className)}
    >
      {value || ' '}
    </span>
  )
}

// ─── Professional Modern ER Nodes ──────────────────────────────────────────────────
function ClassicEntityNode({ id, data }: { id: string; data: any }) {
  const isWeak: boolean = !!data.isWeak
  return (
    <div className={cn(
      'relative bg-white dark:bg-zinc-900 rounded-xl min-w-[160px] shadow-sm hover:shadow-md transition-all duration-200 group overflow-visible',
      isWeak
        ? 'border-2 border-zinc-400 dark:border-zinc-500 outline outline-[3px] outline-offset-[3px] outline-zinc-300 dark:outline-zinc-600'
        : 'border border-zinc-200 dark:border-zinc-800'
    )}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />

      <div className="bg-blue-50/80 dark:bg-blue-900/20 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 rounded-t-xl flex justify-center items-center">
        <InlineLabel value={data.label} onChange={v => data.onRename(id, v)} className="text-sm font-semibold text-blue-700 dark:text-blue-400" />
      </div>
      <div className="px-4 py-2 text-[10px] text-zinc-400 dark:text-zinc-500 text-center uppercase tracking-wider font-medium">
        {isWeak ? 'Weak Entity' : 'Entity'}
      </div>

      {/* Bottom action bar on hover */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <button
          onClick={e => { e.stopPropagation(); data.onAddAttr(id) }}
          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full p-1.5 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
          title="Add Attribute"
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); data.onToggleWeak(id) }}
          className={cn(
            'border rounded-full p-1.5 shadow-sm transition-colors',
            isWeak
              ? 'bg-zinc-700 border-zinc-600 hover:bg-zinc-600 text-white dark:bg-zinc-200 dark:border-zinc-300 dark:hover:bg-zinc-300 dark:text-zinc-800'
              : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
          )}
          title={isWeak ? 'Unmark Weak Entity' : 'Mark as Weak Entity'}
        >
          <ShieldAlert className="h-3 w-3" />
        </button>
      </div>
      <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <button
          onClick={e => { e.stopPropagation(); data.onDelete(id) }}
          className="bg-red-500 border border-red-600 rounded-full p-1 shadow-sm hover:bg-red-600 text-white transition-colors"
          title="Delete Entity"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function ClassicRelationshipNode({ id, data }: { id: string; data: any }) {
  return (
    <div className="relative group flex items-center justify-center w-28 h-28">
      <div className="absolute inset-0 bg-emerald-50/80 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 transform rotate-45 shadow-sm group-hover:shadow-md transition-shadow rounded-sm" />
      <div className="relative z-10 flex flex-col items-center px-2 text-center">
        <InlineLabel value={data.label} onChange={v => data.onRename(id, v)} className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-transparent" />
      </div>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <button
        onClick={e => { e.stopPropagation(); data.onDelete(id) }}
        className="absolute -top-1 -right-1 bg-red-500 border border-red-600 rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors z-20 opacity-0 group-hover:opacity-100 text-white"
        title="Delete Relationship"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

function ClassicAttributeNode({ id, data }: { id: string; data: any }) {
  return (
    <div
      onDoubleClick={e => { e.stopPropagation(); data.onEdit?.(id) }}
      className={cn(
        'relative bg-white dark:bg-zinc-900 rounded-[50%] px-4 py-2 text-xs text-center shadow-sm hover:shadow-md transition-shadow min-w-[120px] h-[55px] group flex items-center justify-center cursor-pointer select-none',
        data.isMultiValued ? 'border-4 border-double border-zinc-300 dark:border-zinc-600' : 'border border-zinc-200 dark:border-zinc-800'
      )}
      title="Double-click to edit"
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <span className={cn('font-medium text-zinc-700 dark:text-zinc-300', data.isPrimary && 'underline underline-offset-4 decoration-zinc-500 font-bold')}>
        {data.label || ' '}
      </span>
      {/* Edit pencil on hover */}
      <button
        onClick={e => { e.stopPropagation(); data.onEdit?.(id) }}
        className="absolute -bottom-1 -right-1 bg-zinc-700 dark:bg-zinc-200 border border-zinc-600 dark:border-zinc-300 rounded-full p-1 shadow-sm hover:bg-zinc-600 dark:hover:bg-zinc-100 transition-colors z-10 opacity-0 group-hover:opacity-100 text-white dark:text-zinc-800"
        title="Edit Attribute"
      >
        <Pencil className="h-2 w-2" />
      </button>
      {/* Delete on hover */}
      <button
        onClick={e => { e.stopPropagation(); data.onDelete(id) }}
        className="absolute -top-1 -right-1 bg-red-500 border border-red-600 rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors z-10 opacity-0 group-hover:opacity-100 text-white"
        title="Delete Attribute"
      >
        <X className="h-2 w-2" />
      </button>
    </div>
  )
}

const nodeTypes = {
  classicEntity: ClassicEntityNode,
  classicRelationship: ClassicRelationshipNode,
  classicAttribute: ClassicAttributeNode,
}

// ─── Add-Attribute Dialog ─────────────────────────────────────────────────────
const SQL_DATATYPES = ['INT', 'DECIMAL', 'VARCHAR', 'TEXT', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'IMAGE', 'PDF']

function AttrDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (a: ERAttribute) => void }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [isMultiValued, setIsMultiValued] = useState(false)
  const [dataType, setDataType] = useState('VARCHAR')

  useEffect(() => {
    if (open) {
      setStep(1)
      setName('')
      setIsPrimary(false)
      setIsMultiValued(false)
      setDataType('VARCHAR')
    }
  }, [open])

  const handleNext = () => {
    if (step === 1 && name.trim()) setStep(2)
  }

  const handleSave = () => {
    if (step !== 2 || !dataType) return
    onSave({ id: generateId(), name: name.trim(), type: dataType, isPrimary, isMultiValued })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Add Attribute"}
            {step === 2 && "Select Datatype"}
          </DialogTitle>
        </DialogHeader>
        
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <input
              autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
              placeholder="e.g. student_name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-4">
              {[['Primary Key', isPrimary, setIsPrimary] as const, ['Multi-Valued', isMultiValued, setIsMultiValued] as const].map(([lbl, val, set]) => (
                <label key={lbl} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={val} onChange={e => (set as any)(e.target.checked)} className="accent-primary" />
                  {lbl}
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button size="sm" className="flex-1" onClick={handleNext} disabled={!name.trim()}>Next</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-2">
              {SQL_DATATYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setDataType(type)}
                  className={cn(
                    "px-2 py-1.5 text-xs rounded-md border font-medium transition-colors",
                    dataType === type ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button size="sm" className="flex-1" onClick={handleSave} disabled={!dataType}>Add Attribute</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit-Attribute Dialog ───────────────────────────────────────────────────
interface EditAttrInitial {
  id: string
  name: string
  dataType: string
  isPrimary: boolean
  isForeign: boolean
  isMultiValued: boolean
  isNullable: boolean
}

function EditAttrDialog({
  open, initial, onClose, onSave,
}: {
  open: boolean
  initial: EditAttrInitial | null
  onClose: () => void
  onSave: (updated: EditAttrInitial) => void
}) {
  const [name, setName] = useState('')
  const [dataType, setDataType] = useState('VARCHAR')
  const [isPrimary, setIsPrimary] = useState(false)
  const [isForeign, setIsForeign] = useState(false)
  const [isMultiValued, setIsMultiValued] = useState(false)
  const [isNullable, setIsNullable] = useState(false)

  useEffect(() => {
    if (open && initial) {
      setName(initial.name)
      setDataType(initial.dataType || 'VARCHAR')
      setIsPrimary(initial.isPrimary)
      setIsForeign(initial.isForeign)
      setIsMultiValued(initial.isMultiValued)
      setIsNullable(initial.isNullable)
    }
  }, [open, initial])

  const handleSave = () => {
    if (!name.trim() || !initial) return
    onSave({ id: initial.id, name: name.trim(), dataType, isPrimary, isForeign, isMultiValued, isNullable })
    onClose()
  }

  const toggles: [string, boolean, (v: boolean) => void, string][] = [
    ['Primary Key', isPrimary, setIsPrimary, 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'],
    ['Foreign Key', isForeign, setIsForeign, 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700'],
    ['Multi-Valued', isMultiValued, setIsMultiValued, 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-500 dark:border-amber-800'],
    ['Nullable', isNullable, setIsNullable, 'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600'],
  ]

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-blue-500" />
            Edit Attribute
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Attribute Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. student_name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Datatype */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Type</label>
            <div className="grid grid-cols-3 gap-2">
              {SQL_DATATYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setDataType(type)}
                  className={cn(
                    'px-2 py-1.5 text-xs rounded-md border font-medium transition-colors',
                    dataType === type ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle flags */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Flags</label>
            <div className="grid grid-cols-2 gap-2">
              {toggles.map(([lbl, val, set, activeClass]) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => set(!val)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-all',
                    val ? activeClass : 'bg-background border-input text-muted-foreground hover:bg-muted'
                  )}
                >
                  <span className={cn(
                    'inline-flex h-3.5 w-3.5 rounded-sm border items-center justify-center text-[10px] flex-shrink-0 transition-colors',
                    val ? 'bg-current border-current text-white' : 'border-muted-foreground'
                  )}>
                    {val && '✓'}
                  </span>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="flex-1" onClick={handleSave} disabled={!name.trim()}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Unsaved-Changes Guard Dialog ─────────────────────────────────────────────
function UnsavedDialog({ open, onSave, onDiscard, onCancel }: {
  open: boolean; onSave: () => void; onDiscard: () => void; onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Unsaved changes
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground pt-1">
          You have unsaved changes to this ER diagram. Would you like to save them before leaving?
        </p>
        <div className="flex gap-2 pt-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onDiscard}>Discard</Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="flex-1" onClick={onSave}>Save & Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Canvas Editor ───────────────────────────────────────────────────────
export function ERDiagramCanvasEditor() {
  const { erDiagramEditorOpen, setERDiagramEditorOpen, activeDiagram, activeDiagramMessageId, sessionId } = useAppStore()
  const { toast } = useToast()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [attrDialogOpen, setAttrDialogOpen] = useState(false)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)
  const [targetEntityId, setTargetEntityId] = useState<string | null>(null)
  const [editAttrDialogOpen, setEditAttrDialogOpen] = useState(false)
  const [editAttrInitial, setEditAttrInitial] = useState<EditAttrInitial | null>(null)
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null)

  // Mark dirty on any change
  const markDirty = () => setIsDirty(true)

  // Rebuild from activeDiagram
  useEffect(() => {
    if (!erDiagramEditorOpen || !activeDiagram) return
    const initialNodes: Node[] = []
    const initialEdges: Edge[] = []
    const entities = activeDiagram.entities ?? []
    const relationships = activeDiagram.relationships ?? []

    entities.forEach((ent, i) => {
      initialNodes.push({
        id: ent.id,
        type: 'classicEntity',
        position: ent.position ?? { x: 150 + i * 420, y: 260 },
        data: { label: ent.name, isWeak: ent.isWeak ?? false },
        className: 'group',
      })
      const attrCount = ent.attributes.length
      ent.attributes.forEach((attr, j) => {
        const angle = (j / Math.max(attrCount, 1)) * Math.PI * 2
        const radius = 140
        const ex = ent.position?.x ?? (150 + i * 420)
        const ey = ent.position?.y ?? 260
        // Use saved position if present (user dragged it), else circular fallback
        const attrPos = attr.position ?? { x: ex + Math.cos(angle) * radius, y: ey + Math.sin(angle) * radius - 20 }
        initialNodes.push({
          id: attr.id,
          type: 'classicAttribute',
          position: attrPos,
          data: { label: attr.name, isPrimary: attr.isPrimary ?? false, isForeign: attr.isForeign ?? false, isMultiValued: attr.isMultiValued ?? false, isNullable: attr.isNullable ?? false, dataType: attr.type ?? 'VARCHAR' },
          className: 'group',
        })
        initialEdges.push({ id: `ea-${ent.id}-${attr.id}`, source: ent.id, target: attr.id, type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 1.5 }, animated: false })
      })
    })

    relationships.forEach(rel => {
      const src = entities.find(e => e.id === rel.source)
      const tgt = entities.find(e => e.id === rel.target)
      const rx = src && tgt ? ((src.position?.x ?? 0) + (tgt.position?.x ?? 0)) / 2 : 360
      const ry = src && tgt ? ((src.position?.y ?? 0) + (tgt.position?.y ?? 0)) / 2 - 30 : 260
      initialNodes.push({
        id: rel.id,
        type: 'classicRelationship',
        position: { x: rx, y: ry },
        data: { label: rel.label ?? 'Relation' },
        className: 'group',
      })
      const cards = rel.cardinality?.split(':') ?? ['1', 'N']
      initialEdges.push({ id: `er1-${rel.id}`, source: rel.source, target: rel.id, type: 'smoothstep', label: cards[0], labelStyle: { fill: '#64748b', fontWeight: 600, fontSize: 12 }, style: { stroke: '#94a3b8', strokeWidth: 2 } })
      initialEdges.push({ id: `er2-${rel.id}`, source: rel.id, target: rel.target, type: 'smoothstep', label: cards[1], labelStyle: { fill: '#64748b', fontWeight: 600, fontSize: 12 }, style: { stroke: '#94a3b8', strokeWidth: 2 } })
    })

    setNodes(initialNodes)
    setEdges(initialEdges)
    setIsDirty(false)
  }, [erDiagramEditorOpen, activeDiagram, setNodes, setEdges])

  // Callbacks
  const deleteNode = useCallback((id: string) => {
    setNodes(ns => ns.filter(n => n.id !== id))
    setEdges(es => es.filter(e => e.source !== id && e.target !== id))
    markDirty()
  }, [setNodes, setEdges])

  const renameNode = useCallback((id: string, newLabel: string) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n))
    markDirty()
  }, [setNodes])

  const toggleWeakEntity = useCallback((id: string) => {
    setNodes(ns => ns.map(n =>
      n.id === id && n.type === 'classicEntity'
        ? { ...n, data: { ...n.data, isWeak: !n.data.isWeak } }
        : n
    ))
    markDirty()
  }, [setNodes])

  const openAttrDialog = useCallback((entityId: string) => {
    setTargetEntityId(entityId); setAttrDialogOpen(true)
  }, [])

  const openEditAttrDialog = useCallback((attrId: string) => {
    setNodes(ns => {
      const node = ns.find(n => n.id === attrId && n.type === 'classicAttribute')
      if (node) {
        setEditAttrInitial({
          id: attrId,
          name: node.data.label,
          dataType: node.data.dataType ?? 'VARCHAR',
          isPrimary: node.data.isPrimary ?? false,
          isForeign: node.data.isForeign ?? false,
          isMultiValued: node.data.isMultiValued ?? false,
          isNullable: node.data.isNullable ?? false,
        })
        setEditAttrDialogOpen(true)
      }
      return ns // no mutation
    })
  }, [setNodes])

  const saveEditedAttribute = useCallback((updated: EditAttrInitial) => {
    setNodes(ns => ns.map(n =>
      n.id === updated.id && n.type === 'classicAttribute'
        ? { ...n, data: { ...n.data, label: updated.name, dataType: updated.dataType, isPrimary: updated.isPrimary, isForeign: updated.isForeign, isMultiValued: updated.isMultiValued, isNullable: updated.isNullable } }
        : n
    ))
    markDirty()
  }, [setNodes])

  const patchedNodes = nodes.map(n => ({
    ...n,
    data: { ...n.data, onDelete: deleteNode, onAddAttr: openAttrDialog, onRename: renameNode, onToggleWeak: toggleWeakEntity, onEdit: openEditAttrDialog },
  }))

  const onConnect = useCallback((params: Connection) =>
    setEdges(es => { markDirty(); return addEdge({ ...params, type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 2 } }, es) }),
    [setEdges])

  const addEntity = () => {
    const id = generateId()
    setNodes(ns => [...ns, {
      id, type: 'classicEntity',
      position: { x: 80 + Math.random() * 400, y: 80 + Math.random() * 260 },
      data: { label: `Entity_${ns.filter(n => n.type === 'classicEntity').length + 1}` },
      className: 'group',
    }])
    markDirty()
  }

  const addRelationship = () => {
    const id = generateId()
    setNodes(ns => [...ns, {
      id, type: 'classicRelationship',
      position: { x: 280 + Math.random() * 200, y: 180 + Math.random() * 120 },
      data: { label: 'Relation' },
      className: 'group',
    }])
    markDirty()
  }

  const saveAttribute = (attr: ERAttribute) => {
    if (!targetEntityId) return
    const entityNode = nodes.find(n => n.id === targetEntityId)
    if (!entityNode) return
    setNodes(ns => [...ns, {
      id: attr.id, type: 'classicAttribute',
      position: { x: entityNode.position.x + 130, y: entityNode.position.y - 70 },
      data: { label: attr.name, isPrimary: attr.isPrimary ?? false, isForeign: false, isMultiValued: attr.isMultiValued ?? false, isNullable: false, dataType: attr.type ?? 'VARCHAR' },
      className: 'group',
    }])
    setEdges(es => [...es, { id: `ea-${targetEntityId}-${attr.id}`, source: targetEntityId, target: attr.id, type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 1.5 } }])
    setAttrDialogOpen(false)
    markDirty()
  }

  // Build payload
  const buildPayload = () => {
    const entities: EREntity[] = nodes.filter(n => n.type === 'classicEntity').map(n => ({
      id: n.id, name: n.data.label, position: n.position, isWeak: n.data.isWeak ?? false,
      attributes: edges.filter(e => e.source === n.id)
        .map(e => nodes.find(an => an.id === e.target && an.type === 'classicAttribute'))
        .filter((an): an is Node => Boolean(an))
        .map(an => ({ id: an.id, name: an.data.label, type: an.data.dataType ?? 'VARCHAR', isPrimary: an.data.isPrimary ?? false, isForeign: an.data.isForeign ?? false, isMultiValued: an.data.isMultiValued ?? false, isNullable: an.data.isNullable ?? false, position: an.position }))
    }))
    const relationships: ERRelationship[] = nodes.filter(n => n.type === 'classicRelationship').map(n => {
      const inEdge = edges.find(e => e.target === n.id)
      const outEdge = edges.find(e => e.source === n.id)
      return { id: n.id, source: inEdge?.source ?? '', target: outEdge?.target ?? '', label: n.data.label, cardinality: `${inEdge?.label ?? '1'}:${outEdge?.label ?? 'N'}` }
    })
    return { entities, relationships }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { entities, relationships } = buildPayload()
      
      // We don't necessarily have to block on backend save if it's offline,
      // but let's try.
      try {
        await saveERDiagram({ entities, relationships, sessionId })
      } catch (e) {
        console.warn('Backend save failed or offline', e)
        // We still proceed to update the local UI store below
      }

      // Try to capture a snapshot of the current canvas to update the chat bubble preview
      let snapshotData = '{}'
      let finalType: 'png' | 'json' | 'svg' = 'json'
      try {
        if (reactFlowWrapperRef.current) {
          const flowEl = reactFlowWrapperRef.current.querySelector('.react-flow__viewport') as HTMLElement | null
          if (flowEl) {
            const dataUrl = await toPng(flowEl, { 
              backgroundColor: 'transparent', 
              pixelRatio: 2,
              style: {
                transform: 'translate(0, 0) scale(1)' // Temporarily reset transform for clean snapshot
              }
            })
            snapshotData = dataUrl.split(',')[1] // remove data:image/png;base64,
            finalType = 'png'
          }
        }
      } catch (e) {
        console.warn('Could not generate canvas snapshot', e)
        finalType = 'json'
      }

      // Update the global store message so the chat reflects the changes
      const newDiagramData = {
        type: finalType,
        data: snapshotData,
        entities,
        relationships,
      } as const

      if (activeDiagramMessageId) {
        useAppStore.getState().updateMessage(activeDiagramMessageId, {
          erDiagram: newDiagramData,
        })
      }
      
      // Update the active diagram so if they re-open, it has latest
      useAppStore.getState().setActiveDiagram(newDiagramData, activeDiagramMessageId ?? undefined)

      setIsDirty(false)
      toast({ title: '✓ Diagram saved', variant: 'success' })
    } catch (err) {
      toast({ title: 'Save failed', description: 'An error occurred.', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  // ─── Client-side export (no Graphviz needed) ──────────────────────────────
  const handleExport = async (format: 'svg' | 'png' | 'json') => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' })
      downloadBlob(blob, 'er_diagram.json')
      toast({ title: '✓ Exported as JSON', variant: 'success' })
      return
    }

    const flowEl = reactFlowWrapperRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!flowEl) return

    const nodesBounds = getRectOfNodes(nodes)
    const transform = getTransformForBounds(nodesBounds, nodesBounds.width + 80, nodesBounds.height + 80, 0.5, 2)

    try {
      let blob: Blob
      if (format === 'svg') {
        const dataUrl = await toPng(flowEl, { backgroundColor: '#ffffff', pixelRatio: 2 })
        // Wrap PNG in an SVG container for SVG download
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${nodesBounds.width + 80}" height="${nodesBounds.height + 80}"><image href="${dataUrl}" width="100%" height="100%"/></svg>`
        blob = new Blob([svgContent], { type: 'image/svg+xml' })
        downloadBlob(blob, 'er_diagram.svg')
      } else {
        const dataUrl = await toPng(flowEl, { backgroundColor: '#ffffff', pixelRatio: 2 })
        blob = dataURLToBlob(dataUrl)
        downloadBlob(blob, 'er_diagram.png')
      }
      toast({ title: `✓ Exported as ${format.toUpperCase()}`, variant: 'success' })
    } catch (e) {
      toast({ title: 'Export failed', description: String(e), variant: 'destructive' })
    }
  }

  const requestClose = () => {
    if (isDirty) { setUnsavedDialogOpen(true) } else { setERDiagramEditorOpen(false) }
  }

  return (
    <>
      <div className={cn(
        'fixed inset-0 z-50 flex flex-col transition-all duration-300 ease-out bg-background/95 backdrop-blur-md',
        erDiagramEditorOpen ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-[0.98]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-md shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                ER Diagram Editor
                {isDirty && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">● Unsaved</span>}
              </h2>
              <p className="text-[10px] text-muted-foreground">Double-click attribute ovals to edit · Hover entity nodes to add attrs, toggle weak, or delete</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={addEntity} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> Entity
            </Button>
            <Button size="sm" variant="outline" onClick={addRelationship} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> Relation
            </Button>

            {/* Export buttons */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden ml-2">
              {(['svg', 'png', 'json'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className="px-2.5 py-1.5 text-xs hover:bg-muted transition-colors border-r border-border last:border-0 font-semibold uppercase flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />{fmt}
                </button>
              ))}
            </div>

            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-8 ml-1">
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={requestClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={reactFlowWrapperRef} className="flex-1 relative bg-white">
          <ReactFlow
            nodes={patchedNodes}
            edges={edges}
            onNodesChange={e => { onNodesChange(e); if (e.some(c => c.type !== 'select')) markDirty() }}
            onEdgesChange={e => { onEdgesChange(e); markDirty() }}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            deleteKeyCode="Delete"
            proOptions={{ hideAttribution: true }}
            className="bg-slate-50 dark:bg-zinc-950"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
            <Controls className="!bg-white dark:!bg-zinc-800 !border-zinc-200 dark:!border-zinc-700 !shadow-sm !rounded-md overflow-hidden [&>button]:!border-b-zinc-200 dark:[&>button]:!border-b-zinc-700 [&>button]:!text-zinc-600 dark:[&>button]:!text-zinc-300 hover:[&>button]:!bg-zinc-50 dark:hover:[&>button]:!bg-zinc-700" />
            <Panel position="bottom-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border text-xs text-muted-foreground shadow-lg">
                <span>{nodes.filter(n => n.type === 'classicEntity' && !n.data.isWeak).length} entities</span>
                <span>·</span>
                <span>{nodes.filter(n => n.type === 'classicEntity' && n.data.isWeak).length > 0 && <>{nodes.filter(n => n.type === 'classicEntity' && n.data.isWeak).length} weak ·</>}</span>
                <span>{nodes.filter(n => n.type === 'classicRelationship').length} relationships</span>
                <span>·</span>
                <span>{nodes.filter(n => n.type === 'classicAttribute').length} attributes</span>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      <AttrDialog open={attrDialogOpen} onClose={() => setAttrDialogOpen(false)} onSave={saveAttribute} />
      <UnsavedDialog
        open={unsavedDialogOpen}
        onSave={async () => { await handleSave(); setUnsavedDialogOpen(false); setERDiagramEditorOpen(false) }}
        onDiscard={() => { setUnsavedDialogOpen(false); setIsDirty(false); setERDiagramEditorOpen(false) }}
        onCancel={() => setUnsavedDialogOpen(false)}
      />
      <EditAttrDialog
        open={editAttrDialogOpen}
        initial={editAttrInitial}
        onClose={() => setEditAttrDialogOpen(false)}
        onSave={saveEditedAttribute}
      />
    </>
  )
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function dataURLToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)![1]
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
