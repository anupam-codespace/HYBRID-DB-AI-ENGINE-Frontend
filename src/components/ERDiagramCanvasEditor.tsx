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
import { Plus, Save, X, Tag, Download, AlertTriangle } from 'lucide-react'
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
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onChange(trimmed)
    else setDraft(value)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value) } }}
        className={cn('bg-transparent border-b border-black outline-none text-center font-bold w-full', className)}
        style={{ minWidth: 60 }}
      />
    )
  }
  return (
    <span
      onDoubleClick={() => setEditing(true)}
      title="Double-click to rename"
      className={cn('cursor-text select-none', className)}
    >
      {value}
    </span>
  )
}

// ─── Custom Classic ER Nodes ──────────────────────────────────────────────────
function ClassicEntityNode({ id, data }: { id: string; data: any }) {
  return (
    <div className="relative bg-white border-2 border-black min-w-[130px] px-6 py-3 font-bold text-black text-center shadow-none group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <InlineLabel value={data.label} onChange={v => data.onRename(id, v)} />
      <button
        onClick={e => { e.stopPropagation(); data.onAddAttr(id) }}
        className="absolute -bottom-3 -right-3 bg-white border border-black rounded-full p-1 shadow-sm hover:bg-gray-100 transition-colors z-10 opacity-0 group-hover:opacity-100"
        title="Add Attribute"
      >
        <Plus className="h-3 w-3 text-black" />
      </button>
      <button
        onClick={e => { e.stopPropagation(); data.onDelete(id) }}
        className="absolute -top-3 -right-3 bg-red-500 border border-black rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors z-10 opacity-0 group-hover:opacity-100"
        title="Delete Entity"
      >
        <X className="h-3 w-3 text-white" />
      </button>
    </div>
  )
}

function ClassicRelationshipNode({ id, data }: { id: string; data: any }) {
  return (
    <div className="relative bg-white border-2 border-black w-28 h-28 flex items-center justify-center font-bold text-black transform rotate-45 shadow-none group">
      <div className="transform -rotate-45 flex flex-col items-center gap-0.5 px-2">
        <InlineLabel value={data.label} onChange={v => data.onRename(id, v)} className="text-sm" />
      </div>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <button
        onClick={e => { e.stopPropagation(); data.onDelete(id) }}
        className="absolute -top-2 -right-2 transform -rotate-45 bg-red-500 border border-black rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors z-10 opacity-0 group-hover:opacity-100"
        title="Delete Relationship"
      >
        <X className="h-2 w-2 text-white" />
      </button>
    </div>
  )
}

