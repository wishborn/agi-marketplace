import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-writing-screenplay",
      label: "Screenplay",
      description: "Directory structure and tools for screenplays and scripts — scenes, character profiles, act structure",
      category: "workflow",
      projectCategories: ["literature"],
      requirements: [
        { id: "writing-structure", label: "Writing Project Structure", description: "_wip/_proofed workflow with scenes", type: "provided" },
      ],
      installActions: [
        {
          id: "scaffold",
          label: "Create screenplay project structure",
          command: [
            "mkdir -p _wip/scenes _proofed/scenes _notes/research _pub character_profiles worldbuilding",
            "&& echo '---\\ntitle: Author Bio\\n---\\n\\n# Author Bio\\n\\n**Name:**\\n\\n**Genre:** Screenplay\\n\\n**Bio:**\\n\\nWrite a short bio here.' > _notes/author_bio.md",
            "&& echo '# Untitled Screenplay\\n\\nA screenplay project.\\n\\n## Structure\\n\\n- `_wip/scenes/` — Work in progress scenes\\n- `_proofed/scenes/` — Approved scenes\\n- `character_profiles/` — Character files\\n- `worldbuilding/` — Setting and world files\\n- `_notes/` — Research and planning\\n- `_pub/` — Final output (Fountain, PDF)' > README.md",
          ].join(" "),
        },
      ],
      devCommands: {},
      guides: [
        {
          title: "Screenplay Structure",
          content:
            "## Directory Layout\\n\\n" +
            "- **_wip/scenes/** — Active writing. Name files like `act1-scene01.md`, `act2-scene05.md`\\n" +
            "- **_proofed/scenes/** — Approved scenes\\n" +
            "- **character_profiles/** — One `.md` file per character\\n" +
            "- **worldbuilding/** — Setting details\\n" +
            "- **_pub/** — Final Fountain/PDF output\\n\\n" +
            "## Scene File Format\\n\\n" +
            "Use markdown with scene headings:\\n" +
            "```\\n# INT. LOCATION - TIME\\n\\nAction description.\\n\\nCHARACTER\\n(parenthetical)\\nDialogue.\\n```",
        },
      ],
      tools: [
        { id: "word-count", label: "Word Count", description: "Count words in WIP scenes", action: "shell", command: "find _wip -name '*.md' -exec cat {} + 2>/dev/null | wc -w" },
        { id: "scene-list", label: "Scene List", description: "List all WIP scenes with word counts", action: "shell", command: "for f in _wip/scenes/*.md; do [ -f \"$f\" ] && echo \"$(basename \"$f\" .md): $(wc -w < \"$f\") words\"; done 2>/dev/null || echo 'No scenes yet'" },
        { id: "move-to-proofed", label: "Move to Proofed", description: "Move all WIP scenes to proofed", action: "shell", command: "cp -r _wip/scenes/* _proofed/scenes/ 2>/dev/null && echo 'Scenes moved to _proofed/' || echo 'No scenes to move'" },
      ],
      icon: "clapperboard",
    });
  },
});
