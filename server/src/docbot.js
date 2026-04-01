import { createHash } from 'crypto'
import { TextDecoder } from 'util'
import pdf from 'pdf-parse'
import PDFParser from 'pdf2json'
import mammoth from 'mammoth'
import { query } from './db.js'
import { getIpfsClient } from './ipfs.js'

function normalizeGateway(raw) {
  const fallback = 'https://gateway.pinata.cloud'
  const candidate = raw?.trim() || fallback
  if (/^https?:\/\//i.test(candidate)) return candidate
  return `https://${candidate}`
}

const PINATA_GATEWAY = normalizeGateway(process.env.PINATA_GATEWAY).replace(/\/$/, '')
const PINATA_GATEWAY_KEY = (process.env.PINATA_GATEWAY_KEY || '').trim()
const MAX_FILES = Number(process.env.DOCBOT_MAX_FILES || 15)
const MAX_FILE_BYTES = Number(process.env.DOCBOT_MAX_FILE_BYTES || 50 * 1024 * 1024)
const MAX_CHUNKS_PER_FILE = Number(process.env.DOCBOT_MAX_CHUNKS_PER_FILE || 8)
const CHUNK_SIZE = Number(process.env.DOCBOT_CHUNK_SIZE || 900)
const CHUNK_OVERLAP = Number(process.env.DOCBOT_CHUNK_OVERLAP || 150)
const INDEX_METADATA_FALLBACK = (process.env.DOCBOT_INDEX_METADATA_FALLBACK || 'true').toLowerCase() !== 'false'
const INDEX_TTL = Number(process.env.DOCBOT_INDEX_TTL_MS || 5 * 60 * 1000)
const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const OPENROUTER_SITE_URL = (process.env.OPENROUTER_SITE_URL || '').trim()
const OPENROUTER_APP_NAME = (process.env.OPENROUTER_APP_NAME || '').trim()
const DEFAULT_CHAT_MODEL = process.env.OPENROUTER_CHAT_MODEL || 'openai/gpt-4o-mini'
const DEFAULT_EMBED_MODEL = process.env.OPENROUTER_EMBED_MODEL || 'openai/text-embedding-3-small'

const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY)

const indexState = {
  chunks: [],
  lastIndexed: 0,
  building: null,
  lastBuildStats: {
    filesSeen: 0,
    filesIndexed: 0,
    filesSkipped: 0,
    chunksCreated: 0,
    emptyTextFiles: 0,
    emptyChunkFiles: 0,
    metadataOnlyChunks: 0,
    fetchFailures: 0,
    embedFailures: 0,
    skipped: []
  }
}

function pushSkipped(stats, cid, reason) {
  if (stats.skipped.length < 10) {
    stats.skipped.push({ cid, reason })
  }
}

function ensureOpenRouter() {
  if (!hasOpenRouter) throw new Error('Doc chatbot requires OPENROUTER_API_KEY')
}

function openRouterHeaders() {
  const headers = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  }
  if (OPENROUTER_SITE_URL) headers['HTTP-Referer'] = OPENROUTER_SITE_URL
  if (OPENROUTER_APP_NAME) headers['X-Title'] = OPENROUTER_APP_NAME
  return headers
}

async function parseOpenRouterResponse(res, purpose) {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const details = body?.error?.message || body?.message || `${purpose} failed (${res.status})`
    throw new Error(details)
  }
  return body
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
    const primaryText = (parsed.text || '').trim()
    if (primaryText) return primaryText

    // Fallback for PDFs where pdf-parse returns no text but selectable text still exists.
    const pdfjsText = await parsePdfWithPdfJs(buffer)
    if (pdfjsText) return pdfjsText

    const pdf2jsonText = await parsePdfWithPdf2Json(buffer)
    return pdf2jsonText || ''
  } catch (err) {
    console.warn('Docbot PDF parse failed for buffer', err.message)
    try {
      const pdfjsText = await parsePdfWithPdfJs(buffer)
      if (pdfjsText) return pdfjsText

      const pdf2jsonText = await parsePdfWithPdf2Json(buffer)
      return pdf2jsonText || ''
    } catch (fallbackErr) {
      console.warn('Docbot PDF fallback parse failed', fallbackErr.message)
      return ''
    }
  }
}

async function parsePdfWithPdfJs(buffer) {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useWorkerFetch: false,
      disableFontFace: true
    })
    const doc = await loadingTask.promise
    const textParts = []

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      for (const item of content.items || []) {
        if (typeof item?.str === 'string' && item.str.trim()) {
          textParts.push(item.str)
        }
      }
    }

    const text = textParts.join(' ').replace(/\s+/g, ' ').trim()
    return text
  } catch (err) {
    throw new Error(`pdfjs extraction failed: ${err.message}`)
  }
}

