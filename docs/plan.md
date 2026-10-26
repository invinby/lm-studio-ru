# LM Studio Russian Interface Implementation Plan

**Goal:** Complete the installed Russian dictionaries, package a reversible Windows patcher, verify the app and publish lm-studio-ru.

**Architecture:** Version-pinned replacement of Russian resource modules and reviewed static UI literals. Original bundles stay local in a checksummed backup. Translation files remain independently editable.

**Tech Stack:** Node.js 22+ built-ins, JSON, PowerShell launchers, node:test.

**Spec:** design.md. The user approved the design and explicitly requested immediate execution in this chat.

## Global Constraints
- Target LM Studio 0.4.26+4 on Windows.
- Preserve interpolation variables, markup and program identifiers.
- Publish only localization and patcher sources; no app bundles or user configuration.
- Backup, idempotent apply, dry run, checksum verification and rollback.

## Review Focus
- Unknown application build: refuse before mutation.
- Existing backup or third-party modifications: refuse unrecognized states.
- Interrupted writes: atomic replacement and verified original backup.
- Translation placeholders and tags: validate against English source.
- Concurrent application process: require closure before writes; do not kill it.

## Tasks
- [x] Audit bundled English/Russian dictionaries and hardcoded interface strings.
- [x] Complete Russian resources and validate coverage/placeholders/markup.
- [x] Write failing tests for version/hash refusal, apply, idempotence, rollback and tampering.
- [x] Implement the dependency-free patcher and launchers; run tests and syntax checks.
- [ ] Apply to local installation, inspect representative screens and record limits.
- [ ] Document installation/rollback/coverage, create public repository and push reviewed sources.
