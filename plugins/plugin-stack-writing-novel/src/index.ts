import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-writing-novel",
      label: "Novel",
      description: "Directory structure and tools for novel writing — chapters, character profiles, worldbuilding, mindmaps",
      category: "workflow",
      projectCategories: ["literature"],
      requirements: [
        { id: "writing-structure", label: "Writing Project Structure", description: "_wip/_proofed workflow with chapters", type: "provided" },
      ],
      installActions: [
        {
          id: "scaffold",
          label: "Create novel project structure",
          command: [
            "mkdir -p _wip/chapters _proofed/chapters _notes/research _pub mindmaps character_profiles worldbuilding",
            "&& echo '---\\ntitle: Author Bio\\n---\\n\\n# Author Bio\\n\\n**Name:**\\n\\n**Genre:** Fiction\\n\\n**Bio:**\\n\\nWrite a short bio here.' > _notes/author_bio.md",
            "&& echo '# Untitled Novel\\n\\nA novel project.\\n\\n## Structure\\n\\n- `_wip/chapters/` — Work in progress chapters\\n- `_proofed/chapters/` — Approved chapters\\n- `character_profiles/` — Character files (e.g. `frodo_baggins.md`)\\n- `worldbuilding/` — World/setting files\\n- `mindmaps/` — JSON mindmap files\\n- `_notes/` — Research and planning\\n- `_pub/` — Published output (EPUB, PDF)' > README.md",
          ].join(" "),
        },
      ],
      devCommands: {},
      guides: [
        {
          title: "Novel Structure",
          content:
            "## Directory Layout\\n\\n" +
            "- **_wip/chapters/** — Active writing. Name files like `01-the-beginning.md`, `02-the-journey.md`\\n" +
            "- **_proofed/chapters/** — Approved content. Use the *Move to Proofed* tool to promote chapters\\n" +
            "- **character_profiles/** — One `.md` file per character (e.g. `frodo_baggins.md`)\\n" +
            "- **worldbuilding/** — Setting, magic systems, geography (e.g. `middle_earth.md`, `magic_system.md`)\\n" +
            "- **mindmaps/** — JSON mindmap files for plotting and brainstorming\\n" +
            "- **_notes/** — Research materials, `author_bio.md`, references\\n" +
            "- **_pub/** — Final compiled output (EPUB, PDF, manuscript)\\n\\n" +
            "## Workflow\\n\\n" +
            "1. Write in `_wip/chapters/`\\n" +
            "2. When a chapter is ready, use *Move to Proofed* to promote it\\n" +
            "3. The Reader MApp serves content from `_proofed/`\\n" +
            "4. Use *Compile Manuscript* to merge all proofed chapters into one file",
        },
        {
          title: "Character Profiles",
          content:
            "## Creating Characters\\n\\n" +
            "Create one `.md` file per character in `character_profiles/`.\\n\\n" +
            "**Naming:** Use snake_case of the character name: `frodo_baggins.md`, `gandalf.md`\\n\\n" +
            "**Template:**\\n```\\n# Character Name\\n\\n**Role:** Protagonist / Antagonist / Supporting\\n**Age:**\\n**Description:**\\n\\n## Background\\n\\n## Personality\\n\\n## Arc\\n```",
        },
      ],
      tools: [
        { id: "word-count", label: "Word Count", description: "Count words in WIP chapters", action: "shell", command: "find _wip -name '*.md' -exec cat {} + 2>/dev/null | wc -w" },
        { id: "chapter-list", label: "Chapter List", description: "List all WIP chapters with word counts", action: "shell", command: "for f in _wip/chapters/*.md; do [ -f \"$f\" ] && echo \"$(basename \"$f\" .md): $(wc -w < \"$f\") words\"; done 2>/dev/null || echo 'No chapters yet'" },
        { id: "move-to-proofed", label: "Move to Proofed", description: "Move all WIP chapters to proofed", action: "shell", command: "cp -r _wip/chapters/* _proofed/chapters/ 2>/dev/null && echo 'Chapters moved to _proofed/' || echo 'No chapters to move'" },
        { id: "compile-manuscript", label: "Compile Manuscript", description: "Concatenate proofed chapters into single file", action: "shell", command: "cat _proofed/chapters/*.md > _pub/manuscript.md 2>/dev/null && echo \"Compiled to _pub/manuscript.md ($(wc -w < _pub/manuscript.md) words)\" || echo 'No proofed chapters'" },
      ],
      icon: "book-open",
    });
  },
});
