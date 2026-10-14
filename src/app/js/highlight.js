/* =========================================================
   CodeLite :: highlight.js
   Lightweight regex based tokenizer + HTML renderer.
   ========================================================= */
window.CLHighlight = (function () {
  'use strict';

  var esc = function (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var rx = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

  /* ---------- rule factory ---------- */
  function R(type, pattern, flags) {
    try { return { type: type, re: new RegExp(pattern, 'y' + (flags || '')) }; }
    catch (e) { return null; }
  }
  function kw(words, type) {
    var uniq = Array.from(new Set(words));
    uniq.sort(function (a, b) { return b.length - a.length; });
    return R(type || 'keyword', '\\b(?:' + uniq.map(rx).join('|') + ')\\b');
  }
  /* case-insensitive keyword rule */
  function kwI(words, type) {
    var uniq = Array.from(new Set(words));
    uniq.sort(function (a, b) { return b.length - a.length; });
    return R(type || 'keyword', '\\b(?:' + uniq.map(rx).join('|') + ')\\b', 'i');
  }
  function keep(list) { return list.filter(Boolean); }

  /* ---------- shared rule factories ---------- */
  var F = {
    slashC:  function () { return R('comment', '//[^\\n]*'); },
    hashC:   function () { return R('comment', '#[^\\n]*'); },
    blockC:  function () { return R('comment', '/\\*[\\s\\S]*?(?:\\*/|$)'); },
    htmlC:   function () { return R('comment', '<!--[\\s\\S]*?(?:-->|$)'); },
    dashC:   function () { return R('comment', '--[^\\n]*'); },
    dq:      function () { return R('string', '"(?:\\\\.|[^"\\\\\\n])*"?'); },
    sq:      function () { return R('string', "'(?:\\\\.|[^'\\\\\\n])*'?"); },
    tpl:     function () { return R('string', '`(?:\\\\.|[^`\\\\])*`?'); },
    num: function () {
      return R('number', '\\b(?:0[xX][0-9a-fA-F][0-9a-fA-F_]*|0[bB][01][01_]*|0[oO][0-7][0-7_]*|\\d[\\d_]*(?:\\.[\\d_]+)?(?:[eE][+-]?\\d+)?n?)\\b');
    },
    decor:   function () { return R('decorator', '@[A-Za-z_$][\\w$.]*'); },
    ident:   function (t) { return R(t || 'variable', '[A-Za-z_$][\\w$]*'); },
    fn:      function () { return R('function', '[A-Za-z_$][\\w$]*(?=\\s*\\()'); },
    type:    function () { return R('type', '[A-Z][\\w$]*'); },
    dollar:  function () { return R('variable', '\\$[A-Za-z_][\\w]*'); },
    op:      function () { return R('operator', '[+\\-*/%=<>!&|^~?:]+'); },
    punct:   function () { return R('punct', '[{}()\\[\\];,.]'); },
    regex: function () {
      return R('regex', '(?<=[=(,:[!&|?{};]\\s*)\\/(?![*/\\s])(?:\\\\.|\\[(?:\\\\.|[^\\]\\\\])*\\]|[^/\\\\\\n\\[])+\\/[gimsuy]*');
    }
  };

  /* ---------- keyword tables ---------- */
  var K = {
    js: 'abstract as async await break case catch class const continue debugger declare default delete do else enum export extends finally for from function get if implements import in instanceof interface let new of package private protected public readonly return satisfies set static super switch this throw try type typeof var void while with yield as const asserts infer is keyof namespace object override readonly unique global declare module require exports process console window document undefined null true false NaN Infinity arguments'.split(' '),
    py: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case self cls def'.split(' '),
    clike: 'auto break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while class namespace template public private protected virtual friend explicit operator new delete this throw try catch using bool void int long short char float double unsigned signed sizeof'.split(' '),
    java: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try var void volatile while true false null record sealed permits yield'.split(' '),
    csharp: 'abstract as base bool break byte case catch char checked class const continue decimal default delegate do double dynamic else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly record ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile while async await get set init partial yield global'.split(' '),
    go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false error string int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 bool byte rune len cap make new append copy delete panic recover print println'.split(' '),
    rust: 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while box Vec Option Result String Some None Ok Err i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 f32 f64 usize isize bool char str'.split(' '),
    php: 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield true false null int float string bool void mixed never parent self'.split(' '),
    ruby: 'alias and begin break case class def defined? do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield attr_accessor attr_reader attr_writer require require_relative puts new lambda proc raise'.split(' '),
    sql: 'SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP INDEX VIEW JOIN LEFT RIGHT INNER OUTER FULL CROSS ON GROUP BY ORDER HAVING LIMIT OFFSET UNION ALL DISTINCT AS AND OR NOT NULL IS IN BETWEEN LIKE EXISTS CASE WHEN THEN ELSE END PRIMARY KEY FOREIGN REFERENCES DEFAULT UNIQUE CHECK CONSTRAINT BEGIN COMMIT ROLLBACK TRANSACTION GRANT REVOKE PROCEDURE FUNCTION TRIGGER VIEW DATABASE SCHEMA USE SHOW DESCRIBE EXPLAIN WITH RECURSIVE OVER PARTITION CAST CASE'.toLowerCase().split(' '),
    shell: 'if then else elif fi for while until do done case esac function in select time break continue return exit export local readonly declare source alias unalias set unset trap shift eval exec test true false echo cd pwd ls cat grep sed awk curl wget chmod chown kill ps top df du mkdir rm cp mv find xargs tar ssh scp git npm node yarn docker sudo apt yum make'.split(' '),
    ps: 'if else elseif switch foreach for while do until break continue return function param begin process end try catch finally throw class enum filter in parallel sequence workflow using import function data dynamicparam inlinescript hidden static default description'.split(' '),
    lua: 'and break do else elseif end false for function goto if in local nil not or repeat return then true until while self'.split(' '),
    dart: 'abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for get hide if implements import in interface is late library mixin new null on operator part required rethrow return sealed set show static super switch sync this throw true try typedef var void while with yield'.split(' '),
    swift: 'associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as Any catch false is nil super self Self throw throws true try'.split(' '),
    kotlin: 'as break by catch class companion const constructor continue crossinline data delegate do dynamic else enum external false final finally for fun if import in infix init inline inner interface internal is lateinit noinline null object open operator out override package private protected public reified return sealed set super suspend this throw true try typealias val var vararg when where while'.split(' '),
    c: 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while define include ifdef ifndef endif pragma'.split(' '),
    r: 'if else repeat while function for next break TRUE FALSE NULL Inf NaN NA library require source'.split(' '),
    perl: 'my our local sub if elsif else unless while until for foreach do return package use require no BEGIN END and or not eq ne lt gt le ge'.split(' '),
    ini: 'true false null yes no on off'.split(' '),
    json: 'true false null'.split(' ')
  };

  /* ---------- grammars ---------- */
  function jsLike(extraK) {
    return keep([
      F.regex(), F.blockC(), F.slashC(), F.tpl(), F.dq(), F.sq(), F.num(), F.decor(),
      kw(extraK || K.js),
      kw(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'], 'constant'),
      kw(['string', 'number', 'boolean', 'any', 'unknown', 'never', 'void', 'object', 'symbol', 'bigint', 'Array', 'Promise', 'Record', 'Partial', 'Readonly'], 'type'),
      F.fn(), F.type(), F.ident(), F.op(), F.punct()
    ]);
  }

  var GRAMMARS = {
    javascript: jsLike(),
    typescript: jsLike(),
    jsx: jsLike(),
    tsx: jsLike(),
    python: keep([
      R('string', '"""[\\s\\S]*?(?:"""|$)'), R('string', "'''[\\s\\S]*?(?:'''|$)"),
      F.hashC(), F.dq(), F.sq(), F.num(), F.decor(),
      kw(K.py), kw(['true', 'false', 'None'], 'constant'),
      R('type', '(?<=class\\s)[A-Za-z_][\\w]*'),
      F.fn(), F.ident(), F.op(), F.punct()
    ]),
    java: keep([F.blockC(), F.slashC(), F.dq(), F.sq(), F.num(), F.decor(), kw(K.java),
      kw(['true', 'false', 'null'], 'constant'), F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    csharp: keep([F.blockC(), F.slashC(), F.dq(), F.sq(), F.num(), F.decor(), kw(K.csharp),
      kw(['true', 'false', 'null'], 'constant'), F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    c: keep([F.blockC(), F.slashC(), F.dq(), F.sq(), F.num(), F.decor(), kw(K.c),
      kw(['true', 'false', 'NULL'], 'constant'), F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    cpp: keep([F.blockC(), F.slashC(), F.dq(), F.sq(), F.num(), F.decor(), kw(K.c),
      kw(['true', 'false', 'NULL'], 'constant'), F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    go: keep([F.blockC(), F.slashC(), F.tpl(), F.dq(), F.sq(), F.num(),
      kw(K.go), kw(['true', 'false', 'nil', 'iota'], 'constant'),
      R('type', '(?<=\\btype\\s)[A-Za-z_][\\w]*'), F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    rust: keep([F.blockC(), F.slashC(), F.dq(), F.sq(), F.num(),
      kw(K.rust), kw(['true', 'false', 'Some', 'None', 'Ok', 'Err'], 'constant'),
      kw(['String', 'Vec', 'Option', 'Result', 'Box'], 'type'),
      F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    php: keep([F.hashC(), F.blockC(), F.dq(), F.sq(), F.num(), F.dollar(), F.decor(),
      kw(K.php), kw(['true', 'false', 'null'], 'constant'),
      R('type', '(?<=class\\s)[A-Za-z_][\\w]*'), F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    ruby: keep([F.hashC(), F.dq(), F.sq(), F.num(), F.dollar(), F.decor(),
      kw(K.ruby, 'keyword'), R('type', '(?<=class\\s|module\\s)[A-Z][\\w]*'),
      F.fn(), F.ident(), F.op(), F.punct()]),
    sql: keep([F.slashC(), F.blockC(), F.dq(), F.sq(), F.num(),
      kwI(K.sql, 'keyword'), R('punct', '[(),.*;]', 'i')]),
    shell: keep([F.hashC(), F.dq(), F.sq(), F.dollar(), F.num(),
      kw(K.shell, 'keyword'), R('operator', '\\b(?:\\-\\-?[a-zA-Z][\\w-]*)\\b'),
      F.fn(), F.ident(), F.op(), F.punct()]),
    powershell: keep([F.hashC(), F.dq(), F.sq(), F.dollar(), F.num(), kw(K.ps),
      kw(['true', 'false', 'null', '$true', '$false'], 'constant'),
      F.fn(), F.ident(), F.op(), F.punct()]),
    lua: keep([F.slashC(), F.blockC(), F.dq(), F.sq(), F.num(), kw(K.lua),
      kw(['true', 'false', 'nil'], 'constant'), F.fn(), F.ident(), F.op(), F.punct()]),
    dart: keep([F.blockC(), F.slashC(), F.dq(), F.sq(), F.num(), F.decor(), kw(K.dart),
      kw(['true', 'false', 'null'], 'constant'), F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    swift: keep([F.blockC(), F.slashC(), F.dq(), F.sq(), F.num(), F.decor(), kw(K.swift),
      kw(['true', 'false', 'nil'], 'constant'), F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    kotlin: keep([F.blockC(), F.slashC(), F.dq(), F.sq(), F.num(), F.decor(), kw(K.kotlin),
      kw(['true', 'false', 'null'], 'constant'), F.fn(), F.type(), F.ident(), F.op(), F.punct()]),
    r: keep([F.hashC(), F.dq(), F.sq(), F.num(), kw(K.r, 'keyword'), F.fn(), F.ident(), F.op(), F.punct()]),
    perl: keep([F.hashC(), F.dq(), F.sq(), F.num(), F.dollar(), kw(K.perl), F.fn(), F.ident(), F.op(), F.punct()]),
    json: keep([
      R('attr', '"(?:\\\\.|[^"\\\\])*"(?=\\s*:)'), F.dq(), F.sq(), F.num(),
      kw(K.json, 'constant'), R('punct', '[{}\\[\\],:]')
    ]),
    html: keep([
      F.htmlC(), R('meta', '<!DOCTYPE[^>]*>', 'i'),
      R('tag', '</?[A-Za-z][\\w:.-]*'), R('attr', '[A-Za-z_:@#][\\w:.@#-]*(?=\\s*=)'),
      F.dq(), F.sq(), R('constant', '&#[xX]?[0-9a-fA-F]+;|&[a-zA-Z]+;'),
      R('punct', '[<>/=]'), F.fn()
    ]),
    xml: keep([
      F.htmlC(), R('meta', '<\\?[\\s\\S]*?\\?>'),
      R('tag', '</?[A-Za-z][\\w:.-]*'), R('attr', '[A-Za-z_:][\\w:.-]*(?=\\s*=)'),
      F.dq(), F.sq(), R('punct', '[<>/=]')
    ]),
    css: keep([
      F.blockC(), F.dq(), F.sq(),
      R('meta', '@[a-zA-Z-]+'),
      R('variable', '--[A-Za-z0-9_-]+'),
      R('attr', '-?[a-zA-Z]+(?=\\s*:)'),
      R('number', '#[0-9a-fA-F]{3,8}\\b'),
      R('number', '\\b\\d*\\.?\\d+(?:px|em|rem|ex|ch|vh|vw|vmin|vmax|pt|pc|cm|mm|in|s|ms|deg|turn|fr|%)?'),
      R('function', '(?:[a-zA-Z-]+)(?=\\()'),
      R('selector', '[.#][A-Za-z_-][\\w-]*'),
      R('selector', '::?[a-zA-Z-]+'),
      R('punct', '[{}()\\[\\];:,>+~*=]')
    ]),
    yaml: keep([
      R('comment', '#[^\\n]*'), F.dq(), F.sq(), F.num(),
      R('attr', '[A-Za-z_][\\w.-]*(?=\\s*:)'),
      R('meta', '[&*][A-Za-z0-9_-]+'),
      R('constant', '\\b(?:true|false|null|yes|no|on|off|~)\\b'),
      R('punct', '[-:]'), R('variable', '^\\s+')
    ]),
    markdown: keep([
      R('comment', '```[\\s\\S]*?(?:```|$)'),
      R('keyword', '^ {0,6}#{1,6}[^\\n]*', 'm'),
      R('keyword', '^ {0,3}[-*+][^\\n]*', 'm'),
      R('keyword', '^ {0,3}>[^\\n]*', 'm'),
      R('keyword', '^ {0,3}(?:---+|===+)$', 'm'),
      R('string', '`[^`\\n]*`'),
      R('function', '!?\\[[^\\]\\n]*\\]\\([^)\\n]*\\)'),
      R('type', '\\*\\*[^*\\n]+\\*\\*'),
      R('punct', '[*_`~]')
    ]),
    ini: keep([F.sq(), F.dq(), F.hashC(), F.semicolonC ? null : R('comment', '[;][^\\n]*'),
      kw(K.ini, 'constant'), R('attr', '^\\s*\\[[^\\]\\n]*\\]'), R('punct', '[=]')]),
    docker: keep([F.hashC(), F.dq(), F.sq(), F.dollar(),
      kw(['FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL', 'AS'], 'keyword'),
      F.fn(), F.ident(), R('punct', '[.,]')]),
    toml: keep([F.hashC(), F.dq(), F.sq(), F.num(),
      R('attr', '^\\s*\\[[^\\]\\n]*\\]', 'm'), R('attr', '\\b[A-Za-z_][\\w.-]*(?=\\s*=)'),
      kw(['true', 'false'], 'constant'), R('punct', '[=,\\[\\]]')]),
    plain: keep([F.ident(), F.op(), F.punct()])
  };

  /* ---------- extension -> language ---------- */
  var EXT = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
    ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx',
    py: 'python', pyw: 'python', pyi: 'python',
    java: 'java', cs: 'csharp', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
    hpp: 'cpp', hh: 'cpp', hxx: 'cpp', m: 'cpp', mm: 'cpp',
    go: 'go', rs: 'rust', php: 'php', phtml: 'html', rb: 'ruby', erb: 'ruby',
    sql: 'sql', sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell', ps1: 'powershell',
    psm1: 'powershell', lua: 'lua', dart: 'dart', swift: 'swift', kt: 'kotlin', kts: 'kotlin',
    r: 'r', pl: 'perl', pm: 'perl', json: 'json', jsonc: 'json',
    html: 'html', htm: 'html', xhtml: 'html', xml: 'xml', svg: 'xml', vue: 'html', svelte: 'html',
    css: 'css', scss: 'css', sass: 'css', less: 'css',
    yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini', cfg: 'ini', conf: 'ini', env: 'ini',
    md: 'markdown', markdown: 'markdown', mdx: 'markdown',
    dockerfile: 'docker', bat: 'batch', cmd: 'batch',
    txt: 'plain', log: 'plain'
  };
  var NAME = {
    javascript: 'JavaScript', typescript: 'TypeScript', jsx: 'JavaScript JSX', tsx: 'TypeScript JSX',
    python: 'Python', java: 'Java', csharp: 'C#', c: 'C', cpp: 'C++', go: 'Go', rust: 'Rust',
    php: 'PHP', ruby: 'Ruby', sql: 'SQL', shell: 'Shell Script', powershell: 'PowerShell',
    lua: 'Lua', dart: 'Dart', swift: 'Swift', kotlin: 'Kotlin', r: 'R', perl: 'Perl',
    json: 'JSON', html: 'HTML', xml: 'XML', css: 'CSS', yaml: 'YAML', markdown: 'Markdown',
    ini: 'INI', docker: 'Dockerfile', toml: 'TOML', plain: 'Plain Text'
  };
  var LINE_COMMENT = {
    python: '#', ruby: '#', shell: '#', powershell: '#', r: '#', perl: '#', yaml: '#',
    ini: ';', docker: '#', toml: '#', lua: '--', sql: '--', batch: 'REM'
  };

  function detect(fileName) {
    var n = (fileName || '').toLowerCase();
    if (/^dockerfile(\.|$)/.test(n) || n === 'dockerfile') return 'docker';
    var i = n.lastIndexOf('.');
    if (i < 0) return 'plain';
    return EXT[n.slice(i + 1)] || 'plain';
  }

  /* ---------- tokenizer ---------- */
  function tokenize(code, lang) {
    var rules = GRAMMARS[lang] || GRAMMARS.plain;
    var out = [];
    var i = 0, n = code.length;
    var plainStart = -1;

    function flush(end) {
      if (plainStart >= 0) {
        out.push({ s: plainStart, e: end, t: null });
        plainStart = -1;
      }
    }

    while (i < n) {
      var matched = false;
      for (var r = 0; r < rules.length; r++) {
        var rule = rules[r];
        if (!rule || !rule.re) continue;
        rule.re.lastIndex = i;
        var m = rule.re.exec(code);
        if (m && m[0].length) {
          flush(i);
          out.push({ s: i, e: i + m[0].length, t: rule.type });
          i += m[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (plainStart < 0) plainStart = i;
        i += (code.charCodeAt(i) >= 0xd800 && code.charCodeAt(i) < 0xdc00) ? 2 : 1;
      }
    }
    flush(n);
    return out;
  }

  /* ---------- renderer ---------- */
  function render(code, tokens, ranges, curIdx) {
    if (!tokens || !tokens.length) return esc(code) || '';
    var useRanges = ranges && ranges.length;
    var html = '';
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var cls = t.t ? ' class="t-' + t.t + '"' : '';
      var txt = esc(code.slice(t.s, t.e));

      if (!useRanges) { html += cls ? '<span' + cls + '>' + txt + '</span>' : txt; continue; }

      var overlap = false;
      for (var k = 0; k < ranges.length; k++) { if (ranges[k][1] > t.s && ranges[k][0] < t.e) { overlap = true; break; } }
      if (!overlap) { html += cls ? '<span' + cls + '>' + txt + '</span>' : txt; continue; }

      var cursor = t.s, out = '';
      for (var q = 0; q < ranges.length; q++) {
        var r = ranges[q];
        if (r[1] <= cursor) continue;
        if (r[0] >= t.e) break;
        var a = Math.max(r[0], t.s), b = Math.min(r[1], t.e);
        if (a > cursor) out += plainSeg(cls, esc(code.slice(cursor, a)));
        out += '<span class="' + (t.t ? 't-' + t.t + ' ' : '') + 'mk' + (q === curIdx ? ' cur' : '') + '">' + esc(code.slice(a, b)) + '</span>';
        cursor = b;
      }
      if (cursor < t.e) out += plainSeg(cls, esc(code.slice(cursor, t.e)));
      html += out;
    }
    return html;
  }
  function plainSeg(cls, txt) { return cls ? '<span' + cls + '>' + txt + '</span>' : txt; }

  return {
    detect: detect,
    name: function (l) { return NAME[l] || 'Plain Text'; },
    lineComment: function (l) { return LINE_COMMENT[l] || '//'; },
    tokenize: tokenize,
    render: render,
    esc: esc
  };
})();