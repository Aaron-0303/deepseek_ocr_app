import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, HardDrive, Loader2, RefreshCw, AlertTriangle, Zap } from 'lucide-react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const statusText = {
  loading_cpu: '正在从磁盘加载模型到内存',
  cpu_ready: '模型位于内存（CPU）',
  loading_gpu: '正在从内存加载到显存',
  gpu_ready: '模型已加载到显存（GPU）',
  offloading_cpu: '正在从显存卸载到内存',
  error: '模型状态异常',
}

function ModelControl() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/model/status`)
      setStatus(response.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || '无法获取模型状态')
    }
  }, [])

  useEffect(() => {
    refreshStatus()
    const timer = setInterval(refreshStatus, 1000)
    return () => clearInterval(timer)
  }, [refreshStatus])

  const runAction = async (action) => {
    setActionLoading(true)
    setError(null)
    try {
      await axios.post(`${API_BASE}/model/${action}`)
      await refreshStatus()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || '模型切换失败')
    } finally {
      setActionLoading(false)
    }
  }

  const transitioning = ['loading_cpu', 'loading_gpu', 'offloading_cpu'].includes(status?.status)
  const gpuReady = status?.status === 'gpu_ready'
  const cpuReady = status?.status === 'cpu_ready'

  return (
    <div className="glass panel-glow p-5 rounded-2xl border-cyan-200/15">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-3 rounded-2xl border ${gpuReady ? 'bg-emerald-400/10 border-emerald-300/20' : 'bg-cyan-400/10 border-cyan-300/20'}`}>
            {gpuReady ? <Zap className="w-5 h-5 text-emerald-300" /> : <Cpu className="w-5 h-5 text-cyan-200" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">模型资源状态</span>
              <span className={`text-xs px-2.5 py-1 rounded-full border ${gpuReady ? 'bg-emerald-400/10 border-emerald-300/20 text-emerald-200' : 'bg-cyan-400/10 border-cyan-300/20 text-cyan-100'}`}>
                {status?.device?.toUpperCase() || '...' }
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {statusText[status?.status] || status?.message || '正在获取状态...'}
            </p>
            {status?.cuda_allocated_mb != null && (
              <p className="text-xs text-slate-500 mt-1">
                GPU 已分配 {status.cuda_allocated_mb} MB / 缓存 {status.cuda_reserved_mb} MB
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <motion.button
            onClick={() => runAction('load-gpu')}
            disabled={!cpuReady || actionLoading || transitioning}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
              !cpuReady || actionLoading || transitioning
                ? 'opacity-40 cursor-not-allowed glass text-gray-400'
                : 'bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20'
            }`}
            whileHover={cpuReady && !actionLoading && !transitioning ? { scale: 1.02 } : {}}
            whileTap={cpuReady && !actionLoading && !transitioning ? { scale: 0.98 } : {}}
          >
            {status?.status === 'loading_gpu' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            加载到 GPU
          </motion.button>

          <motion.button
            onClick={() => runAction('offload-cpu')}
            disabled={!gpuReady || actionLoading || transitioning}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
              !gpuReady || actionLoading || transitioning
                ? 'opacity-40 cursor-not-allowed glass text-gray-400'
                : 'border border-cyan-200/15 bg-white/5 text-cyan-50 hover:bg-cyan-300/10'
            }`}
            whileHover={gpuReady && !actionLoading && !transitioning ? { scale: 1.02 } : {}}
            whileTap={gpuReady && !actionLoading && !transitioning ? { scale: 0.98 } : {}}
          >
            {status?.status === 'offloading_cpu' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            卸载到内存
          </motion.button>

          <button
            onClick={refreshStatus}
            className="border border-cyan-200/15 bg-white/5 p-2.5 rounded-xl text-cyan-100/70 hover:text-white hover:bg-cyan-300/10 transition-colors"
            title="刷新状态"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {transitioning && (
        <div className="mt-4 h-1.5 bg-slate-900 rounded-full overflow-hidden">
          <motion.div
            className="h-full w-1/3 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 rounded-full shadow-[0_0_14px_rgba(34,211,238,0.8)]"
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

export default ModelControl
