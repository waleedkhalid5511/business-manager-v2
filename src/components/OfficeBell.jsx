import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function OfficeBell({ profile }) {
  const [incomingCall, setIncomingCall] = useState(null)
  const [callerName, setCallerName] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    checkActiveCalls()

    const sub = supabase
      .channel(`bell-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'office_calls',
        filter: `receiver_id=eq.${profile.id}`
      }, async (payload) => {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', payload.new.caller_id)
          .single()
        setCallerName(data?.full_name || 'Someone')
        setIncomingCall(payload.new)
        playBell()
      })
      .subscribe()

    return () => sub.unsubscribe()
  }, [profile?.id])

  const checkActiveCalls = async () => {
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
      playBell()
    }
  }

  const playBell = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const playTone = (freq, start, dur) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = freq; o.type = 'sine'
        g.gain.setValueAtTime(0.3, ctx.currentTime + start)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
        o.start(ctx.currentTime + start)
        o.stop(ctx.currentTime + start + dur)
      }
      playTone(880, 0, 0.6); playTone(1100, 0.1, 0.4)
      playTone(880, 0.8, 0.6); playTone(1100, 0.9, 0.4)
      playTone(880, 1.6, 0.6); playTone(1100, 1.7, 0.4)
    } catch (e) {}
  }

  const respond = async (status) => {
    if (!incomingCall) return
    await supabase.from('office_calls').update({ status }).eq('id', incomingCall.id)
    setIncomingCall(null)
    setCallerName('')
  }

  if (!incomingCall) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.93)',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
    }}>
      {/* Pulse Rings */}
      <div style={{ position: 'relative', marginBottom: '48px' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: `${120 + i * 60}px`,
            height: `${120 + i * 60}px`,
            borderRadius: '50%',
            border: `2px solid rgba(215,25,32,${0.4 - i * 0.1})`,
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: `pulse ${1 + i * 0.3}s infinite`
          }} />
        ))}
        <div style={{
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #d71920, #8b0000)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '56px', position: 'relative', zIndex: 1,
          boxShadow: '0 0 40px rgba(215,25,32,0.6)',
          animation: 'redGlow 1s infinite'
        }}>🔔</div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '52px' }}>
        <div style={{
          color: 'rgba(255,255,255,0.5)', fontSize: '13px',
          fontWeight: '600', letterSpacing: '4px',
          textTransform: 'uppercase', marginBottom: '16px'
        }}>
          You're being called
        </div>
        <div style={{
          color: 'white', fontSize: '40px',
          fontWeight: '800', letterSpacing: '-1px', marginBottom: '10px'
        }}>
          {callerName}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '16px' }}>
          is calling you to the office
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <button onClick={() => respond('coming')} style={{
          padding: '16px 48px', borderRadius: '50px',
          background: 'linear-gradient(135deg, #16a34a, #15803d)',
          border: 'none', color: 'white',
          fontSize: '17px', fontWeight: '800',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 4px 24px rgba(22,163,74,0.5)',
          transition: 'all 0.2s'
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
        >
          ✅ Coming!
        </button>

        <button onClick={() => respond('dismissed')} style={{
          padding: '16px 40px', borderRadius: '50px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '17px', fontWeight: '700',
          cursor: 'pointer', transition: 'all 0.2s',
          backdropFilter: 'blur(10px)'
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        >
          ✕ Dismiss
        </button>
      </div>

      <div style={{
        position: 'absolute', bottom: '32px',
        color: 'rgba(255,255,255,0.25)', fontSize: '12px'
      }}>
        {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
