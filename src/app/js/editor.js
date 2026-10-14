/* =========================================================
   CodeLite :: editor.js
   Core editor: highlight layer, gutter, scroll sync,
   indentation, bracket handling, find matches.
   ========================================================= */
window.CLEditor = (function () {
  'use strict';

  var PLAIN_LIMIT = 400000;   // above this we skip syntax highlighting

  var PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

  function Editor(ref) {
    this.ta = ref.textarea;
    this.hl = ref.highlight;
    this.gutter = ref.gutterInner;
    this.gutterLayer = ref.gutterLayer;
    this.curLine = ref.currentLine;
    this.viewport = ref.viewport;

    this.settings = { fontSize: 14, tabSize: 2, wordWrap: false };
    this.lang = 'plain';
    this.matches = [];
    this.curMatch = -1;
    this.lineStarts = [0];
    this.lineCount = 1;
    this.listeners = { change: [], cursor: [], stats: [] };

    var self = this;
    this._renderPending = false;
    this._lastText = '';

    this.ta.addEventListener('input', function () { self._onInput(); });
    this.ta.addEventListener('scroll', function () { self._syncScroll(); });
    ['keyup', 'click', 'focus', 'select'].forEach(function (ev) {
      self.ta.addEventListener(ev, function () { self._emitCursor(); });
    });
    this.ta.addEventListener('keydown', function (e) { self._onKeyDown(e); });
    this.ta.addEventListener('click', function (e) { self._onClick(e); });
    this.ta.addEventListener('dblclick', function (e) { self._onDoubleClick(e); });
  }

  /* ---------- events ---------- */
  Editor.prototype.on = function (name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); return this; };
  Editor.prototype._fire = function (name, arg) { (this.listeners[name] || []).forEach(function (f) { f(arg); }); };

  /* ---------- settings ---------- */
  Editor.prototype.setSettings = function (s) {
    Object.assign(this.settings, s || {});
    var fs = this.settings.fontSize;
    var lh = Math.round(fs * 1.5);
    var root = document.documentElement.style;
    root.setProperty('--fs', fs + 'px');
    root.setProperty('--lh', lh + 'px');
    root.setProperty('--tabw', this.settings.tabSize + 'ch');

    var wrap = !!this.settings.wordWrap;
    this.ta.classList.toggle('wrap', wrap);
    this.hl.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
    this.hl.style.wordBreak = wrap ? 'break-word' : 'normal';
    this.hl.style.right = wrap ? '0' : 'auto';
    this.render(true);
  };

  /* ---------- text ---------- */
  Editor.prototype.setText = function (text, lang) {
    if (lang !== undefined) this.lang = lang || 'plain';
    this.ta.value = text == null ? '' : String(text);
    this._lastText = this.ta.value;
    this.matches = [];
    this.curMatch = -1;
    this._computeLines();
    this.render(true);
    this._emitCursor();
    this._fire('stats', this.getStats());
  };

  Editor.prototype.getText = function () { return this.ta.value; };

  Editor.prototype.setLang = function (lang) {
    this.lang = lang || 'plain';
    this._computeLines();
    this.render(true);
  };

  Editor.prototype.focus = function () { this.ta.focus(); };

  Editor.prototype._onInput = function () {
    this._computeLines();
    this.render();
    this._emitCursor();
    this._fire('change', this.ta.value);
  };

  /* ---------- line index ---------- */
  Editor.prototype._computeLines = function () {
    var v = this.ta.value;
    if (v.length > 4000000) { this.lineStarts = [0]; this.lineCount = 1; return; }
    var starts = [0];
    for (var i = 0; i < v.length; i++) if (v.charCodeAt(i) === 10) starts.push(i + 1);
    this.lineStarts = starts;
    this.lineCount = starts.length;
  };

  Editor.prototype.posToLine = function (pos) {
    var s = this.lineStarts, lo = 0, hi = s.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (s[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo;
  };

  Editor.prototype.lineToPos = function (line) {
    line = Math.max(0, Math.min(this.lineCount - 1, line));
    return this.lineStarts[line];
  };

  Editor.prototype.getStats = function () {
    var v = this.ta.value;
    return { lines: this.lineCount, chars: v.length, bytes: new Blob([v]).size };
  };

  Editor.prototype.getSelection = function () { return this.ta.selectionStart; };

  /* ---------- rendering ---------- */
  Editor.prototype.render = function (force) {
    var self = this;
    if (this._renderPending && !force) return;
    this._renderPending = true;
    var run = function () {
      self._renderPending = false;
      self._doRender();
    };
    if (force) { clearTimeout(this._rt); run(); }
    else { clearTimeout(this._rt); this._rt = setTimeout(run, 32); }
  };

  Editor.prototype._doRender = function () {
    var v = this.ta.value;
    var text = this.lang === 'plain' ? null : v;
    if (text !== null && text.length > PLAIN_LIMIT) text = null;

    if (text === null) {
      this.hl.textContent = v || '';
      this._tokens = null;
    } else {
      this._tokens = CLHighlight.tokenize(text, this.lang);
      this.hl.innerHTML = CLHighlight.render(text, this._tokens, this.matches, this.curMatch) || '';
    }

    this._renderGutter();
    this._syncScroll();
    if (window.__clMinimap && this._tokens) {
      window.__clMinimap.draw(v, this._tokens);
    } else if (window.__clMinimap) {
      window.__clMinimap.clear();
    }
    this._emitCursor();
  };

  Editor.prototype._renderGutter = function () {
    var n = this.lineCount;
    if (n > 20000) {
      this.gutter.textContent = '';
      return;
    }
    if (this._gutterN === n && this._gutterCur === this._curLineIdx) return;
    this._gutterN = n;
    var html = '';
    for (var i = 1; i <= n; i++) html += '<div class="gl" data-l="' + i + '">' + i + '</div>';
    this.gutter.innerHTML = html;
    this._gutterCur = -1;
  };

  Editor.prototype._markGutterLine = function (line) {
    if (this._gutterCur === line) return;
    var prev = this.gutter.children[this._gutterCur];
    if (prev) prev.classList.remove('cur');
    var cur = this.gutter.children[line];
    if (cur) cur.classList.add('cur');
    this._gutterCur = line;
  };

  Editor.prototype._syncScroll = function () {
    var st = this.ta.scrollTop, sl = this.ta.scrollLeft;
    this.hl.style.transform = 'translate(' + (-sl) + 'px,' + (-st) + 'px)';
    this.gutter.style.transform = 'translateY(' + (-st) + 'px)';

    var lh = Math.round(this.settings.fontSize * 1.5);
    var line = this._curLineIdx || 0;
    this.curLine.style.top = (8 + line * lh - st) + 'px';
    this.curLine.classList.toggle('on', document.activeElement === this.ta);

    if (window.__clMinimap) {
      window.__clMinimap.setViewport(st, this.ta.clientHeight, this.ta.scrollHeight);
    }

    if (line !== undefined && this._gutterCur !== line) this._markGutterLine(line);
  };

  Editor.prototype._emitCursor = function () {
    var pos = this.ta.selectionStart;
    var line = this.posToLine(pos);
    var ls = this.lineStarts[line];
    var col = pos - ls + 1;
    this._curLineIdx = line;
    this._syncScroll();
    this._fire('cursor', {
      line: line + 1, col: col, pos: pos,
      selStart: this.ta.selectionStart,
      selEnd: this.ta.selectionEnd,
      selected: this.ta.selectionEnd - this.ta.selectionStart
    });
  };

  /* ---------- selection helpers ---------- */
  Editor.prototype.setSelection = function (s, e, focus) {
    if (focus) this.ta.focus();
    this.ta.setSelectionRange(s, e === undefined ? s : e);
    this._emitCursor();
  };

  Editor.prototype.replaceRange = function (start, end, text, selStart, selEnd) {
    this.ta.focus();
    this.ta.setSelectionRange(start, end);
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) {
      var v = this.ta.value;
      this.ta.value = v.slice(0, start) + text + v.slice(end);
      this.ta.dispatchEvent(new Event('input', { bubbles: true }));
      if (selStart !== undefined) this.ta.setSelectionRange(selStart, selEnd !== undefined ? selEnd : selStart);
    }
    this._emitCursor();
  };

  Editor.prototype.insertText = function (text) {
    this.replaceRange(this.ta.selectionStart, this.ta.selectionEnd, text,
      this.ta.selectionStart + text.length);
  };

  Editor.prototype.revealLine = function (line) {
    var lh = Math.round(this.settings.fontSize * 1.5);
    var y = 8 + line * lh;
    var st = this.ta.scrollTop, vh = this.ta.clientHeight;
    if (y < st + lh || y > st + vh - lh * 2) {
      this.ta.scrollTop = Math.max(0, y - vh / 2);
    }
    this._syncScroll();
  };

  Editor.prototype.gotoLine = function (line) {
    var l = Math.max(0, Math.min(this.lineCount - 1, line - 1));
    var p = this.lineToPos(l);
    this.setSelection(p, p, true);
    this.revealLine(l);
  };

  Editor.prototype.revealPos = function (pos) {
    var line = this.posToLine(pos);
    this.revealLine(line);
    return line;
  };

  /* ---------- find matches ---------- */
  Editor.prototype.setMatches = function (ranges, cur) {
    this.matches = ranges || [];
    this.curMatch = cur === undefined ? -1 : cur;
    this.render(true);
  };

  Editor.prototype.clearMatches = function () {
    if (!this.matches.length) return;
    this.matches = [];
    this.curMatch = -1;
    this.render(true);
  };

  Editor.prototype.selectMatch = function (idx) {
    if (!this.matches.length) return;
    idx = ((idx % this.matches.length) + this.matches.length) % this.matches.length;
    var r = this.matches[idx];
    this.curMatch = idx;
    this.setSelection(r[0], r[1], true);
    this.revealPos(r[0]);
    this.render(true);
    this._fire('matchChange', { index: idx, count: this.matches.length });
  };

  Editor.prototype.nextMatch = function (delta) {
    if (!this.matches.length) return;
    var base = this.curMatch < 0 ? (delta > 0 ? -1 : 0) : this.curMatch;
    this.selectMatch(base + delta);
  };

  /* ---------- mouse ---------- */
  Editor.prototype._onClick = function (e) {
    if (this.settings.wordWrap) return;
    var line = this._lineFromY(e.clientY);
    if (line < 0) return;
    var pos = this.lineToPos(line);
    this._lastClickLine = line;
    this._lastClickTime = Date.now();
  };

  Editor.prototype._onDoubleClick = function (e) {
    var line = this._lineFromY(e.clientY);
    if (line < 0) return;
    var start = this.lineToPos(line);
    var v = this.ta.value;
    var end = start;
    var ls = this.lineStarts[line];
    var le = (line + 1 < this.lineStarts.length) ? this.lineStarts[line + 1] - 1 : v.length;
    var s = start, t = end;
    var isWord = function (c) { return /[A-Za-z0-9_$]/.test(c || ''); };
    while (s > ls && isWord(v[s - 1])) s--;
    while (t < le && isWord(v[t])) t++;
    if (t > s) this.setSelection(s, t, false);
    else if (line > 0) {
      var ps = start - 1;
      while (ps > ls && !/\S/.test(v[ps])) ps--;
      this.setSelection(ps + 1, start, false);
    }
  };

  Editor.prototype._lineFromY = function (clientY) {
    var r = this.viewport.getBoundingClientRect();
    var y = clientY - r.top - 8 + this.ta.scrollTop;
    var lh = Math.round(this.settings.fontSize * 1.5);
    var line = Math.floor(y / lh);
    if (line < 0 || line >= this.lineCount) return -1;
    return line;
  };

  /* ---------- keyboard ---------- */
  Editor.prototype._onKeyDown = function (e) {
    var ta = this.ta;
    var key = e.key;
    var ctrl = e.ctrlKey || e.metaKey;

    /* Alt + Up/Down : move line */
    if (e.altKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
      e.preventDefault();
      this._moveLine(key === 'ArrowUp' ? -1 : 1);
      return;
    }
    /* Ctrl + Shift + K : delete line */
    if (ctrl && e.shiftKey && (key === 'K' || key === 'k')) {
      e.preventDefault(); this._deleteLines(); return;
    }
    /* Ctrl + D : duplicate line */
    if (ctrl && (key === 'd' || key === 'D')) { e.preventDefault(); this._duplicateLine(); return; }
    /* Ctrl + / : toggle comment */
    if (ctrl && key === '/') { e.preventDefault(); this._toggleComment(); return; }
    /* Ctrl + Alt + Up/Down : cursor line up/down */
    if (ctrl && e.altKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
      e.preventDefault(); this._moveCursorLine(key === 'ArrowUp' ? -1 : 1); return;
    }
    /* Home : smart home */
    if (key === 'Home' && !ctrl && !e.shiftKey) {
      var pos = ta.selectionStart;
      var ls = this.lineStarts[this.posToLine(pos)];
      var lineStr = ta.value.slice(ls, pos);
      var firstNonWs = ls + lineStr.match(/^[ \t]*/)[0].length;
      if (pos > firstNonWs) { e.preventDefault(); this.setSelection(firstNonWs, firstNonWs, false); }
      return;
    }
    /* Tab / Shift+Tab */
    if (key === 'Tab' && !ctrl && !e.altKey) {
      e.preventDefault();
      this._handleTab(e.shiftKey);
      return;
    }
    /* Enter */
    if (key === 'Enter' && !ctrl && !e.altKey) { e.preventDefault(); this._handleEnter(); return; }
    /* Backspace over an empty pair */
    if (key === 'Backspace' && !ctrl && !e.altKey) {
      var s = ta.selectionStart, t = ta.selectionEnd;
      if (s === t && s > 0) {
        var before = ta.value[s - 1], after = ta.value[s];
        if (PAIRS[before] === after) { e.preventDefault(); this.replaceRange(s - 1, s + 1, ''); return; }
      }
    }
    /* auto close / surround */
    if (key.length === 1 && !ctrl && !e.altKey) {
      if (PAIRS[key]) { e.preventDefault(); this._handlePair(key); return; }
      if (key === ')' || key === ']' || key === '}') {
        if (ta.selectionStart === ta.selectionEnd && ta.value[ta.selectionStart] === key) {
          e.preventDefault(); this.setSelection(ta.selectionStart + 1, ta.selectionStart + 1, false); return;
        }
      }
    }
  };

  Editor.prototype._unit = function () { return ' '.repeat(Math.max(1, this.settings.tabSize)); };

  Editor.prototype._handlePair = function (ch) {
    var ta = this.ta, s = ta.selectionStart, e = ta.selectionEnd;
    var close = PAIRS[ch];
    if (s !== e) {
      var sel = ta.value.slice(s, e);
      this.replaceRange(s, e, ch + sel + close, s + 1, e + 1);
      return;
    }
    var next = ta.value[s];
    var isQuote = (ch === '"' || ch === "'" || ch === '`');
    if (isQuote && next === ch) { this.setSelection(s + 1, s + 1, false); return; }
    var wordBefore = s > 0 ? ta.value[s - 1] : '';
    if (isQuote && /[\w$)\]]/.test(wordBefore)) { this.insertText(ch); return; }
    this.replaceRange(s, s, ch + close, s + 1);
  };

  Editor.prototype._handleTab = function (shift) {
    var ta = this.ta, s = ta.selectionStart, e = ta.selectionEnd;
    var unit = this._unit();
    if (s === e && !shift) {
      var line = this.posToLine(s);
      var ls = this.lineStarts[line];
      var prefix = ta.value.slice(ls, s).match(/^[ \t]*/)[0];
      if (prefix.length >= this.settings.tabSize || prefix.length > 0) {
        this.replaceRange(ls, ls + prefix.length, '');
      } else {
        this.insertText(unit);
      }
      return;
    }
    if (s !== e || shift) this._blockIndent(shift);
  };

  Editor.prototype._blockIndent = function (outdent) {
    var ta = this.ta, v = ta.value;
    var s = ta.selectionStart, e = ta.selectionEnd;
    var startLine = this.posToLine(s);
    var endLine = this.posToLine(e);
    var unit = this._unit();
    var cut = Math.min(unit.length, 4);
    var lines = [];
    for (var i = startLine; i <= endLine; i++) {
      lines.push(v.slice(this.lineStarts[i], (i + 1 < this.lineStarts.length ? this.lineStarts[i + 1] - 1 : v.length)));
    }

    var firstShift = 0, lastShift = 0, out;
    if (outdent) {
      out = lines.map(function (ln) {
        if (ln.startsWith('\t')) { var d = 1; return ln.slice(1); }
        var m = ln.match(/^ +/);
        if (m) { var d2 = Math.min(cut, m[0].length); return ln.slice(d2); }
        return ln;
      });
      firstShift = out[0] !== lines[0] ? Math.min(cut, (lines[0].match(/^[\t ]+/) || [''])[0].replace(/\t/g, '  ').length) : 0;
      lastShift = 0;
    } else {
      out = lines.map(function (ln) { return unit + ln; });
      firstShift = 0;
      lastShift = 0;
    }

    var sPos = this.lineStarts[startLine];
    var ePos = (endLine + 1 < this.lineStarts.length ? this.lineStarts[endLine + 1] - 1 : v.length);
    var joined = out.join('\n');
    ta.focus();
    ta.value = v.slice(0, sPos) + joined + v.slice(ePos);
    ta.dispatchEvent(new Event('input', { bubbles: true }));

    if (outdent) {
      var removedFirst = lines[0].length - out[0].length;
      var removedLast = lines[lines.length - 1].length - out[lines.length - 1].length;
      ta.setSelectionRange(Math.max(sPos, s - removedFirst), Math.max(sPos, e - removedLast));
    } else {
      ta.setSelectionRange(s + unit.length, e + unit.length);
    }
    this._emitCursor();
  };

  Editor.prototype._lineBounds = function (line) {
    var v = this.ta.value;
    var s = this.lineStarts[line];
    var e = (line + 1 < this.lineStarts.length) ? this.lineStarts[line + 1] - 1 : v.length;
    return [s, e];
  };

  Editor.prototype._moveLine = function (dir) {
    var line = this.posToLine(this.ta.selectionStart);
    var target = line + dir;
    if (target < 0 || target >= this.lineCount) return;
    var ta = this.ta, v = ta.value;
    var a = this._lineBounds(line), b = this._lineBounds(target);
    var lineText = v.slice(a[0], a[1]);
    var targetText = v.slice(b[0], b[1]);
    var s = ta.selectionStart, e = ta.selectionEnd;
    var newText, newS, newE;
    if (dir < 0) {
      newText = lineText + '\n' + targetText;
      newS = s + (b[1] - b[0] + 1);
      newE = e + (b[1] - b[0] + 1);
    } else {
      newText = targetText + '\n' + lineText;
      newS = s - (a[1] - a[0] + 1);
      newE = e - (a[1] - a[0] + 1);
    }
    var from = b[0], to = dir < 0 ? a[1] : a[1];
    this.replaceRange(from, to, newText, newS, newE);
  };

  Editor.prototype._moveCursorLine = function (dir) {
    var pos = this.ta.selectionStart;
    var line = this.posToLine(pos);
    var col = pos - this.lineStarts[line];
    var t = line + dir;
    if (t < 0 || t >= this.lineCount) return;
    var np = Math.min(this.lineStarts[t] + col, (t + 1 < this.lineStarts.length ? this.lineStarts[t + 1] - 1 : this.ta.value.length));
    this.setSelection(np, np, true);
    this.revealLine(t);
  };

  Editor.prototype._duplicateLine = function () {
    var line = this.posToLine(this.ta.selectionStart);
    var b = this._lineBounds(line);
    var txt = this.ta.value.slice(b[0], b[1] + 1);
    var pos = this.ta.selectionStart;
    this.replaceRange(b[1], b[1], '\n' + txt, pos + txt.length + 1, pos + txt.length + 1);
    this.revealLine(line);
  };

  Editor.prototype._deleteLines = function () {
    var ta = this.ta;
    var startLine = this.posToLine(ta.selectionStart);
    var endLine = this.posToLine(ta.selectionEnd);
    var from = this.lineStarts[startLine];
    var to = (endLine + 1 < this.lineStarts.length) ? this.lineStarts[endLine + 1] : ta.value.length;
    this.replaceRange(from, to, '');
  };

  Editor.prototype._handleEnter = function () {
    var ta = this.ta, v = ta.value;
    var pos = ta.selectionStart;
    var ls = this.lineStarts[this.posToLine(pos)];
    var before = v.slice(ls, pos);
    var indent = before.match(/^[ \t]*/)[0];
    var opens = /[{[(:]\s*$/.test(before);
    var nextCh = v[pos];
    var closesNext = nextCh !== undefined && /^[}\])]/.test(nextCh);

    var unit = this._unit();
    if (opens && closesNext) {
      var insert = '\n' + indent + unit + '\n' + indent;
      this.replaceRange(pos, pos + 1, insert, pos + 1 + indent.length + unit.length);
    } else {
      var ins = '\n' + indent + (opens ? unit : '');
      this.replaceRange(pos, pos, ins, pos + ins.length);
    }
  };

  Editor.prototype._toggleComment = function () {
    var ta = this.ta, v = ta.value;
    var prefix = CLHighlight.lineComment(this.lang);
    var startLine = this.posToLine(ta.selectionStart);
    var endLine = this.posToLine(ta.selectionEnd);
    var from = this.lineStarts[startLine];
    var to = (endLine + 1 < this.lineStarts.length) ? this.lineStarts[endLine + 1] - 1 : v.length;
    var block = v.slice(from, to);
    var lines = block.split('\n');
    var meaningful = lines.filter(function (l) { return l.trim().length; });
    var allCommented = meaningful.length > 0 && meaningful.every(function (l) { return l.trim().indexOf(prefix) === 0; });

    function indentOf(l) { return l.slice(0, l.length - l.replace(/^[ \t]+/, '').length); }

    var result;
    if (allCommented) {
      result = lines.map(function (l) {
        var i = l.indexOf(prefix);
        if (i < 0) return l;
        return l.slice(0, i) + l.slice(i + prefix.length).replace(/^ /, '');
      });
    } else {
      result = lines.map(function (l) { return l.trim().length ? indentOf(l) + prefix + ' ' + l.trim() : l; });
    }

    var delta = result.join('\n').length - block.length;
    ta.focus();
    ta.value = v.slice(0, from) + result.join('\n') + v.slice(to);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.setSelectionRange(from, Math.max(from, to + delta));
    this._emitCursor();
  };

  /* ---------- public ---------- */
  function create(ref) { return new Editor(ref); }

  return { create: create };
})();