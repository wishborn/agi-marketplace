import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-writing-research",
      label: "Research Paper",
      description: "Directory structure and tools for academic papers, theses, and research documents",
      category: "workflow",
      projectCategories: ["literature"],
      requirements: [
        { id: "writing-structure", label: "Writing Project Structure", description: "_wip/_proofed workflow with sections", type: "provided" },
      ],
      installActions: [
        {
          id: "scaffold",
          label: "Create research project structure",
          command: [
            "mkdir -p _wip/sections _proofed/sections _notes/research _pub mindmaps",
            "&& echo '---\\ntitle: Author Bio\\n---\\n\\n# Author Bio\\n\\n**Name:**\\n\\n**Institution:**\\n\\n**Field:**\\n\\n**Bio:**\\n\\nWrite a short bio here.' > _notes/author_bio.md",
            "&& echo '# Untitled Paper\\n\\nA research project.\\n\\n## Structure\\n\\n- `_wip/sections/` — Draft sections (abstract, introduction, methodology, etc.)\\n- `_proofed/sections/` — Approved sections\\n- `mindmaps/` — Concept maps and outlines\\n- `_notes/research/` — Source materials and references\\n- `_pub/` — Final output (PDF, LaTeX)' > README.md",
            "&& echo '# Abstract\\n\\n[Write abstract here]' > _wip/sections/01-abstract.md",
            "&& echo '# Introduction\\n\\n[Write introduction here]' > _wip/sections/02-introduction.md",
            "&& echo '# Methodology\\n\\n[Write methodology here]' > _wip/sections/03-methodology.md",
            "&& echo '# Results\\n\\n[Write results here]' > _wip/sections/04-results.md",
            "&& echo '# Discussion\\n\\n[Write discussion here]' > _wip/sections/05-discussion.md",
            "&& echo '# Conclusion\\n\\n[Write conclusion here]' > _wip/sections/06-conclusion.md",
            "&& echo '# References\\n\\n[Add references here]' > _wip/sections/07-references.md",
          ].join(" "),
        },
      ],
      devCommands: {},
      guides: [
        {
          title: "Research Paper Structure",
          content:
            "## Directory Layout\\n\\n" +
            "- **_wip/sections/** — Draft sections. Pre-scaffolded with standard academic structure\\n" +
            "- **_proofed/sections/** — Approved sections\\n" +
            "- **mindmaps/** — Concept maps as JSON files\\n" +
            "- **_notes/research/** — Source materials, PDFs, reference notes\\n" +
            "- **_pub/** — Final compiled output\\n\\n" +
            "## Section Naming\\n\\n" +
            "Prefix with number for ordering: `01-abstract.md`, `02-introduction.md`\\n" +
            "Add sub-sections as needed: `03a-methodology-design.md`, `03b-methodology-data.md`",
        },
      ],
      tools: [
        { id: "word-count", label: "Word Count", description: "Count words in WIP sections", action: "shell", command: "find _wip -name '*.md' -exec cat {} + 2>/dev/null | wc -w" },
        { id: "section-list", label: "Section List", description: "List all WIP sections with word counts", action: "shell", command: "for f in _wip/sections/*.md; do [ -f \"$f\" ] && echo \"$(basename \"$f\" .md): $(wc -w < \"$f\") words\"; done 2>/dev/null || echo 'No sections yet'" },
        { id: "move-to-proofed", label: "Move to Proofed", description: "Move all WIP sections to proofed", action: "shell", command: "cp -r _wip/sections/* _proofed/sections/ 2>/dev/null && echo 'Sections moved to _proofed/' || echo 'No sections to move'" },
        { id: "citation-check", label: "Citation Check", description: "Find unresolved citations", action: "shell", command: "grep -rn '\\[citation needed\\]\\|\\[TODO\\]\\|\\[REF\\]' _wip/sections/ 2>/dev/null || echo 'No unresolved citations found'" },
        { id: "compile-paper", label: "Compile Paper", description: "Concatenate proofed sections into single file", action: "shell", command: "cat _proofed/sections/*.md > _pub/paper.md 2>/dev/null && echo \"Compiled to _pub/paper.md ($(wc -w < _pub/paper.md) words)\" || echo 'No proofed sections'" },
      ],
      icon: "graduation-cap",
    });
  },
});
