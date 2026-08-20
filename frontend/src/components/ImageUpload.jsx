import { useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { Upload, Image as ImageIcon, X, FileText, Clipboard } from 'lucide-react'

export default function ImageUpload({ onImageSelect, preview, fileType = 'image' }) {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.[0]) {
      onImageSelect(acceptedFiles[0])
    }
  }, [onImageSelect])

  const isPDF = fileType === 'pdf'

  // Handle clipboard paste
  useEffect(() => {
    // Only enable paste for images, not PDFs
    if (isPDF) return

    const handlePaste = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const blob = item.getAsFile()
          
          if (blob) {
            // Create a File object with a proper name
            const file = new File([blob], `pasted-image-${Date.now()}.png`, {
              type: blob.type,
            })
            onImageSelect(file)
          }
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [onImageSelect, isPDF])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: isPDF ? {
      'application/pdf': ['.pdf']
    } : {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']
    },
    multiple: false
  })

  return (
    <div className="glass panel-glow p-5 sm:p-6 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">
          {isPDF ? 'Upload PDF' : 'Upload Image'}
        </h3>
        {isPDF ? (
          <FileText className="w-5 h-5 text-cyan-300" />
        ) : (
          <ImageIcon className="w-5 h-5 text-cyan-300" />
        )}
      </div>

      {!preview ? (
        <motion.div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-300
            ${isDragActive 
              ? 'border-cyan-300 bg-cyan-300/10 shadow-[0_0_35px_rgba(34,211,238,0.12)]'
              : 'border-cyan-100/15 bg-slate-950/35 hover:border-cyan-300/40 hover:bg-cyan-300/[0.06]'
            }
          `}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <input {...getInputProps()} />
          
          <div className="space-y-4">
            <motion.div
              animate={{ 
                y: isDragActive ? -10 : 0,
                scale: isDragActive ? 1.1 : 1 
              }}
              className="flex justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-300 rounded-2xl blur-xl opacity-40" />
                <div className="relative bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-600 p-4 rounded-2xl text-slate-950 shadow-xl shadow-cyan-500/20">
                  <Upload className="w-8 h-8" />
                </div>
              </div>
            </motion.div>
            
            <div>
              <p className="text-lg font-semibold text-white">
                {isDragActive
                  ? 'Drop it like it\'s hot! 🔥'
                  : isPDF
                    ? 'Drag & drop your PDF'
                    : 'Drag & drop your image'
                }
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {isPDF
                  ? 'or click to browse • PDF files up to 100MB'
                  : 'or click to browse • PNG, JPG, WEBP up to 10MB'
                }
              </p>
              {!isPDF && (
                <p className="text-xs text-cyan-300 mt-2 flex items-center justify-center gap-1.5">
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>Press Ctrl+V to paste from clipboard</span>
                </p>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group rounded-2xl overflow-hidden"
        >
          {isPDF ? (
            <div className="flex items-center justify-center p-12 bg-cyan-300/[0.04] border border-cyan-100/15 rounded-2xl">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-3 text-cyan-300" />
                <p className="text-sm text-gray-300 font-medium">PDF Ready</p>
                <p className="text-xs text-gray-500 mt-1">{preview?.name || 'Document loaded'}</p>
              </div>
            </div>
          ) : (
            <img
              src={preview}
              alt="Preview"
              className="w-full rounded-2xl border border-white/10"
            />
          )}
          <div className="absolute top-3 right-3 flex gap-2">
            <motion.button
              onClick={(e) => {
                e.stopPropagation()
                onImageSelect(null)
              }}
              className="bg-red-500/90 backdrop-blur-sm px-3 py-2 rounded-full opacity-100 hover:bg-red-600 transition-colors flex items-center gap-2 shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={isPDF ? "Remove PDF" : "Remove image"}
            >
              <X className="w-4 h-4" />
              <span className="text-sm font-medium">Remove</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
