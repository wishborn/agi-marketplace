# Code Workers

## Overview

Code domain workers for software development tasks. Provides four workers covering architecture design, implementation, code review, and test validation. This plugin is baked in and cannot be disabled.

## Workers

| Worker ID | Name | Role |
|-----------|------|------|
| `code.engineer` | Code Engineer | Architecture design — produces implementation specs and phase definitions for downstream workers |
| `code.hacker` | Code Hacker | Implementation — writes code matching existing codebase patterns. Always followed by `code.tester` |
| `code.reviewer` | Code Reviewer | Code review — analyzes implementation against requirements and conventions |
| `code.tester` | Code Tester | Test validation — writes and runs tests for implemented code |

## Enforced Chain

```
code.hacker → code.tester (automatic)
```

When `code.hacker` completes, the system automatically spawns `code.tester` with the same worktree and a list of files written.

## Dispatch Keywords

`implement`, `add`, `create`, `build`, `fix`, `write code`, `feature`, `bug fix`, `refactor`, `architecture`, `design`, `spec`, `plan`, `review`, `test`

## Permissions

`filesystem.read`, `filesystem.write`, `shell.exec`

## Notes

- `code.engineer` does not write implementation code — it designs architecture and defines phases.
- `code.hacker` scans the codebase for conventions before writing anything; code is matched to existing style.
