import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Zap, Loader2, Settings, Image as ImageIcon, FileText } from 'lucide-react'
import ImageUpload from './components/ImageUpload'
import ModeSelector from './components/ModeSelector'
import ResultPanel from './components/ResultPanel'
import AdvancedSettings from './components/AdvancedSettings'
import PDFProcessor from './components/PDFProcessor'
import ModelControl from './components/ModelControl'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

function App() {
  const [mode, setMode] = useState('plain_ocr')
  const [fileType, setFileType] = useState('image') // 'image' or 'pdf'
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [includeCaption, setIncludeCaption] = useState(false)
  
  // Form state
  const [prompt, setPrompt] = useState('')
  const [findTerm, setFindTerm] = useState('')
  const [advancedSettings, setAdvancedSettings] = useState({
    base_size: 1024,
    image_size: 640,
    crop_mode: true,
    test_compress: false
  })

  const handleFileTypeChange = useCallback((newType) => {
    // Clear current file when switching types
    setImage(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview(null)
    setError(null)
    setResult(null)
    setFileType(newType)
  }, [imagePreview])

  const handleImageSelect = useCallback((file) => {
    if (file === null) {
      // Clear everything when removing image
      setImage(null)
      if (imagePreview && fileType === 'image') {
        URL.revokeObjectURL(imagePreview)
      }
      setImagePreview(null)
      setError(null)
      setResult(null)
    } else {
      setImage(file)
      // Only create preview URL for images, not PDFs
      if (fileType === 'image') {
        setImagePreview(URL.createObjectURL(file))
      } else {
        setImagePreview(file) // Just store the file for PDFs
      }
      setError(null)
      setResult(null)
    }
  }, [imagePreview, fileType])

  const handleSubmit = async () => {
    if (!image) {
      setError('Please upload an image first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', image)
      formData.append('mode', mode)
      formData.append('prompt', prompt)
      // Enable grounding only for find mode
      formData.append('grounding', mode === 'find_ref')
      formData.append('include_caption', includeCaption)
      formData.append('find_term', findTerm)
      formData.append('schema', '')
      formData.append('base_size', advancedSettings.base_size)
      formData.append('image_size', advancedSettings.image_size)
      formData.append('crop_mode', advancedSettings.crop_mode)
      formData.append('test_compress', advancedSettings.test_compress)

      const response = await axios.post(`${API_BASE}/ocr`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = useCallback(() => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text)
    }
  }, [result])

  const handleDownload = useCallback(() => {
    if (!result?.text) return
    
    const extensions = {
      plain_ocr: 'txt',
      describe: 'txt',
      find_ref: 'txt',
      freeform: 'txt',
    }
    
    const ext = extensions[mode] || 'txt'
    const blob = new Blob([result.text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deepseek-ocr-result.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }, [result, mode])

  return (
    <div className="app-shell min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-blue-600/10 to-violet-500/10" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTZ6TTI0IDZjMy4zMSAwIDYgMi42OSA2IDZzLTIuNjkgNi02IDYtNi0yLjY5LTYtNiAyLjY5LTYgNi02ek00OCAzNmMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTZ6IiBzdHJva2U9InJnYmEoMTQ3LCA1MSwgMjM0LCAwLjEpIiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-30" />
        <motion.div
          className="absolute top-20 left-20 w-96 h-96 bg-cyan-400/15 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Header */}
      <header className="topbar sticky top-0 z-50">
        <div className="max-w-[1500px] mx-auto px-5 sm:px-8 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-300 rounded-2xl blur-xl opacity-50" />
                <div className="relative bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-600 p-2.5 rounded-2xl text-slate-950 shadow-lg shadow-cyan-500/20">
                  <Sparkles className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">DeepSeek <span className="gradient-text">OCR</span></h1>
                <p className="text-xs text-cyan-100/55">Document intelligence workspace</p>
              </div>
            </motion.div>
            <div className="soft-chip hidden sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
              Local AI workspace
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1500px] mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-card mb-7 px-6 py-8 sm:px-10 sm:py-10"
        >
          <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_280px]">
            <div className="max-w-3xl">
              <div className="soft-chip mb-5">
                <Zap className="h-3.5 w-3.5 text-cyan-200" />
                DeepSeek Vision Intelligence
              </div>
              <h2 className="text-4xl font-black leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                Turn documents into
                <span className="gradient-text block">structured intelligence.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                上传图片或 PDF，快速完成文字识别、内容理解、关键词定位与结构化导出。
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="soft-chip">Image OCR</span>
                <span className="soft-chip">PDF Processing</span>
                <span className="soft-chip">GPU Accelerated</span>
              </div>
            </div>
            <div className="relative hidden h-56 items-center justify-center lg:flex" aria-hidden="true">
              <motion.div
                className="hero-orb h-40 w-40 rounded-full"
                animate={{ y: [0, -10, 0], rotate: [0, 4, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute h-52 w-52 rounded-full border border-cyan-200/20" />
              <div className="absolute h-64 w-64 rounded-full border border-dashed border-blue-300/15" />
            </div>
          </div>
        </motion.section>

        <div className="mb-6">
          <ModelControl />
        </div>

        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="panel-label">OCR workspace</p>
            <h2 className="text-2xl font-bold tracking-tight text-white">Create a new recognition task</h2>
          </div>
          <p className="text-sm text-slate-400">选择文件类型 → 上传内容 → 配置识别方式 → 获取结果</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* Left Panel - Upload & Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* File Type Toggle */}
            <div className="glass p-2 rounded-2xl">
              <div className="flex items-center justify-between px-3 pb-3 pt-2">
                <div>
                  <p className="panel-label !mb-1">01 · Input type</p>
                  <p className="text-sm font-semibold text-white">What do you want to process?</p>
                </div>
                <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-200">STEP 1</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  onClick={() => handleFileTypeChange('image')}
                  className={`p-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    fileType === 'image'
                      ? 'bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                      : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ImageIcon className="w-4 h-4" />
                  Image OCR
                </motion.button>
                <motion.button
                  onClick={() => handleFileTypeChange('pdf')}
                  className={`p-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    fileType === 'pdf'
                      ? 'bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                      : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FileText className="w-4 h-4" />
                  PDF Processing
                </motion.button>
              </div>
            </div>

            {/* Image/PDF Upload */}
            <ImageUpload
              onImageSelect={handleImageSelect}
              preview={imagePreview}
              fileType={fileType}
            />

            {/* Mode Selector with integrated inputs */}
            <ModeSelector
              mode={mode}
              onModeChange={setMode}
              prompt={prompt}
              onPromptChange={setPrompt}
              findTerm={findTerm}
              onFindTermChange={setFindTerm}
            />

            {/* Advanced Settings Toggle */}
            <motion.button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full glass glass-hover px-5 py-4 rounded-2xl flex items-center justify-between"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-300" />
                <span className="text-sm font-medium text-slate-200">Advanced Settings</span>
              </div>
              <motion.div
                animate={{ rotate: showAdvanced ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.div>
            </motion.button>

            {/* Advanced Settings Panel */}
            <AnimatePresence>
              {showAdvanced && (
                <AdvancedSettings
                  settings={advancedSettings}
                  onSettingsChange={setAdvancedSettings}
                  includeCaption={includeCaption}
                  onIncludeCaptionChange={setIncludeCaption}
                />
              )}
            </AnimatePresence>

            {/* Action Button / PDF Processor */}
            {fileType === 'pdf' ? (
              <PDFProcessor
                pdfFile={image}
                mode={mode}
                prompt={prompt}
                advancedSettings={advancedSettings}
                includeCaption={includeCaption}
              />
            ) : (
              <>
                <motion.button
                  onClick={handleSubmit}
                  disabled={!image || loading}
                  className={`primary-action w-full ${
                    !image || loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  whileHover={!loading && image ? { scale: 1.02 } : {}}
                  whileTap={!loading && image ? { scale: 0.98 } : {}}
                >
                  <div className="relative flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="font-semibold">Processing Magic...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span className="font-semibold">Analyze Image</span>
                      </>
                    )}
                  </div>
                </motion.button>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-4 rounded-2xl border-red-500/50 bg-red-500/10"
                  >
                    <p className="text-sm text-red-400">{error}</p>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>

          {/* Right Panel - Results */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ResultPanel 
              result={result}
              loading={loading}
              imagePreview={imagePreview}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-cyan-100/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="max-w-[1500px] mx-auto px-6 py-8 text-center space-y-2">
          <p className="text-sm text-gray-400">
            Powered by <span className="gradient-text font-semibold">DeepSeek-OCR</span> • 
            Built with <span className="text-pink-400">♥</span> using React + FastAPI
          </p>
          <p className="text-xs text-gray-500">
            Thanks to <a href="https://github.com/p-xiexin" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors">@p-xiexin</a> for the clipboard paste idea!
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
