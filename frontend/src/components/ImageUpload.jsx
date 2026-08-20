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
    <div className="glass p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">文件上传</p>
          <h3 className="font-semibold text-slate-950">
            {isPDF ? '上传 PDF' : '上传图片'}
          </h3>
        </div>
        {isPDF ? (
          <FileText className="w-5 h-5 text-blue-600" />
        ) : (
          <ImageIcon className="w-5 h-5 text-blue-600" />
        )}
      </div>

      {!preview ? (
        <motion.div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-300
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50 shadow-[0_0_30px_rgba(59,130,246,0.12)]'
              : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
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
                <div className="absolute inset-0 bg-blue-300 rounded-2xl blur-xl opacity-30" />
                <div className="relative bg-gradient-to-br from-cyan-400 to-blue-600 p-4 rounded-2xl text-white shadow-xl shadow-blue-200">
                  <Upload className="w-8 h-8" />
                </div>
              </div>
            </motion.div>
            
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {isDragActive
                  ? '松开即可上传'
                  : isPDF
                    ? '拖放 PDF 到这里'
                    : '拖放图片到这里'
                }
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {isPDF
                  ? '或点击选择文件 · 最大 100MB'
                  : '或点击选择文件 · 支持 PNG、JPG、WEBP'
                }
              </p>
              {!isPDF && (
                <p className="text-xs text-blue-600 mt-2 flex items-center justify-center gap-1.5">
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>也可以按 Ctrl+V 粘贴剪贴板图片</span>
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
            <div className="flex items-center justify-center p-12 bg-blue-50 border border-blue-100 rounded-2xl">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-3 text-blue-500" />
                <p className="text-sm text-slate-800 font-medium">PDF 已就绪</p>
                <p className="text-xs text-slate-500 mt-1">{preview?.name || '文档已加载'}</p>
              </div>
            </div>
          ) : (
            <img
              src={preview}
              alt="Preview"
              className="w-full rounded-2xl border border-slate-200"
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
