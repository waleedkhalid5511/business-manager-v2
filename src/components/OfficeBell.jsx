import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function OfficeBell({ profile }) {
  const [incomingCall, setIncomingCall] = useState(null)
  const [callerName, setCallerName] = useState('')
  const bellIntervalRef = useRef(null)
  const audioCtxRef = useRef(null)

  useEffect(() => {
    if (!profile?.id) return

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    checkActiveCalls()

    const sub = supabase
      .channel(`bell-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'office_calls',
        filter: `receiver_id=eq.${profile.id}`
      }, async (payload) => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.caller_id)
            .single()

          const name = data?.full_name || 'Someone'
          setCallerName(name)
          setIncomingCall(payload.new)
          startBellLoop()
          showBrowserNotification(name)
        } catch (e) {
          console.error('Bell error:', e)
        }
      })
      .subscribe()

    return () => {
      sub?.unsubscribe()
      stopBellLoop()
    }
  }, [profile?.id])

  // Stop bell when call is answered/dismissed
  useEffect(() => {
    if (!incomingCall) {
      stopBellLoop()
    }
  }, [incomingCall])

  const checkActiveCalls = async () => {
    try {
      const { data } = await supabase
        .from('office_calls')
        .select('*, caller:profiles!office_calls_caller_id_fkey(full_name)')
        .eq('receiver_id', profile.id)
        .eq('status', 'ringing')
        .order('created_at', { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        setIncomingCall(data[0])
        setCallerName(data[0].caller?.full_name || 'Someone')
        startBellLoop()
        showBrowserNotification(data[0].caller?.full_name || 'Someone')
      }
    } catch (e) {}
  }

  const showBrowserNotification = (name) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification('🔔 Office Bell!', {
          body: `${name} is calling you to the office`,
          icon: '/favicon.ico',
          requireInteraction: true, // stays until user interacts
          tag: 'office-bell' // replace existing notification
        })
        notif.onclick = () => {
          window.focus()
          notif.close()
        }
      }
    } catch (e) {}
  }

  const playBellOnce = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx

      const playTone = (freq, start, dur, vol = 0.3) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = freq; o.type = 'sine'
        g.gain.setValueAtTime(vol, ctx.currentTime + start)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
        o.start(ctx.currentTime + start)
        o.stop(ctx.currentTime + start + dur)
      }

      // Bell pattern: ding dong ding dong
      playTone(1320, 0.0, 0.5, 0.4)
      playTone(1100, 0.2, 0.4, 0.3)
      playTone(1320, 0.8, 0.5, 0.4)
      playTone(1100, 1.0, 0.4, 0.3)
    } catch (e) {}
  }

  const startBellLoop = () => {
    stopBellLoop() // clear any existing
    playBellOnce()
    // Repeat every 3 seconds
    bellIntervalRef.current = setInterval(() => {
      playBellOnce()
    }, 3000)
  }

  const stopBellLoop = () => {
    if (bellIntervalRef.current) {
      clearInterval(bellIntervalRef.current)
      bellIntervalRef.current = null
    }
    try {
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
        audioCtxRef.current = null
      }
    } catch (e) {}
  }

  const respond = async (status) => {
    if (!incomingCall) return
    stopBellLoop()
    try {
      await supabase.from('office_calls').update({ status }).eq('id', incomingCall.id)
      // Close browser notification if open
      if ('Notification' in window) {
        // Can't directly close but tag will replace it
      }
    } catch (e) {}
    setIncomingCall(null)
    setCallerName('')
  }

  if (!incomingCall) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.95)',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
    }}>
      {/* Pulse Rings */}
      <div style={{ position: 'relative', marginBottom: '48px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: `${120 + i * 60}px`,
            height: `${120 + i * 60}px`,
            borderRadius: '50%',
            border: `2px solid rgba(215,25,32,${0.5 - i * 0.12})`,
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: `pulse ${1 + i * 0.4}s ease-in-out infinite`
          }} />
        ))}
        <div style={{
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #d71920, #8b0000)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '56px', position: 'relative', zIndex: 1,
          boxShadow: '0 0 50px rgba(215,25,32,0.7)',
          animation: 'redGlow 1s infinite'
        }}>🔔</div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '52px' }}>
        <div style={{
          color: 'rgba(255,255,255,0.5)', fontSize: '12px',
          fontWeight: '600', letterSpacing: '5px',
          textTransform: 'uppercase', marginBottom: '16px'
        }}>
          You're being called
        </div>
        <div style={{
          color: 'white', fontSize: '42px', fontWeight: '800',
          letterSpacing: '-1px', marginBottom: '10px'
        }}>
          {callerName}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>
          is calling you to the office
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <button onClick={() => respond('coming')} style={{
          padding: '18px 52px', borderRadius: '50px',
          background: 'linear-gradient(135deg, #16a34a, #15803d)',
          border: 'none', color: 'white',
          fontSize: '18px', fontWeight: '800',
          cursor: 'pointer',
          boxShadow: '0 6px 28px rgba(22,163,74,0.5)',
          transition: 'all 0.2s'
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          ✅ Coming!
        </button>
        <button onClick={() => respond('dismissed')} style={{
          padding: '18px 44px', borderRadius: '50px',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.65)',
          fontSize: '18px', fontWeight: '700',
          cursor: 'pointer', transition: 'all 0.2s'
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
        >
          ✕ Dismiss
        </button>
      </div>

      <div style={{
        position: 'absolute', bottom: '32px',
        color: 'rgba(255,255,255,0.2)', fontSize: '12px'
      }}>
        {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
