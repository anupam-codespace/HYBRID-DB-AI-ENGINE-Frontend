import { useCallback, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Plus,
  Save,
  Download,
  Trash2,
  X,
  Table2,
  Tag,
  Key,
  Link,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/appStore'
import { saveERDiagram, exportERDiagram } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type { EREntity, ERRelationship, ERAttribute } from '@/lib/api'
import { generateId, cn } from '@/lib/utils'

// ─── Custom ER Entity Node ────────────────────────────────────────────────────

interface EntityNodeData {
  label: string
  attributes: ERAttribute[]
  onDelete: (id: string) => void
  onAddAttr: (entityId: string) => void
}

function EntityNode({ id, data }: { id: string; data: EntityNodeData }) {
  return (
    <div className="min-w-[160px] rounded-xl border-2 border-primary bg-card shadow-lg overflow-hidden select-none">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5 text-white" />
          <span className="text-white font-semibold text-sm">{data.label}</span>
        </div>
        <button
          onClick={() => data.onDelete(id)}
          className="text-white/70 hover:text-white transition-colors p-0.5 rounded"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {/* Attributes */}
      <div className="divide-y divide-border">
        {data.attributes.map((attr) => (
          <div key={attr.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
            {attr.isPrimary && (
              <Key className="h-3 w-3 text-yellow-500 flex-shrink-0" title="Primary Key" />
            )}
            {attr.isForeign && (
              <Link className="h-3 w-3 text-blue-500 flex-shrink-0" title="Foreign Key" />
            )}
            <span className={cn('flex-1', attr.isPrimary && 'font-semibold underline')}>
              {attr.name}
            </span>
            <Badge variant="outline" className="text-[9px] py-0 h-4">
              {attr.type}
            </Badge>
          </div>
        ))}
      </div>
      {/* Add attribute */}
      <button
        onClick={() => data.onAddAttr(id)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors border-t border-border"
      >
        <Plus className="h-2.5 w-2.5" />
        Add attribute
      </button>
    </div>
  )
}

const nodeTypes = { entity: EntityNode }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function entitiesToNodes(entities: EREntity[]): Node[] {
  return entities.map((e, i) => ({
    id: e.id,
    type: 'entity',
    position: e.position ?? { x: 80 + i * 240, y: 80 + (i % 3) * 200 },
    data: {
      label: e.name,
      attributes: e.attributes,
      onDelete: () => {},   // wired in component
      onAddAttr: () => {},
    },
  }))
}

function relationshipsToEdges(rels: ERRelationship[]): Edge[] {
  return rels.map((r) => ({
    id: r.id,
    source: r.source,
    target: r.target,
    label: r.label ?? r.cardinality,
    animated: false,
    style: { stroke: 'hsl(221.2 83.2% 53.3%)', strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: 'currentColor' },
  }))
}

// ─── Attribute Edit Dialog ────────────────────────────────────────────────────

function AttrDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (attr: ERAttribute) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('VARCHAR')
  const [isPrimary, setIsPrimary] = useState(false)
  const [isForeign, setIsForeign] = useState(false)
  const [isNullable, setIsNullable] = useState(true)

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ id: generateId(), name: name.trim(), type, isPrimary, isForeign, isNullable })
    setName(''); setType('VARCHAR'); setIsPrimary(false); setIsForeign(false); setIsNullable(true)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Attribute</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Attribute Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="e.g. user_id"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {['INT','BIGINT','VARCHAR','TEXT','BOOLEAN','DATE','TIMESTAMP','FLOAT','DECIMAL','UUID'].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4">
            {[
              { label: '🔑 Primary Key', state: isPrimary, set: setIsPrimary },
              { label: '🔗 Foreign Key', state: isForeign, set: setIsForeign },
              { label: 'Nullable', state: isNullable, set: setIsNullable },
            ].map(({ label, state, set }) => (
              <label key={label} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={state}
                  onChange={(e) => set(e.target.checked)}
                  className="accent-primary"
                />
                {label}
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

// ─── Main Canvas Editor ───────────────────────────────────────────────────────

export function ERDiagramCanvasEditor() {
  const { erDiagramEditorOpen, setERDiagramEditorOpen, activeDiagram, sessionId } = useAppStore()
  const { toast } = useToast()

  const initialEntities: EREntity[] = activeDiagram?.entities ?? []
  const initialRelationships: ERRelationship[] = activeDiagram?.relationships ?? []

  const [nodes, setNodes, onNodesChange] = useNodesState(entitiesToNodes(initialEntities))
  const [edges, setEdges, onEdgesChange] = useEdgesState(relationshipsToEdges(initialRelationships))
  const [saving, setSaving] = useState(false)
  const [attrDialogOpen, setAttrDialogOpen] = useState(false)
  const [targetEntityId, setTargetEntityId] = useState<string | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // Wire delete + addAttr callbacks into node data
  const deleteNode = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
  }, [setNodes, setEdges])

  const openAttrDialog = useCallback((entityId: string) => {
    setTargetEntityId(entityId)
    setAttrDialogOpen(true)
  }, [])

  // Patch callbacks into every node's data
  const patchedNodes = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onDelete: deleteNode, onAddAttr: openAttrDialog },
  }))

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((es) =>
        addEdge(
          {
            ...params,
            animated: false,
            style: { stroke: 'hsl(221.2 83.2% 53.3%)', strokeWidth: 1.5 },
          },
          es
        )
      ),
    [setEdges]
  )

  // Add new entity
  const addEntity = () => {
    const id = generateId()
    const name = `Entity_${nodes.length + 1}`
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'entity',
        position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
        data: { label: name, attributes: [], onDelete: deleteNode, onAddAttr: openAttrDialog },
      },
    ])
  }

  // Save attribute to target entity
  const saveAttribute = (attr: ERAttribute) => {
    if (!targetEntityId) return
    setNodes((ns) =>
      ns.map((n) =>
        n.id === targetEntityId
          ? { ...n, data: { ...n.data, attributes: [...n.data.attributes, attr] } }
          : n
      )
    )
  }

  // Save to backend
  const handleSave = async () => {
    setSaving(true)
    try {
      const entities: EREntity[] = nodes.map((n) => ({
        id: n.id,
        name: n.data.label as string,
        attributes: (n.data.attributes as ERAttribute[]) ?? [],
        position: n.position,
      }))
      const relationships: ERRelationship[] = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label as string | undefined,
      }))
      await saveERDiagram({ entities, relationships, sessionId })
      toast({ title: 'Diagram saved', variant: 'success' })
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Export as SVG/PNG/JSON
  const handleExport = async (format: 'svg' | 'png' | 'json') => {
    try {
      const entities: EREntity[] = nodes.map((n) => ({
        id: n.id,
        name: n.data.label as string,
        attributes: (n.data.attributes as ERAttribute[]) ?? [],
        position: n.position,
      }))
      const relationships: ERRelationship[] = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }))
      const blob = await exportERDiagram({ entities, relationships, format })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `er_diagram.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: `Exported as .${format}`, variant: 'success' })
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  if (!erDiagramEditorOpen) return null

  return (
    <>
      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Tag className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">ER Diagram Editor</h2>
              <p className="text-[10px] text-muted-foreground">
                Drag to move · Connect handles to create relationships · Double-click to rename
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Add entity */}
            <Button size="sm" variant="outline" onClick={addEntity} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" />
              Add Entity
            </Button>

            {/* Export menu */}
            <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
              {(['svg', 'png', 'json'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className="px-2.5 py-1.5 text-xs hover:bg-muted transition-colors border-r border-border last:border-0 font-medium uppercase"
                >
                  {fmt}
                </button>
              ))}
            </div>

            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-8">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg"
              onClick={() => setERDiagramEditorOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={patchedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode="Delete"
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeColor={() => 'hsl(221.2 83.2% 53.3%)'}
              maskColor="hsl(222.2 84% 4.9% / 0.5)"
              className="!border-border !rounded-xl !bg-card"
            />
            <Panel position="bottom-center">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border text-xs text-muted-foreground shadow">
                <span>{nodes.length} entities</span>
                <span>·</span>
                <span>{edges.length} relationships</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Trash2 className="h-3 w-3" />
                  Del to delete selected
                </span>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Attribute dialog */}
      <AttrDialog
        open={attrDialogOpen}
        onClose={() => setAttrDialogOpen(false)}
        onSave={saveAttribute}
      />
    </>
  )
}
