/**
 * Bench the IT notice drafter across OpenAI models.
 *
 * Imports the REAL production prompt, so this measures what ships rather than
 * a paraphrase of it. Scores each model on the properties that actually decide
 * whether a CA can use the output — above all, whether it invents figures.
 *
 *   node scripts/compare-models.mts [path/to/notice.txt]
 *
 * Reads OPENAI_API_KEY from .env.local. Every run costs money; the table
 * reports what it cost.
 */
import fs from 'node:fs'
import OpenAI from 'openai'
import {
  NOTICE_RESPONSE_SYSTEM_PROMPT,
  buildNoticeUserPrompt,
} from '../lib/ai/prompts/notice-response.ts'

fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .forEach((line) => {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].trim()
  })

/** USD per 1M tokens, from https://developers.openai.com/api/docs/pricing */
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5.6-sol': { input: 4.0, output: 20.0 },
  'gpt-5.6-terra': { input: 2.0, output: 12.0 },
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
  'gpt-5.5': { input: 5.0, output: 30.0 },
  'gpt-5.4': { input: 2.5, output: 15.0 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-5': { input: 1.25, output: 10.0 },
  'gpt-5-mini': { input: 0.25, output: 2.0 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
}

const MODELS = process.env.COMPARE_MODELS?.split(',') ?? [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.4-mini',
  'gpt-5-mini',
  'gpt-5-nano',
]

const USD_TO_INR = 88

const noticePath = process.argv[2] ?? 'scripts/fixtures/notice-143-2.txt'
const noticeText = fs.readFileSync(noticePath, 'utf8')

const factsPath = noticePath.replace(/\.txt$/, '.facts.json')
const EXPECTED_FACTS: Record<string, string> = fs.existsSync(factsPath)
  ? JSON.parse(fs.readFileSync(factsPath, 'utf8'))
  : {}
const FACT_COUNT = Object.keys(EXPECTED_FACTS).length

/** The notice's own reference, whatever form it takes across notice types. */
const DIN_OR_REF =
  noticeText.match(/(?:DIN|Reference No)[:\s]+([A-Za-z0-9/()-]+)/)?.[1] ?? ''

const userPrompt = buildNoticeUserPrompt({
  noticeText,
  noticeType: process.env.COMPARE_NOTICE_TYPE ?? undefined,
  clientName: 'Ramesh Traders',
  firmName: 'Demo & Associates',
})

type Score = {
  model: string
  ok: boolean
  error?: string
  seconds: number
  inTokens: number
  outTokens: number
  inrPerDraft: number
  chars: number
  fabricatedAmounts: string[]
  placeholders: number
  keptDin: boolean
  answeredAllIssues: boolean
  replyParagraphs: number
  hedges: number
  mentionsChannel: boolean
  optionalTime: boolean
  markdownLeak: boolean
  register: number
  factsUsed: number
  factsMissed: string[]
}

function score(model: string, text: string, usage: { input: number; output: number }, seconds: number): Score {
  const price = PRICING[model]
  const usd = price
    ? (usage.input / 1e6) * price.input + (usage.output / 1e6) * price.output
    : 0

  // A rupee figure is FABRICATED only if it does not appear in the notice.
  // Some notices (GST ASMT-10 especially) state amounts themselves, and rule 2
  // of the prompt tells the model to carry those through — quoting them is
  // correct, not invention. Comparing on digits alone ignores ₹ vs Rs. and
  // any spacing difference.
  const noticeDigits = noticeText.replace(/[^0-9]/g, '')
  const fabricated = (text.match(/(?:₹|Rs\.?)\s?[0-9][0-9,]*(?:\.[0-9]+)?/g) ?? []).filter(
    (amount) => {
      const digits = amount.replace(/[^0-9]/g, '')
      return digits.length > 0 && !noticeDigits.includes(digits)
    }
  )

  const numbered = [...text.matchAll(/^\s*(\d+)\.\s+\S/gm)].map((m) => Number(m[1]))
  const replyParagraphs: number[] = []
  for (const n of numbered) {
    if (n === 1 && replyParagraphs.length > 0) break
    replyParagraphs.push(n)
  }

  // Facts the notice supplies verbatim, loaded from the fixture's sidecar.
  // Using a placeholder for any of these is caution misapplied — the model was
  // handed the answer.
  const missed = Object.entries(EXPECTED_FACTS)
    .filter(([, value]) => !text.includes(value))
    .map(([k]) => k)

  const registerMarkers = [
    /the assessee/i,
    /your good office/i,
    /respectfully submit/i,
    /Respected Sir\/Madam/,
    /Yours faithfully/i,
  ]

  return {
    model,
    ok: true,
    seconds,
    inTokens: usage.input,
    outTokens: usage.output,
    inrPerDraft: usd * USD_TO_INR,
    chars: text.length,
    fabricatedAmounts: fabricated,
    placeholders: (text.match(/\[[^\]]{3,}\]/g) ?? []).length,
    keptDin: DIN_OR_REF ? text.includes(DIN_OR_REF) : true,
    answeredAllIssues: replyParagraphs.length >= 2,
    replyParagraphs: replyParagraphs.length,
    hedges: (text.match(/furnished\/proposed to be furnished/gi) ?? []).length,
    mentionsChannel: /e-proceeding|e-filing portal/i.test(text),
    optionalTime: /\[Include only if additional time is needed:/i.test(text),
    markdownLeak: /\*\*|^#{1,6}\s|```/m.test(text),
    register: registerMarkers.filter((r) => r.test(text)).length,
    factsUsed: Object.keys(EXPECTED_FACTS).length - missed.length,
    factsMissed: missed,
  }
}

async function run(model: string): Promise<Score> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const started = Date.now()
  try {
    const response = await client.responses.create({
      model,
      instructions: NOTICE_RESPONSE_SYSTEM_PROMPT,
      input: userPrompt,
      max_output_tokens: 4000,
    })
    const seconds = (Date.now() - started) / 1000
    const text = response.output_text ?? ''
    if (!text.trim()) throw new Error('empty output')
    fs.mkdirSync('/tmp/model-drafts', { recursive: true })
    fs.writeFileSync(`/tmp/model-drafts/${model}.txt`, text)
    return score(
      model,
      text,
      { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 },
      seconds
    )
  } catch (error) {
    return {
      model,
      ok: false,
      error: (error as Error).message.slice(0, 90),
      seconds: (Date.now() - started) / 1000,
      inTokens: 0, outTokens: 0, inrPerDraft: 0, chars: 0,
      fabricatedAmounts: [], placeholders: 0, keptDin: false,
      answeredAllIssues: false, replyParagraphs: 0, hedges: 0,
      mentionsChannel: false, optionalTime: false, markdownLeak: false, register: 0,
      factsUsed: 0, factsMissed: [],
    }
  }
}

