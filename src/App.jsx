import React, { useMemo, useState, useEffect } from "react";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { ButtonGroup } from "./components/ui/button-group";
import { Textarea } from "./components/ui/textarea";
import { Card, CardTitle } from "./components/ui/card";
import { Switch } from "./components/ui/switch";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "./components/ui/field";
import { toast } from "sonner";
import { Kbd } from "./components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import TablePreview from "./components/table-preview";

// --- Tree preview components -------------------------------------------------
// --- Tree preview components -------------------------------------------------
function DomNodeItem({
  node,
  indexById,
  classNameById,
  matchSet,
  ancestorSet,
  depth = 0,
  expandMode = "auto", // "auto" | "all" | "collapse"
  selectedId,
  onSelect,
}) {
  const isText = node?.data?.text || node.text === true;
  const childIds = node.children || [];
  const labelTag = isText ? "#text" : node.data?.tag || node.tag || "div";
  const classNames = (node.classes || [])
    .map((id) => classNameById.get(id))
    .filter(Boolean);
  const [open, setOpen] = useState(depth < 1); // open roots by default
  // Simple type color coding
  const tagColor =
    labelTag === "thead"
      ? "text-blue-600"
      : labelTag === "tbody"
      ? "text-emerald-600"
      : labelTag === "tfoot"
      ? "text-violet-600"
      : labelTag === "tr"
      ? "text-amber-700"
      : labelTag === "th"
      ? "text-pink-700"
      : labelTag === "td"
      ? "text-slate-700"
      : labelTag === "table"
      ? "text-indigo-700"
      : labelTag === "span"
      ? "text-gray-600"
      : "text-gray-800";

  // Search / expansion logic
  const isMatch = matchSet.has(node._id);
  const isAncestorOfMatch = ancestorSet.has(node._id);
  useEffect(() => {
    if (expandMode === "all") {
      setOpen(true);
    } else if (expandMode === "collapse") {
      setOpen(false);
    } else {
      setOpen(isMatch || isAncestorOfMatch || depth < 1);
    }
  }, [expandMode, isMatch, isAncestorOfMatch, depth]);

  const isSelected = selectedId === node._id;

  const textPreview = isText
    ? (() => {
        const attr = (node.data?.attributes || []).find(
          (a) => a.name === "data-text"
        );
        const v = attr?.value || "";
        return v.length > 40 ? v.slice(0, 37) + "…" : v;
      })()
    : "";

  return (
    <details open={open} onClick={setOpen} style={{ marginLeft: 16 }}>
      <summary
        className={[
          "text-xs leading-6 px-1 rounded cursor-pointer select-none",
          isSelected ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50",
        ].join(" ")}
        onClick={(e) => {
          e.preventDefault(); // prevent native toggle so click = select
          onSelect?.(node._id);
        }}
      >
        <span className={`font-mono ${tagColor}`}>&lt;{labelTag}&gt;</span>
        {classNames.length > 0 && (
          <span className="ml-2 opacity-70">.{classNames.join(".")}</span>
        )}
        {isText && textPreview && (
          <span className="ml-2 opacity-60">“{textPreview}”</span>
        )}
      </summary>
      {childIds.map((cid) => (
        <DomNodeItem
          key={cid}
          node={indexById.get(cid)}
          indexById={indexById}
          classNameById={classNameById}
          matchSet={matchSet}
          ancestorSet={ancestorSet}
          depth={depth + 1}
          expandMode={expandMode}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </details>
  );
}

function DomTreePreview({
  nodes,
  styles,
  searchQuery,
  expandMode = "auto",
  selectedId,
  onSelect,
}) {
  const indexById = React.useMemo(() => {
    const m = new Map();
    (nodes || []).forEach((n) => m.set(n._id, n));
    return m;
  }, [nodes]);

  const classNameById = React.useMemo(() => {
    const m = new Map();
    (styles || []).forEach((s) => m.set(s._id, s.name));
    return m;
  }, [styles]);

  const parentById = React.useMemo(() => {
    const p = new Map();
    (nodes || []).forEach((n) =>
      (n.children || []).forEach((c) => p.set(c, n._id))
    );
    return p;
  }, [nodes]);

  // Roots = nodes not referenced as a child
  const roots = React.useMemo(() => {
    const childSet = new Set();
    (nodes || []).forEach((n) =>
      (n.children || []).forEach((c) => childSet.add(c))
    );
    return (nodes || []).filter((n) => !childSet.has(n._id));
  }, [nodes]);

  // Search: match by tag or class name substring
  const q = (searchQuery || "").trim().toLowerCase();
  const matchSet = React.useMemo(() => {
    const set = new Set();
    if (!q) return set;
    for (const n of nodes || []) {
      const tag = (n.data?.tag || n.tag || "").toLowerCase();
      const classNames = (n.classes || []).map(
        (id) => classNameById.get(id)?.toLowerCase() || ""
      );
      if (tag.includes(q) || classNames.some((cn) => cn.includes(q))) {
        set.add(n._id);
      }
    }
    return set;
  }, [nodes, classNameById, q]);

  // Ancestors of matches should open too
  const ancestorSet = React.useMemo(() => {
    const set = new Set();
    for (const id of matchSet) {
      let cur = parentById.get(id);
      while (cur && !set.has(cur)) {
        set.add(cur);
        cur = parentById.get(cur);
      }
    }
    return set;
  }, [matchSet, parentById]);

  if (!nodes || nodes.length === 0) {
    return <div className="text-xs text-gray-500">No nodes to preview</div>;
  }

  return (
    <div className="rounded-xl border bg-white max-h-[420px] overflow-auto p-2">
      {roots.map((r) => (
        <DomNodeItem
          key={r._id}
          node={r}
          indexById={indexById}
          classNameById={classNameById}
          matchSet={matchSet}
          ancestorSet={ancestorSet}
          expandMode={expandMode}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// --- ID + Node helpers ------------------------------------------------------
function uid(prefix = "") {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

function makeDomNode({ tag, classes = [], attributes = [], text = false }) {
  const id = uid("n_");
  return {
    _id: id,
    type: "DOM",
    tag: "div",
    classes,
    children: [],
    data: { tag, attributes, slot: "", text },
  };
}

// --- Text node helper --------------------------------------------------------
// Webflow text nodes are standalone objects with `{ text: true, v: string }`.
// Parent element's `children` should include the text node's `_id`.
// Text node: Webflow expects standalone nodes with { text: true, v: "..." }
function makeTextNode(textValue) {
  return {
    _id: uid("t_"),
    text: true,
    v: String(textValue ?? ""),
  };
}

// --- CSV parsing -------------------------------------------------------------
// RFC4180-ish CSV parser (handles quotes, escaped quotes, commas, newlines)
function parseCSV(input) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          // escaped quote
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        field += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        i++;
        continue;
      }
      if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
        continue;
      }
      if (ch === "\r") {
        // handle CRLF (\r\n)
        i++;
        continue;
      }
      field += ch;
      i++;
    }
  }
  // flush last field
  row.push(field);
  // flush last row if not empty (or if there was at least one comma)
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

function stringifyCSV(rows) {
  return rows
    .map((r) =>
      r
        .map((cell = "") => {
          const needsQuote = /[",\n\r]/.test(cell);
          const escaped = String(cell).replace(/"/g, '""');
          return needsQuote ? `"${escaped}"` : escaped;
        })
        .join(",")
    )
    .join("\n");
}

export default function WebflowTableJsonBuilder() {
  // Basic table controls
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [includeHead, setIncludeHead] = useState(true);
  const [includeFoot, setIncludeFoot] = useState(false);

  // Section template wrapper toggle state
  const [wrapInSection, setWrapInSection] = useState(false);

  // Classes / attrs
  const [tableClass, setTableClass] = useState("");
  const [theadClass, setTheadClass] = useState("");
  const [tbodyClass, setTbodyClass] = useState("");
  const [tfootClass, setTfootClass] = useState("");
  const [cellClass, setCellClass] = useState("");
  const [rowClass, setRowClass] = useState("");
  const [useThInHead, setUseThInHead] = useState(true);
  const [addAriaRole, setAddAriaRole] = useState(true);

  // CSV state
  const [csvText, setCsvText] = useState("");
  const [csvData, setCsvData] = useState(null); // 2D array or null
  const [csvHasHeaderRow, setCsvHasHeaderRow] = useState(true);
  const [useSpanFallback, setUseSpanFallback] = useState(false); // for text nodes

  const [status, setStatus] = useState("");

  // Tree UI state
  const [treeSearch, setTreeSearch] = useState("");
  const [expandMode, setExpandMode] = useState("auto"); // "auto" | "all" | "collapse"
  const [selectedId, setSelectedId] = useState(null);

  // When CSV is present, override rows/cols from its dimensions
  const effectiveCols = csvData
    ? Math.max(...csvData.map((r) => r.length))
    : cols;
  const effectiveRows = csvData
    ? csvHasHeaderRow
      ? Math.max(csvData.length - 1, 0)
      : csvData.length
    : rows;

  function handleCsvFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setCsvText(text);
      const data = parseCSV(text);
      setCsvData(data);
    };
    reader.readAsText(file);
  }

  function handleCsvTextPaste() {
    const data = parseCSV(csvText);
    setCsvData(data);
  }

  async function asClipboardItem(jsonString) {
    // Prefer modern Clipboard API with JSON + plaintext, but *await* so we can catch rejections
    if (
      typeof window !== "undefined" &&
      navigator.clipboard &&
      window.ClipboardItem
    ) {
      try {
        const blobJson = new Blob([jsonString], { type: "application/json" });
        const blobText = new Blob([jsonString], { type: "text/plain" });
        const item = new window.ClipboardItem({
          "application/json": blobJson,
          "text/plain": blobText,
        });
        await navigator.clipboard.write([item]); // <-- await so catch triggers on NotAllowedError
        return; // success
      } catch (err) {
        console.warn(
          "navigator.clipboard.write rejected; falling back to execCommand path",
          err
        );
        // fall through to legacy path
      }
    }

    // Legacy fallback: intercept the copy event and set application/json manually.
    await new Promise((resolve, reject) => {
      const json = jsonString;

      const cleanup = () => {
        document.removeEventListener("copy", onCopy, true);
        document.removeEventListener("beforecopy", onBeforeCopy, true);
        if (temp) temp.remove();
      };

      const onBeforeCopy = () => {
        // noop – selection exists via the Textarea we create
      };

      const onCopy = (e) => {
        try {
          e.preventDefault();
          e.clipboardData.setData("application/json", json);
          e.clipboardData.setData("text/plain", json);
          cleanup();
          resolve();
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      // Create a hidden textarea to satisfy execCommand('copy')
      const temp = document.createElement("textarea");
      temp.value = json;
      temp.setAttribute("readonly", "");
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      temp.style.pointerEvents = "none";
      document.body.appendChild(temp);
      temp.focus();
      temp.select();

      document.addEventListener("beforecopy", onBeforeCopy, true);
      document.addEventListener("copy", onCopy, true);

      const ok = document.execCommand("copy");
      if (!ok) {
        cleanup();
        reject(new Error("execCommand('copy') returned false"));
      }
    });
  }

  // Build JSON & preview payload (uses CSV if provided)
  const built = useMemo(() => {
    const nodes = [];
    const push = (node) => {
      nodes.push(node);
      return node;
    };

    // --- Tailwind → CSS mapping (very small curated map; extend as needed) ---
    const twScaleRem = {
      0: "0rem",
      1: "0.25rem",
      2: "0.5rem",
      3: "0.75rem",
      4: "1rem",
      5: "1.25rem",
      6: "1.5rem",
      8: "2rem",
      10: "2.5rem",
      12: "3rem",
      16: "4rem",
      20: "5rem",
      24: "6rem",
      32: "8rem",
    };

    function tokenCss(token) {
      const m = token.match(/^(p|px|py|pt|pr|pb|pl)-(\d+)$/);
      if (m) {
        const dir = m[1];
        const val = twScaleRem[m[2]];
        if (!val) return "";
        switch (dir) {
          case "p":
            return `padding: ${val};`;
          case "px":
            return `padding-left: ${val}; padding-right: ${val};`;
          case "py":
            return `padding-top: ${val}; padding-bottom: ${val};`;
          case "pt":
            return `padding-top: ${val};`;
          case "pr":
            return `padding-right: ${val};`;
          case "pb":
            return `padding-bottom: ${val};`;
          case "pl":
            return `padding-left: ${val};`;
        }
      }
      if (token === "w-full") return "width: 100%;";
      if (token === "max-w-7xl") return "max-width: 80rem;";
      if (token === "mx-auto") return "margin-left: auto; margin-right: auto;";
      if (token === "flex") return "display: flex;";
      if (token === "grid") return "display: grid;";
      if (token === "items-center") return "align-items: center;";
      if (token === "justify-center") return "justify-content: center;";
      const gap = token.match(/^gap-(\d+)$/);
      if (gap) {
        const val = twScaleRem[gap[1]];
        if (val) return `grid-row-gap: ${val}; grid-column-gap: ${val};`;
      }
      if (token === "text-center") return "text-align: center;";
      if (token === "border") return "border-style: solid; border-width: 1px;";
      if (token === "rounded-md")
        return "border-top-left-radius: 6px; border-top-right-radius: 6px; border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;";
      if (token === "bg-blue-500") return "background-color: #3B82F6;";
      if (token === "border-blue-500")
        return "border-top-color: #3B82F6; border-right-color: #3B82F6; border-bottom-color: #3B82F6; border-left-color: #3B82F6;";
      if (token === "text-white") return "color: #fff;";
      if (token === "transition-colors")
        return "transition-property: border-color, background-color;";
      if (token === "duration-200") return "transition-duration: 200ms;";
      if (token === "ease-in-out") return "transition-timing-function: ease;";
      return "";
    }

    function tailwindToStyleLess(className) {
      if (!className) return "";
      return className
        .trim()
        .split(/\s+/)
        .map(tokenCss)
        .filter(Boolean)
        .join(" ");
    }

    const SECTION_PRESETS = {
      section_table: { styleLess: "" },
      "padding-global": { styleLess: "padding-right: 5%; padding-left: 5%;" },
      "container-large": {
        styleLess:
          "width: 100%; max-width: 80rem; margin-right: auto; margin-left: auto;",
      },
      "padding-section-medium": {
        styleLess: "padding-top: 5rem; padding-bottom: 5rem;",
        variants: {
          medium: { styleLess: "padding-top: 4rem; padding-bottom: 4rem;" },
          small: { styleLess: "padding-top: 3rem; padding-bottom: 3rem;" },
        },
      },
      table_component: { styleLess: "" },
    };

    const styles = [];
    const styleIndex = new Map();

    function ensureStyle(name) {
      if (!name || !name.trim()) return null;
      if (styleIndex.has(name)) return styleIndex.get(name);
      const id = uid("cls_");
      let styleLess = "";
      let variants = {};
      if (SECTION_PRESETS[name]) {
        styleLess = SECTION_PRESETS[name].styleLess || "";
        variants = SECTION_PRESETS[name].variants || {};
      } else {
        styleLess = tailwindToStyleLess(name);
      }
      styles.push({
        _id: id,
        fake: false,
        type: "class",
        name,
        namespace: "",
        comb: "",
        styleLess,
        variants,
        children: [],
        createdBy: null,
        origin: null,
        selector: null,
      });
      styleIndex.set(name, id);
      return id;
    }

    function classIds(list) {
      const names = (list || []).flatMap((n) =>
        n ? String(n).trim().split(/\s+/) : []
      );
      return names
        .filter(Boolean)
        .map((n) => ensureStyle(n))
        .filter(Boolean);
    }

    const tableAttrs = [];
    if (addAriaRole) tableAttrs.push({ name: "role", value: "table" });

    const table = push(
      makeDomNode({
        tag: "table",
        classes: classIds(tableClass ? [tableClass] : []),
        attributes: tableAttrs,
      })
    );

    const makeRow = (sectionTag, rIndex) => {
      const tr = push(
        makeDomNode({
          tag: "tr",
          classes: classIds(rowClass ? [rowClass] : []),
        })
      );
      const cellTag = sectionTag === "thead" && useThInHead ? "th" : "td";
      const sourceRow = csvData
        ? csvHasHeaderRow && sectionTag === "tbody"
          ? csvData[rIndex + 1]
          : csvData[rIndex]
        : null;

      const cellCount = csvData ? effectiveCols : cols;

      for (let c = 0; c < cellCount; c++) {
        const cell = push(
          makeDomNode({
            tag: cellTag,
            classes: classIds(cellClass ? [cellClass] : []),
          })
        );

        let textValue = "";
        if (csvData && sourceRow) {
          textValue = sourceRow[c] ?? "";
        }

        if (csvData) {
          if (useSpanFallback) {
            const span = push(makeDomNode({ tag: "span" }));
            const tn = push(makeTextNode(textValue));
            span.children.push(tn._id);
            cell.children.push(span._id);
          } else {
            const tn = push(makeTextNode(textValue));
            cell.children.push(tn._id);
          }
        }

        tr.children.push(cell._id);
      }
      return tr;
    };

    let thead = null;
    if (includeHead) {
      thead = push(
        makeDomNode({
          tag: "thead",
          classes: classIds(theadClass ? [theadClass] : []),
        })
      );
      const tr = makeRow("thead", 0);
      thead.children.push(tr._id);
    }

    const tbody = push(
      makeDomNode({
        tag: "tbody",
        classes: classIds(tbodyClass ? [tbodyClass] : []),
      })
    );
    const bodyRowCount = csvData ? effectiveRows : rows;
    for (let r = 0; r < bodyRowCount; r++) {
      const tr = makeRow("tbody", r);
      tbody.children.push(tr._id);
    }

    let tfoot = null;
    if (includeFoot) {
      tfoot = push(
        makeDomNode({
          tag: "tfoot",
          classes: classIds(tfootClass ? [tfootClass] : []),
        })
      );
      const tr = makeRow("tfoot", 0);
      tfoot.children.push(tr._id);
    }

    if (thead) table.children.push(thead._id);
    table.children.push(tbody._id);
    if (tfoot) table.children.push(tfoot._id);

    if (wrapInSection) {
      const outer = push(
        makeDomNode({ tag: "div", classes: classIds(["section_table"]) })
      );
      const padGlobal = push(
        makeDomNode({ tag: "div", classes: classIds(["padding-global"]) })
      );
      const container = push(
        makeDomNode({ tag: "div", classes: classIds(["container-large"]) })
      );
      const padSection = push(
        makeDomNode({
          tag: "div",
          classes: classIds(["padding-section-medium"]),
        })
      );
      const tableWrapper = push(
        makeDomNode({ tag: "div", classes: classIds(["table_component"]) })
      );

      outer.children.push(padGlobal._id);
      padGlobal.children.push(container._id);
      container.children.push(padSection._id);
      padSection.children.push(tableWrapper._id);
      tableWrapper.children.push(table._id);
    }

    const payload = {
      nodes,
      styles,
      assets: [],
      ix1: [],
      ix2: { interactions: [], events: [], actionLists: [] },
    };
    const meta = {
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      universalBindingsRemovedCount: 0,
      unlinkedSymbolCount: 0,
      KbdComponentsRemovedCount: 0,
    };

    const json = JSON.stringify(
      { type: "@webflow/XscpData", payload, meta },
      null,
      2
    );
    return { payload, meta, json };
  }, [
    cols,
    rows,
    includeHead,
    includeFoot,
    tableClass,
    theadClass,
    tbodyClass,
    tfootClass,
    cellClass,
    useThInHead,
    addAriaRole,
    csvData,
    csvHasHeaderRow,
    useSpanFallback,
    wrapInSection,
    rowClass,
  ]);

  const handleCopy = async () => {
    try {
      toast.promise(await asClipboardItem(built.json), {
        loading: "Copying JSON to clipboard…",
        success: "Copied JSON to clipboard as application/json",
        error: "Could not access clipboard. JSON shown below — copy manually.",
      });
      setStatus("Copied JSON to clipboard as application/json");
    } catch (e) {
      console.error(e);
      setStatus(
        "Could not access clipboard. JSON shown below — copy manually."
      );
    }
    setTimeout(() => setStatus(""), 3000);
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 p-6">
      <div className="max-w-5xl mx-auto grid gap-6">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">Webflow Table JSON Builder</h1>
          <Button
            onClick={handleCopy}
            className="px-4 py-2 rounded-2xl bg-black text-white shadow hover:opacity-90"
          >
            Copy as application/json
          </Button>
        </header>

        <main className="columns-1 md:columns-2 gap-6">
          <section className="grid gap-6">
            <Card className="space-y-4 p-4 bg-white rounded-2xl shadow-sm break-inside-avoid">
              <CardTitle className="text-lg font-medium">Structure</CardTitle>
              <FieldGroup className="grid grid-cols-2 gap-3">
                <Field className="grid gap-1">
                  <FieldLabel className="text-sm text-gray-600">
                    Columns
                  </FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={cols}
                    onChange={(e) =>
                      setCols(parseInt(e.target.value || "1", 10))
                    }
                    className="px-3 py-2 rounded-xl border"
                  />
                </Field>
                <Field className="grid gap-1">
                  <FieldLabel className="text-sm text-gray-600">
                    Body rows
                  </FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    max={500}
                    value={rows}
                    onChange={(e) =>
                      setRows(parseInt(e.target.value || "0", 10))
                    }
                    className="px-3 py-2 rounded-xl border"
                  />
                </Field>
              </FieldGroup>
              <FieldSeparator />
              <FieldGroup className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-y-4 gap-x-8 flex-wrap *:w-auto *:flex-shrink-0">
                  <Field orientation={"horizontal"}>
                    <Switch
                      checked={includeHead}
                      onCheckedChange={setIncludeHead}
                    />{" "}
                    <FieldLabel>
                      Include <Kbd>thead</Kbd>
                    </FieldLabel>
                  </Field>
                  <Field orientation={"horizontal"}>
                    <Switch
                      checked={includeFoot}
                      onCheckedChange={setIncludeFoot}
                    />{" "}
                    <FieldLabel>
                      Include <Kbd>tfoot</Kbd>
                    </FieldLabel>
                  </Field>
                  <TooltipProvider>
                    <Tooltip>
                      <Field orientation={"horizontal"}>
                        <Switch
                          checked={wrapInSection}
                          onCheckedChange={setWrapInSection}
                        />{" "}
                        <FieldLabel>Wrap in section template</FieldLabel>
                        <TooltipTrigger asChild>
                          <InfoIcon className="opacity-50 cursor-pointer inline-block size-4 ml-1" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Wraps the table in a client-first section structure
                        </TooltipContent>
                      </Field>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </FieldGroup>
              <FieldSeparator />
              <FieldGroup className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-y-4 gap-x-8 flex-wrap *:w-auto *:flex-shrink-0">
                  <Field orientation={"horizontal"}>
                    <Switch
                      checked={useThInHead}
                      onCheckedChange={setUseThInHead}
                    />{" "}
                    <FieldLabel>
                      Use <Kbd>th</Kbd> in head
                    </FieldLabel>
                  </Field>
                  <Field orientation={"horizontal"}>
                    <Switch
                      checked={addAriaRole}
                      onCheckedChange={setAddAriaRole}
                    />{" "}
                    <FieldLabel>
                      Add <Kbd>role="table"</Kbd>
                    </FieldLabel>
                  </Field>
                </div>
              </FieldGroup>
              <FieldSeparator />
              <CardTitle className="text-lg font-medium mt-2">
                Classes (optional)
              </CardTitle>
              <div className="grid gap-3">
                <Input
                  placeholder="table classes (e.g. wf-table)"
                  value={tableClass}
                  onChange={(e) => setTableClass(e.target.value)}
                  className="px-3 py-2 rounded-xl border"
                />
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="thead class"
                    value={theadClass}
                    onChange={(e) => setTheadClass(e.target.value)}
                    className="px-3 py-2 rounded-xl border"
                  />
                  <Input
                    placeholder="tbody class"
                    value={tbodyClass}
                    onChange={(e) => setTbodyClass(e.target.value)}
                    className="px-3 py-2 rounded-xl border"
                  />
                  <Input
                    placeholder="tfoot class"
                    value={tfootClass}
                    onChange={(e) => setTfootClass(e.target.value)}
                    className="px-3 py-2 rounded-xl border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="tr class"
                    value={rowClass}
                    onChange={(e) => setRowClass(e.target.value)}
                    className="px-3 py-2 rounded-xl border"
                  />
                  <Input
                    placeholder="td/th class"
                    value={cellClass}
                    onChange={(e) => setCellClass(e.target.value)}
                    className="px-3 py-2 rounded-xl border"
                  />
                </div>
              </div>
            </Card>

            <Card className="space-y-4 p-4 bg-white rounded-2xl shadow-sm break-inside-avoid">
              <CardTitle className="text-lg font-medium">CSV import</CardTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target?.files && e.target.files[0];
                    if (file) handleCsvFile(file);
                  }}
                />
                <Field orientation={"horizontal"}>
                  <Switch
                    checked={csvHasHeaderRow}
                    onCheckedChange={setCsvHasHeaderRow}
                  />{" "}
                  <FieldLabel>First row is header</FieldLabel>
                </Field>
                <Field orientation={"horizontal"}>
                  <Switch
                    checked={useSpanFallback}
                    onCheckedChange={setUseSpanFallback}
                  />{" "}
                  <FieldLabel>
                    Use <Kbd>span</Kbd> text fallback
                  </FieldLabel>
                </Field>
              </div>
              <Textarea
                placeholder="…or paste CSV here"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full h-40 font-mono text-xs p-3 rounded-xl border"
              />
              <ButtonGroup>
                <Button onClick={handleCsvTextPaste} variant="outline">
                  Parse pasted CSV
                </Button>
                <Button
                  onClick={() => {
                    setCsvText("");
                    setCsvData(null);
                  }}
                  variant="outline"
                >
                  Clear CSV
                </Button>
              </ButtonGroup>
              {csvData && (
                <div className="text-xs text-gray-600">
                  Loaded CSV: {csvData.length} rows ×{" "}
                  {Math.max(...csvData.map((r) => r.length))} cols
                </div>
              )}
            </Card>
          </section>

          <section className="grid gap-6">
            <Card className="space-y-4 p-4 bg-white rounded-2xl shadow-sm break-inside-avoid">
              <CardTitle className="text-lg font-medium">How to use</CardTitle>
              <ol className="list-decimal ml-5 space-y-1 mt-2 text-sm text-gray-700">
                <li>
                  Upload or paste your CSV. Optionally mark first row as header.
                </li>
                <li>
                  Toggle the <Kbd>span</Kbd> fallback if your project ignores
                  raw text nodes.
                </li>
                <li>
                  Click <em>Copy as application/json</em> and paste into Webflow{" "}
                  <em>Custom Element</em>.
                </li>
                <li>Edit styles/classes in Webflow as needed.</li>
              </ol>
              <p className="text-xs text-gray-500">
                Tip: For accessibility, keep header cells in{" "}
                <Kbd>&lt;thead&gt;</Kbd> as <Kbd>&lt;th&gt;</Kbd>. This builder
                will use <Kbd>th</Kbd> when the head is included.
              </p>
            </Card>
            <Card className="space-y-4 p-4 bg-white rounded-2xl shadow-sm break-inside-avoid">
              <CardTitle className="text-lg font-medium">Output</CardTitle>
              <p className="text-sm text-gray-600">
                Paste into a Webflow <strong>Custom Element</strong>. If text
                nodes don’t appear after paste, enable <Kbd>span</Kbd> text
                fallback and re-copy.
              </p>
              {/* Controls row */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search (tag or class)… e.g. td, tbody, table_component"
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  className="max-w-sm"
                />
                <Button variant="outline" onClick={() => setExpandMode("all")}>
                  Expand all
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setExpandMode("collapse")}
                >
                  Collapse all
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setExpandMode("auto");
                    setTreeSearch("");
                  }}
                >
                  Reset
                </Button>
              </div>

              {/* Tree + Inspector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DomTreePreview
                  nodes={built.payload.nodes}
                  styles={built.payload.styles}
                  searchQuery={treeSearch}
                  expandMode={expandMode}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />

                {/* Inspector */}
                <div className="rounded-xl border bg-white p-3 text-sm">
                  <div className="font-medium mb-2">Inspector</div>
                  {(() => {
                    const n = (built.payload.nodes || []).find(
                      (x) => x._id === selectedId
                    );
                    if (!n)
                      return (
                        <div className="text-xs text-gray-500">
                          Select a node to inspect
                        </div>
                      );
                    const tag =
                      n.data?.tag || n.tag || (n.text ? "#text" : "div");
                    const classes = n.classes || [];
                    const findStyle = (id) =>
                      (built.payload.styles || []).find((s) => s._id === id);

                    return (
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-500">ID:</span>{" "}
                          <code className="text-xs">{n._id}</code>
                        </div>
                        <div>
                          <span className="text-gray-500">Tag:</span>{" "}
                          <code>{tag}</code>
                        </div>
                        <div>
                          <span className="text-gray-500">Classes:</span>
                          {classes.length === 0 ? (
                            <span className="ml-2 text-gray-400">—</span>
                          ) : (
                            <ul className="ml-4 list-disc">
                              {classes.map((cid) => {
                                const s = findStyle(cid);
                                return (
                                  <li key={cid}>
                                    <code>{s?.name || "(unknown)"}</code>
                                    <span className="ml-2 text-xs text-gray-500">
                                      [{cid}]
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-500">Children:</span>{" "}
                          {(n.children || []).length}
                        </div>
                        {Array.isArray(n.data?.attributes) &&
                          n.data.attributes.length > 0 && (
                            <div>
                              <span className="text-gray-500">Attributes:</span>
                              <ul className="ml-4 list-disc">
                                {n.data.attributes.map((a, i) => (
                                  <li key={i}>
                                    <code>{a.name}</code> ={" "}
                                    <code>{String(a.value)}</code>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        {n?.text && (
                          <div>
                            <span className="text-gray-500">Text:</span>{" "}
                            <code className="text-xs">{n.v}</code>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Data:</span>
                          <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(n, null, 2)}
                          </pre>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <Button
                onClick={handleCopy}
                className="px-4 py-2 rounded-2xl bg-black text-white shadow hover:opacity-90"
              >
                Copy Table Tree
              </Button>
              {status && <p className="text-sm text-green-700">{status}</p>}
            </Card>
          </section>
        </main>
      </div>
      <section className="mt-6 max-w-5xl mx-auto">
        <Card className="space-y-4 p-4 bg-white rounded-2xl shadow-sm break-inside-avoid">
          <CardTitle className="text-lg font-medium">JSON Output</CardTitle>
          <TablePreview
            json={built.json}
            editable
            hasHeader={csvHasHeaderRow}
            onEdit={(rows) => {
              setCsvData(rows);
              setCsvText(stringifyCSV(rows));
            }}
          />
        </Card>
      </section>
    </div>
  );
}
