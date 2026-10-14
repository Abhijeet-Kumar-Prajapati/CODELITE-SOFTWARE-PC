/* =========================================================
   CodeLite :: explorer.js
   Folder tree using File System Access API, with fallback.
   ========================================================= */
window.CLExplorer = (function () {
  'use strict';

  var ICONS = {
    js: '\u{1F4BE}', mjs: '\u{1F4BE}', cjs: '\u{1F4BE}', jsx: '\u26A1', ts: '\u{1F4BE}', tsx: '\u26A1',
    json: '\u{1F4C4}', html: '\u{1F4C5}', htm: '\u{1F4C5}', css: '\u{1F4A7}', scss: '\u{1F4A7}',
    py: '\u{1F40D}', java: '\u{1F4E0}', cs: '\u{1F4E0}', c: '\u{1F4E0}', h: '\u{1F4E0}', cpp: '\u{1F4E0}',
    go: '\u{1F427}', rs: '\u{1F980}', rb: '\u{1F427}', php: '\u{1F427}', sql: '\u{1F5C4}',
    md: '\u{1F4DD}', yml: '\u{1F5C4}', yaml: '\u{1F5C4}', toml: '\u{1F5C4}', ini: '\u{1F5C4}',
    sh: '\u{1F4BB}', bat: '\u{1F4BB}', lock: '\u{1F512}', txt: '\u{1F4C4}', svg: '\u{1F5BC}'
  };
  var SKIP_DIRS = ['.git', 'node_modules', '__pycache__', '.venv', '.svn', '.hg', '.DS_Store'];

  function icon(name) {
    var i = name.lastIndexOf('.');
    if (i > 0) { var e = name.slice(i + 1).toLowerCase(); if (ICONS[e]) return ICONS[e]; }
    if (/^Dockerfile/i.test(name)) return '\u{1F433}';
    return '\u{1F4C4}';
  }

  function Explorer(ref) {
    this.treeEl = ref.tree;
    this.rowEl = ref.folderRow;
    this.nameEl = ref.folderName;
    this.chevEl = ref.folderChev;
    this.onOpenFile = ref.onOpenFile || function () {};
    this.prompt = ref.prompt || function () { return Promise.resolve(null); };
    this.confirm = ref.confirm || function () { return Promise.resolve(false); };
    this.toast = ref.toast || function () {};

    this.root = null;
    this.selected = null;
    this.flat = [];       // every discovered node
    this.available = (typeof window.showDirectoryPicker === 'function');

    var self = this;
    this.rowEl.addEventListener('click', function () { self.toggleRoot(); });
    this.treeEl.addEventListener('contextmenu', function (e) {
      var item = e.target.closest('.tree-item');
      if (!item) return;
      e.preventDefault();
      self._selectByEl(item);
      self._menu(item);
    });
  }

  Explorer.prototype._selectByEl = function (el) {
    if (this.selected && this.selected.el) this.selected.el.classList.remove('active');
    var node = this._nodeForEl(el);
    this.selected = node;
    if (node && node.el) node.el.classList.add('active');
    if (node && node.kind === 'file') this.onOpenFile(node);
  };

  Explorer.prototype._nodeForEl = function (el) {
    var all = this.flat;
    for (var i = 0; i < all.length; i++) if (all[i].el === el) return all[i];
    return null;
  };

  /* ---------- folder open ---------- */
  Explorer.prototype.openFolder = function () {
    if (!this.available) { this.toast('Folder access needs the CodeLite launcher (start the .bat file).', true); return; }
    var self = this;
    window.showDirectoryPicker({ mode: 'readwrite' }).then(function (handle) {
      self.setRoot(handle);
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      self.toast('Could not open folder: ' + e.message, true);
    });
  };

  Explorer.prototype.setRoot = function (handle) {
    this.root = { name: handle.name, kind: 'dir', handle: handle, children: null, expanded: true, depth: 0 };
    this.flat = [this.root];
    this.selected = null;
    this.nameEl.textContent = handle.name;
    this.treeEl.innerHTML = '';
    this.chevEl.textContent = '▾';
    this._load(this.root).then(function () { });
  };

  Explorer.prototype.toggleRoot = function () {
    if (!this.root) return;
    if (this.root.expanded && this.root.children) {
      this.root.expanded = false;
      this.chevEl.textContent = '▸';
    } else {
      this.root.expanded = true;
      this.chevEl.textContent = '▾';
    }
    this._render();
  };

  Explorer.prototype.refresh = function () {
    if (!this.root) return;
    this.root.children = null;
    var self = this;
    this._load(this.root).then(function () { self._render(); });
  };

  /* ---------- directory loading (lazy) ---------- */
  Explorer.prototype._load = function (node) {
    var self = this;
    if (!node || !node.handle) return Promise.resolve();
    if (node.children) return Promise.resolve(node.children);

    var out = [];
    var it = node.handle.values();
    function step() {
      return it.next().then(function (res) {
        if (res.done) return null;
        var e = res.value;
        var child = {
          name: e.name, kind: e.kind === 'directory' ? 'dir' : 'file',
          handle: e, parent: node, children: null, expanded: false,
          depth: (node.depth || 0) + 1
        };
        out.push(child);
        self.flat.push(child);
        return step();
      });
    }
    out.sort(function (a, b) {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return step().then(function () {
      node.children = out;
      node.childMap = {};
      out.forEach(function (c) { node.childMap[c.name.toLowerCase()] = c; });
      return out;
    });
  };

  /* ---------- render ---------- */
  Explorer.prototype._render = function () {
    var frag = document.createDocumentFragment();
    var hidden = SKIP_DIRS.filter(function (d) { return d === '.git' || d === 'node_modules'; });
    (function walk(node) {
      if (!node.children) return;
      node.children.forEach(function (child) {
        if (child.kind === 'dir' && SKIP_DIRS.indexOf(child.name) > -1) return;
        frag.appendChild(selfItem(child));
        if (child.kind === 'dir' && child.expanded && child.children) {
          var box = document.createElement('div');
          box.className = 'tree-children open';
          (function w(c) {
            c.children.forEach(function (g) {
              if (g.kind === 'dir' && SKIP_DIRS.indexOf(g.name) > -1) return;
              box.appendChild(selfItem(g));
              if (g.kind === 'dir' && g.expanded && g.children) w(g);
            });
          })(child);
          frag.appendChild(box);
        }
      });
    })(this.root);

    this.treeEl.innerHTML = '';
    this.treeEl.appendChild(frag);

    function selfItem(child) {
      var el = document.createElement('div');
      el.className = 'tree-item';
      el.style.paddingLeft = (8 + child.depth * 12) + 'px';
      if (this.selected === child) el.classList.add('active');

      var chev = document.createElement('span');
      chev.className = 'ti-chev';
      chev.textContent = child.kind === 'dir' ? (child.expanded ? '▾' : '▸') : '';

      var ico = document.createElement('span');
      ico.className = 'ti-ico';
      ico.textContent = child.kind === 'dir' ? (child.expanded ? '\u{1F4C2}' : '\u{1F4C1}') : icon(child.name);

      var nm = document.createElement('span');
      nm.className = 'ti-name';
      nm.textContent = child.name;

      el.appendChild(chev); el.appendChild(ico); el.appendChild(nm);
      child.el = el;

      var self = this;
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (child.kind === 'dir') self.toggle(child);
        else self._selectByEl(el);
      });
      return el;
    }
  };

  Explorer.prototype.toggle = function (node) {
    var self = this;
    if (!node.expanded) {
      node.expanded = true;
      this._render();
      if (!node.children) {
        this._load(node).then(function () { self._render(); });
      }
    } else {
      node.expanded = false;
      this._render();
    }
  };

  /* ---------- file index (quick open / outline) ---------- */
  Explorer.prototype.scanAll = function () {
    var self = this;
    if (!this.root) return Promise.resolve([]);
    var files = [], count = 0, LIMIT = 30000;

    function walk(handle, path, depth) {
      if (count > LIMIT || depth > 12) return Promise.resolve();
      var it = handle.values();
      function step() {
        return it.next().then(function (res) {
          if (res.done || count > LIMIT) return null;
          var e = res.value;
          var p = path + '/' + e.name;
          if (e.kind === 'file') { files.push({ name: e.name, path: p, handle: e }); count++; return null; }
          if (SKIP_DIRS.indexOf(e.name) > -1) return null;
          return walk(e, p, depth + 1).then(step);
        });
      }
      return step();
    }
    return walk(this.root.handle, this.root.name, 0).then(function () { return files; });
  };

  /* ---------- mutations ---------- */
  Explorer.prototype._activeDir = function () {
    if (this.selected && this.selected.kind === 'dir') return this.selected;
    if (this.selected && this.selected.parent) return this.selected.parent;
    return this.root;
  };

  Explorer.prototype._unique = function (dir, name) {
    var map = dir.childMap || {};
    if (!map[name.toLowerCase()]) return name;
    var base = name.replace(/(\.[^.]+)?$/, ''), ext = (name.match(/(\.[^.]+)$/) || [, ''])[1];
    var i = 1;
    while (map[(base + ' ' + i + ext).toLowerCase()]) i++;
    return base + ' ' + i + ext;
  };

  Explorer.prototype.newFile = function () {
    var self = this;
    var dir = this._activeDir();
    if (!dir || !dir.handle) { this.toast('Open a folder first.', true); return; }
    this._load(dir).then(function () {
      self.prompt('New File', 'untitled.txt').then(function (name) {
        if (!name) return;
        name = self._unique(dir, name.trim());
        dir.handle.getFileHandle(name, { create: true }).then(function (fh) {
          var child = { name: name, kind: 'file', handle: fh, parent: dir, depth: (dir.depth || 0) + 1 };
          dir.children.push(child);
          dir.childMap[name.toLowerCase()] = child;
          dir.expanded = true;
          self._render();
          if (child.el) self._selectByEl(child.el);
        }).catch(function (e) { self.toast('Error: ' + e.message, true); });
      });
    });
  };

  Explorer.prototype.newFolder = function () {
    var self = this;
    var dir = this._activeDir();
    if (!dir || !dir.handle) { this.toast('Open a folder first.', true); return; }
    this._load(dir).then(function () {
      self.prompt('New Folder', 'new-folder').then(function (name) {
        if (!name) return;
        name = self._unique(dir, name.trim());
        dir.handle.getDirectoryHandle(name, { create: true }).then(function (dh) {
          var child = { name: name, kind: 'dir', handle: dh, parent: dir, children: [], childMap: {}, expanded: true, depth: (dir.depth || 0) + 1 };
          dir.children.push(child);
          dir.childMap[name.toLowerCase()] = child;
          self._render();
        }).catch(function (e) { self.toast('Error: ' + e.message, true); });
      });
    });
  };

  Explorer.prototype.renameSelected = function () {
    var self = this;
    var node = this.selected;
    if (!node) { this.toast('Select an item first.', true); return; }
    this.prompt('Rename', node.name).then(function (name) {
      if (!name || name === node.name) return;
      name = self._unique(node.parent, name.trim());
      node.handle.move(name).then(function () {
        node.name = name;
        self._render();
        self.toast('Renamed to ' + name);
      }).catch(function (e) { self.toast('Error: ' + e.message, true); });
    });
  };

  Explorer.prototype.deleteSelected = function () {
    var self = this;
    var node = this.selected;
    if (!node) { this.toast('Select an item first.', true); return; }
    this.confirm('Delete "' + node.name + '" permanently? This cannot be undone.', 'Delete').then(function (ok) {
      if (!ok) return;
      var parent = node.parent;
      parent.handle.removeEntry(node.name).then(function () {
        var i = parent.children.indexOf(node);
        if (i > -1) parent.children.splice(i, 1);
        delete parent.childMap[node.name.toLowerCase()];
        var f = self.flat.indexOf(node);
        if (f > -1) self.flat.splice(f, 1);
        self.selected = null;
        self._render();
        self.toast('Deleted ' + node.name);
      }).catch(function (e) { self.toast('Error: ' + e.message, true); });
    });
  };

  Explorer.prototype.reveal = function (path) {
    if (!this.root) return;
    var parts = path.split('/').filter(Boolean);
    if (parts[0] === this.root.name) parts.shift();
    var node = this.root, self = this;
    function step(i) {
      if (i >= parts.length) { node.expanded = true; self._render(); if (node.el) self._selectByEl(node.el); return; }
      self._load(node).then(function () {
        var c = (node.childMap || {})[parts[i].toLowerCase()];
        if (!c) { self.toast('Not found: ' + path, true); return; }
        node.expanded = true;
        c.expanded = true;
        self._render();
        step(i + 1);
      });
    }
    step(0);
  };

  Explorer.prototype.getRootName = function () { return this.root ? this.root.name : null; };

  function create(ref) { return new Explorer(ref); }

  return { create: create, ICONS: ICONS };
})();