export async function exportCSV(filenameHint, csvString) {
  return await window.api.export.csv(filenameHint, csvString)
}

export async function exportPDF(filenameHint, htmlString) {
  return await window.api.export.pdf(filenameHint, htmlString)
}

export function toCSV(rows, columns) {
  // columns: [{key, header}]
  const header = columns.map((c) => escapeCSV(c.header)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escapeCSV(row[c.key])).join(','))
    .join('\n')
  return header + '\n' + body
}

function escapeCSV(value) {
  if (value == null) return ''
  const s = String(value)
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}