function ClassicAttributeNode({ id, data }: { id: string; data: any }) {
  return (
    <div className={cn(
      'relative bg-white rounded-[50%] px-4 py-2 font-bold text-black text-xs text-center shadow-none min-w-[90px] group',
      data.isMultiValued ? 'border-[4px] border-double border-black' : 'border-2 border-black'
    )}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      {data.isPrimary
        ? <u className="underline underline-offset-2"><InlineLabel value={data.label} onChange={v => data.onRename(id, v)} /></u>
        : <InlineLabel value={data.label} onChange={v => data.onRename(id, v)} />
      }
      <button
        onClick={e => { e.stopPropagation(); data.onDelete(id) }}
        className="absolute -top-2 -right-2 bg-red-500 border border-black rounded-full p-0.5 shadow-sm hover:bg-red-600 transition-colors z-10 opacity-0 group-hover:opacity-100"
        title="Delete Attribute"
      >
        <X className="h-2.5 w-2.5 text-white" />
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
function AttrDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (a: ERAttribute) => void }) {
  const [name, setName] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [isMultiValued, setIsMultiValued] = useState(false)

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ id: generateId(), name: name.trim(), type: 'VARCHAR', isPrimary, isMultiValued })
    setName(''); setIsPrimary(false); setIsMultiValued(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Attribute</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="e.g. student_name"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-4">
            {[['Primary Key', isPrimary, setIsPrimary] as const, ['Multi-Valued', isMultiValued, setIsMultiValued] as const].map(([lbl, val, set]) => (
              <label key={lbl} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={val} onChange={e => (set as any)(e.target.checked)} className="accent-primary" />
                {lbl}
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="flex-1" onClick={handleSave}>Add</Button>
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
  const { erDiagramEditorOpen, setERDiagramEditorOpen, activeDiagram, sessionId } = useAppStore()
  const { toast } = useToast()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [attrDialogOpen, setAttrDialogOpen] = useState(false)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)
  const [targetEntityId, setTargetEntityId] = useState<string | null>(null)
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
        data: { label: ent.name },
        className: 'group',
      })
      const attrCount = ent.attributes.length
      ent.attributes.forEach((attr, j) => {
        const angle = (j / Math.max(attrCount, 1)) * Math.PI * 2
        const radius = 140
        const ex = ent.position?.x ?? (150 + i * 420)
        const ey = ent.position?.y ?? 260
        initialNodes.push({
          id: attr.id,
          type: 'classicAttribute',
          position: { x: ex + Math.cos(angle) * radius, y: ey + Math.sin(angle) * radius - 20 },
          data: { label: attr.name, isPrimary: attr.isPrimary, isMultiValued: attr.isMultiValued },
          className: 'group',
        })
        initialEdges.push({ id: `ea-${ent.id}-${attr.id}`, source: ent.id, target: attr.id, type: 'straight', style: { stroke: '#000', strokeWidth: 1 } })
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
      initialEdges.push({ id: `er1-${rel.id}`, source: rel.source, target: rel.id, type: 'straight', label: cards[0], style: { stroke: '#000', strokeWidth: 1.5 } })
      initialEdges.push({ id: `er2-${rel.id}`, source: rel.id, target: rel.target, type: 'straight', label: cards[1], style: { stroke: '#000', strokeWidth: 1.5 } })
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

  const openAttrDialog = useCallback((entityId: string) => {
    setTargetEntityId(entityId); setAttrDialogOpen(true)
  }, [])

  const patchedNodes = nodes.map(n => ({
    ...n,
    data: { ...n.data, onDelete: deleteNode, onAddAttr: openAttrDialog, onRename: renameNode },
  }))

  const onConnect = useCallback((params: Connection) =>
    setEdges(es => { markDirty(); return addEdge({ ...params, type: 'straight', style: { stroke: '#000', strokeWidth: 1.5 } }, es) }),
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
      data: { label: attr.name, isPrimary: attr.isPrimary, isMultiValued: attr.isMultiValued },
      className: 'group',
    }])
    setEdges(es => [...es, { id: `ea-${targetEntityId}-${attr.id}`, source: targetEntityId, target: attr.id, type: 'straight', style: { stroke: '#000', strokeWidth: 1 } }])
    setAttrDialogOpen(false)
    markDirty()
  }

  // Build payload
  const buildPayload = () => {
    const entities: EREntity[] = nodes.filter(n => n.type === 'classicEntity').map(n => ({
      id: n.id, name: n.data.label, position: n.position,
      attributes: edges.filter(e => e.source === n.id)
        .map(e => nodes.find(an => an.id === e.target && an.type === 'classicAttribute'))
        .filter((an): an is Node => Boolean(an))
        .map(an => ({ id: an.id, name: an.data.label, type: 'VARCHAR', isPrimary: an.data.isPrimary, isMultiValued: an.data.isMultiValued }))
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
      await saveERDiagram({ entities, relationships, sessionId })
      setIsDirty(false)
      toast({ title: '✓ Diagram saved', variant: 'success' })
    } catch {
      toast({ title: 'Save failed', description: 'Could not reach backend.', variant: 'destructive' })
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
        const dataUrl = await toSvg(reactFlowWrapperRef.current!, { backgroundColor: '#ffffff' })
        blob = dataURLToBlob(dataUrl)
        downloadBlob(blob, 'er_diagram.svg')
      } else {
        const dataUrl = await toPng(reactFlowWrapperRef.current!, { backgroundColor: '#ffffff', pixelRatio: 2 })
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
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Tag className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                ER Diagram Editor
                {isDirty && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">● Unsaved</span>}
              </h2>
              <p className="text-[10px] text-muted-foreground">Double-click any label to rename · Hover nodes to add attrs or delete</p>
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
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e5e5e5" />
            <Controls className="!bg-white !border-black !shadow-sm" />
            <Panel position="bottom-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border text-xs text-muted-foreground shadow-lg">
                <span>{nodes.filter(n => n.type === 'classicEntity').length} entities</span>
                <span>·</span>
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
