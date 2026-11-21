// solve.js — csv-reader-speed-01-run-20261121 entry.
// A faster drop-in for csv-reader 1.0.0: run(input) returns exactly the same
// {columns, rows, errors} for every {text, header}, reading the text once,
// left to right. Same broken-row policy as the reference (BOM drop, empty
// lines skipped, stray CR dropped outside quotes, doubled quotes, CRLF/lone
// CR inside quotes read as LF, quote junk appended, unterminated quote read
// as a literal then re-read unquoted, pad/cut to the first record's width).
// Speed comes from bulk slices instead of per-character concatenation,
// charCodeAt scans, and no per-field result objects. Pure and deterministic.

const COMMA = 44, QUOTE = 34, LF = 10, CR = 13, BOM = 0xfeff;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === BOM ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;
  let fieldEnd = 2;   // 0 comma, 1 line break, 2 end
  let fieldAdded = 0; // characters kept by the last unquoted read

  // Unquoted run from pos: bulk-slice to the next comma or line break; a CR
  // not followed by LF is dropped with a stray_cr error and the run goes on.
  function readUnquoted(value) {
    let start = pos;
    let added = 0;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === COMMA) {
        const v = value + text.slice(start, pos);
        fieldAdded = added + pos - start;
        pos += 1; fieldEnd = 0;
        return v;
      }
      if (c === LF) {
        const v = value + text.slice(start, pos);
        fieldAdded = added + pos - start;
        pos += 1; line += 1; fieldEnd = 1;
        return v;
      }
      if (c === CR) {
        if (text.charCodeAt(pos + 1) === LF) {
          const v = value + text.slice(start, pos);
          fieldAdded = added + pos - start;
          pos += 2; line += 1; fieldEnd = 1;
          return v;
        }
        value += text.slice(start, pos);
        added += pos - start;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos += 1;
        start = pos;
        continue;
      }
      pos += 1;
    }
    const v = value + text.slice(start, pos);
    fieldAdded = added + pos - start;
    fieldEnd = 2;
    return v;
  }

  // Quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let start = pos;
    let value = '';
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === QUOTE) {
        if (text.charCodeAt(pos + 1) === QUOTE) {
          value += text.slice(start, pos) + '"';
          pos += 2; start = pos;
          continue;
        }
        value += text.slice(start, pos);
        pos += 1;
        if (pos >= n) { fieldEnd = 2; return value; }
        const t = text.charCodeAt(pos);
        if (t === COMMA) { pos += 1; fieldEnd = 0; return value; }
        if (t === LF) { pos += 1; line += 1; fieldEnd = 1; return value; }
        if (t === CR && text.charCodeAt(pos + 1) === LF) {
          pos += 2; line += 1; fieldEnd = 1; return value;
        }
        const jv = readUnquoted(value);
        if (fieldAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        return jv;
      }
      if (c === CR) {
        value += text.slice(start, pos) + '\n';
        line += 1;
        pos += text.charCodeAt(pos + 1) === LF ? 2 : 1;
        start = pos;
        continue;
      }
      if (c === LF) {
        line += 1; // the LF itself stays in the next slice
        pos += 1;
        continue;
      }
      pos += 1;
    }
    // Never closed: the quote is literal, re-read the rest as unquoted.
    pos = open + 1;
    line = openLine;
    errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
    return readUnquoted('"');
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === LF) { pos += 1; line += 1; }
      else if (c === CR && text.charCodeAt(pos + 1) === LF) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    let ended;
    do {
      quoted = text.charCodeAt(pos) === QUOTE;
      fields.push(quoted ? readQuoted() : readUnquoted(''));
      ended = fieldEnd;
    } while (ended === 0);
    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
