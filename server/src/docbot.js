import { GoogleGenerativeAI } from '@google/generative-ai'
import { createHash } from 'crypto'
import { TextDecoder } from 'util'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import { query } from './db.js'

function normalizeGateway(raw) {
  const fallback = 'https://gateway.pinata.cloud'
  const candidate = raw?.trim() || fallback
  if (/^https?:\/\//i.test(candidate)) return candidate
  return `https://${candidate}`
}

const PINATA_GATEWAY = normalizeGateway(process.env.PINATA_GATEWAY).replace(/\/$/, '')
const MAX_FILES = Number(process.env.DOCBOT_MAX_FILES || 15)
const MAX_FILE_BYTES = Number(process.env.DOCBOT_MAX_FILE_BYTES || 50 * 1024 * 1024)
const MAX_CHUNKS_PER_FILE = Number(process.env.DOCBOT_MAX_CHUNKS_PER_FILE || 8)
const CHUNK_SIZE = Number(process.env.DOCBOT_CHUNK_SIZE || 900)
const CHUNK_OVERLAP = Number(process.env.DOCBOT_CHUNK_OVERLAP || 150)
const INDEX_TTL = Number(process.env.DOCBOT_INDEX_TTL_MS || 5 * 60 * 1000)
const DEFAULT_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-pro'
const DEFAULT_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'text-embedding-004'

const hasGemini = Boolean(process.env.GEMINI_API_KEY)
const genAI = hasGemini ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null
let embedModel
let chatModel

const indexState = {
  chunks: [],
  lastIndexed: 0,
  building: null
}

function ensureGemini() {
  if (!genAI) throw new Error('Doc chatbot requires GEMINI_API_KEY')
  if (!embedModel) embedModel = genAI.getGenerativeModel({ model: DEFAULT_EMBED_MODEL })
  if (!chatModel) chatModel = genAI.getGenerativeModel({ model: DEFAULT_CHAT_MODEL })
}

function chunkText(raw) {
  if (!raw) return []
  const clean = raw.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const chunks = []
  let start = 0
  while (start < clean.length && chunks.length < MAX_CHUNKS_PER_FILE) {
    const end = Math.min(clean.length, start + CHUNK_SIZE)
    chunks.push(clean.slice(start, end))
    if (end === clean.length) break
    start = Math.max(0, end - CHUNK_OVERLAP)
  }
  return chunks
}

function sha1(text) {
  return createHash('sha1').update(text).digest('hex')
}

async function parsePdf(buffer) {
  try {
    const parsed = await pdf(buffer)
    return parsed.text || ''
  } catch (err) {
    console.warn('Docbot PDF parse failed for buffer', err.message)
    return ''
  }
}

async function parseDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  } catch (err) {
    console.warn('Docbot DOCX parse failed', err.message)
    return ''
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikePdf(contentType, cid) {
  return /application\/pdf/i.test(contentType) || (cid || '').toLowerCase().endsWith('.pdf')
}

function looksLikeDocx(contentType, cid) {
  return (
    /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i.test(contentType) ||
    /application\/msword/i.test(contentType) ||
    (cid || '').toLowerCase().endsWith('.docx')
  )
}

function looksLikeHtml(contentType, cid) {
  return /text\/html/i.test(contentType) || (cid || '').toLowerCase().endsWith('.html') || (cid || '').toLowerCase().endsWith('.htm')
}

function looksLikeCsv(contentType, cid) {
  return /text\/csv/i.test(contentType) || (cid || '').toLowerCase().endsWith('.csv')
}

async function extractTextFromBuffer(buffer, contentType, cid) {
  if (looksLikePdf(contentType, cid)) return parsePdf(buffer)
  if (looksLikeDocx(contentType, cid)) return parseDocx(buffer)
  if (looksLikeHtml(contentType, cid)) return stripHtml(buffer.toString('utf-8'))
  if (looksLikeCsv(contentType, cid)) return buffer.toString('utf-8')

  if (/application\/json/i.test(contentType) || (cid || '').toLowerCase().endsWith('.json')) {
    try {
      const json = JSON.parse(buffer.toString('utf-8'))
      return JSON.stringify(json, null, 2)
    } catch (err) {
      console.warn('Docbot JSON parse failed', err.message)
    }
  }

  if (/image\//i.test(contentType)) {
    return ''
  }

  const decoder = new TextDecoder('utf-8', { fatal: false })
  return decoder.decode(buffer)
}

async function fetchPinataText(cid) {
  const gateway = PINATA_GATEWAY.endsWith('/ipfs') ? PINATA_GATEWAY : `${PINATA_GATEWAY}/ipfs`
  const url = `${gateway}/${cid}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Pinata fetch failed (${res.status}) for ${cid}`)
  const contentType = res.headers.get('content-type') || ''
  const arrayBuffer = await res.arrayBuffer()
  const trimmedArrayBuffer = arrayBuffer.byteLength > MAX_FILE_BYTES ? arrayBuffer.slice(0, MAX_FILE_BYTES) : arrayBuffer
  const limitedBuffer = Buffer.from(trimmedArrayBuffer)
  const text = await extractTextFromBuffer(limitedBuffer, contentType, cid)
  if (!text || !text.trim()) {
    console.warn('Docbot extracted empty text', { cid, contentType, bytes: limitedBuffer.length })
  }
  return text
}

