# Changelog

All notable changes to CodeLite are recorded here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-14

First public release.

### Added
- **Editor core**
  - Syntax highlighting for 30+ languages (JavaScript, TypeScript,
    Python, Java, C/C++, C#, Go, Rust, PHP, Ruby, SQL, HTML, CSS,
    SCSS, JSON, YAML, TOML, XML, Markdown, Shell, PowerShell, Lua,
    Dart, Swift, Kotlin, Perl, R, Dockerfile, INI and more)
  - Line numbers with current-line highlight
  - Minimap with click-to-jump viewport indicator
  - Automatic indentation on Enter
  - Automatic closing and selection-wrapping for `(` `{` `[` `"` `` ` ``
  - Toggle line comment (`Ctrl + /`), delete line (`Ctrl + Shift + K`),
    duplicate line (`Ctrl + D`), move line (`Alt + Up/Down`)
  - Smart Home, expand selection (`Ctrl + L`)
  - Find and replace with regex, match-case and whole-word support
  - Goto line/column (`Ctrl + G`)

- **Navigation**
  - Command palette with 19 commands (`Ctrl + Shift + P`)
  - Quick open file picker (`Ctrl + P`) with fuzzy matching
  - Outline view listing functions, classes and document headings
  - Breadcrumbs for the active file

- **Files**
  - Folder tree explorer using the File System Access API
  - Lazy directory loading, so large projects open instantly
  - Create file, create folder, rename and delete
  - Automatic skipping of `.git`, `node_modules` and `__pycache__`
  - Multi-tab editing with unsaved-change indicators

- **Search**
  - Project-wide search with match count and click-to-jump

- **Interface**
  - VS Code inspired Dark+, Light+ and High Contrast themes
  - Adjustable font size, tab size, word wrap and minimap
  - Settings persisted locally

- **Distribution**
  - Windows installer built with Inno Setup (per-user, no admin rights)
  - Start Menu, Desktop and optional startup shortcuts
  - Portable ZIP build
  - Local server so the app runs in a secure browser context

### Security
- Fully offline. No telemetry, no analytics, no network calls.
- The bundled local server binds to `127.0.0.1` only and validates every
  request path against the installation directory.

[1.0.0]: https://github.com/Abhijeet-Kumar-Prajapati/CODELITE-SOFTWARE-PC/releases/tag/v1.0.0