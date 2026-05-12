import { useCallback, useRef, useState, useEffect } from 'react'
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
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Plus, Save, Trash2, X, Tag } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import { saveERDiagram, exportERDiagram } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type { EREntity, ERRelationship, ERAttribute } from '@/lib/api'
import { generateId, cn } from '@/lib/utils'

// ─── Custom Classic ER Nodes ──────────────────────────────────────────────────

function ClassicEntityNode({ id, data }: { id: string; data: any }) {
  return (
    <div className="relative bg-[#74b84b] border-[1.5px] border-black min-w-[120px] px-6 py-3 font-bold text-black text-center shadow-sm">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      {data.label}
      <button
        onClick={(e) => { e.stopPropagation(); data.onAddAttr(id); }}
        className="absolute -bottom-3 -right-3 bg-white border border-black rounded-full p-1 shadow-sm hover:bg-gray-100 transition-colors z-10 opacity-0 group-hover:opacity-100"
        title="Add Attribute"
      >
        <Plus className="h-3 w-3 text-black" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
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
    <div className="relative bg-[#ff9b21] border-[1.5px] border-black w-24 h-24 flex items-center justify-center font-bold text-black transform rotate-45 shadow-sm">
      <div className="transform -rotate-45">{data.label}</div>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <button
        onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
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
    <div className="relative bg-[#48d1cc] border-[1.5px] border-black rounded-[50%] px-4 py-2 font-semibold text-black text-xs text-center shadow-sm min-w-[70px]">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      {data.isPrimary ? <u className="underline underline-offset-2">{data.label}</u> : data.label}
      <button
        onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
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
          <div className="flex gap-4 pt-2">
            {[
              { label: 'Primary Key', state: isPrimary, set: setIsPrimary },
              { label: 'Foreign Key', state: isForeign, set: setIsForeign },
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
          <div className="flex gap-2 pt-2">
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

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [saving, setSaving] = useState(false)
  const [attrDialogOpen, setAttrDialogOpen] = useState(false)
  const [targetEntityId, setTargetEntityId] = useState<string | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // Build classic graph from active diagram JSON
  useEffect(() => {
    if (!erDiagramEditorOpen || !activeDiagram) return

    const initialNodes: Node[] = []
    const initialEdges: Edge[] = []
    
    const entities = activeDiagram.entities ?? []
    const relationships = activeDiagram.relationships ?? []

    entities.forEach((ent, i) => {
      // Entity Node
      initialNodes.push({
        id: ent.id,
        type: 'classicEntity',
        position: ent.position ?? { x: 200 + i * 400, y: 300 },
        data: { label: ent.name },
        className: 'group',
      })

      // Attribute Nodes
      const attrCount = ent.attributes.length
      ent.attributes.forEach((attr, j) => {
        const angle = (j / attrCount) * Math.PI * 2
        const radius = 130
        const ex = ent.position?.x ?? (200 + i * 400)
        const ey = ent.position?.y ?? 300
        
        initialNodes.push({
          id: attr.id,
          type: 'classicAttribute',
          position: { x: ex + Math.cos(angle) * radius, y: ey + Math.sin(angle) * radius - 20 },
          data: { label: attr.name, isPrimary: attr.isPrimary },
          className: 'group',
        })

        // Edge entity to attribute
        initialEdges.push({
          id: `e-${ent.id}-${attr.id}`,
          source: ent.id,
          target: attr.id,
          type: 'straight',
          style: { stroke: '#000', strokeWidth: 1 },
        })
      })
    })

    relationships.forEach((rel) => {
      const src = entities.find(e => e.id === rel.source)
      const tgt = entities.find(e => e.id === rel.target)
      let rx = 400, ry = 300
      if (src && tgt) {
         rx = ((src.position?.x ?? 0) + (tgt.position?.x ?? 0)) / 2 + 20
         ry = ((src.position?.y ?? 0) + (tgt.position?.y ?? 0)) / 2 - 20
      }

      initialNodes.push({
        id: rel.id,
        type: 'classicRelationship',
        position: { x: rx, y: ry },
        data: { label: rel.label ?? 'Relation' },
        className: 'group',
      })

      const cards = rel.cardinality ? rel.cardinality.split(':') : ['1', 'N']
      
      initialEdges.push({
        id: `e-${rel.source}-${rel.id}`,
        source: rel.source,
        target: rel.id,
        label: cards[0],
        type: 'straight',
        style: { stroke: '#000', strokeWidth: 1.5 },
        labelStyle: { fill: '#d32f2f', fontWeight: 'bold', fontSize: 14 },
        labelBgStyle: { fill: 'transparent' }
      })

      initialEdges.push({
        id: `e-${rel.id}-${rel.target}`,
        source: rel.id,
        target: rel.target,
        label: cards[1] ?? 'N',
        type: 'straight',
        style: { stroke: '#000', strokeWidth: 1.5 },
        labelStyle: { fill: '#d32f2f', fontWeight: 'bold', fontSize: 14 },
        labelBgStyle: { fill: 'transparent' }
      })
    })

    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [erDiagramEditorOpen, activeDiagram, setNodes, setEdges])

  const deleteNode = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
  }, [setNodes, setEdges])

  const openAttrDialog = useCallback((entityId: string) => {
    setTargetEntityId(entityId)
    setAttrDialogOpen(true)
  }, [])

  // Patch callbacks into nodes dynamically so closures remain fresh
  const patchedNodes = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onDelete: deleteNode, onAddAttr: openAttrDialog },
  }))

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((es) =>
        addEdge({ ...params, animated: false, style: { stroke: '#000', strokeWidth: 1.5 } }, es)
      ),
    [setEdges]
  )

  const addEntity = () => {
    const id = generateId()
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'classicEntity',
        position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
        data: { label: `Entity_${ns.filter(n=>n.type==='classicEntity').length + 1}` },
        className: 'group',
      },
    ])
  }

  const addRelationship = () => {
    const id = generateId()
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'classicRelationship',
        position: { x: 300 + Math.random() * 200, y: 300 + Math.random() * 100 },
        data: { label: `Relation` },
        className: 'group',
      },
    ])
  }

  const saveAttribute = (attr: ERAttribute) => {
    if (!targetEntityId) return
    const entityNode = nodes.find(n => n.id === targetEntityId)
    if (!entityNode) return

    const attrNodeId = attr.id
    setNodes((ns) => [
      ...ns,
      {
        id: attrNodeId,
        type: 'classicAttribute',
        position: { x: entityNode.position.x + 120, y: entityNode.position.y - 60 },
        data: { label: attr.name, isPrimary: attr.isPrimary },
        className: 'group',
      }
    ])

    setEdges((es) => [
      ...es,
      {
        id: `e-${targetEntityId}-${attrNodeId}`,
        source: targetEntityId,
        target: attrNodeId,
        type: 'straight',
        style: { stroke: '#000', strokeWidth: 1 },
      }
    ])
    setAttrDialogOpen(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Reconstruct entities from classic nodes format
      const entities: EREntity[] = nodes.filter(n => n.type === 'classicEntity').map(n => {
        const connectedEdges = edges.filter(e => e.source === n.id)
        const attributes = connectedEdges
          .map(e => nodes.find(an => an.id === e.target && an.type === 'classicAttribute'))
          .filter((an): an is Node => Boolean(an))
          .map(an => ({
            id: an.id,
            name: an.data.label,
            type: 'VARCHAR',
            isPrimary: an.data.isPrimary
          }))
        return {
          id: n.id,
          name: n.data.label,
          position: n.position,
          attributes
        }
      })
      
      const relationships: ERRelationship[] = nodes.filter(n => n.type === 'classicRelationship').map(n => {
        const inEdge = edges.find(e => e.target === n.id)
        const outEdge = edges.find(e => e.source === n.id)
        return {
          id: n.id,
          source: inEdge?.source ?? '',
          target: outEdge?.target ?? '',
          label: n.data.label,
          cardinality: `${inEdge?.label ?? '1'}:${outEdge?.label ?? 'N'}`
        }
      })

      await saveERDiagram({ entities, relationships, sessionId })
      toast({ title: 'Diagram saved', variant: 'success' })
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Export as SVG/PNG/JSON
  const handleExport = async (format: 'svg' | 'png' | 'json') => {
    try {
      const entities: EREntity[] = nodes.filter(n => n.type === 'classicEntity').map(n => {
        const connectedEdges = edges.filter(e => e.source === n.id)
        const attributes = connectedEdges
          .map(e => nodes.find(an => an.id === e.target && an.type === 'classicAttribute'))
          .filter((an): an is Node => Boolean(an))
          .map(an => ({
            id: an.id,
            name: an.data.label,
            type: 'VARCHAR',
            isPrimary: an.data.isPrimary
          }))
        return {
          id: n.id,
          name: n.data.label,
          position: n.position,
          attributes
        }
      })
      
      const relationships: ERRelationship[] = nodes.filter(n => n.type === 'classicRelationship').map(n => {
        const inEdge = edges.find(e => e.target === n.id)
        const outEdge = edges.find(e => e.source === n.id)
        return {
          id: n.id,
          source: inEdge?.source ?? '',
          target: outEdge?.target ?? '',
          label: n.data.label,
          cardinality: `${inEdge?.label ?? '1'}:${outEdge?.label ?? 'N'}`
        }
      })
      
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

  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 z-50 flex flex-col transition-all duration-300 ease-out bg-background/95 backdrop-blur-md",
          erDiagramEditorOpen ? "opacity-100 pointer-events-auto scale-100" : "opacity-0 pointer-events-none scale-[0.98]"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-md shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Tag className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Classic ER Diagram Editor</h2>
              <p className="text-[10px] text-muted-foreground">
                Drag handles to connect nodes · Hover over nodes to delete or add attributes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={addEntity} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> Entity
            </Button>
            <Button size="sm" variant="outline" onClick={addRelationship} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> Relation
            </Button>
            
            {/* Export menu */}
            <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden ml-2">
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

            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-8 ml-2">
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg ml-1" onClick={() => setERDiagramEditorOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={reactFlowWrapper} className="flex-1 relative bg-gradient-to-br from-background via-background/90 to-muted/50">
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
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="hsl(var(--muted-foreground) / 0.2)" />
            <Controls className="!bg-card !border-border !shadow-sm" />
            <Panel position="bottom-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border text-xs text-muted-foreground shadow-lg">
                <span>{nodes.filter(n=>n.type==='classicEntity').length} entities</span>
                <span>·</span>
                <span>{nodes.filter(n=>n.type==='classicRelationship').length} relationships</span>
                <span>·</span>
                <span>{nodes.filter(n=>n.type==='classicAttribute').length} attributes</span>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      <AttrDialog open={attrDialogOpen} onClose={() => setAttrDialogOpen(false)} onSave={saveAttribute} />
    </>
  )
}