async function embedText(text) {
  ensureGemini()
  const result = await embedModel.embedContent(text)
  return result.embedding.values
}

function cosineSimilarity(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (!normA || !normB) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function buildDocIndex(force = false) {
  if (!hasGemini) return []
  if (!force && indexState.chunks.length && Date.now() - indexState.lastIndexed < INDEX_TTL) {
    return indexState.chunks
  }
  if (indexState.building) return indexState.building

  indexState.building = (async () => {
    const { rows } = await query('SELECT filename, cid FROM files ORDER BY upload_date DESC LIMIT $1', [MAX_FILES])
    const freshChunks = []
    for (const file of rows) {
      try {
        const text = await fetchPinataText(file.cid)
        if (!text) continue
        const pieces = chunkText(text)
        for (let i = 0; i < pieces.length; i++) {
          const chunkTextValue = pieces[i]
          const id = `${file.cid}:${sha1(chunkTextValue)}:${i}`
          const embedding = await embedText(chunkTextValue)
          freshChunks.push({
            id,
            cid: file.cid,
            filename: file.filename || file.cid,
            text: chunkTextValue,
            embedding
          })
        }
      } catch (err) {
        console.warn('Docbot chunking skipped for', file.cid, err.message)
      }
    }
    indexState.chunks = freshChunks
    indexState.lastIndexed = Date.now()
    indexState.building = null
    return freshChunks
  })()

  return indexState.building
}

export async function refreshDocIndex() {
  if (!hasGemini) return { ok: false, reason: 'GEMINI_API_KEY missing' }
  await buildDocIndex(true)
  return { ok: true, chunks: indexState.chunks.length }
}

export async function answerDocQuestion({ question, history = [] }) {
  if (!hasGemini) {
    throw new Error('Doc chatbot disabled. Provide GEMINI_API_KEY to enable it.')
  }
  const prompt = question?.trim()
  if (!prompt) throw new Error('Question is required')
  const chunks = await buildDocIndex(false)
  if (!chunks.length) {
    return {
      answer: 'No documents are indexed yet. Upload files to Pinata and try again.',
      sources: []
    }
  }
  const queryEmbedding = await embedText(prompt)
  const scored = chunks
    .map(chunk => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(5, chunks.length))

  const context = scored
    .map((chunk, idx) => `[#${idx + 1}] File: ${chunk.filename} (CID: ${chunk.cid})\n${chunk.text}`)
    .join('\n\n')

  const historyText = (history || [])
    .map(entry => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
    .join('\n')

  const instructions = `You are the blockFiles document assistant. Use the provided context chunks (linked to Pinata CIDs) to answer the latest user question.
- Cite supporting chunks inline using their reference number like [#1].
- If the answer cannot be found in the context, state that clearly instead of guessing.`

  const parts = [instructions]
  if (historyText) parts.push(`Conversation so far:\n${historyText}`)
  parts.push(`Context:\n${context || 'None'}`)
  parts.push(`Question: ${prompt}`)

  ensureGemini()
  const result = await chatModel.generateContent(parts.join('\n\n'))
  const answer = result.response.text()

  return {
    answer,
    sources: scored.map((chunk, index) => ({
      rank: index + 1,
      cid: chunk.cid,
      filename: chunk.filename,
      score: Number(chunk.score.toFixed(4)),
      preview: chunk.text.slice(0, 220)
    }))
  }
}

export function docBotEnabled() {
  return hasGemini
}
