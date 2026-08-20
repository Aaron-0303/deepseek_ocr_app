import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileText, Image as ImageIcon, Loader2, Settings, Sparkles, Zap } from 'lucide-react'
import axios from 'axios'
import AdvancedSettings from './components/AdvancedSettings'
import ImageUpload from './components/ImageUpload'
import ModeSelector from './components/ModeSelector'
import ModelControl from './components/ModelControl'
import PDFProcessor from './components/PDFProcessor'
import ResultPanel from './components/ResultPanel'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

function App() {
  const [mode, setMode] = useState('plain_ocr')
  const [fileType, setFileType] = useState('image')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [includeCaption, setIncludeCaption] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [findTerm, setFindTerm] = useState('')
  const [advancedSettings, setAdvancedSettings] = useState({
    base_size: 1024,
    image_size: 640,
    crop_mode: true,
    test_compress: false,
  })

  const handleFileTypeChange = useCallback((newType) => {
    setImage(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    setError(null)
    setResult(null)
    setFileType(newType)
  }, [imagePreview])

  const handleImageSelect = useCallback((file) => {
    if (file === null) {
      setImage(null)
      if (imagePreview && fileType === 'image') URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
      setError(null)
      setResult(null)
      return
    }

    setImage(file)
    setImagePreview(fileType === 'image' ? URL.createObjectURL(file) : file)
    setError(null)
    setResult(null)
  }, [fileType, imagePreview])

  const handleSubmit = async () => {
    if (!image) {
      setError('请先上传图片')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', image)
      formData.append('mode', mode)
      formData.append('prompt', prompt)
      formData.append('grounding', mode === 'find_ref')
      formData.append('include_caption', includeCaption)
      formData.append('find_term', findTerm)
      formData.append('schema', '')
      formData.append('base_size', advancedSettings.base_size)
      formData.append('image_size', advancedSettings.image_size)
      formData.append('crop_mode', advancedSettings.crop_mode)
      formData.append('test_compress', advancedSettings.test_compress)

      const response = await axios.post(`${API_BASE}/ocr`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || '处理失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = useCallback(() => {
    if (result?.text) navigator.clipboard.writeText(result.text)
  }, [result])

  const handleDownload = useCallback(() => {
    if (!result?.text) return
    const blob = new Blob([result.text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'deepseek-ocr-result.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="sidebar lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-[320px]">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-6">
            <div className="rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 p-2.5 text-white shadow-lg shadow-blue-200">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-950">DeepSeek OCR</h1>
              <p className="text-xs text-slate-500">智能文档识别工作台</p>
            </div>
          </div>

          <div className="space-y-7 overflow-y-auto px-5 py-6">
            <section>
              <p className="section-label">输入类型</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleFileTypeChange('image')}
                  className={`sidebar-option ${fileType === 'image' ? 'sidebar-option-active' : ''}`}
                >
                  <ImageIcon className="h-5 w-5" />
                  <span>图片</span>
                </button>
                <button
                  onClick={() => handleFileTypeChange('pdf')}
                  className={`sidebar-option ${fileType === 'pdf' ? 'sidebar-option-active' : ''}`}
                >
                  <FileText className="h-5 w-5" />
                  <span>PDF</span>
                </button>
              </div>
            </section>

            <section>
              <p className="section-label">模型资源</p>
              <ModelControl compact />
            </section>
          </div>

          <div className="mt-auto border-t border-slate-200 px-6 py-5">
            <p className="text-xs leading-5 text-slate-400">模型文件保存在本地，识别内容不会上传到第三方服务。</p>
          </div>
        </div>
      </aside>

      <main className="lg:pl-[320px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">识别工作台</p>
              <p className="mt-0.5 text-xs text-slate-500">上传文件并选择识别方式</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              本地部署
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-label">新建任务</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                {fileType === 'pdf' ? '处理 PDF 文档' : '识别图片内容'}
              </h2>
            </div>
            <p className="text-sm text-slate-500">上传文件后可调整识别模式和高级参数</p>
          </div>

          <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_520px]">
            <div className="space-y-6">
              <ImageUpload
                onImageSelect={handleImageSelect}
                preview={imagePreview}
                fileType={fileType}
              />

              <ModeSelector
                mode={mode}
                onModeChange={setMode}
                prompt={prompt}
                onPromptChange={setPrompt}
                findTerm={findTerm}
                onFindTermChange={setFindTerm}
              />

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                      <Settings className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">高级设置</p>
                      <p className="text-xs text-slate-500">尺寸、裁剪和输出选项</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-600">{showAdvanced ? '收起' : '展开'}</span>
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <div className="border-t border-slate-100 p-5">
                      <AdvancedSettings
                        settings={advancedSettings}
                        onSettingsChange={setAdvancedSettings}
                        includeCaption={includeCaption}
                        onIncludeCaptionChange={setIncludeCaption}
                      />
                    </div>
                  )}
                </AnimatePresence>
              </div>

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
                    className="primary-action w-full"
                    whileTap={image && !loading ? { scale: 0.99 } : {}}
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                    <span>{loading ? '正在识别…' : '开始识别'}</span>
                  </motion.button>

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="2xl:sticky 2xl:top-24">
              {fileType === 'image' ? (
                <ResultPanel
                  result={result}
                  loading={loading}
                  imagePreview={imagePreview}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                  <div className="rounded-2xl bg-blue-50 p-4 text-blue-600 w-fit">
                    <FileText className="h-7 w-7" />
                  </div>
                  <h3 className="mt-6 text-lg font-bold text-slate-950">PDF 输出</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    在左侧选择输出格式并开始处理。完成后文件会自动下载到浏览器默认目录。
                  </p>
                  <div className="mt-6 space-y-3 text-sm text-slate-600">
                    {['支持 Markdown、HTML、Word 和 JSON', '自动保留文档结构与图片', '大文件处理时显示上传进度'].map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