console.log(`Notice: ${noticePath} (${noticeText.length} chars)`)
console.log(`Models: ${MODELS.join(', ')}\n`)
console.log('Running all models in parallel…\n')

const results = await Promise.all(MODELS.map(run))

const yn = (v: boolean) => (v ? 'yes' : 'no ')
const pad = (s: string | number, n: number) => String(s).padEnd(n)

console.log('═'.repeat(112))
console.log(
  pad('MODEL', 16) + pad('SAFE', 6) + pad('SECS', 7) + pad('₹/DRAFT', 10) +
  pad('CHARS', 7) + pad('PARAS', 7) + pad('DIN', 5) + pad('PARAS>=2', 9) +
  pad('CHAN', 6) + pad('TIME?', 7) + pad('MD', 4) + pad('REG', 5) + 'FACTS'
)
console.log('═'.repeat(112))

for (const r of results) {
  if (!r.ok) {
    console.log(pad(r.model, 16) + 'FAILED — ' + r.error)
    continue
  }
  const safe = r.fabricatedAmounts.length === 0 ? 'PASS' : 'FAIL'
  console.log(
    pad(r.model, 16) +
    pad(safe, 6) +
    pad(r.seconds.toFixed(1), 7) +
    pad('₹' + r.inrPerDraft.toFixed(2), 10) +
    pad(r.chars, 7) +
    pad(r.replyParagraphs, 7) +
    pad(yn(r.keptDin), 5) +
    pad(yn(r.answeredAllIssues), 9) +
    pad(yn(r.mentionsChannel), 6) +
    pad(yn(r.optionalTime), 7) +
    pad(r.markdownLeak ? 'LEAK' : 'ok', 4) +
    pad(`${r.register}/5`, 5) +
    `${r.factsUsed}/${FACT_COUNT}`
  )
}
console.log('═'.repeat(112))

console.log('\nSAFETY DETAIL — any rupee figure below was INVENTED by the model:')
for (const r of results.filter((x) => x.ok)) {
  console.log(
    `  ${pad(r.model, 16)} ${r.fabricatedAmounts.length === 0
      ? 'clean (all amounts are placeholders)'
      : '*** ' + r.fabricatedAmounts.join(', ') + ' ***'}` +
    `   placeholders: ${r.placeholders}`
  )
}

const monthly = (inr: number, drafts: number) => `₹${(inr * drafts).toFixed(0)}`
console.log('\nFACTS THE NOTICE GAVE BUT THE MODEL PLACEHOLDERED (extra retyping for the CA):')
for (const r of results.filter((x) => x.ok)) {
  console.log(`  ${pad(r.model, 16)} ${r.factsMissed.length === 0 ? 'none — used everything' : r.factsMissed.join(', ')}`)
}

console.log('\nCOST AT SCALE (Solo plan = 20 drafts/month, at ₹999/month):')
for (const r of results.filter((x) => x.ok)) {
  console.log(
    `  ${pad(r.model, 16)} ${pad(monthly(r.inrPerDraft, 20), 10)}/CA/month` +
    `   = ${((r.inrPerDraft * 20 / 999) * 100).toFixed(1)}% of the subscription`
  )
}

console.log('\nDrafts written to /tmp/model-drafts/ for side-by-side reading.')
