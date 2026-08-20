import { motion } from 'framer-motion'
import { FileText, Eye, Search, Wand2 } from 'lucide-react'

const modes = [
  { id: 'plain_ocr', name: 'Plain OCR', icon: FileText, color: 'from-blue-500 to-cyan-500', desc: 'Extract raw text', needsInput: false },
  { id: 'describe', name: 'Describe', icon: Eye, color: 'from-violet-500 to-purple-500', desc: 'Image description', needsInput: false },
  { id: 'find_ref', name: 'Find', icon: Search, color: 'from-yellow-500 to-orange-500', desc: 'Locate specific terms', needsInput: 'findTerm' },
  { id: 'freeform', name: 'Freeform', icon: Wand2, color: 'from-fuchsia-500 to-pink-500', desc: 'Custom prompt', needsInput: 'prompt' },
]

export default function ModeSelector({ 
  compact = false,
  mode, 
  onModeChange, 
  prompt, 
  onPromptChange,
  findTerm,
  onFindTermChange
}) {
  const selectedMode = modes.find(m => m.id === mode)
  const needsInput = selectedMode?.needsInput

  return (
    <div className={compact ? 'rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4' : 'glass p-5 space-y-4'}>
      <div>
        <p className="section-label">识别模式</p>
        <h3 className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-slate-950`}>选择模型处理文件的方式</h3>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${compact ? '' : 'sm:grid-cols-4'}`}>
        {modes.map((m) => {
          const Icon = m.icon
          const isSelected = mode === m.id
          
          return (
            <motion.button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              className={`
                relative p-2 rounded-xl text-center transition-all
                ${isSelected 
                  ? 'border border-blue-500 bg-blue-50 shadow-sm'
                  : 'bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSelected && (
                <motion.div
                  layoutId="selected-mode"
                  className="absolute inset-0 rounded-xl bg-blue-50"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <div className="relative space-y-1">
                <div className={`
                  w-8 h-8 mx-auto rounded-lg flex items-center justify-center
                  ${isSelected 
                    ? `bg-gradient-to-br ${m.color} shadow-lg`
                    : 'bg-slate-100 text-slate-500'
                  }
                `}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className={`text-xs font-medium ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                  {m.name}
                </p>
              </div>
            </motion.button>
          )
        })}
      </div>

      {needsInput === 'findTerm' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <input
            type="text"
            value={findTerm}
            onChange={(e) => onFindTermChange(e.target.value)}
            placeholder="输入要定位的内容，例如：总计、发票号"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors"
          />
        </motion.div>
      )}

      {needsInput === 'prompt' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="输入自定义提示词…"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors resize-none"
            rows={2}
          />
        </motion.div>
      )}
    </div>
  )
}
