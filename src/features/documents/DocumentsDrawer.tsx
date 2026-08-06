import { FilePlus2, FileText, History, RotateCcw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { DescriptionDocument, RecoveryCheckpoint } from '../../domain/types'
import { listCheckpoints } from '../../storage/database'
import { trapFocus } from '../../lib/focusTrap'

interface DocumentsDrawerProps {
  documents: DescriptionDocument[]
  activeId: string
  open: boolean
  onClose: () => void
  onCreate: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (documentId: string, checkpoint: RecoveryCheckpoint) => void
}

export function DocumentsDrawer({ documents, activeId, open, onClose, onCreate, onSelect, onDelete, onRestore }: DocumentsDrawerProps) {
  const [expandedRecoveryId, setExpandedRecoveryId] = useState<string | null>(null)
  const [loadingRecoveryId, setLoadingRecoveryId] = useState<string | null>(null)
  const [checkpointsByDocument, setCheckpointsByDocument] = useState<Record<string, RecoveryCheckpoint[]>>({})
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const toggleRecovery = async (documentId: string) => {
    if (expandedRecoveryId === documentId) {
      setExpandedRecoveryId(null)
      return
    }
    setPendingDeleteId(null)
    setExpandedRecoveryId(documentId)
    setLoadingRecoveryId(documentId)
    const checkpoints = (await listCheckpoints(documentId)).sort((a, b) => b.createdAt - a.createdAt)
    setCheckpointsByDocument((current) => ({ ...current, [documentId]: checkpoints }))
    setLoadingRecoveryId(null)
  }
  const confirmDelete = (documentId: string) => {
    onDelete(documentId)
    setPendingDeleteId(null)
    if (expandedRecoveryId === documentId) setExpandedRecoveryId(null)
  }
  return (
    <aside className={`side-drawer documents-drawer ${open ? 'open' : ''}`} aria-label="Documents" aria-hidden={!open} onKeyDown={(event) => trapFocus(event, onClose)}>
      <header className="drawer-header"><div><span className="eyebrow">Workspace</span><h2>Documents</h2></div><button className="icon-button" autoFocus onClick={onClose} aria-label="Close documents"><X /></button></header>
      <button className="button secondary wide" type="button" onClick={onCreate}><FilePlus2 />New description</button>
      <div className="document-list">
        {documents.map((document) => (
          <div className={`document-entry ${document.id === activeId ? 'active' : ''} ${expandedRecoveryId === document.id ? 'expanded' : ''}`} key={document.id}>
            <div className="document-row">
              <button className="document-select" onClick={() => onSelect(document.id)}>
                <FileText />
                <span><strong>{document.title}</strong><small>{document.mode} · {new Date(document.updatedAt).toLocaleDateString()}</small></span>
              </button>
              <div className="document-actions">
                <button className="icon-button subtle" aria-expanded={expandedRecoveryId === document.id} aria-controls={`recovery-${document.id}`} onClick={() => void toggleRecovery(document.id)} aria-label={`Recovery points for ${document.title}`}><History /></button>
                <button className="icon-button subtle" disabled={documents.length === 1} aria-haspopup="dialog" onClick={() => { setExpandedRecoveryId(null); setPendingDeleteId(document.id) }} aria-label={`Delete ${document.title}`}><Trash2 /></button>
                {pendingDeleteId === document.id && <div className="delete-document-popover" role="alertdialog" aria-labelledby={`delete-title-${document.id}`} aria-describedby={`delete-copy-${document.id}`} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setPendingDeleteId(null) } }}>
                  <strong id={`delete-title-${document.id}`}>Delete “{document.title}”?</strong>
                  <p id={`delete-copy-${document.id}`}>This removes the document from this browser and cannot be undone.</p>
                  <div><button className="button quiet" autoFocus onClick={() => setPendingDeleteId(null)}>Cancel</button><button className="button danger" onClick={() => confirmDelete(document.id)}>Delete</button></div>
                </div>}
              </div>
            </div>
            {expandedRecoveryId === document.id && <section className="document-recovery" id={`recovery-${document.id}`} aria-label={`Recovery points for ${document.title}`}>
              <div className="document-recovery-heading"><span><History /><strong>Recovery points</strong></span><small>For {document.title}</small></div>
              {loadingRecoveryId === document.id
                ? <p className="recovery-empty">Loading recovery points…</p>
                : (checkpointsByDocument[document.id]?.length ?? 0) > 0
                  ? checkpointsByDocument[document.id]!.slice(0, 8).map((checkpoint) => <button className="recovery-row" key={checkpoint.id} onClick={() => onRestore(document.id, checkpoint)}><RotateCcw /><span><strong>{new Date(checkpoint.createdAt).toLocaleString()}</strong><small>{checkpoint.mode} · {checkpoint.content.length.toLocaleString()} characters</small></span></button>)
                  : <p className="recovery-empty">No recovery points yet for this document.</p>}
            </section>}
          </div>
        ))}
      </div>
      <p className="drawer-footnote">Documents are stored only in this browser. Export a workspace file for portable backups.</p>
    </aside>
  )
}
