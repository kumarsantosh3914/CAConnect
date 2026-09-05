export type Invoice = {
  supplierGstin: string
  invoiceNumber: string
  invoiceDate: string
  amountPaise: number
}

export type Mismatch = {
  matchType: 'purchase_only' | 'gstr_only' | 'amount_mismatch'
  supplierGstin: string
  invoiceNumber: string
  invoiceDate: string | null
  purchaseAmountPaise: number | null
  gstrAmountPaise: number | null
  differencePaise: number
}

const REQUIRED_HEADERS = ['supplier_gstin', 'invoice_number', 'invoice_date', 'invoice_amount']

export function normalizeKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function parseAmount(value: string | number): number {
  const normalized = String(value).replace(/,/g, '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error(`Invalid invoice amount “${value}”.`)
  const [whole, fraction = ''] = normalized.split('.')
  return Number(whole) * 100 + Number((fraction + '00').slice(0, 2))
}

function assertDate(value: string): string {
  const indian = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (indian) return `${indian[3]}-${indian[2]}-${indian[1]}`
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime())) {
    throw new Error(`Invoice date “${value}” must be YYYY-MM-DD.`)
  }
  return value
}

function invoiceFrom(value: Record<string, unknown>, label: string): Invoice {
  const supplierGstin = normalizeKey(String(value.supplier_gstin ?? value.ctin ?? value.gstin ?? ''))
  const invoiceNumber = normalizeKey(String(value.invoice_number ?? value.inum ?? value.invoice_no ?? ''))
  const invoiceDate = String(value.invoice_date ?? value.idt ?? value.invoice_date ?? '')
  const amount = value.invoice_amount ?? value.val ?? value.invoice_value
  if (!supplierGstin || !invoiceNumber || !invoiceDate || amount === undefined || amount === null) {
    throw new Error(`${label} is missing supplier GSTIN, invoice number, date, or amount.`)
  }
  return { supplierGstin, invoiceNumber, invoiceDate: assertDate(invoiceDate), amountPaise: parseAmount(amount as string | number) }
}

/** Minimal RFC 4180 reader: quoted commas and escaped quotes are supported. */
function rows(csv: string): string[][] {
  const output: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i]
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i += 1 } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i += 1
      row.push(cell); cell = ''
      if (row.some((value) => value.trim())) output.push(row)
      row = []
    } else cell += char
  }
  row.push(cell)
  if (row.some((value) => value.trim())) output.push(row)
  return output
}

export function parsePurchaseCsv(csv: string): Invoice[] {
  const parsed = rows(csv.replace(/^\uFEFF/, ''))
  if (parsed.length < 2) throw new Error('The purchase register needs a header and at least one invoice.')
  const header = parsed[0].map((value) => value.trim().toLowerCase())
  const missing = REQUIRED_HEADERS.filter((name) => !header.includes(name))
  if (missing.length) throw new Error(`Missing CSV column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`)
  const invoices = parsed.slice(1).map((row, index) => {
    const record = Object.fromEntries(header.map((name, i) => [name, row[i] ?? '']))
    return invoiceFrom(record, `CSV row ${index + 2}`)
  })
  assertUnique(invoices, 'purchase register')
  return invoices
}

function extractGstrRows(value: unknown, output: Record<string, unknown>[] = [], supplierGstin?: string): Record<string, unknown>[] {
  if (Array.isArray(value)) value.forEach((item) => extractGstrRows(item, output, supplierGstin))
  else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const currentSupplier = typeof record.ctin === 'string' ? record.ctin : supplierGstin
    if (typeof record.inum === 'string' && record.idt && record.val !== undefined) {
      output.push({ ...record, ctin: currentSupplier })
    }
    Object.values(record).forEach((item) => extractGstrRows(item, output, currentSupplier))
  }
  return output
}

/** Reads the document rows from the GST portal's GSTR-2B B2B JSON export. */
export function parseGstr2bJson(json: string): Invoice[] {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error('The GSTR-2B file is not valid JSON.') }
  const raw = extractGstrRows(parsed)
  const invoices: Invoice[] = []
  for (const row of raw) {
    // The supplier GSTIN sits on a parent b2b row in official exports.
    const supplier = String(row.ctin ?? row.supplier_gstin ?? '')
    if (!supplier) continue
    invoices.push(invoiceFrom(row, 'GSTR-2B invoice'))
  }
  if (!invoices.length) throw new Error('No supported B2B invoices were found in this GSTR-2B JSON file.')
  assertUnique(invoices, 'GSTR-2B export')
  return invoices
}

function key(invoice: Invoice) { return `${invoice.supplierGstin}|${invoice.invoiceNumber}` }

function assertUnique(invoices: Invoice[], source: string) {
  const seen = new Set<string>()
  for (const invoice of invoices) {
    const value = key(invoice)
    if (seen.has(value)) throw new Error(`Duplicate GSTIN and invoice number in the ${source}: ${value}.`)
    seen.add(value)
  }
}

export function reconcile(purchases: Invoice[], gstrInvoices: Invoice[]): Mismatch[] {
  const gstrByKey = new Map(gstrInvoices.map((invoice) => [key(invoice), invoice]))
  const purchaseByKey = new Map(purchases.map((invoice) => [key(invoice), invoice]))
  const mismatches: Mismatch[] = []
  for (const purchase of purchases) {
    const gstr = gstrByKey.get(key(purchase))
    if (!gstr) mismatches.push({ matchType: 'purchase_only', supplierGstin: purchase.supplierGstin, invoiceNumber: purchase.invoiceNumber, invoiceDate: purchase.invoiceDate, purchaseAmountPaise: purchase.amountPaise, gstrAmountPaise: null, differencePaise: purchase.amountPaise })
    else if (purchase.amountPaise !== gstr.amountPaise) mismatches.push({ matchType: 'amount_mismatch', supplierGstin: purchase.supplierGstin, invoiceNumber: purchase.invoiceNumber, invoiceDate: purchase.invoiceDate, purchaseAmountPaise: purchase.amountPaise, gstrAmountPaise: gstr.amountPaise, differencePaise: purchase.amountPaise - gstr.amountPaise })
  }
  for (const gstr of gstrInvoices) if (!purchaseByKey.has(key(gstr))) {
    mismatches.push({ matchType: 'gstr_only', supplierGstin: gstr.supplierGstin, invoiceNumber: gstr.invoiceNumber, invoiceDate: gstr.invoiceDate, purchaseAmountPaise: null, gstrAmountPaise: gstr.amountPaise, differencePaise: -gstr.amountPaise })
  }
  return mismatches.sort((a, b) => a.supplierGstin.localeCompare(b.supplierGstin) || a.invoiceNumber.localeCompare(b.invoiceNumber))
}
