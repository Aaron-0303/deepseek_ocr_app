import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Cpu, HardDrive, Loader2, RefreshCw, Zap } from 'lucide-react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const statusText = {
  loading_cpu: '正在从磁盘加载模型',
  cpu_ready: '模型位于内存',
  loading_gpu: '正在加载到显存',
  gpu_ready: '模型已在显存中',
  offloading_cpu: '正在卸载到内存',
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
    const timer = setInterval(refreshStatus, 1500)
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
  const unavailable = !status || !!error

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2.5 ${gpuReady ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
          {gpuReady ? <Zap className="h-5 w-5" /> : <Cpu className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{statusText[status?.status] || '正在连接后端'}</p>
            <button onClick={refreshStatus} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-600" title="刷新状态">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {status?.device ? `设备：${status.device.toUpperCase()}` : '等待状态返回'}
          </p>
          {status?.cuda_allocated_mb != null && (
            <p className="mt-1 text-xs text-slate-400">显存 {status.cuda_allocated_mb} MB · 缓存 {status.cuda_reserved_mb} MB</p>
          )}
        </div>
      </div>

      {transitioning && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => runAction('load-gpu')}
          disabled={!cpuReady || actionLoading || transitioning}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {status?.status === 'loading_gpu' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          加载显存
        </button>
        <button
          onClick={() => runAction('offload-cpu')}
          disabled={!gpuReady || actionLoading || transitioning}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
        >
          {status?.status === 'offloading_cpu' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
          卸载内存
        </button>
      </div>

      {(error || unavailable) && error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}
    </div>
  )
}

export default ModelControl
