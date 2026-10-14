/* =========================================================
   CodeLite :: app.js
   Application wiring: tabs, files, commands, search, UI.
   ========================================================= */
(function () {
  'use strict';

  /* True only for the installed build, which START CodeLite.bat serves
     from http://localhost:<port> so the browser treats it as a secure
     origin. A hosted or file:// copy has no server behind it, so the
     app must not try to shut one down. */
  var LOCAL_APP = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i
    .test(location.href);

  /* ---------- element refs ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    title: $('tbTitle'), quickOpen: $('quickOpenInput'),
    btnOpenFolder: $('btnOpenFolder'), btnNewFile: $('btnNewFile'),
    btnSettings: $('btnSettings'), btnExit: $('btnExit'),

    activitybar: $('activitybar'),
    sidebar: $('sidebar'), sidebarTitle: $('sidebarTitle'),
    sbNewFile: $('sbNewFile'), sbNewFolder: $('sbNewFolder'),
    sbRefresh: $('sbRefresh'), sbCollapse: $('sbCollapse'),
    folderRow: $('folderRow'), folderName: $('folderName'), folderChev: $('folderChev'),
    fileTree: $('fileTree'),
    searchInput: $('searchInput'), searchSummary: $('searchSummary'), searchResults: $('searchResults'),
    optCase: $('optCase'), optWord: $('optWord'), optRegex: $('optRegex'),
    outlineList: $('outlineList'),

    tabsBar: $('tabsBar'), findBar: $('findBar'),
    findInput: $('findInput'), findCount: $('findCount'), replaceInput: $('replaceInput'),
    replaceRow: $('replaceRow'),
    findPrev: $('findPrev'), findNext: $('findNext'), findToggleReplace: $('findToggleReplace'), findClose: $('findClose'),
    ffCase: $('ffCase'), ffWord: $('ffWord'), ffRegex: $('ffRegex'),
    btnReplace: $('btnReplace'), btnReplaceAll: $('btnReplaceAll'),

    editorHost: $('editorHost'), breadcrumbs: $('breadcrumbs'), welcome: $('welcome'),
    viewport: $('viewport'), textarea: $('inputLayer'), highlight: $('highlightLayer'),
    gutterInner: $('gutterInner'), gutterLayer: $('gutterLayer'), currentLine: $('currentLine'),
    minimap: $('minimap'), minimapSlider: $('minimapSlider'),

    sbBranch: $('sbBranch'), sbProblems: $('sbProblems'), sbLang: $('sbLang'),
    sbSaved: $('sbSaved'), sbPos: $('sbPos'), sbSel: $('sbSel'), sbIndent: $('sbIndent'),

    palOverlay: $('paletteOverlay'), palInput: $('paletteInput'), palList: $('paletteList'),
    qoOverlay: $('quickOpenOverlay'), qoInput: $('quickOpenListInput'), qoList: $('quickOpenList'),
    promptOverlay: $('promptOverlay'), promptTitle: $('promptTitle'), promptInput: $('promptInput'),
    promptOk: $('promptOk'), promptCancel: $('promptCancel'),
    setOverlay: $('settingsOverlay'), setTheme: $('setTheme'), setWordWrap: $('setWordWrap'),
    setMinimap: $('setMinimap'), setFormat: $('setFormat'),
    valFontSize: $('valFontSize'), valTabSize: $('valTabSize'),
    settingsClose: $('settingsClose'), settingsReset: $('settingsReset'),
    toast: $('toast'), wcHint: $('wcHint'), wcOpenFolder: $('wcOpenFolder'), wcNewFile: $('wcNewFile')
  };

  /* ---------- state ---------- */
  var LS = 'codelite.settings.v1';
  var settings = Object.assign({
    fontSize: 14, tabSize: 2, theme: 'dark', wordWrap: false, minimap: true, formatOnSave: true
  }, readLS());

  var tabs = [];
  var activeId = null;
  var seq = 0;
  var findState = { caseSensitive: false, word: false, regex: false, replaceOpen: false };
  var searchState = { caseSensitive: false, word: false, regex: false };
  var qoIndex = 0, qoItems = [];
  var palIndex = 0, palItems = [];
  var chord = null;

  function readLS() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } }
  function writeLS() { try { localStorage.setItem(LS, JSON.stringify(settings)); } catch (e) { } }

  /* ---------- editor ---------- */
  var editor = CLEditor.create({
    textarea: el.textarea, highlight: el.highlight, gutterInner: el.gutterInner,
    gutterLayer: el.gutterLayer, currentLine: el.currentLine, viewport: el.viewport
  });
  var minimap = CLMinimap.create(el.minimap, el.minimapSlider, {
    onSeek: function (line) {
      var max = editor.lineCount;
      editor.ta.scrollTop = Math.max(0, line * Math.round(settings.fontSize * 1.5) - editor.ta.clientHeight / 2);
      editor._syncScroll();
    }
  });
  window.__clMinimap = minimap;

  editor.on('cursor', updateStatus);
  editor.on('change', function () {
    var t = active(); if (t) { t.dirty = true; renderTabs(); }
    updateStatus();
    if (el.findBar.classList.contains('hidden') === false) runFind();
    scheduleOutline();
  });
  editor.on('matchChange', function (d) { updateFindCount(d.index, d.count); });
  editor.on('stats', function () { scheduleOutline(); });

  /* ---------- explorer ---------- */
  var explorer = CLExplorer.create({
    tree: el.fileTree, folderRow: el.folderRow, folderName: el.folderName, folderChev: el.folderChev,
    prompt: promptDialog, confirm: confirmDialog, toast: toast,
    onOpenFile: function (node) { openFileHandle(node.handle, node.name); }
  });

  /* ---------- toast / dialogs ---------- */
  var toastTimer = null;
  function toast(msg, isErr) {
    el.toast.textContent = msg;
    el.toast.classList.toggle('err', !!isErr);
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.add('hidden'); }, 2600);
  }

  function promptDialog(title, def) {
    return new Promise(function (resolve) {
      el.promptTitle.textContent = title;
      el.promptInput.value = def || '';
      el.promptOverlay.classList.remove('hidden');
      setTimeout(function () {
        el.promptInput.focus();
        el.promptInput.select();
      }, 10);
      function onKey(e) {
        if (e.key === 'Enter') { e.preventDefault(); done(el.promptInput.value); }
        else if (e.key === 'Escape') { e.preventDefault(); done(null); }
      }
      function done(v) {
        el.promptOverlay.classList.add('hidden');
        el.promptInput.removeEventListener('keydown', onKey);
        el.promptOk.removeEventListener('click', onOk);
        el.promptCancel.removeEventListener('click', onCancel);
        resolve(v === '' ? null : v);
      }
      function onOk() { done(el.promptInput.value); }
      function onCancel() { done(null); }
      el.promptInput.addEventListener('keydown', onKey);
      el.promptOk.addEventListener('click', onOk);
      el.promptCancel.addEventListener('click', onCancel);
    });
  }

  function confirmDialog(message, okLabel) {
    return new Promise(function (resolve) {
      el.promptTitle.textContent = message;
      el.promptInput.style.display = 'none';
      el.promptOk.textContent = okLabel || 'OK';
      el.promptOverlay.classList.remove('hidden');
      setTimeout(function () { el.promptOk.focus(); }, 10);
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        else if (e.key === 'Enter') { e.preventDefault(); done(true); }
      }
      function done(v) {
        el.promptOverlay.classList.add('hidden');
        el.promptInput.style.display = '';
        el.promptInput.removeEventListener('keydown', onKey);
        el.promptOk.removeEventListener('click', onOk);
        el.promptCancel.removeEventListener('click', onCancel);
        resolve(v);
      }
      function onOk() { done(true); }
      function onCancel() { done(false); }
      el.promptInput.addEventListener('keydown', onKey);
      el.promptOk.addEventListener('click', onOk);
      el.promptCancel.addEventListener('click', onCancel);
    });
  }

  /* ---------- tabs ---------- */
  function active() { return tabs.filter(function (t) { return t.id === activeId; })[0] || null; }

  function newTab(name, text, lang) {
    var t = { id: ++seq, name: name, text: text || '', lang: lang || 'plain', handle: null, path: null, dirty: false };
    tabs.push(t);
    return t;
  }

  function switchTo(id, keepFocus) {
    if (id === activeId) return;
    var cur = active();
    if (cur) cur.text = editor.getText();
    activeId = id;
    var t = active();
    if (!t) { showWelcome(); return; }
    editor.setText(t.text, t.lang);
    el.welcome.classList.add('hidden');
    el.editorHost.classList.remove('hidden');
    renderTabs();
    renderBreadcrumbs();
    closeFind();
    updateStatus();
    if (!keepFocus) editor.focus();
    el.title.textContent = t.name + (t.dirty ? ' •' : '') + ' — CodeLite';
  }

  function openTab(t) {
    var cur = active();
    if (cur) cur.text = editor.getText();
    activeId = t.id;
    editor.setText(t.text, t.lang);
    el.welcome.classList.add('hidden');
    el.editorHost.classList.remove('hidden');
    renderTabs();
    renderBreadcrumbs();
    updateStatus();
    editor.focus();
    el.title.textContent = t.name + ' — CodeLite';
  }

  function closeTab(id) {
    var i = tabs.findIndex(function (t) { return t.id === id; });
    if (i < 0) return;
    var t = tabs[i];
    var doClose = function () {
      tabs.splice(i, 1);
      if (activeId === id) {
        activeId = null;
        var next = tabs[i] || tabs[i - 1];
        if (next) switchTo(next.id);
        else showWelcome();
      } else renderTabs();
    };
    if (t.dirty) {
      confirmDialog('Save changes to "' + t.name + '" before closing?', 'Close without saving')
        .then(function (skip) { if (!skip) save(t, true).then(function () { doClose(); }); else doClose(); });
    } else doClose();
  }

  function showWelcome() {
    el.editorHost.classList.add('hidden');
    el.welcome.classList.remove('hidden');
    el.tabsBar.innerHTML = '';
    el.breadcrumbs.classList.add('hidden');
    el.title.textContent = 'CodeLite';
    updateStatus();
    if (!explorer.available) {
      el.wcHint.innerHTML = 'Fir se kholne ke liye <b>CodeLite.bat</b> par double-click karein.<br>' +
        'Browser se kholne par folder ka access nahi milta.';
    } else {
      el.wcHint.innerHTML =
        '<kbd>Ctrl</kbd>+<kbd>P</kbd> Go to file&ensp;·&ensp;<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> All commands<br>' +
        '<kbd>Ctrl</kbd>+<kbd>F</kbd> Find&ensp;·&ensp;<kbd>Ctrl</kbd>+<kbd>G</kbd> Go to line&ensp;·&ensp;<kbd>Ctrl</kbd>+<kbd>S</kbd> Save<br>' +
        '<kbd>Alt</kbd>+<kbd>↑↓</kbd> Move line&ensp;·&ensp;<kbd>Ctrl</kbd>+<kbd>/</kbd> Toggle comment&ensp;·&ensp;<kbd>F11</kbd> Fullscreen';
    }
  }

  function renderTabs() {
    el.tabsBar.innerHTML = '';
    tabs.forEach(function (t) {
      var d = document.createElement('div');
      d.className = 'tab' + (t.id === activeId ? ' active' : '') + (t.dirty ? ' dirty' : '');
      var dot = document.createElement('span'); dot.className = 'tab-dot';
      var nm = document.createElement('span'); nm.className = 'tab-name'; nm.textContent = t.name;
      var x = document.createElement('span'); x.className = 'tab-x'; x.textContent = '✕';
      d.appendChild(dot); d.appendChild(nm); d.appendChild(x);
      d.addEventListener('mousedown', function (e) {
        if (e.button === 1) { e.preventDefault(); closeTab(t.id); return; }
        switchTo(t.id);
      });
      x.addEventListener('click', function (e) { e.stopPropagation(); closeTab(t.id); });
      el.tabsBar.appendChild(d);
    });
  }

  function renderBreadcrumbs() {
    var t = active();
    if (!t) { el.breadcrumbs.classList.add('hidden'); return; }
    el.breadcrumbs.classList.remove('hidden');
    el.breadcrumbs.innerHTML = '';
    var parts = t.path ? t.path.split('/') : [t.name];
    parts.forEach(function (p, i) {
      if (i) { var s = document.createElement('span'); s.className = 'bc-sep'; s.textContent = '›'; el.breadcrumbs.appendChild(s); }
      var seg = document.createElement('span');
      seg.className = 'bc-seg'; seg.textContent = p;
      if (i === parts.length - 1) seg.style.color = 'var(--fg)';
      seg.addEventListener('click', function () {
        if (t.handle && i < parts.length - 1) explorer.reveal(parts.slice(0, i + 1).join('/'));
      });
      el.breadcrumbs.appendChild(seg);
    });
  }

  /* ---------- files ---------- */
  function openFileHandle(handle, name) {
    handle.getFile().then(function (file) {
      return file.text().then(function (text) { return { text: text, file: file }; });
    }).then(function (r) {
      var existing = tabs.filter(function (t) { return t.handle === handle; })[0];
      var lang = CLHighlight.detect(name);
      if (existing) {
        if (existing.dirty) {
          confirmDialog('"' + name + '" has unsaved changes. Discard them and reopen?', 'Reopen')
            .then(function (ok) {
              if (!ok) { openTab(existing); return; }
              existing.text = r.text; existing.lang = lang;
              openTab(existing);
            });
          return;
        }
        existing.text = r.text; existing.lang = lang;
        openTab(existing);
        return;
      }
      var t = newTab(name, r.text, lang);
      t.handle = handle;
      t.path = pathOf(name);
      openTab(t);
    }).catch(function (e) { toast('Could not open file: ' + e.message, true); });
  }

  function pathOf(name) {
    var root = explorer.getRootName();
    return root ? root + '/' + name : name;
  }

  function newUntitled() {
    var n = 1, name;
    do { name = 'Untitled-' + n; n++; } while (tabs.some(function (t) { return t.name === name; }));
    var t = newTab(name, '', 'plain');
    openTab(t);
  }

  function save(t, silent) {
    t = t || active();
    if (!t) return Promise.resolve(false);
    if (t.id === activeId) t.text = editor.getText();

    var content = t.text;
    if (settings.formatOnSave) content = content.replace(/[ \t]+$/gm, '');

    var write = function (handle) {
      return handle.createWritable().then(function (ws) {
        return ws.write(content).then(function () { return ws.close(); });
      }).then(function () {
        t.handle = handle;
        t.dirty = false;
        renderTabs();
        if (t.id === activeId) updateStatus();
        if (!silent) toast('Saved ' + t.name);
        return true;
      });
    };

    if (t.handle) {
      return write(t.handle).catch(function (e) {
        toast('Save failed: ' + e.message, true);
        return false;
      });
    }
    if (typeof window.showSaveFilePicker === 'function') {
      return window.showSaveFilePicker({
        suggestedName: t.name,
        types: [{ description: 'Source file', accept: { 'text/plain': ['.' + (t.name.split('.').pop() || 'txt')] } }]
      }).then(write).catch(function (e) {
        if (e.name !== 'AbortError') toast('Save failed: ' + e.message, true);
        return false;
      });
    }
    download(t.name, content);
    t.dirty = false;
    renderTabs();
    if (!silent) toast('Downloaded ' + t.name + ' (browser mode)');
    return Promise.resolve(true);
  }

  function saveAll() {
    var dirty = tabs.filter(function (t) { return t.dirty; });
    if (!dirty.length) { toast('Nothing to save'); return Promise.resolve(); }
    return dirty.reduce(function (p, t) { return p.then(function () { return save(t, true); }); }, Promise.resolve())
      .then(function () { toast('All files saved'); });
  }

  function download(name, content) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------- status bar ---------- */
  function updateStatus(c) {
    var t = active();
    el.sbLang.textContent = CLHighlight.name(t ? t.lang : 'plain');
    el.sbIndent.textContent = 'Spaces: ' + settings.tabSize;
    if (c) {
      el.sbPos.textContent = 'Ln ' + c.line + ', Col ' + c.col;
      el.sbSel.textContent = c.selected > 0 ? c.selected + ' selected' : '';
    }
    el.sbSaved.textContent = t && t.dirty ? 'Unsaved' : 'Saved';
    el.sbSaved.style.color = (t && t.dirty) ? '#fff' : '';
    el.sbBranch.textContent = '⎇ ' + (explorer.getRootName() || 'no folder');
    var txt = t ? t.text : '';
    var w = (txt.match(/\b(TODO|FIXME|HACK)\b/g) || []).length;
    el.sbProblems.textContent = '⚠ ' + w;
    el.sbProblems.classList.toggle('has-err', false);
  }

  /* ---------- find & replace ---------- */
  function buildMatcher() {
    var q = el.findInput.value;
    if (!q) return null;
    var src = q;
    try {
      if (findState.regex) src = src;
      else src = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (findState.word) src = '\\b(?:' + src + ')\\b';
      return new RegExp(src, findState.caseSensitive ? 'g' : 'gi');
    } catch (e) { return null; }
  }

  function runFind() {
    var text = editor.getText();
    var re = buildMatcher();
    if (!re) { editor.setMatches([], -1); updateFindCount(-1, 0); return; }
    var ranges = [], m, guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < 20000) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      ranges.push([m.index, m.index + m[0].length]);
    }
    var cur = editor.curMatch;
    editor.setMatches(ranges, cur);
    updateFindCount(cur, ranges.length);
    if (ranges.length && cur < 0) editor.selectMatch(0);
  }

  function updateFindCount(idx, count) {
    el.findCount.textContent = count === 0 ? 'No results'
      : (idx >= 0 ? (idx + 1) + ' of ' + count : count + (count === 1 ? ' result' : ' results'));
  }

  function openFind(withReplace) {
    if (!active()) return;
    el.findBar.classList.remove('hidden');
    el.replaceRow.classList.toggle('hidden', !withReplace);
    var sel = editor.getSelection();
    if (editor.ta.selectionEnd > sel) el.findInput.value = editor.getText().slice(sel, editor.ta.selectionEnd);
    setTimeout(function () { el.findInput.focus(); el.findInput.select(); runFind(); }, 10);
  }
  function closeFind() {
    el.findBar.classList.add('hidden');
    editor.clearMatches();
    editor.focus();
  }

  function replaceCurrent() {
    var ranges = editor.matches;
    if (!ranges.length) return;
    var idx = editor.curMatch < 0 ? 0 : editor.curMatch;
    var r = ranges[idx];
    var rep = el.replaceInput.value;
    if (findState.regex) {
      try {
        var src = el.findInput.value;
        if (findState.word) src = '\\b(?:' + src + ')\\b';
        rep = editor.getText().slice(r[0], r[1]).replace(new RegExp(src, findState.caseSensitive ? 'g' : 'gi'), rep);
      } catch (e) { }
    }
    editor.replaceRange(r[0], r[1], rep, r[0] + rep.length);
    runFind();
    editor.selectMatch(idx);
  }

  function replaceAll() {
    var ranges = editor.matches;
    if (!ranges.length) return;
    var rep = el.replaceInput.value;
    var text = editor.getText();
    var out = '', last = 0;
    ranges.forEach(function (r) { out += text.slice(last, r[0]) + rep; last = r[1]; });
    out += text.slice(last);
    var pos = editor.getSelection();
    editor.replaceRange(0, text.length, out, Math.min(pos, out.length));
    runFind();
    toast(ranges.length + ' occurrence(s) replaced');
  }

  /* ---------- outline ---------- */
  var OUTLINE = [
    { re: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, k: 'function' },
    { re: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, k: 'type' },
    { re: /^\s*(?:export\s+)?(?:async\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, k: 'function' },
    { re: /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/, k: 'type' },
    { re: /^\s*(?:export\s+)?(?:enum|type)\s+([A-Za-z_$][\w$]*)/, k: 'type' },
    { re: /^\s*def\s+([A-Za-z_][\w]*)/, k: 'function' },
    { re: /^\s*class\s+([A-Za-z_][\w]*)/, k: 'type' },
    { re: /^\s*(?:public|private|protected|static|final|override)?\s*[\w<>\[\],\s]+\s+([A-Za-z_$][\w$]*)\s*\([^;{]*\)\s*\{?\s*$/, k: 'function' },
    { re: /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w]*)/, k: 'function' },
    { re: /^\s*fn\s+([A-Za-z_][\w]*)/, k: 'function' },
    { re: /^\s*(?:public\s+)?(?:static\s+)?[\w<>\[\]]+\s+([A-Za-z_][\w]*)\s*\(/, k: 'function' },
    { re: /^\s*(#{1,6})\s+(.+)$/, k: 'keyword' },
    { re: /^\s*[<\[]([A-Za-z_][\w-]*)[>\]]/, k: 'tag' },
    { re: /^\s*([A-Z][A-Z0-9_]{2,})\s*[=:]/, k: 'constant' }
  ];

  var outlineTimer = null;
  function scheduleOutline() {
    clearTimeout(outlineTimer);
    outlineTimer = setTimeout(buildOutline, 400);
  }

  function buildOutline() {
    var t = active();
    if (!t) return;
    var text = t.id === activeId ? editor.getText() : t.text;
    if (!text || text.length > 600000) { el.outlineList.innerHTML = ''; return; }
    var lines = text.split('\n');
    var frag = document.createDocumentFragment();
    var count = 0;
    for (var i = 0; i < lines.length && count < 800; i++) {
      var ln = lines[i];
      if (!ln.trim() || ln.length > 300) continue;
      for (var r = 0; r < OUTLINE.length; r++) {
        var m = ln.match(OUTLINE[r].re);
        if (m) {
          var it = document.createElement('div');
          it.className = 'ol-item';
          it.textContent = (OUTLINE[r].k === 'keyword' ? ln.trim() : m[m.length - 1]);
          it.style.color = 'var(--' + (OUTLINE[r].k === 'function' ? 'fn' : OUTLINE[r].k === 'type' ? 'typ' : OUTLINE[r].k === 'tag' ? 'tag' : OUTLINE[r].k === 'constant' ? 'cst' : 'kw') + ')';
          it.style.paddingLeft = (10 + (OUTLINE[r].k === 'function' ? 0 : 8)) + 'px';
          (function (lineNo) {
            it.addEventListener('click', function () {
              showPane('outline');
              editor.gotoLine(lineNo);
            });
          })(i + 1);
          frag.appendChild(it);
          count++;
          break;
        }
      }
    }
    el.outlineList.innerHTML = '';
    el.outlineList.appendChild(frag);
  }

  /* ---------- search in files ---------- */
  var searchTimer = null;
  function runSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var q = el.searchInput.value;
      el.searchResults.innerHTML = '';
      if (!q.trim()) { el.searchSummary.textContent = 'Type to search'; return; }
      if (!explorer.root) { el.searchSummary.textContent = 'Open a folder first'; return; }

      var src = q;
      try {
        if (!searchState.regex) src = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (searchState.word) src = '\\b(?:' + src + ')\\b';
        var re = new RegExp(src, searchState.caseSensitive ? 'g' : 'gi');
      } catch (e) { el.searchSummary.textContent = 'Invalid pattern'; return; }

      explorer.scanAll().then(function (files) {
        var results = [], scanned = 0, MAX = 400;
        function next(i) {
          if (i >= files.length || scanned >= files.length || results.length >= 600) { finish(); return; }
          var f = files[i];
          f.handle.getFile().then(function (file) {
            if (file.size > 1500000) return null;
            return file.text().then(function (txt) { return { f: f, txt: txt }; });
          }).catch(function () { return null; }).then(function (res) {
            scanned++;
            if (res) {
              var lines = res.txt.split('\n');
              for (var li = 0; li < lines.length; li++) {
                re.lastIndex = 0;
                if (re.test(lines[li])) {
                  results.push({ path: res.f.path, name: res.f.name, handle: res.f.handle, line: li + 1, text: lines[li].trim().slice(0, 200) });
                  if (results.length >= 600) break;
                }
              }
            }
            if (scanned % 25 === 0) { renderSearchResults(results, files.length); }
            next(i + 1);
          });
        }
        function finish() { renderSearchResults(results, files.length); }
        next(0);
      });
    }, 260);
  }

  function renderSearchResults(results, totalFiles) {
    el.searchSummary.textContent = results.length
      ? results.length + ' result' + (results.length === 1 ? '' : 's') + ' in ' + totalFiles + ' files'
      : 'No results (' + totalFiles + ' files scanned)';
    var frag = document.createDocumentFragment();
    results.slice(0, 400).forEach(function (r) {
      var it = document.createElement('div');
      it.className = 'sr-item';
      var f = document.createElement('div'); f.className = 'sr-file';
      f.textContent = r.path + ':' + r.line;
      var l = document.createElement('div'); l.className = 'sr-line';
      l.innerHTML = mark(r.text, el.searchInput.value);
      it.appendChild(f); it.appendChild(l);
      it.addEventListener('click', function () {
        openFileHandle(r.handle, r.name);
        setTimeout(function () { editor.gotoLine(r.line); }, 120);
      });
      frag.appendChild(it);
    });
    el.searchResults.innerHTML = '';
    el.searchResults.appendChild(frag);
  }

  function mark(text, q) {
    try {
      var src = searchState.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (searchState.word) src = '\\b(?:' + src + ')\\b';
      var re = new RegExp(src, searchState.caseSensitive ? 'g' : 'gi');
      return CLHighlight.esc(text).replace(re, function (m) { return '<mark>' + m + '</mark>'; });
    } catch (e) { return CLHighlight.esc(text); }
  }

  /* ---------- quick open ---------- */
  function openQuickOpen() {
    if (!explorer.root) { toast('Open a folder first', true); return; }
    explorer.scanAll().then(function (files) {
      qoItems = files;
      el.qoOverlay.classList.remove('hidden');
      el.qoInput.value = '';
      setTimeout(function () { el.qoInput.focus(); }, 10);
      renderQuickOpen('');
    });
  }

  function fuzzy(needle, hay) {
    var n = needle.toLowerCase(), h = hay.toLowerCase();
    var idx = h.indexOf(n);
    if (idx > -1) return idx;
    var i = 0, score = 0;
    for (var j = 0; j < h.length && i < n.length; j++) {
      if (h[j] === n[i]) { i++; score++; }
    }
    return i === n.length ? 1000 + score : -1;
  }

  function renderQuickOpen(q) {
    var list = qoItems.map(function (f) { return { f: f, score: q ? fuzzy(q, f.path) : 0 }; })
      .filter(function (x) { return x.score >= 0; })
      .sort(function (a, b) { return a.score - b.score; })
      .slice(0, 60);
    el.qoList.innerHTML = '';
    list.forEach(function (x, i) {
      var li = document.createElement('li');
      li.className = i === qoIndex ? 'sel' : '';
      li.innerHTML = CLHighlight.esc(x.f.path) + ' <span class="pl-key">' + x.f.name.split('.').pop().toUpperCase() + '</span>';
      li.addEventListener('click', function () { pickQuickOpen(i); });
      li.addEventListener('mousemove', function () { qoIndex = i; renderQuickOpen(q); });
      el.qoList.appendChild(li);
    });
    qoFiltered = list;
  }
  var qoFiltered = [];

  function pickQuickOpen(i) {
    var item = (qoFiltered[i] || qoFiltered[qoIndex]);
    if (!item) return;
    el.qoOverlay.classList.add('hidden');
    explorer.reveal(item.f.path);
    openFileHandle(item.f.handle, item.f.name);
  }

  /* ---------- command palette ---------- */
  function commands() {
    var hasFolder = !!explorer.root;
    var hasTab = !!active();
    return [
      { t: 'File: Open Folder…', k: 'Ctrl+K Ctrl+O', f: function () { explorer.openFolder(); } },
      { t: 'File: New Untitled File', k: '', f: newUntitled },
      { t: 'File: Save', k: 'Ctrl+S', f: function () { if (hasTab) save(); } },
      { t: 'File: Save All', k: '', f: saveAll },
      { t: 'File: Save As…', k: 'Ctrl+Shift+S', f: function () { if (hasTab) { var t = active(); t.handle = null; t.name = t.name; save(t); } } },
      { t: 'View: Go to File…', k: 'Ctrl+P', f: openQuickOpen },
      { t: 'Go to Line/Column…', k: 'Ctrl+G', f: gotoLineDialog },
      { t: 'View: Find', k: 'Ctrl+F', f: function () { openFind(false); } },
      { t: 'View: Replace', k: 'Ctrl+H', f: function () { openFind(true); } },
      { t: 'View: Toggle Sidebar', k: 'Ctrl+B', f: toggleSidebar },
      { t: 'View: Toggle Word Wrap', k: 'Alt+Z', f: toggleWrap },
      { t: 'View: Toggle Minimap', k: '', f: toggleMinimap },
      { t: 'View: Increase Font Size', k: 'Ctrl+=', f: function () { bumpFont(1); } },
      { t: 'View: Decrease Font Size', k: 'Ctrl+-', f: function () { bumpFont(-1); } },
      { t: 'View: Toggle Full Screen', k: 'F11', f: toggleFullscreen },
      { t: 'Editor: Toggle Line Comment', k: 'Ctrl+/', f: function () { editor._toggleComment(); } },
      { t: 'Explorer: New File', k: '', f: function () { explorer.newFile(); } },
      { t: 'Explorer: New Folder', k: '', f: function () { explorer.newFolder(); } },
      { t: 'Explorer: Rename', k: '', f: function () { explorer.renameSelected(); } },
      { t: 'Explorer: Delete', k: '', f: function () { explorer.deleteSelected(); } },
      { t: 'Explorer: Refresh', k: '', f: function () { explorer.refresh(); } },
      { t: 'Preferences: Settings', k: 'Ctrl+,', f: openSettings },
      { t: 'Help: Keyboard Shortcuts', k: '', f: showShortcutsDialog },
      { t: 'File: Exit CodeLite', k: '', f: exitApp }
    ].filter(function (c) { return hasFolder || !/New (File|Folder)|Refresh|Delete|Rename/.test(c.t); });
  }

  function openPalette() {
    palItems = commands();
    palIndex = 0;
    el.palInput.value = '';
    el.palOverlay.classList.remove('hidden');
    setTimeout(function () { el.palInput.focus(); }, 10);
    renderPalette('');
  }

  function renderPalette(q) {
    var list = palItems.map(function (c) { return { c: c, score: q ? fuzzy(q, c.t) : 0 }; })
      .filter(function (x) { return x.score >= 0; })
      .sort(function (a, b) { return a.score - b.score; }).slice(0, 50);
    palFiltered = list;
    el.palList.innerHTML = '';
    list.forEach(function (x, i) {
      var li = document.createElement('li');
      li.className = i === palIndex ? 'sel' : '';
      li.innerHTML = CLHighlight.esc(x.c.t) + (x.c.k ? ' <span class="pl-key">' + CLHighlight.esc(x.c.k) + '</span>' : '');
      li.addEventListener('mousedown', function (ev) { ev.preventDefault(); runPalette(i); });
      li.addEventListener('mousemove', function () { palIndex = i; renderPalette(q); });
      el.palList.appendChild(li);
    });
  }
  var palFiltered = [];

  function runPalette(i) {
    var item = palFiltered[i] || palFiltered[palIndex];
    if (!item) return;
    el.palOverlay.classList.add('hidden');
    setTimeout(function () { item.c.f(); }, 0);
  }

  /* ---------- misc actions ---------- */
  function toggleSidebar() {
    var s = el.sidebar;
    var w = s.style.width === '0px' ? '' : '0px';
    s.style.width = w;
    s.style.flexBasis = w;
    setTimeout(function () { editor._syncScroll(); }, 0);
  }

  function toggleWrap() {
    settings.wordWrap = !settings.wordWrap;
    el.setWordWrap.value = settings.wordWrap ? 'on' : 'off';
    applySettings();
    toast('Word wrap ' + (settings.wordWrap ? 'on' : 'off'));
  }

  function toggleMinimap() {
    settings.minimap = !settings.minimap;
    el.setMinimap.value = settings.minimap ? 'on' : 'off';
    applySettings();
    toast('Minimap ' + (settings.minimap ? 'on' : 'off'));
  }

  function bumpFont(d) {
    settings.fontSize = Math.max(10, Math.min(28, settings.fontSize + d));
    applySettings();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () { });
    } else document.exitFullscreen();
  }

  function gotoLineDialog() {
    if (!active()) return;
    promptDialog('Go to Line / Column', '1').then(function (v) {
      if (!v) return;
      var m = v.match(/^(\d+)(?:\s*[, :]\s*(\d+))?/);
      if (!m) return;
      var line = parseInt(m[1], 10);
      editor.gotoLine(line);
      if (m[2]) {
        var p = editor.lineToPos(line - 1) + parseInt(m[2], 10) - 1;
        editor.setSelection(p, p, true);
      }
    });
  }

  function showShortcuts() {
    var rows = [
      ['Ctrl + P', 'Go to file'], ['Ctrl + Shift + P', 'Command palette'],
      ['Ctrl + S', 'Save'], ['Ctrl + Shift + S', 'Save as'],
      ['Ctrl + F', 'Find'], ['Ctrl + H', 'Replace'],
      ['Ctrl + G', 'Go to line'], ['Ctrl + B', 'Toggle sidebar'],
      ['Ctrl + K Ctrl + O', 'Open folder'], ['Ctrl + /', 'Toggle comment'],
      ['Ctrl + Shift + K', 'Delete line'], ['Ctrl + D', 'Duplicate line'],
      ['Alt + ↑ / ↓', 'Move line up / down'], ['Alt + Z', 'Toggle word wrap'],
      ['Ctrl + = / -', 'Font size'], ['F11', 'Full screen'],
      ['Ctrl + L', 'Expand selection'], ['Shift + Alt + ↓', 'Copy line down']
    ];
    var html = '<div style="max-height:60vh;overflow:auto;font-size:12.5px;line-height:2">';
    rows.forEach(function (r) {
      html += '<div style="display:flex;gap:14px"><kbd style="background:var(--panel);border:1px solid var(--border);border-radius:4px;padding:1px 7px;min-width:150px;text-align:center">' + r[0] + '</kbd><span>' + r[1] + '</span></div>';
    });
    return html + '</div>';
  }

  var shortcutResolve = null;
  function showShortcutsDialog() {
    return new Promise(function (resolve) {
      el.promptTitle.textContent = 'Keyboard Shortcuts';
      el.promptInput.style.display = 'none';
      el.promptOk.textContent = 'Close';
      el.promptOverlay.classList.remove('hidden');
      var box = el.promptOverlay.querySelector('.dialog');
      var prev = box.querySelector('.kb-list');
      if (prev) prev.remove();
      var d = document.createElement('div');
      d.className = 'kb-list';
      d.innerHTML = showShortcuts();
      box.insertBefore(d, box.querySelector('.dlg-actions'));
      setTimeout(function () { el.promptOk.focus(); }, 10);
      function onKey(e) {
        if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); done(); }
      }
      function done() {
        el.promptOverlay.classList.add('hidden');
        el.promptInput.style.display = '';
        if (d.parentNode) d.parentNode.removeChild(d);
        el.promptInput.removeEventListener('keydown', onKey);
        el.promptOk.removeEventListener('click', onOk);
        el.promptCancel.removeEventListener('click', onCancel);
        resolve(true);
      }
      function onOk() { done(); }
      function onCancel() { done(); }
      el.promptInput.addEventListener('keydown', onKey);
      el.promptOk.addEventListener('click', onOk);
      el.promptCancel.addEventListener('click', onCancel);
    });
  }

  function openSettings() {
    el.setOverlay.classList.remove('hidden');
    el.valFontSize.textContent = settings.fontSize;
    el.valTabSize.textContent = settings.tabSize;
    el.setTheme.value = settings.theme;
    el.setWordWrap.value = settings.wordWrap ? 'on' : 'off';
    el.setMinimap.value = settings.minimap ? 'on' : 'off';
    el.setFormat.value = settings.formatOnSave ? 'on' : 'off';
  }

  function applySettings() {
    document.documentElement.dataset.theme = settings.theme;
    editor.setSettings({
      fontSize: settings.fontSize, tabSize: settings.tabSize, wordWrap: settings.wordWrap
    });
    minimap.setEnabled(settings.minimap && !settings.wordWrap);
    editor.render(true);
    el.valFontSize.textContent = settings.fontSize;
    el.valTabSize.textContent = settings.tabSize;
    writeLS();
    updateStatus();
  }

  function exitApp() {
    var dirty = tabs.filter(function (t) { return t.dirty; });
    var go = function () {
      // only the installed build has a server listening to stop
      if (LOCAL_APP) {
        try {
          fetch('/shutdown', { method: 'POST' }).catch(function () { });
        } catch (e) { }
      }
      setTimeout(function () { window.close(); }, 120);
    };
    if (dirty.length) {
      confirmDialog('You have ' + dirty.length + ' unsaved file(s). Exit anyway?', 'Exit')
        .then(function (ok) { if (ok) go(); });
    } else go();
  }

  /* ---------- panes ---------- */
  function showPane(name) {
    ['explorer', 'search', 'outline'].forEach(function (p) {
      $('pane-' + p).classList.toggle('hidden', p !== name);
    });
    Array.prototype.forEach.call(el.activitybar.querySelectorAll('.act[data-view]'), function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
    el.sidebarTitle.textContent = name.toUpperCase();
    if (el.sidebar.style.width === '0px') toggleSidebar();
  }

  /* ---------- global keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    var ctrl = e.ctrlKey || e.metaKey;

    /* overlay-scoped handling */
    if (!el.palOverlay.classList.contains('hidden')) {
      if (e.key === 'Escape') { e.preventDefault(); el.palOverlay.classList.add('hidden'); }
      else if (e.key === 'Enter') { e.preventDefault(); runPalette(palIndex); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); palIndex = Math.min(palFiltered.length - 1, palIndex + 1); renderPalette(el.palInput.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palIndex = Math.max(0, palIndex - 1); renderPalette(el.palInput.value); }
      return;
    }
    if (!el.qoOverlay.classList.contains('hidden')) {
      if (e.key === 'Escape') { e.preventDefault(); el.qoOverlay.classList.add('hidden'); }
      else if (e.key === 'Enter') { e.preventDefault(); pickQuickOpen(qoIndex); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); qoIndex = Math.min(qoFiltered.length - 1, qoIndex + 1); renderQuickOpen(el.qoInput.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); qoIndex = Math.max(0, qoIndex - 1); renderQuickOpen(el.qoInput.value); }
      return;
    }
    if (!el.setOverlay.classList.contains('hidden')) {
      if (e.key === 'Escape') { e.preventDefault(); el.setOverlay.classList.add('hidden'); }
      return;
    }

    /* Ctrl+K chord */
    if (chord === 'k') {
      chord = null;
      if (e.key === 'o' || e.key === 'O') { e.preventDefault(); explorer.openFolder(); return; }
      if (e.key === 'b' || e.key === 'B') { e.preventDefault(); toggleSidebar(); return; }
    }
    if (ctrl && e.key.toLowerCase() === 'k') { chord = 'k'; setTimeout(function () { chord = null; }, 1500); return; }

    if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
    if (ctrl && e.shiftKey && (e.key === 'P' || e.key === 'p')) { e.preventDefault(); openPalette(); return; }
    if (ctrl && !e.shiftKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); openQuickOpen(); return; }
    if (ctrl && !e.shiftKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (active()) save(); return; }
    if (ctrl && e.shiftKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (active()) { var t = active(); t.handle = null; save(t); }
      return;
    }
    if (ctrl && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); explorer.openFolder(); return; }
    if (ctrl && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); openFind(false); return; }
    if (ctrl && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); openFind(true); return; }
    if (ctrl && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); gotoLineDialog(); return; }
    if (ctrl && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); toggleSidebar(); return; }
    if (ctrl && e.key === ',') { e.preventDefault(); openSettings(); return; }
    if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); bumpFont(1); return; }
    if (ctrl && (e.key === '-' || e.key === '_')) { e.preventDefault(); bumpFont(-1); return; }
    if (e.altKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); toggleWrap(); return; }
    if (e.altKey && e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); editor._duplicateLine(); return; }
    if (ctrl && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); expandSelection(); return; }
    if (ctrl && e.shiftKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); showPane('explorer'); return; }
    if (ctrl && e.shiftKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); showPane('search'); el.searchInput.focus(); return; }
  });

  function expandSelection() {
    var ta = editor.ta, s = ta.selectionStart, e = ta.selectionEnd;
    var text = ta.value;
    var isWord = function (c) { return /[A-Za-z0-9_$]/.test(c || ''); };
    if (s === e) {
      var a = s, b = s;
      while (a > 0 && isWord(text[a - 1])) a--;
      while (b < text.length && isWord(text[b])) b++;
      editor.setSelection(a, b, true);
      return;
    }
    var pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    var cs = text[s - 1], ce = text[e];
    if (pairs[cs] === ce && s > 0) { editor.setSelection(s - 1, e + 1, true); return; }
    var prevStart = text.lastIndexOf('\n', s - 1) + 1;
    if (s > 0) { editor.setSelection(Math.max(0, prevStart), e, true); }
  }

  /* ---------- find bar wiring ---------- */
  el.findInput.addEventListener('input', runFind);
  el.findInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); editor.nextMatch(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  el.findNext.addEventListener('click', function () { editor.nextMatch(1); });
  el.findPrev.addEventListener('click', function () { editor.nextMatch(-1); });
  el.findClose.addEventListener('click', closeFind);
  el.findToggleReplace.addEventListener('click', function () {
    el.replaceRow.classList.toggle('hidden');
    if (!el.replaceRow.classList.contains('hidden')) el.replaceInput.focus();
  });
  el.btnReplace.addEventListener('click', replaceCurrent);
  el.btnReplaceAll.addEventListener('click', replaceAll);
  el.replaceInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); replaceCurrent(); }
  });
  function bindToggle(btn, key, cb) {
    btn.addEventListener('click', function () {
      findState[key] = !findState[key];
      btn.classList.toggle('on', findState[key]);
      runFind();
      if (cb) cb();
    });
  }
  bindToggle(el.ffCase, 'caseSensitive');
  bindToggle(el.ffWord, 'word');
  bindToggle(el.ffRegex, 'regex');

  /* ---------- search pane wiring ---------- */
  el.searchInput.addEventListener('input', runSearch);
  ['optCase', 'optWord', 'optRegex'].forEach(function (id, i) {
    var keys = ['caseSensitive', 'word', 'regex'];
    el[id].addEventListener('click', function () {
      searchState[keys[i]] = !searchState[keys[i]];
      el[id].classList.toggle('on', searchState[keys[i]]);
      runSearch();
    });
  });

  /* ---------- quick open wiring ---------- */
  el.qoInput.addEventListener('input', function () { qoIndex = 0; renderQuickOpen(el.qoInput.value); });
  el.palInput.addEventListener('input', function () { palIndex = 0; renderPalette(el.palInput.value); });
  el.quickOpen.addEventListener('focus', function () { el.quickOpen.blur(); openQuickOpen(); });
  el.quickOpen.addEventListener('click', function () { openQuickOpen(); });

  /* ---------- button wiring ---------- */
  el.btnOpenFolder.addEventListener('click', function () { explorer.openFolder(); });
  el.wcOpenFolder.addEventListener('click', function () { explorer.openFolder(); });
  el.wcNewFile.addEventListener('click', newUntitled);
  el.btnNewFile.addEventListener('click', newUntitled);
  el.sbNewFile.addEventListener('click', function () { explorer.newFile(); });
  el.sbNewFolder.addEventListener('click', function () { explorer.newFolder(); });
  el.sbRefresh.addEventListener('click', function () { explorer.refresh(); });
  el.sbCollapse.addEventListener('click', function () {
    function collapse(n) {
      if (!n.children) return;
      n.expanded = false;
      n.children.forEach(collapse);
    }
    if (explorer.root) { collapse(explorer.root); explorer.root.expanded = true; explorer._render(); }
  });
  el.btnSettings.addEventListener('click', openSettings);
  el.settingsClose.addEventListener('click', function () { el.setOverlay.classList.add('hidden'); });
  el.settingsReset.addEventListener('click', function () {
    settings = { fontSize: 14, tabSize: 2, theme: 'dark', wordWrap: false, minimap: true, formatOnSave: true };
    applySettings(); openSettings();
  });
  el.btnExit.addEventListener('click', exitApp);
  // a hosted or file:// copy has no local server behind it, so be honest
  // about what the button actually does
  if (!LOCAL_APP) {
    el.btnExit.title = 'Close CodeLite (this browser tab)';
    el.btnExit.textContent = 'Close';
  }

  Array.prototype.forEach.call(el.activitybar.querySelectorAll('.act[data-view]'), function (b) {
    b.addEventListener('click', function () {
      var v = b.dataset.view;
      if (b.classList.contains('active') && el.sidebar.style.width !== '0px') toggleSidebar();
      else { showPane(v); }
    });
  });
  $('actZoomIn').addEventListener('click', function () { bumpFont(1); });
  $('actZoomOut').addEventListener('click', function () { bumpFont(-1); });

  /* ---------- settings controls ---------- */
  document.querySelectorAll('[data-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.dataset.set, d = parseInt(b.dataset.d, 10);
      settings[key] = Math.max(key === 'fontSize' ? 10 : 1, Math.min(key === 'fontSize' ? 28 : 8, settings[key] + d));
      applySettings();
    });
  });
  el.setTheme.addEventListener('change', function () { settings.theme = el.setTheme.value; applySettings(); });
  el.setWordWrap.addEventListener('change', function () { settings.wordWrap = el.setWordWrap.value === 'on'; applySettings(); });
  el.setMinimap.addEventListener('change', function () { settings.minimap = el.setMinimap.value === 'on'; applySettings(); });
  el.setFormat.addEventListener('change', function () { settings.formatOnSave = el.setFormat.value === 'on'; writeLS(); });

  /* ---------- overlay dismiss ---------- */
  ['paletteOverlay', 'quickOpenOverlay', 'settingsOverlay'].forEach(function (id) {
    $(id).addEventListener('mousedown', function (e) { if (e.target.id === id) $(id).classList.add('hidden'); });
  });

  /* ---------- before unload ---------- */
  window.addEventListener('beforeunload', function (e) {
    if (tabs.some(function (t) { return t.dirty; })) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- init ---------- */
  applySettings();
  showWelcome();
  newUntitled();
  switchTo(tabs[0].id);

  /* first-run hint */
  if (!localStorage.getItem('codelite.seen')) {
    localStorage.setItem('codelite.seen', '1');
    setTimeout(function () {
      toast('Welcome to CodeLite! Click "Open Folder" to start.');
    }, 700);
  }

  window.CodeliteApp = {
    openFolder: function () { explorer.openFolder(); },
    save: save, newFile: newUntitled,
    editor: editor, explorer: explorer, minimap: minimap,
    setLanguage: function (lang) { var t = active(); if (t) { t.lang = lang; editor.setLang(lang); renderTabs(); updateStatus(); } },
    state: function () { return { tabs: tabs.length, root: explorer.getRootName(), available: explorer.available }; }
  };
})();