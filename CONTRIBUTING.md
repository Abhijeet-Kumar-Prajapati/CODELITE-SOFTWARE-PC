# Contributing to CodeLite

Thanks for taking the time to help. CodeLite is small on purpose, so every
line counts.

## Before you start

- Open an issue first for anything larger than a bug fix, so we agree on the
  direction before you write the code.
- Keep the whole editor dependency-free. No frameworks, no bundlers, no
  `node_modules`. It is plain HTML, CSS and JavaScript on purpose.
- Nothing in the app may make a network request. If a feature needs the
  internet, it does not belong in CodeLite.

## Style

- 2 space indent, semicolons, `var` in the older files, single quotes
- Comments explain *why*, not *what*
- No dead code, no commented-out blocks left behind
- English for code and comments; user-facing docs also exist in Hindi
  (`docs/USER-GUIDE-HI.txt`)

## Testing before you open a pull request

```powershell
# 1. the tokenizer must parse without losing a single character
node scripts/test-highlight.js

# 2. the app must load with no console errors
#    run:  src\START CodeLite.bat
#    then open http://localhost:8737 in Edge or Chrome

# 3. the installer still compiles
powershell -ExecutionPolicy Bypass -File installer\build-installer.ps1
```

## Changing the version

Bump it in one place per file:

- `installer/CodeLite.iss`  → `AppVersion`
- `docs/CHANGELOG.md`       → new section at the top
- `src/app/js/app.js`       → the welcome-screen text, if it shows a version

## Reporting bugs

Please include:

- Windows version
- Edge or Chrome version
- what you did, what you expected, what happened instead
- a screenshot if it is a visual problem

## Security issues

Do not open a public issue for a security problem. Contact the maintainer
privately first.