async function parsePdfWithPdf2Json(buffer) {
  try {
    const text = await new Promise((resolve, reject) => {
      const parser = new PDFParser(null, 1)
      parser.on('pdfParser_dataError', err => reject(err?.parserError || err))
      parser.on('pdfParser_dataReady', data => {
        try {
          const pages = Array.isArray(data?.Pages) ? data.Pages : []
          const tokens = []
          for (const page of pages) {
            const texts = Array.isArray(page?.Texts) ? page.Texts : []
            for (const t of texts) {
              const runs = Array.isArray(t?.R) ? t.R : []
              for (const r of runs) {
                if (typeof r?.T === 'string' && r.T.length) {
                  tokens.push(decodeURIComponent(r.T))
                }
              }
            }
          }
          resolve(tokens.join(' '))
        } catch (mapErr) {
          reject(mapErr)
        }
      })
      parser.parseBuffer(buffer)
    })

    return String(text || '').replace(/\s+/g, ' ').trim()
  } catch (err) {
    throw new Error(`pdf2json extraction failed: ${err.message}`)
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

async function gatewayDataToBuffer(data) {
  if (!data) return Buffer.alloc(0)
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const buf = await data.arrayBuffer()
    return Buffer.from(buf)
  }
  if (typeof data === 'string') return Buffer.from(data, 'utf-8')
  if (typeof data === 'object') return Buffer.from(JSON.stringify(data))
  return Buffer.alloc(0)
}

async function downloadCidBytes(cid) {
  const client = await getIpfsClient().catch(err => {
    console.warn('Docbot Pinata client unavailable', err.message)
    return null
  })

  if (client?.gateways?.public?.get) {
    try {
      const sdkResponse = await client.gateways.public.get(cid)
      const buffer = await gatewayDataToBuffer(sdkResponse.data)
      return { buffer, contentType: sdkResponse.contentType || '' }
    } catch (err) {
      console.warn('Docbot Pinata SDK fetch failed for', cid, err.message)
    }
  }

  const gateway = PINATA_GATEWAY.endsWith('/ipfs') ? PINATA_GATEWAY : `${PINATA_GATEWAY}/ipfs`
  const keyQuery = PINATA_GATEWAY_KEY ? `?pinataGatewayKey=${encodeURIComponent(PINATA_GATEWAY_KEY)}` : ''
  const url = `${gateway}/${cid}${keyQuery}`
  const headers = PINATA_GATEWAY_KEY ? { 'x-pinata-gateway-key': PINATA_GATEWAY_KEY } : undefined
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Pinata fetch failed (${res.status}) for ${cid}`)
  const contentType = res.headers.get('content-type') || ''
  const arrayBuffer = await res.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), contentType }
}

async function fetchPinataText(cid) {
  const result = await downloadCidBytes(cid)
  if (!result) throw new Error(`Pinata fetch failed for ${cid}`)
  const { buffer, contentType } = result
  if (!buffer?.length) {
    console.warn('Docbot fetched empty buffer', { cid, contentType })
    return ''
  }
  const limitedBuffer = buffer.length > MAX_FILE_BYTES ? buffer.subarray(0, MAX_FILE_BYTES) : buffer
  const text = await extractTextFromBuffer(limitedBuffer, contentType, cid)
  if (!text || !text.trim()) {
    console.warn('Docbot extracted empty text', { cid, contentType, bytes: limitedBuffer.length })
  }
  return text
}

async function embedText(text) {
  ensureOpenRouter()
  const res = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model: DEFAULT_EMBED_MODEL,
      input: text
    })
  })
  const body = await parseOpenRouterResponse(res, 'Embedding request')
  const embedding = body?.data?.[0]?.embedding
  if (!Array.isArray(embedding) || !embedding.length) {
    throw new Error('Embedding request returned no vector')
  }
  return embedding
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

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 3)
}

function lexicalSimilarity(queryText, candidateText) {
  const queryTokens = new Set(tokenize(queryText))
  if (!queryTokens.size) return 0
  const candidateTokens = new Set(tokenize(candidateText))
  if (!candidateTokens.size) return 0
  let overlap = 0
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) overlap += 1
  }
  return overlap / queryTokens.size
}

async function buildEmbeddingIfPossible(text, stats) {
  try {
    return await embedText(text)
  } catch (err) {
    stats.embedFailures += 1
    return null
  }
}

async function buildDocIndex(force = false) {
  if (!hasOpenRouter) return []
  if (!force && indexState.chunks.length && Date.now() - indexState.lastIndexed < INDEX_TTL) {
    return indexState.chunks
  }
  if (indexState.building) return indexState.building

  indexState.building = (async () => {
    const { rows } = await query('SELECT filename, cid FROM files ORDER BY upload_date DESC LIMIT $1', [MAX_FILES])
    const freshChunks = []
    const stats = {
      filesSeen: rows.length,
      filesIndexed: 0,
      filesSkipped: 0,
      chunksCreated: 0,
      emptyTextFiles: 0,
      emptyChunkFiles: 0,
      metadataOnlyChunks: 0,
      fetchFailures: 0,
      embedFailures: 0,
      skipped: []
    }

    for (const file of rows) {
      const cid = file.cid
      try {
        const text = await fetchPinataText(cid)
        if (!text || !text.trim()) {
          stats.emptyTextFiles += 1
          if (INDEX_METADATA_FALLBACK) {
            const metadataText = `Metadata-only index entry. Content extraction failed for this file. Filename: ${file.filename || cid}. CID: ${cid}.`
            const embedding = await buildEmbeddingIfPossible(metadataText, stats)
            freshChunks.push({
              id: `${cid}:metadata`,
              cid,
              filename: file.filename || cid,
              text: metadataText,
              embedding,
              metadataOnly: true
            })
            stats.filesIndexed += 1
            stats.chunksCreated += 1
            stats.metadataOnlyChunks += 1
          } else {
            stats.filesSkipped += 1
            pushSkipped(stats, cid, 'No extractable text found (possibly scanned/image-only document)')
          }
          continue
        }

        const pieces = chunkText(text)
        if (!pieces.length) {
          stats.filesSkipped += 1
          stats.emptyChunkFiles += 1
          pushSkipped(stats, cid, 'Text extracted but produced no chunks')
          continue
        }

        let fileChunkCount = 0
        for (let i = 0; i < pieces.length; i++) {
          const chunkTextValue = pieces[i]
          const id = `${cid}:${sha1(chunkTextValue)}:${i}`
          const embedding = await buildEmbeddingIfPossible(chunkTextValue, stats)
          freshChunks.push({
            id,
            cid,
            filename: file.filename || cid,
            text: chunkTextValue,
            embedding
          })
          fileChunkCount += 1
        }
        if (fileChunkCount > 0) {
          stats.filesIndexed += 1
          stats.chunksCreated += fileChunkCount
        }
      } catch (err) {
        const message = err?.message || 'Unknown indexing error'
        stats.filesSkipped += 1
        stats.fetchFailures += 1
        pushSkipped(stats, cid, message)
        console.warn('Docbot chunking skipped for', cid, message)
      }
    }
    indexState.chunks = freshChunks
    indexState.lastIndexed = Date.now()
    indexState.lastBuildStats = stats
    return freshChunks
  })()

  try {
    return await indexState.building
  } finally {
    indexState.building = null
  }
}

export async function refreshDocIndex() {
  if (!hasOpenRouter) return { ok: false, reason: 'OPENROUTER_API_KEY missing' }
  await buildDocIndex(true)
  return {
    ok: true,
    chunks: indexState.chunks.length,
    stats: indexState.lastBuildStats
  }
}

export async function answerDocQuestion({ question, history = [] }) {
  if (!hasOpenRouter) {
    throw new Error('Doc chatbot disabled. Provide OPENROUTER_API_KEY to enable it.')
  }
  const prompt = question?.trim()
  if (!prompt) throw new Error('Question is required')
  const chunks = await buildDocIndex(false)
  if (!chunks.length) {
    const stats = indexState.lastBuildStats
    const filesSeen = stats?.filesSeen || 0
    const hasUploads = filesSeen > 0
    const hint = hasUploads
      ? 'Files are uploaded, but no readable text was extracted. This usually means scanned/image-only PDFs or unsupported formats.'
      : 'No uploaded files were found for indexing.'
    return {
      answer: `No documents are indexed yet. ${hint}`,
      sources: []
    }
  }

  let queryEmbedding = null
  try {
    queryEmbedding = await embedText(prompt)
  } catch (err) {
    queryEmbedding = null
  }

  const scored = chunks
    .map(chunk => {
      const hasVectors = Array.isArray(queryEmbedding) && Array.isArray(chunk.embedding)
      const score = hasVectors
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : lexicalSimilarity(prompt, `${chunk.filename || ''} ${chunk.text || ''}`)
      return { ...chunk, score }
    })
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
- Some chunks may be metadata-only fallbacks for files where content extraction failed. If only metadata is available, say so clearly and do not invent document contents.
- If the answer cannot be found in the context, state that clearly instead of guessing.`

  const promptParts = []
  if (historyText) promptParts.push(`Conversation so far:\n${historyText}`)
  promptParts.push(`Context:\n${context || 'None'}`)
  promptParts.push(`Question: ${prompt}`)

  ensureOpenRouter()
  let answer = ''
  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model: DEFAULT_CHAT_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: promptParts.join('\n\n') }
        ]
      })
    })
    const body = await parseOpenRouterResponse(res, 'Chat completion request')
    const rawAnswer = body?.choices?.[0]?.message?.content
    answer = typeof rawAnswer === 'string'
      ? rawAnswer
      : Array.isArray(rawAnswer)
        ? rawAnswer.map(part => (typeof part === 'string' ? part : part?.text || '')).join('').trim()
        : ''
  } catch (err) {
    const modelError = err?.message || 'Model request failed'
    const fileSummaries = scored
      .map(chunk => `- ${chunk.filename || chunk.cid} (${chunk.cid})${chunk.metadataOnly ? ' [metadata-only]' : ''}`)
      .join('\n')
    answer = `Model response unavailable (${modelError}). I can still confirm indexed files:\n${fileSummaries || '- none'}`
  }

  if (!answer) {
    answer = 'Model returned no answer text, but files were indexed. Try rephrasing your question.'
  }

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
  return hasOpenRouter
}
