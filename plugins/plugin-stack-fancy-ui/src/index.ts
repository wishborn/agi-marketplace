import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-fancy-ui",
      label: "Fancy UI",
      description:
        "Fancy UI Stack - react-fancy (components + hooks), fancy-code (embedded code editor), " +
        "fancy-sheets (full spreadsheet with formulas, multi-sheet, CSV), " +
        "react-echarts (ECharts wrapper with typed chart components). Built on Tailwind CSS v4.",
      category: "tooling",
      projectCategories: ["app", "web"],
      requirements: [
        { id: "react-fancy", label: "@particle-academy/react-fancy", type: "provided" },
        { id: "fancy-code", label: "@particle-academy/fancy-code", type: "provided" },
        { id: "fancy-sheets", label: "@particle-academy/fancy-sheets", type: "provided" },
        { id: "react-echarts", label: "@particle-academy/react-echarts", type: "provided" },
        { id: "echarts", label: "echarts (peer)", type: "provided" },
      ],
      installActions: [
        {
          id: "npm.install.fancy",
          label: "Install Fancy UI packages",
          command:
            "npm install @particle-academy/react-fancy @particle-academy/fancy-code @particle-academy/fancy-sheets @particle-academy/react-echarts echarts",
        },
      ],
      guides: [
        {
          title: "Fancy UI cheat-sheet",
          content: [
            "# Fancy UI cheat-sheet",
            "",
            "Quick orientation. The full per-package reference lives under this plugin's Docs topics",
            "(`overview`, `react-fancy`, `fancy-code`, `fancy-sheets`, `react-echarts`).",
            "",
            "## Use these (correct names)",
            "",
            "- `Action` - the button component. Variants: `default` / `circle` / `ghost`. 10 colors.",
            "  Icons are string slugs: `<Action icon=\"pencil\" color=\"blue\">Edit</Action>`.",
            "- `Modal` - the dialog component. Use `Modal.Header` / `Modal.Body` / `Modal.Footer`.",
            "  Props: `open`, `onClose`, `size`.",
            "- `Icon` - register icons once at app entry with `registerIcons({ Home, Settings })`,",
            "  then use kebab-case names: `<Icon name=\"home\" size=\"sm\" />`.",
            "- `CodeEditor` (from `@particle-academy/fancy-code`) - compound editor.",
            "  Wrap `CodeEditor.Toolbar` / `CodeEditor.Panel` / `CodeEditor.StatusBar`.",
            "  Prop is `readOnly` (camelCase). Built-in languages: js / ts / html / php / python / go.",
            "- `Spreadsheet` (from `@particle-academy/fancy-sheets`) - full spreadsheet with formulas.",
            "  Wrap `Spreadsheet.Toolbar` / `Spreadsheet.Grid` / `Spreadsheet.SheetTabs` inside a",
            "  height-sized container. `data`/`defaultData` is a `WorkbookData` object, not an array.",
            "  `onChange(workbook)`, no `onCellChange`, no `columns` prop.",
            "- `EChart` + typed sub-components like `EChart.Line`, `EChart.Bar`, `EChart.Pie`,",
            "  `EChart.Candlestick`, `EChart.Gauge`. Call `registerAll()` once at app entry",
            "  (or selective `registerCharts([...])` for production).",
            "",
            "## Don't use (these don't exist or don't belong)",
            "",
            "- `Button`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`,",
            "  `PageScroll`, `FancyCode`, `FancySheets` - none of these are exported from any of the",
            "  packages in this stack. Use `Action`, `Modal`, `CodeEditor`, `Spreadsheet` instead.",
            "- Material UI, Chakra UI, Ant Design, shadcn/ui - this stack replaces them.",
            "- Chart.js, Recharts - use `react-echarts` instead.",
            "- Raw `<table>` for tabular data - use `Spreadsheet` or `Table` from `react-fancy`.",
            "- \"Catppuccin\" class names - the stack uses Tailwind v4 with the `dark:` class strategy.",
            "",
            "## CSS setup (Tailwind v4)",
            "",
            "```css",
            "@import \"tailwindcss\";",
            "@import \"@particle-academy/react-fancy/styles.css\";",
            "@import \"@particle-academy/fancy-code/styles.css\";",
            "@import \"@particle-academy/fancy-sheets/styles.css\";",
            "@source \"../node_modules/@particle-academy/react-fancy/dist/**/*.js\";",
            "@source \"../node_modules/@particle-academy/fancy-code/dist/**/*.js\";",
            "@source \"../node_modules/@particle-academy/fancy-sheets/dist/**/*.js\";",
            "```",
            "",
            "## App-entry setup",
            "",
            "```tsx",
            "// main.tsx (or setup.ts imported from it)",
            "import { registerIcons } from \"@particle-academy/react-fancy\";",
            "import { Home, Settings, Search } from \"lucide-react\";",
            "import { registerAll } from \"@particle-academy/react-echarts\";",
            "",
            "registerIcons({ Home, Settings, Search });",
            "registerAll();",
            "```",
            "",
            "See the Docs topics for full APIs and more examples.",
          ].join("\n"),
        },
      ],
      tools: [
        {
          id: "fancy-install",
          label: "Install Fancy UI",
          description: "Install all Fancy UI packages (including the echarts peer dep)",
          action: "shell",
          command:
            "npm install @particle-academy/react-fancy @particle-academy/fancy-code @particle-academy/fancy-sheets @particle-academy/react-echarts echarts",
        },
      ],
      icon: "sparkles",
    });

    // Register knowledge namespace so the per-package docs appear in the Docs page.
    api.registerKnowledge({
      id: "fancy-ui",
      label: "Fancy UI",
      description:
        "Reference docs for the Fancy UI stack: react-fancy, fancy-code, fancy-sheets, react-echarts",
      contentDir: new URL("../docs", import.meta.url).pathname,
      topics: [
        { path: "overview.md", title: "Stack overview & setup" },
        { path: "react-fancy.md", title: "react-fancy" },
        { path: "fancy-code.md", title: "fancy-code (CodeEditor)" },
        { path: "fancy-sheets.md", title: "fancy-sheets (Spreadsheet)" },
        { path: "react-echarts.md", title: "react-echarts (EChart + sub-components)" },
      ],
    });
  },
});
