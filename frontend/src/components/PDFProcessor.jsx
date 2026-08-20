import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

function PDFProcessor({ pdfFile, mode, prompt, advancedSettings, includeCaption }) {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressInfo, setProgressInfo] = useState({
    message: '',
    currentPage: 0,
    totalPages: 0,
  })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [outputFormat, setOutputFormat] = useState('markdown')

  const formats = [
    { value: 'markdown', label: 'Markdown', ext: 'md', icon: '📝' },
    { value: 'html', label: 'HTML', ext: 'html', icon: '🌐' },
    { value: 'docx', label: 'Word', ext: 'docx', icon: '📄' },
    { value: 'json', label: 'JSON', ext: 'json', icon: '📊' }
  ]

  const handleProcess = useCallback(async () => {
    if (!pdfFile) return

    setProcessing(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setProgressInfo({ message: '正在上传 PDF', currentPage: 0, totalPages: 0 })

    const jobId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    let progressTimer = null

    try {
      const formData = new FormData()
      formData.append('pdf_file', pdfFile)
      formData.append('job_id', jobId)
      formData.append('mode', mode)
      formData.append('prompt', prompt)
      formData.append('output_format', outputFormat)
      formData.append('grounding', mode === 'find_ref')
      formData.append('include_caption', includeCaption)
      formData.append('extract_images', true)
      formData.append('dpi', 144)
      formData.append('base_size', advancedSettings.base_size)
      formData.append('image_size', advancedSettings.image_size)
      formData.append('crop_mode', advancedSettings.crop_mode)

      const pollProgress = async () => {
        try {
          const { data } = await axios.get(
            `${API_BASE}/process-pdf/progress/${encodeURIComponent(jobId)}`
          )

          if (data.status !== 'waiting') {
            setProgress(Math.min(100, Math.max(0, data.progress || 0)))
            setProgressInfo({
              message: data.message || '正在处理 PDF',
              currentPage: data.current_page || 0,
              totalPages: data.total_pages || 0,
            })
          }
        } catch (pollError) {
          console.debug('PDF progress polling failed:', pollError)
        }
      }

      progressTimer = window.setInterval(pollProgress, 700)

      const response = await axios.post(`${API_BASE}/process-pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: outputFormat === 'json' ? 'json' : 'blob',
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return
          const uploadPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setProgress(Math.max(1, Math.round(uploadPercent * 0.05)))
        }
      })

      if (outputFormat === 'json') {
        setResult(response.data)
      } else {
        // For file downloads (markdown, html, docx)
        const format = formats.find(f => f.value === outputFormat)
        const blob = new Blob([response.data], {
          type: response.headers['content-type']
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ocr_result.${format.ext}`
        a.click()
        URL.revokeObjectURL(url)

        setResult({
          success: true,
          message: `Document downloaded as ${format.label}`,
          format: outputFormat
        })
      }

      setProgress(100)
      setProgressInfo((current) => ({ ...current, message: 'PDF 处理完成' }))
    } catch (err) {
      console.error('PDF processing error:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to process PDF')
    } finally {
      if (progressTimer) window.clearInterval(progressTimer)
      setProcessing(false)
    }
  }, [pdfFile, mode, prompt, outputFormat, includeCaption, advancedSettings])

  const handleDownloadJSON = useCallback(() => {
    if (!result || outputFormat !== 'json') return

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ocr_result.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [result, outputFormat])

  return (
    <div className="space-y-4">
      {/* Format Selector */}
      <div className="glass p-6 space-y-3">
        <label className="block text-sm font-semibold text-slate-900 mb-3">
          输出格式
        </label>
        <div className="grid grid-cols-2 gap-2">
          {formats.map((format) => (
            <motion.button
              key={format.value}
              onClick={() => setOutputFormat(format.value)}
              className={`p-3 rounded-xl text-sm font-medium transition-all ${
                outputFormat === format.value
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="mr-2">{format.icon}</span>
              {format.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Process Button */}
      <motion.button
        onClick={handleProcess}
        disabled={!pdfFile || processing}
        className={`primary-action w-full ${
          !pdfFile || processing ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        whileHover={!processing && pdfFile ? { scale: 1.02 } : {}}
        whileTap={!processing && pdfFile ? { scale: 0.98 } : {}}
      >
        <div className="relative flex items-center justify-center gap-3">
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-semibold">Processing PDF...</span>
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              <span className="font-semibold">Process PDF</span>
            </>
          )}
        </div>
      </motion.button>

      {/* Progress Bar */}
      <AnimatePresence>
        {processing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass p-4 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">
                {progressInfo.message || '正在处理 PDF'}
              </span>
              <span className="text-sm font-medium text-blue-600">{progress}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            {progressInfo.totalPages > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                当前第 {progressInfo.currentPage}/{progressInfo.totalPages} 页
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass p-4 rounded-2xl border-red-500/50 bg-red-500/10 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Processing Failed</p>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Display */}
      <AnimatePresence>
        {result && !error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass p-6 rounded-2xl border-green-500/50 bg-green-500/10"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-400">
                  {result.message || 'PDF processed successfully!'}
                </p>
                {outputFormat === 'json' && result.pages && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-400">
                      Processed {result.total_pages} page{result.total_pages > 1 ? 's' : ''}
                    </p>
                    <motion.button
                      onClick={handleDownloadJSON}
                      className="glass px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Download className="w-4 h-4" />
                      Download JSON
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default PDFProcessor
