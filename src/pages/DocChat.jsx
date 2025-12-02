import { useEffect, useMemo, useRef, useState } from 'react'
import { docChat, refreshDocChatIndex, ipfsGatewayUrl } from '../api'

const initialMessage = {
  role: 'assistant',
  content: 'Hi! Ask me anything about the documents you have uploaded. I will cite the Pinata sources I rely on.'
}

export default function DocChat() {
  const [messages, setMessages] = useState([initialMessage])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState('')
  const [reindexing, setReindexing] = useState(false)
  const scrollRef = useRef(null)

  const chatHistoryPayload = useMemo(
    () =>
      messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
    [messages]
  )

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const handleSend = async event => {
    event?.preventDefault()
    if (!input.trim() || isThinking) return
    const userMessage = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setError('')
    setIsThinking(true)
    try {
      const response = await docChat(userMessage.content, [...chatHistoryPayload, userMessage])
      setMessages(prev => [...prev, { role: 'assistant', content: response.answer, sources: response.sources || [] }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }])
      setError(err.message)
    } finally {
      setIsThinking(false)
    }
  }

  const handleReindex = async () => {
    if (reindexing) return
    setReindexing(true)
    setError('')
    try {
      const result = await refreshDocChatIndex()
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Indexed ${result.chunks ?? 0} document chunks.`
        }
      ])
    } catch (err) {
      setError(err.message)
    } finally {
      setReindexing(false)
    }
  }

  return (
    <section className="min-h-screen pt-36 pb-16 px-4 sm:px-6 lg:px-12 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/50">Docs AI</p>
            <h1 className="text-3xl font-semibold">Chat with Decentralized documents</h1>
            <p className="text-white/70 text-sm sm:text-base">
              Powered by blockFiles.
            </p>
          </div>
          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="self-start rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reindexing ? 'Rebuilding…' : 'Rebuild index'}
          </button>
        </header>

        <div className="relative rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-2xl">
          <div ref={scrollRef} className="h-[28rem] overflow-y-auto p-6 space-y-4">
            {messages.map((message, idx) => (
              <MessageBubble key={`${message.role}-${idx}-${message.content.slice(0, 6)}`} {...message} />
            ))}
            {isThinking && (
              <div className="text-sm text-white/60">Thinking…</div>
            )}
          </div>
          <form onSubmit={handleSend} className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row">
            <input
              type="text"
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="Ask about a document, CID, or topic"
              className="flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/60"
            />
            <button
              type="submit"
              disabled={isThinking || !input.trim()}
              className="rounded-2xl bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send
            </button>
          </form>
          {error && <p className="px-6 pb-4 text-sm text-rose-300">{error}</p>}
        </div>
      </div>
    </section>
  )
}

function MessageBubble({ role, content, sources = [] }) {
  const isUser = role === 'user'
  return (
    <div className={isUser ? 'text-right' : 'text-left'}>
      <div
        className={
          'inline-flex max-w-full flex-col rounded-2xl px-4 py-3 text-left text-sm shadow-lg sm:max-w-3xl ' +
          (isUser ? 'bg-white/80 text-slate-900 ml-auto' : 'bg-black/40 text-white backdrop-blur')
        }
      >
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        {!isUser && sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
            {sources.map(source => (
              <a
                key={`${source.cid}-${source.rank}`}
                href={ipfsGatewayUrl(source.cid)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/20 px-3 py-1 transition hover:border-white/60"
              >
                {source.filename || source.cid} · #{source.rank}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
