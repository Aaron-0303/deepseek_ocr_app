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
    <div className="glass p-4 rounded-2xl border border-white/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-xl ${gpuReady ? 'bg-cyan-500/15' : 'bg-purple-500/15'}`}>
            {gpuReady ? <Zap className="w-5 h-5 text-cyan-300" /> : <Cpu className="w-5 h-5 text-purple-300" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-200">模型资源状态</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${gpuReady ? 'bg-cyan-500/15 text-cyan-300' : 'bg-purple-500/15 text-purple-300'}`}>
                {status?.device?.toUpperCase() || '...' }
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {statusText[status?.status] || status?.message || '正在获取状态...'}
            </p>
            {status?.cuda_allocated_mb != null && (
              <p className="text-xs text-gray-500 mt-1">
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
                : 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
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
                : 'glass text-gray-200 hover:bg-white/10'
            }`}
            whileHover={gpuReady && !actionLoading && !transitioning ? { scale: 1.02 } : {}}
            whileTap={gpuReady && !actionLoading && !transitioning ? { scale: 0.98 } : {}}
          >
            {status?.status === 'offloading_cpu' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            卸载到内存
          </motion.button>

          <button
            onClick={refreshStatus}
            className="glass p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="刷新状态"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {transitioning && (
        <div className="mt-4 h-1.5 bg-dark-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full w-1/3 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full"
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
