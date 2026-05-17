const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

interface Attr { id: string; name: string; type: string; isPrimary?: boolean; isMultiValued?: boolean }
interface Entity { id: string; name: string; attributes: Attr[]; position?: { x: number; y: number } }
interface Rel { id: string; source: string; target: string; label?: string; cardinality?: string }

// ─── Stop words & verb map ────────────────────────────────────────────────────

const STOP = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'to','of','in','for','on','with','at','by','from','up','about','into',
  'that','this','these','those','it','its','and','or','but','if','then','than',
  'so','both','either','neither','not','also','just','very','quite','only',
  'need','must','each','every','any','all','most','more','some','such','no',
])

const CARDINALITY_WORDS = new Set(['many','multiple','several','various','few'])

const VERB_MAP: Record<string, string> = {
  enroll:'enrolls', enrolls:'enrolls', enrolled:'enrolls',
  has:'has', have:'has', had:'has',
  work:'works on', works:'works on',
  belong:'belongs to', belongs:'belongs to',
  manage:'manages', manages:'manages',
  use:'uses', uses:'uses',
  contain:'contains', contains:'contains',
  include:'includes', includes:'includes',
  teach:'teaches', teaches:'teaches', taught:'teaches',
  assign:'assigns', assigns:'assigns', assigned:'assigns',
  place:'places', places:'places',
  order:'orders', orders:'orders',
  buy:'buys', buys:'buys', bought:'buys',
  sell:'sells', sells:'sells', sold:'sells',
  own:'owns', owns:'owns',
  employ:'employs', employs:'employs',
  hire:'hires', hires:'hires',
  treat:'treats', treats:'treats',
  write:'writes', writes:'writes', wrote:'writes',
  publish:'publishes', publishes:'publishes',
  attend:'attends', attends:'attends',
  register:'registers', registers:'registers',
  submit:'submits', submits:'submits',
  supply:'supplies', supplies:'supplies',
  support:'supports', supports:'supports',
  create:'creates', creates:'creates',
  produce:'produces', produces:'produces',
  rent:'rents', rents:'rents',
  borrow:'borrows', borrows:'borrows',
  lend:'lends', lends:'lends',
}

function buildAttrs(name: string): Attr[] {
  return [
    { id: uid(), name: `${name}_ID`, type: 'INT', isPrimary: true },
  ]
}

// ─── Main extractor ───────────────────────────────────────────────────────────

export interface ExtractedER {
  entities: Entity[]
  relationships: Rel[]
  summary: string
}

export function extractERFromText(text: string): ExtractedER | null {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)

  // Cardinality
  let cardinality = '1:N'
  const hasManyLeft  = words.slice(0, Math.floor(words.length / 2)).some(w => CARDINALITY_WORDS.has(w))
  const hasManyRight = words.slice(Math.floor(words.length / 2)).some(w => CARDINALITY_WORDS.has(w))
  if (hasManyLeft && hasManyRight) cardinality = 'M:N'
  else if (words.includes('one') && !words.some(w => CARDINALITY_WORDS.has(w))) cardinality = '1:1'

  // Relation verb
  let relation = 'has'
  for (const w of words) {
    if (VERB_MAP[w]) { relation = VERB_MAP[w]; break }
  }

  // Entity candidates: non-stop, non-cardinality, non-verb, len >= 3
  const candidates: string[] = []
  const seen = new Set<string>()
  for (const w of words) {
    if (w.length < 3) continue
    if (STOP.has(w)) continue
    if (CARDINALITY_WORDS.has(w)) continue
    if (VERB_MAP[w]) continue
    if (!seen.has(w)) { seen.add(w); candidates.push(w) }
  }

  const e1Name = (candidates[0] || 'Entity1').charAt(0).toUpperCase() + (candidates[0] || 'entity1').slice(1)
  const e2Name = (candidates[1] || 'Entity2').charAt(0).toUpperCase() + (candidates[1] || 'entity2').slice(1)
  const relName = relation.charAt(0).toUpperCase() + relation.slice(1)

  const e1Id = uid(), e2Id = uid(), relId = uid()

  const entities: Entity[] = [
    { id: e1Id, name: e1Name, attributes: buildAttrs(e1Name), position: { x: 100, y: 220 } },
    { id: e2Id, name: e2Name, attributes: buildAttrs(e2Name), position: { x: 560, y: 220 } },
  ]
  const relationships: Rel[] = [
    { id: relId, source: e1Id, target: e2Id, label: relName, cardinality },
  ]

  return {
    entities,
    relationships,
    summary: `**Entities detected:** ${e1Name}, ${e2Name}\n**Relationship:** ${relName}\n**Cardinality:** ${cardinality}`,
  }
}
