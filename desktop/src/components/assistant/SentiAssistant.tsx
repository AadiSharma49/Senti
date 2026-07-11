import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAssistantStore, type AssistantStatus } from '../../state/assistantStore'

/**
 * SentiAssistant — the conversational agent surface. Tap the orb, speak, and
 * Senti answers out loud. A running transcript keeps the context visible.
 */

const STATUS_LABEL: Record<AssistantStatus, string> = {
  idle: 'Tap the orb and speak',
  loading: 'Waking up…',
  listening: 'Listening…',
  transcribing: 'Getting that…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

function MicOrb() {
  const status = useAssistantStore((s) => s.status)
  const active = status === 'listening'
  const working = status === 'thinking' || status === 'transcribing' || status === 'speaking' || status === 'loading'

  const onTap = () => {
    if (status === 'idle') void useAssistantStore.getState().startListen()
    else if (status === 'listening') useAssistantStore.getState().stopListen()
  }

  return (
    <button
      onClick={onTap}
      disabled={working}
      aria-label="Talk to Senti"
      className={`relative flex h-20 w-20 items-center justify-center rounded-full transition ${
        working ? 'cursor-default' : 'cursor-pointer hover:scale-105'
      } ${active ? 'bg-accent/20' : 'bg-white/5'} ring-1 ring-white/10`}
    >
      {(active || working) && (
        <motion.span
          className="absolute inset-0 rounded-full bg-accent/25"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: active ? 1.8 : 1.1, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="relative h-9 w-9 text-accent"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
        />
      </svg>
    </button>
  )
}

export default function SentiAssistant() {
  const open = useAssistantStore((s) => s.open)
  const status = useAssistantStore((s) => s.status)
  const messages = useAssistantStore((s) => s.messages)
  const error = useAssistantStore((s) => s.error)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, status])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="flex h-[76vh] w-full max-w-xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-black/40 glass-strong shadow-2xl shadow-cyan-500/10"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-accent">Assistant</div>
                <div className="mt-1 font-display text-xl text-white text-glow">Senti</div>
              </div>
              <button
                onClick={() => useAssistantStore.getState().hide()}
                aria-label="Close assistant"
                className="rounded-full p-2 text-secondary transition hover:bg-white/10 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="max-w-sm text-sm text-secondary">
                    Ask me anything — the weather, a fact, a plan for your day, or just talk. I answer out loud.
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-accent/15 text-white ring-1 ring-accent/20'
                        : 'bg-white/5 text-white/90 ring-1 ring-white/10'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {error && <div className="text-center text-xs text-red-300/80">{error}</div>}
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-3 border-t border-white/10 px-6 py-6">
              <MicOrb />
              <div className="text-xs uppercase tracking-[0.3em] text-secondary">{STATUS_LABEL[status]}</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
