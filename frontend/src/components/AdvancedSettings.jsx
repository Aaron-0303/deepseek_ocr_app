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
      className="glass panel-glow p-6 rounded-2xl space-y-4"
    >
      <div className="flex items-center gap-2">
        <Sliders className="w-5 h-5 text-cyan-300" />
        <h3 className="font-semibold text-white">Advanced Settings</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Base Size</label>
          <input
            type="number"
            value={settings.base_size}
            onChange={(e) => handleChange('base_size', parseInt(e.target.value))}
            className="w-full bg-slate-950/60 border border-cyan-100/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cyan-300/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Image Size</label>
          <input
            type="number"
            value={settings.image_size}
            onChange={(e) => handleChange('image_size', parseInt(e.target.value))}
            className="w-full bg-slate-950/60 border border-cyan-100/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cyan-300/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Crop Mode</label>
          <select
            value={settings.crop_mode ? 'true' : 'false'}
            onChange={(e) => handleChange('crop_mode', e.target.value === 'true')}
            className="w-full bg-slate-950/60 border border-cyan-100/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cyan-300/50"
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Test Compress</label>
          <select
            value={settings.test_compress ? 'true' : 'false'}
            onChange={(e) => handleChange('test_compress', e.target.value === 'true')}
            className="w-full bg-slate-950/60 border border-cyan-100/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cyan-300/50"
          >
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
        </div>
      </div>

      <div className="pt-2 border-t border-white/10">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeCaption}
            onChange={(e) => onIncludeCaptionChange(e.target.checked)}
            className="accent-cyan-400"
          />
          <span className="text-sm text-gray-300">Include image caption</span>
        </label>
      </div>
    </motion.div>
  )
}
