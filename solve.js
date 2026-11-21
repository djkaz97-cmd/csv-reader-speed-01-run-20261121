// solve.js - dependency-free ES module.
// run(input) returns exactly what csv-reader 1.0.0 returns for {text, header}:
// the JSON value {columns, rows, errors}, under csv-reader's own broken-row policy.
//
// Strategy: one left-to-right pass. Each record is located with a single native
// indexOf('\n'); the record segment is split with a single native split(',');
// only pieces that start with a quote (quoted fields) are scanned indexOf-by-
// indexOf over quotes/escapes/breaks. A quoted field still open at the record
// break is finished with a proven character-level reader. Unquoted pieces are
// pushed straight from split() - no per-field regex, no per-field closure.
//
// Policy (ground truth: the kit's vendor/csv-reader/index.js):
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; an empty line is no record;
//   - outside quotes, a lone CR (not followed by LF) is dropped (stray_cr) and
//     does not advance the line counter;
//   - a quoted field runs to the next non-doubled quote; "" is one quote; CRLF
//     or lone CR inside quotes become one LF and advance the line; what follows
//     the closing quote up to the next comma or line break is appended as it
//     stands (quote_junk when the field ends and something was appended);
//   - a never-closing quote is a literal character and the rest is re-read as
//     unquoted (unterminated_quote, line rewound to the opening quote);
//   - a quote inside an unquoted field is literal; fields stay strings;
//   - columns is the first record when header is true (else null; [] when there
//     are no records); rows holds the other records, padded with "" (short_row,
//     with fields) or cut (long_row, with extra) to the first record's width;
//   - each error is {code, line, row}: the 1-based line the record starts on
//     (LF, CRLF and lone CR inside quotes counted) and the record's index in
//     rows (null for the header), in the order met. A single empty unquoted
//     field is no record, but its stray_cr errors stay.

const CR = 13;
const LF = 10;
const COMMA = 44;
const QUOTE = 34;
const BOM = 0xFEFF;

const END_COMMA = 0;
const END_LINE = 1;
const END_TEXT = 2;

