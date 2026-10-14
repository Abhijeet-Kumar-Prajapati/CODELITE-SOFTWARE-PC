/* =========================================================
   CodeLite :: minimap.js
   Token based code minimap (VS Code style).
   ========================================================= */
window.CLMinimap = (function () {
  'use strict';

  var MAX_H = 4000;      // max canvas height in px
  var CHAR_W = 1.15;     // px per character
  var LINE_H = 2;        // px per line
  var MARGIN = 4;

  function Minimap(canvas, slider, opts) {
    this.canvas = canvas;
    this.slider = slider;
    this.onSeek = (opts && opts.onSeek) || function () {};
    this.ctx = canvas.getContext('2d');
    this.lines = [];
    this.scale = 1;
    this.enabled = true;
    this.lastKey = '';
    this._bind();
  }

  Minimap.prototype._bind = function () {
    var self = this;
    function toLine(ev) {
      var r = self.canvas.getBoundingClientRect();
      var y = ev.clientY - r.top;
      var visualLine = Math.round(y / self.scale);
      self.onSeek(Math.max(0, visualLine));
    }
    this.canvas.addEventListener('mousedown', function (e) {
      e.preventDefault();
      toLine(e);
      function mv(ev) { toLine(ev); }
      function up() {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  };

  Minimap.prototype.setEnabled = function (on) {
    this.enabled = on;
    this.canvas.style.display = on ? '' : 'none';
    this.slider.style.display = on ? '' : 'none';
    if (!on) this.lastKey = '';
  };

  Minimap.prototype.clear = function () {
    this.lastKey = '';
    var c = this.canvas;
    this.ctx.clearRect(0, 0, c.width, c.height);
  };

  /* cssVar -> color */
  Minimap.prototype._palette = function () {
    var cs = getComputedStyle(document.documentElement);
    function v(n) { return cs.getPropertyValue('--' + n).trim() || '#888'; }
    return {
      null: v('fg'), comment: v('com'), string: v('str'), number: v('num'),
      keyword: v('kw'), constant: v('cst'), function: v('fn'), type: v('typ'),
      variable: v('vr'), operator: v('op'), punct: v('op'), tag: v('tag'),
      attr: v('atv'), decorator: v('dec'), selector: v('sel2'), meta: v('kw'),
      regex: v('str'), invalid: v('err')
    };
  };

  Minimap.prototype.draw = function (code, tokens) {
    if (!this.enabled) return;
    var key = tokens.length + ':' + code.length + ':' + document.documentElement.dataset.theme;
    if (key === this.lastKey) return;
    this.lastKey = key;

    /* line start offsets */
    var lines = [0];
    for (var i = 0; i < code.length; i++) if (code.charCodeAt(i) === 10) lines.push(i + 1);
    this.lines = lines;

    var count = lines.length;
    var lh = Math.min(LINE_H, MAX_H / Math.max(1, count));
    var scale = lh / LINE_H;
    this.scale = scale;

    var cssW = parseFloat(getComputedStyle(this.canvas).width) || 88;
    var dpr = window.devicePixelRatio || 1;
    var contentH = Math.max(1, Math.round(count * lh));
    var pixelW = Math.max(1, Math.round(cssW * dpr));
    var pixelH = Math.max(1, Math.min(4000, Math.round(contentH * dpr)));

    if (this.canvas.width !== pixelW || this.canvas.height !== pixelH) {
      this.canvas.width = pixelW;
      this.canvas.height = pixelH;
    }
    this.canvas.style.height = contentH + 'px';

    var ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelW, pixelH);
    var pal = this._palette();

    var charW = CHAR_W * dpr;
    var rowH = lh * dpr;
    var maxX = pixelW - MARGIN * dpr;

    /* binary search for line of an offset */
    function lineOf(off) {
      var lo = 0, hi = count - 1;
      while (lo < hi) {
        var mid = (lo + hi + 1) >> 1;
        if (lines[mid] <= off) lo = mid; else hi = mid - 1;
      }
      return lo;
    }

    for (var t = 0; t < tokens.length; t++) {
      var tk = tokens[t];
      if (!tk.t) continue;
      var color = pal[tk.t] || pal.variable;
      if (!color) continue;
      var ln = lineOf(tk.s);
      var x = (tk.s - lines[ln]) * charW + MARGIN * dpr;
      var w = (tk.e - tk.s) * charW;
      if (x > maxX) continue;
      if (x + w > maxX) w = maxX - x;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.72;
      ctx.fillRect(x, ln * rowH, Math.max(1, w), Math.max(1, rowH - (rowH > 2.5 ? 1 : 0)));
    }
    ctx.globalAlpha = 1;
  };

  /* draw the viewport indicator */
  Minimap.prototype.setViewport = function (scrollTop, viewH, totalH) {
    if (!this.enabled) { this.slider.classList.remove('on'); return; }
    var sh = this.canvas.clientHeight || 1;
    var ratio = viewH / Math.max(1, totalH);
    var h = Math.max(18, sh * ratio);
    var y = (scrollTop / Math.max(1, totalH)) * sh;
    y = Math.max(0, Math.min(sh - h, y));
    this.slider.style.height = h + 'px';
    this.slider.style.top = y + 'px';
    this.slider.classList.toggle('on', totalH > viewH + 4);
  };

  Minimap.prototype.visibleLines = function () { return this.lines.length; };

  return { create: function (c, s, o) { return new Minimap(c, s, o); } };
})();