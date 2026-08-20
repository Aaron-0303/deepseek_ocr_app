import { motion } from 'framer-motion'
import { Sliders } from 'lucide-react'

export default function AdvancedSettings({ settings, onSettingsChange, includeCaption, onIncludeCaptionChange }) {
  const handleChange = (key, value) => {
    onSettingsChange({
      ...settings,
      [key]: value
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <Sliders className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-slate-900">参数设置</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-slate-500">基础尺寸</label>
          <input
            type="number"
            value={settings.base_size}
            onChange={(e) => handleChange('base_size', parseInt(e.target.value))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-500">图像尺寸</label>
          <input
            type="number"
            value={settings.image_size}
            onChange={(e) => handleChange('image_size', parseInt(e.target.value))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-500">裁剪模式</label>
          <select
            value={settings.crop_mode ? 'true' : 'false'}
            onChange={(e) => handleChange('crop_mode', e.target.value === 'true')}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-500">测试压缩</label>
          <select
            value={settings.test_compress ? 'true' : 'false'}
            onChange={(e) => handleChange('test_compress', e.target.value === 'true')}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeCaption}
            onChange={(e) => onIncludeCaptionChange(e.target.checked)}
            className="accent-cyan-400"
          />
          <span className="text-sm text-slate-600">包含图片说明</span>
        </label>
      </div>
    </motion.div>
  )
}
