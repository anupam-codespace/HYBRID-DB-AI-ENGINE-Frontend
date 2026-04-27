import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Plus, X, FileText, Image, FileSpreadsheet, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore, type AttachedFile } from '@/store/appStore'
import { uploadFile } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { formatFileSize, generateId } from '@/lib/utils'
import { cn } from '@/lib/utils'

const ACCEPTED: Record<string, string[]> = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/pdf': ['.pdf'],
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],
}

export function FileIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) return <Image className="h-3.5 w-3.5" />
  if (type.includes('csv') || type.includes('sheet') || type.includes('excel'))
    return <FileSpreadsheet className="h-3.5 w-3.5" />
  if (type === 'application/pdf') return <FileText className="h-3.5 w-3.5" />
  return <File className="h-3.5 w-3.5" />
}

export function FileUploadButton() {
  const { pendingFiles, addPendingFile, updatePendingFile, removePendingFile } =
    useAppStore()
  const { toast } = useToast()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        const id = generateId()
        const staged: AttachedFile = {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          uploading: true,
        }
        addPendingFile(staged)

        try {
          const res = await uploadFile(file)
          updatePendingFile(id, { uploading: false, fileId: res.file_id })
          toast({
            title: 'File uploaded',
            description: `"${file.name}" is ready to use.`,
            variant: 'success',
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed'
          updatePendingFile(id, { uploading: false, error: message })
          toast({
            title: 'Upload failed',
            description: message,
            variant: 'destructive',
          })
        }
      }
    },
    [addPendingFile, updatePendingFile, toast]
  )

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div {...getRootProps()} className="flex items-center gap-1 flex-wrap">
      <input {...getInputProps()} />

      {/* Upload trigger */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={open}
        id="file-upload-btn"
        aria-label="Attach file"
        className="h-8 w-8 rounded-full border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
