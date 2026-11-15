# Repository instructions

## Project scope

This repository hosts a simple static GitHub Pages website basic app and games for fun and experimentation.
Keep changes small, readable, and consistent with a lightweight HTML/CSS/JavaScript static site.

## Security requirements

- Do not add secrets, API keys, tokens, credentials, personal data, or private configuration to the repo.
- Do not expose environment values or deployment secrets in HTML, JS, CSS, or documentation.
- Do not modify GitHub Pages deployment settings, Actions workflows, or repository permissions unless explicitly requested.
- Do not introduce remote scripts, analytics, trackers, or untrusted third-party content without clear justification.
- Do not run destructive commands against the repo or rewrite unrelated files.

## Working rules

- Read the existing project files before changing behavior.
- Must be responsive for mobile.
- Preserve the static-site workflow and keep the site self-contained.
- Keep file paths relative to the repository root and avoid unnecessary new dependencies.
- When a task touches deployment or security-sensitive files, ask for confirmation before proceeding.

## Validation

- Validate the change with the smallest practical check.
- For front-end changes, ensure the page still loads correctly in a browser or via a local static server.
- Keep patches minimal and avoid unrelated cleanup or formatting churn.
