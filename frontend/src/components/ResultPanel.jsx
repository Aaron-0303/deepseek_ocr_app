import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Download, Sparkles, Loader2, CheckCircle2, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import DOMPurify from 'dompurify'

export default function ResultPanel({ result, loading, imagePreview, onCopy, onDownload }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [copied, setCopied] = useState(null)

  const handleCopyClick = async (text, type) => {
    try {
      await onCopy(text)
      setCopied(type)
      window.setTimeout(() => setCopied(null), 1800)
    } catch (err) {
      console.error('Copy failed:', err)
      setCopied('error')
      window.setTimeout(() => setCopied(null), 1800)
    }
  }

  // Check if text looks like HTML (model outputs HTML, not markdown)
  const isHTML = result?.text && (
    result.text.includes('<table') || 
    result.text.includes('<tr>') || 
    result.text.includes('<td>') ||
    result.text.includes('<div') ||
    result.text.includes('<p>') ||
    result.text.includes('<h1') ||
    result.text.includes('<h2')
  )

  // Also check if it looks like markdown (for backwards compatibility)
  const isMarkdown = result?.text && !isHTML && (
    result.text.includes('##') || 
    result.text.includes('**') || 
    result.text.includes('```') ||
    result.text.includes('- ') ||
    result.text.includes('|')
  )

  // Draw boxes function
  const drawBoxes = useCallback(() => {
    if (!result?.boxes?.length || !canvasRef.current || !imgRef.current) {
      console.log('❌ Cannot draw - missing:', {
        hasBoxes: !!result?.boxes?.length,
        hasCanvas: !!canvasRef.current,
        hasImgRef: !!imgRef.current
      })
      return
    }

    console.log('🎨 Drawing boxes:', result.boxes)

    const img = imgRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    console.log('📐 Image dimensions:', {
      displayWidth: img.offsetWidth,
      displayHeight: img.offsetHeight,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      imageDims: result.image_dims
    })

    // Set canvas size to match displayed image
    canvas.width = img.offsetWidth
    canvas.height = img.offsetHeight
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Calculate scale factors
    const scaleX = img.offsetWidth / (result.image_dims?.w || img.naturalWidth)
    const scaleY = img.offsetHeight / (result.image_dims?.h || img.naturalHeight)
    
    console.log('📏 Scale factors:', { scaleX, scaleY })
    
    // Draw boxes
    result.boxes.forEach((box, idx) => {
      const [x1, y1, x2, y2] = box.box
      const colors = [
        '#00ff00', '#00ffff', '#ff00ff', '#ffff00', '#ff0066'
      ]
      const color = colors[idx % colors.length]
      
      // Scale coordinates
      const sx = x1 * scaleX
      const sy = y1 * scaleY
      const sw = (x2 - x1) * scaleX
      const sh = (y2 - y1) * scaleY
      
      console.log(`📦 Box ${idx} (${box.label}):`, {
        original: [x1, y1, x2, y2],
        scaled: [sx, sy, sx + sw, sy + sh],
        dimensions: { width: sw, height: sh }
      })
      
      // Draw semi-transparent fill
      ctx.fillStyle = color + '33'
      ctx.fillRect(sx, sy, sw, sh)
      
      // Draw thick neon border
      ctx.strokeStyle = color
      ctx.lineWidth = 4
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.strokeRect(sx, sy, sw, sh)
      ctx.shadowBlur = 0
      
      // Label background
      if (box.label) {
        ctx.font = 'bold 14px Inter'
        const metrics = ctx.measureText(box.label)
        const padding = 8
        const labelHeight = 24
        
        ctx.fillStyle = color
        ctx.fillRect(sx, sy - labelHeight, metrics.width + padding * 2, labelHeight)
        
        // Label text
        ctx.fillStyle = '#000'
        ctx.fillText(box.label, sx + padding, sy - 7)
      }
    })
    
    console.log('✅ Finished drawing', result.boxes.length, 'boxes')
  }, [result])

  // Trigger drawing when image loads
  useEffect(() => {
    if (imageLoaded && result?.boxes?.length) {
      console.log('🚀 Image loaded, drawing boxes now')
      drawBoxes()
    }
  }, [imageLoaded, result, drawBoxes])

  // Reset imageLoaded when result changes
  useEffect(() => {
    setImageLoaded(false)
  }, [result])

  // Redraw on window resize
  useEffect(() => {
    if (!imageLoaded || !result?.boxes?.length) return
    
    const handleResize = () => {
      console.log('📐 Window resized, redrawing')
      drawBoxes()
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [imageLoaded, result, drawBoxes])

  return (
    <div className="glass p-5 sm:p-6 space-y-4 min-h-[420px] sm:min-h-[620px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-blue-50 p-2 border border-blue-100">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="section-label !mb-0">识别输出</p>
            <h3 className="font-semibold text-slate-950">处理结果</h3>
          </div>
        </div>
        
        {result && (
          <div className="flex gap-2">
            <motion.button
              onClick={() => handleCopyClick(result.text, 'result')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="复制处理结果"
            >
              {copied === 'result' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span className="hidden text-xs sm:inline">{copied === 'result' ? '已复制' : copied === 'error' ? '复制失败' : '复制'}</span>
            </motion.button>
            <motion.button
              onClick={onDownload}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Download"
            >
              <Download className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 space-y-4"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full"
              />
              <Loader2 className="w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-600" />
            </div>
            <p className="text-sm text-slate-500 animate-pulse">
              正在识别图片内容…
            </p>
          </motion.div>
        ) : result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Preview with boxes */}
            {imagePreview && result.boxes && result.boxes.length > 0 && (
              <div className="flex max-h-[540px] justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-2">
                <div className="relative inline-block max-w-full">
                  <img
                    ref={imgRef}
                    src={imagePreview}
                    alt="Result"
                    className="block max-h-[520px] w-auto max-w-full object-contain"
                    onLoad={() => {
                      console.log('🖼️ Image loaded, triggering draw')
                      setImageLoaded(true)
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full pointer-events-none"
                    style={{ display: 'block' }}
                  />
                </div>
              </div>
            )}

            {/* Text result */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-h-[32rem] overflow-y-auto">
              {isHTML ? (
                <div 
                  className="prose prose-slate prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.text) }}
                  style={{
                    color: '#334155',
                  }}
                />
              ) : isMarkdown ? (
                <div className="prose prose-slate prose-sm max-w-none">
                  <ReactMarkdown>{result.text}</ReactMarkdown>
                </div>
              ) : (
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                  {result.text}
                </pre>
              )}
            </div>

            {/* Raw Response Viewer */}
            {result.raw_text && (
              <details className="glass rounded-xl overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <span className="text-sm font-medium text-slate-700">Raw Model Response</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </summary>
                <div className="px-4 py-3 border-t border-slate-200 space-y-2">
                  <p className="text-xs text-slate-500 mb-2">模型返回的原始内容</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-words select-all">
                      {result.raw_text}
                    </pre>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleCopyClick(result.raw_text, 'raw')}
                      className="text-xs px-3 py-1.5 border border-slate-200 bg-white hover:border-blue-200 hover:text-blue-700 rounded-lg transition-colors"
                    >
                      {copied === 'raw' ? '已复制' : '复制原始内容'}
                    </button>
                    <span className="text-xs text-slate-400 py-1">
                      {result.raw_text.length} 个字符
                    </span>
                  </div>
                </div>
              </details>
            )}

            {/* Advanced Settings Dropdown */}
            <details className="glass rounded-xl overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors">
                <span className="text-sm font-medium text-slate-700">Metadata & Debug Info</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </summary>
              <div className="px-4 py-3 border-t border-slate-200 space-y-3">
                {result.metadata && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Processing Metadata</p>
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap">
                      {JSON.stringify(result.metadata, null, 2)}
                    </pre>
                  </div>
                )}
                {result.boxes?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Parsed Bounding Boxes ({result.boxes.length})</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                      {result.boxes.map((box, idx) => (
                        <div key={idx} className="text-xs font-mono">
                          <span className="text-blue-600">Box {idx + 1}:</span>{' '}
                          <span className="text-violet-600">{box.label}</span>{' '}
                          <span className="text-slate-500">
                            [{box.box.map(n => Math.round(n)).join(', ')}]
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Coordinates are scaled from model output (0-999) to image pixels
                    </p>
                  </div>
                )}
              </div>
            </details>

            {/* Success indicator */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center justify-center gap-2 text-emerald-600"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Processing complete!</span>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 space-y-4"
          >
            <div className="relative">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-20 h-20 bg-blue-200/70 rounded-full blur-xl"
              />
              <Sparkles className="w-10 h-10 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900">
                等待识别
              </p>
              <p className="text-sm text-slate-500 mt-1">
                上传图片并开始识别，结果会显示在这里
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