// Fallback readers (rare paths: a quote still open at the record break).
// Character-level scans identical in result to csv-reader's readQuoted /
// readUnquoted, running on the original text from a given position.
const reQuoted = /["\r\n]/g;
const reUnquoted = /[,\r\n]/g;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let i = 0; // next character to read
  let line = 1; // line that character is on
  if (n && text.charCodeAt(0) === BOM) i = 1;

  let recordLine = 1; // line the current record starts on
  let recordRow = null; // the record's index in rows (null: the header)

  // ---------- shared field accumulator (single slice or array of slices) ----------
  let scanSingle = undefined;
  let scanPieces = undefined;
  let scanAdded = 0;
  let scanEnded = 0;

  function addPiece(piece) {
    if (scanPieces !== undefined) {
      scanPieces.push(piece);
    } else if (scanSingle === undefined) {
      scanSingle = piece;
    } else {
      scanPieces = [scanSingle, piece];
      scanSingle = undefined;
    }
  }

  function fieldValue() {
    return scanPieces !== undefined
      ? scanPieces.join('')
      : scanSingle === undefined
        ? ''
        : scanSingle;
  }

  // Unquoted scan from outer `i` into the shared accumulator; the caller must
  // have reset scanSingle/scanPieces. Results via scanEnded / scanAdded.
  function scanCore() {
    let scanPos = i;
    while (true) {
      reUnquoted.lastIndex = scanPos;
      const m = reUnquoted.exec(text);
      const end = m === null ? n : m.index;
      if (end > scanPos) {
        addPiece(text.slice(scanPos, end));
        scanAdded += end - scanPos;
      }
      if (m === null) {
        i = n;
        scanEnded = END_TEXT;
        return;
      }
      const cc = text.charCodeAt(end);
      if (cc === COMMA) {
        i = end + 1;
        scanEnded = END_COMMA;
        return;
      }
      if (cc === LF) {
        i = end + 1;
        line += 1;
        scanEnded = END_LINE;
        return;
      }
      if (end + 1 < n && text.charCodeAt(end + 1) === LF) {
        i = end + 2;
        line += 1;
        scanEnded = END_LINE;
        return;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      scanPos = end + 1;
    }
  }

  // ---------- fallback: read one quoted field starting at text[openPos] === '"' ----------
  function readQuotedFieldAt(openPos) {
    const openLine = line;
    i = openPos + 1;
    scanSingle = undefined;
    scanPieces = undefined;
    let closed = false;
    let scanPos = i;
    while (scanPos < n) {
      reQuoted.lastIndex = scanPos;
      const m = reQuoted.exec(text);
      const end = m === null ? n : m.index;
      if (end > scanPos) addPiece(text.slice(scanPos, end));
      if (m === null) {
        i = n;
        break;
      }
      const cc = text.charCodeAt(end);
      if (cc === QUOTE) {
        if (end + 1 < n && text.charCodeAt(end + 1) === QUOTE) {
          addPiece('"');
          scanPos = end + 2;
          continue;
        }
        i = end + 1;
        closed = true;
        break;
      }
      if (cc === CR) {
        addPiece('\n');
        line += 1;
        i = end + 1;
        if (i < n && text.charCodeAt(i) === LF) i += 1;
        scanPos = i;
        continue;
      }
      addPiece('\n');
      line += 1;
      i = end + 1;
      scanPos = i;
      continue;
    }
    if (closed) {
      scanAdded = 0;
      scanCore();
      if (scanAdded > 0) {
        errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      }
    } else {
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      i = openPos + 1;
      line = openLine;
      scanSingle = undefined;
      scanPieces = ['"'];
      scanCore();
    }
    return { value: fieldValue(), ended: scanEnded };
  }

  // ---------- fallback: finish the current record field by field ----------
  let fieldsCur = [];
  let lastQuotedCur = false;
  let out = 0;
  function finishRecordViaV3() {
    while (true) {
      if (text.charCodeAt(i) === QUOTE) {
        const f = readQuotedFieldAt(i);
        fieldsCur[out++] = f.value;
        lastQuotedCur = true;
        if (f.ended !== END_COMMA) return;
      } else {
        scanSingle = undefined;
        scanPieces = undefined;
        scanCore();
        fieldsCur[out++] = fieldValue();
        lastQuotedCur = false;
        if (scanEnded !== END_COMMA) return;
      }
    }
  }

  // ---------- record-level processing (shared by every path) ----------
  function recordComplete() {
    if (fieldsCur.length === 1 && fieldsCur[0] === '' && !lastQuotedCur) return false;

    if (width < 0) width = fieldsCur.length;

    if (header && columns === null) {
      columns = fieldsCur;
      return true;
    }

    if (fieldsCur.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fieldsCur.length });
      while (fieldsCur.length < width) fieldsCur.push('');
    } else if (fieldsCur.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fieldsCur.splice(width) });
    }
    rows.push(fieldsCur);
    return true;
  }

  outer: while (true) {
    while (i < n) {
      const cc = text.charCodeAt(i);
      if (cc === LF) {
        i += 1;
        line += 1;
        continue;
      }
      if (cc === CR && i + 1 < n && text.charCodeAt(i + 1) === LF) {
        i += 2;
        line += 1;
        continue;
      }
      break;
    }
    if (i >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    const recStart = i;
    const nl = text.indexOf('\n', i);
    let segEnd;
    if (nl === -1) {
      segEnd = n;
      i = n;
    } else {
      segEnd = nl > recStart && text.charCodeAt(nl - 1) === CR ? nl - 1 : nl;
      i = nl + 1;
    }
    const seg = text.slice(recStart, segEnd);

    // -------- turn the record segment into fields --------
    fieldsCur = [];
    lastQuotedCur = false;
    let fellBack = false;

    if (seg.indexOf('"') === -1) {
      // Fast path: no quotes at all. Lone CRs are stray (dropped, error each).
      let nStray = 0;
      let pos = 0;
      while ((pos = seg.indexOf('\r', pos)) !== -1) {
        nStray += 1;
        pos += 1;
      }
      if (nStray > 0) {
        for (let k = 0; k < nStray; k++) {
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        }
      }
      fieldsCur = nStray > 0 ? seg.replace(/\r/g, '').split(',') : seg.split(',');
    } else {
      // Slow path: quotes present. Split on commas; only pieces starting with a
      // quote are scanned; commas inside quotes were split points and are
      // rejoined as content while scanning. The pieces array is reused in place
      // as the record's field array (compacted by out) to avoid a second
      // allocation and per-field push calls.
      const pieces = seg.split(',');
      const segHasCR = seg.indexOf('\r') !== -1;
      fieldsCur = pieces;
      out = 0;
      let p = 0;
      let segOffset = 0; // offset within seg of the current piece's start
      while (p < pieces.length) {
        const piece = pieces[p];
        if (piece.charCodeAt(0) === QUOTE) {
          // Quoted field starting at this piece. The common case is a simple
          // quoted field wholly inside this piece ("...", no escapes, no breaks,
          // no junk after the closing quote): a single slice, no join.
          const len = piece.length;
          const qi = piece.indexOf('"', 1);
          if (qi === len - 1 && !segHasCR) {
            fieldsCur[out++] = piece.slice(1, len - 1);
            lastQuotedCur = true;
            segOffset += len + (p === pieces.length - 1 ? 0 : 1);
            p += 1;
            continue;
          }
          // General case: scan indexOf-by-indexOf over quotes/escapes/breaks.
          const parts = [];
          let curP = p;
          let cur = piece;
          let k = 1; // skip the opening quote
          let closed = false;
          let openAtEnd = false;
          let junk = '';
          let sumLen = 0; // text length consumed from segOffset so far (piece chars)
          let crLine = 0; // line advances inside this quoted field (CR/CRLF inside quotes)
          scan: while (true) {
            const qi = cur.indexOf('"', k);
            const ri = cur.indexOf('\r', k);
            let next = -1;
            let nextIsQuote = false;
            if (qi !== -1 && (ri === -1 || qi <= ri)) {
              next = qi;
              nextIsQuote = true;
            } else if (ri !== -1) {
              next = ri;
            }
            if (next === -1) {
              parts.push(cur.slice(k));
              if (curP === pieces.length - 1) {
                openAtEnd = true;
                break scan;
              }
              parts.push(',');
              sumLen += cur.length;
              curP += 1;
              cur = pieces[curP];
              k = 0;
              continue;
            }
            if (nextIsQuote) {
              if (next + 1 < cur.length && cur.charCodeAt(next + 1) === QUOTE) {
                parts.push(cur.slice(k, next));
                parts.push('"');
                k = next + 2;
                continue;
              }
              parts.push(cur.slice(k, next));
              closed = true;
              sumLen += cur.length;
              const junkRaw = cur.slice(next + 1);
              const jStray = junkRaw.split('\r').length - 1;
              if (jStray > 0) {
                for (let k2 = 0; k2 < jStray; k2++) {
                  errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
                }
              }
              junk = junkRaw.replace(/\r/g, '');
              if (junk !== '') {
                errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
              }
              break scan;
            }
            // '\r' inside quotes: one LF, advances the line. A following '\n'
            // (CRLF) is skipped so it is not read as a second LF.
            parts.push(cur.slice(k, next));
            parts.push('\n');
            crLine += 1;
            k = next + 1;
            if (k < cur.length && cur.charCodeAt(k) === LF) k += 1;
            continue;
          }
          if (openAtEnd) {
            // The quote runs past this record's break: finish the field with
            // the character-level reader (may span further records or the text end).
            const openPos = recStart + segOffset;
            const f = readQuotedFieldAt(openPos);
            fieldsCur[out++] = f.value;
            lastQuotedCur = true;
            if (f.ended === END_COMMA) finishRecordViaV3();
            fellBack = true;
            break;
          }
          line += crLine;
          if (junk !== '') parts.push(junk);
          fieldsCur[out++] = parts.length === 1 ? parts[0] : parts.join('');
          lastQuotedCur = true;
          // Advance segOffset past this whole quoted field: all pieces p..curP
          // plus the commas between them (and after curP, unless it is last).
          segOffset += sumLen + (curP - p) + (curP === pieces.length - 1 ? 0 : 1);
          p = curP + 1;
          continue;
        } else {
          // Unquoted piece: a quote inside is literal; lone CRs are stray.
          let field = piece;
          if (segHasCR) {
            const ri = piece.indexOf('\r');
            if (ri !== -1) {
              let nStray = 0;
              let pos = ri;
              while ((pos = piece.indexOf('\r', pos)) !== -1) {
                nStray += 1;
                pos += 1;
              }
              if (nStray > 0) {
                for (let k2 = 0; k2 < nStray; k2++) {
                  errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
                }
              }
              field = piece.replace(/\r/g, '');
            }
          }
          fieldsCur[out++] = field;
          lastQuotedCur = false;
        }
        segOffset += piece.length + (p === pieces.length - 1 ? 0 : 1);
        p += 1;
      }
      fieldsCur.length = out;
    }

    if (fellBack) {
      fieldsCur.length = out;
      if (!recordComplete()) continue outer;
      continue outer; // i / line already advanced by the fallback readers
    }

    if (!recordComplete()) {
      if (nl !== -1) line += 1;
      continue outer;
    }
    // The record ended at the break consumed above (one line advance per break).
    if (nl !== -1) line += 1;

    continue outer;
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
