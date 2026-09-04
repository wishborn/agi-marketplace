# Knowledge Workers

## Overview

Knowledge domain workers for research, analysis, and information management. Provides six workers covering data analysis, cryptographic operations, library management, linguistic work, research, and transcription. This plugin is baked in and cannot be disabled.

## Workers

| Worker ID | Name | Role |
|-----------|------|------|
| `k.analyst` | Analyst | Analyzes data, reports, and structured information — produces findings with supporting evidence |
| `k.cryptologist` | Cryptologist | Cryptographic analysis and implementation review — keys, ciphers, protocols |
| `k.librarian` | Librarian | Organizes, indexes, and retrieves information — manages knowledge bases and file collections |
| `k.linguist` | Linguist | Terminology management — maintains glossaries, ensures naming consistency across the codebase |
| `k.researcher` | Researcher | Deep research and literature review — synthesizes information from multiple sources |
| `k.scribe` | Scribe | Transcription and formatting — converts raw content into structured documents |

## Dispatch Keywords

`analyze`, `research`, `glossary`, `terminology`, `encrypt`, `decrypt`, `index`, `organize`, `library`, `investigate`, `transcribe`

## Chain Note

`k.linguist` is the chain target for `data.modeler` — when a data modeler completes, linguist automatically updates the project glossary to reflect new schema terms.

## Permissions

`filesystem.read`, `filesystem.write`
