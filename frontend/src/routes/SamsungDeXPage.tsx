import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  IconDeviceDesktop as Desktop,
  IconDeviceMobile as Phone,
  IconRefresh as Refresh,
  IconPlayerPlay as Play,
  IconPlayerStop as Stop,
  IconPlugConnected as Plug,
  IconLoader2 as Spinner,
  IconAlertTriangle as Warning,
  IconCircleCheck as Check,
} from '@tabler/icons-react'
import { useDeviceStore } from '@/stores/useDeviceStore'
import { Button } from '@/components/ui/button'
import { GetSamsungDeXStatus, SamsungDeXControl } from '../../bindings/ADBKit/internal/app/app'

type DeXStatus = {
  serial: string
  model: string
  android: string
  active: boolean
  displayId: number
  loopback: boolean
  connection: string
  canActivate: boolean
  warning: string
}

export default function SamsungDeXPage() {
  const devices = useDeviceStore(s => s.devices)
  const activeSerial = useDeviceStore(s => s.activeSerial)
  const setActiveSerial = useDeviceStore(s => s.setActiveSerial)
  const [status, setStatus] = useState<DeXStatus | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [bitrate, setBitrate] = useState(12)
  const [fps, setFps] = useState(60)
  const [attachId, setAttachId] = useState('')
  const selected = useMemo(() => devices.find(d => d.serial === activeSerial), [devices, activeSerial])

  const refresh = useCallback(async () => {
    if (!activeSerial) {setStatus(null); return}
    setBusy('Checking Samsung DeX…')
    setError('')
    try {
      const next = await GetSamsungDeXStatus(activeSerial)
      setStatus(next as DeXStatus)
    } catch(e) {
      setError(String(e))
      setStatus(null)
    } finally {setBusy('')}
  }, [activeSerial])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function perform(action: 'activate'|'attach'|'open'|'stop') {
    if (!activeSerial || busy) return
    if (action === 'stop' && !window.confirm('Stop only this phone’s localhost DeX session? Normal display 0 stays active.')) return
    setBusy(({
      activate:'Activating genuine Samsung DeX…',
      attach:'Attaching to external DeX desktop…',
      open:'Opening a separate DeX display…',
      stop:'Stopping loopback DeX…',
    })[action])
    setError('')
    setSuccess('')
    try {
      const targetAction = action === 'attach' && attachId.trim() ? 'attach:' + attachId.trim() : action
      const result = await SamsungDeXControl(activeSerial,targetAction,bitrate,fps)
      setSuccess(result)
      const next = await GetSamsungDeXStatus(activeSerial)
      setStatus(next as DeXStatus)
    } catch(e) {
      setError(String(e))
    } finally {setBusy('')}
  }

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
      transition={{duration:0.24}} className="flex h-full flex-col gap-5 overflow-y-auto pb-12">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Desktop className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Samsung DeX</h1>
            <p className="text-xs text-muted-foreground">Genuine dual-mode desktop · independent phone screen · no display 0 mirroring</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Desktop session</h2>
            <Button variant="outline" disabled={!!busy||!activeSerial} onClick={()=>void refresh()}>
              <Refresh className={busy?'animate-spin':''}/> Refresh
            </Button>
          </div>
          <label className="block space-y-2">
            <span className="text-xs text-muted-foreground">Target Samsung device</span>
            <select className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              value={activeSerial} disabled={!!busy}
              onChange={e=>setActiveSerial(e.currentTarget.value)}>
              {!activeSerial && <option value="">Select a device</option>}
              {devices.map(d=><option key={d.serial} value={d.serial}>{d.model||'Samsung'} · {d.serial}</option>)}
            </select>
          </label>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <Phone className="size-5 text-muted-foreground"/>
              <div className="flex-1">
                <div className="font-medium">{status?.model || selected?.model || 'No phone selected'}</div>
                <div className="text-xs text-muted-foreground">Android {status?.android||'—'} · {activeSerial||'No ADB connection'}</div>
              </div>
              <span className={'rounded-full px-2.5 py-1 text-xs font-semibold '+
                (status?.active?'bg-emerald-500/15 text-emerald-500':'bg-muted text-muted-foreground')}>
                {status?.active?'Dual-mode active':'Inactive'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-background/60 p-3"><div className="text-xs text-muted-foreground">Phone</div>
                <div className="font-semibold">Display 0</div></div>
              <div className="rounded-lg bg-background/60 p-3"><div className="text-xs text-muted-foreground">DeX desktop</div>
                <div className="font-semibold">{status?.active?'Display '+status.displayId:'Not running'}</div></div>
              <div className="rounded-lg bg-background/60 p-3"><div className="text-xs text-muted-foreground">Activator</div>
                <div className="font-semibold">{status?.loopback?'Phone loopback':status?.active?'External session':'Standby'}</div></div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={!activeSerial||!!busy||!status?.canActivate&&!status?.active} onClick={()=>void perform('open')}>
              <Play/> Launch genuine DeX
            </Button>
            <Button variant="secondary" disabled={!activeSerial||!!busy||(!status?.active&&!attachId.trim())} onClick={()=>void perform('attach')}>
              <Plug/> Attach existing DeX
            </Button>
            <Button variant="outline" disabled={!activeSerial||!!busy||!status?.canActivate||status?.active} onClick={()=>void perform('activate')}>
              <Desktop/> Activate only
            </Button>
            <Button variant="destructive" disabled={!activeSerial||!!busy||!status?.loopback} onClick={()=>void perform('stop')}>
              <Stop/> Stop loopback session
            </Button>
          </div>
          <AnimatePresence mode="wait">
            {busy && <motion.div key={busy} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0}}
               role="status" className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm text-primary">
               <Spinner className="size-4 animate-spin"/>{busy}
            </motion.div>}
          </AnimatePresence>
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <Warning className="size-5 shrink-0"/><span className="break-words">{error}</span></div>}
          {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-600">
            <Check className="size-5 shrink-0"/><span className="break-words">{success}</span></div>}
          {status?.warning && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-500">{status.warning}</div>}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 font-semibold">Stream settings</h2>
            <label className="block space-y-2 text-sm">
              <span className="text-muted-foreground">Video bitrate</span>
              <select value={bitrate} disabled={!!busy} onChange={e=>setBitrate(Number(e.target.value))}
               className="w-full rounded-lg border border-border bg-background p-2">
               {[4,6,8,12,16,20].map(n=><option key={n} value={n}>{n} Mb/s</option>)}
              </select>
            </label>
            <label className="mt-4 block space-y-2 text-sm">
              <span className="text-muted-foreground">Frame limit</span>
              <select value={fps} disabled={!!busy} onChange={e=>setFps(Number(e.target.value))}
               className="w-full rounded-lg border border-border bg-background p-2">
               {[30,45,60].map(n=><option key={n} value={n}>{n} FPS</option>)}
              </select>
            </label>
            <label className="mt-4 block space-y-2 text-sm">
              <span className="text-muted-foreground">External DeX display ID (optional)</span>
              <input type="number" min="1" max="255" inputMode="numeric" value={attachId}
                onChange={e=>setAttachId(e.currentTarget.value)}
                placeholder="Auto-detect · e.g. 8 on Note10"
                className="w-full rounded-lg border border-border bg-background p-2"
                aria-label="External DeX display ID override" />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              When Windows activates DeX on a separate display (for example, ID 8), enter that
              ID and click Attach. Display 0 is never allowed.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Note20 Snapdragon uses Qualcomm H.264. The Exynos Note10 uses its own encoder;
              the DeX bridge does not force Qualcomm encoding on that phone.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-2 font-semibold">How it works</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <strong>Activate</strong> uses Samsung’s own wireless DeX subsystem over a phone-local RTSP loopback.
              <strong> Attach</strong> connects scrcpy to an already-running genuine DeX display, including a
              Windows-activated session, without creating a generic virtual desktop.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
