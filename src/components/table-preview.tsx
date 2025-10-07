import * as React from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

/** Minimal shape of the Webflow XscpData JSON we care about */
type XscpNode = {
  _id: string;
  text?: boolean;
  v?: string;
  type?: string;
  tag?: string;
  classes?: string[];
  children?: string[];
  data?: {
    tag?: string;
    attributes?: { name: string; value: string }[];
    [k: string]: any;
  } & Record<string, any>;
};

export type TablePreviewProps = {
  /** 2D array representing rows and columns. Row 0 may be the header when hasHeader is true. */
  rows?: string[][];
  /** When true, the first row in `rows` is rendered as a table header. */
  hasHeader?: boolean;
  /** Optional caption under the table. */
  caption?: string;
  /** Optional className for wrapping container */
  className?: string;
  /**
   * XscpData JSON — either the full JSON string, the parsed object, or an object
   * with a `payload` containing `nodes`.
   */
  json?:
    | string
    | { type?: string; payload?: { nodes?: XscpNode[] } }
    | { payload?: { nodes?: XscpNode[] } };
  /** When true, render inputs and allow editing cells. */
  editable?: boolean;
  /** Called whenever a cell is edited; receives the full 2D rows snapshot. */
  onEdit?: (rows: string[][]) => void;
};

function getTextFromNode(
  node: XscpNode | undefined,
  indexById: Map<string, XscpNode>
): string {
  if (!node) return "";
  if (node.text) return String(node.v ?? "");
  const children = node.children || [];
  for (const cid of children) {
    const child = indexById.get(cid);
    const t = getTextFromNode(child, indexById);
    if (t) return t;
  }
  return "";
}

function normalizeTag(node?: XscpNode): string {
  return (node?.data?.tag || node?.tag || "").toLowerCase();
}

function extractRowsFromXscp(
  json: TablePreviewProps["json"]
): { rows: string[][]; hasHeader: boolean } | null {
  if (!json) return null;
  let payload: any = null;
  try {
    if (typeof json === "string") {
      const parsed = JSON.parse(json);
      payload = parsed?.payload ?? null;
    } else if (typeof json === "object") {
      payload = (json as any)?.payload ?? null;
    }
  } catch {
    return null;
  }
  const nodes: XscpNode[] = payload?.nodes || [];
  if (!nodes.length) return null;

  const indexById = new Map<string, XscpNode>();
  nodes.forEach((n) => indexById.set(n._id, n));

  // Find first <table> node
  const tableNode = nodes.find((n) => normalizeTag(n) === "table");
  if (!tableNode) return null;

  // Find thead / tbody / tfoot children
  const tableChildren = (tableNode.children || [])
    .map((id) => indexById.get(id))
    .filter(Boolean) as XscpNode[];
  const thead = tableChildren.find((n) => normalizeTag(n) === "thead");
  const tbody = tableChildren.find((n) => normalizeTag(n) === "tbody");
  const tfoot = tableChildren.find((n) => normalizeTag(n) === "tfoot");

  const readSectionRows = (section?: XscpNode): string[][] => {
    if (!section) return [];
    const rows: string[][] = [];
    const trNodes = (section.children || [])
      .map((id) => indexById.get(id))
      .filter((n): n is XscpNode => Boolean(n && normalizeTag(n) === "tr"));
    for (const tr of trNodes) {
      const cells: string[] = [];
      const cellNodes = (tr.children || [])
        .map((id) => indexById.get(id))
        .filter((n): n is XscpNode =>
          Boolean(n && (normalizeTag(n) === "td" || normalizeTag(n) === "th"))
        );
      for (const cell of cellNodes) {
        const text = getTextFromNode(cell, indexById);
        cells.push(text);
      }
      rows.push(cells);
    }
    return rows;
  };

  const headRows = readSectionRows(thead);
  const bodyRows = readSectionRows(tbody);
  const footerRows = readSectionRows(tfoot); // currently ignored in render

  const hasHeader = headRows.length > 0;
  const rowsOut = hasHeader ? [...headRows, ...bodyRows] : bodyRows;
  return { rows: rowsOut, hasHeader };
}

export default function TablePreview(props: TablePreviewProps) {
  const {
    rows: rowsProp,
    hasHeader: hasHeaderProp = true,
    caption,
    className,
    json,
    editable = false,
    onEdit,
  } = props;

  const extracted = React.useMemo(() => extractRowsFromXscp(json), [json]);
  const basisRows = extracted?.rows ?? rowsProp ?? [];
  const basisHasHeader = extracted?.hasHeader ?? hasHeaderProp;

  const [localRows, setLocalRows] = React.useState<string[][]>(basisRows);
  const editingRef = React.useRef(false);
  React.useEffect(() => {
    setLocalRows(basisRows);
  }, [basisRows]);

  const handleChange = (ri: number, ci: number, value: string) => {
    setLocalRows((prev) => {
      const next = prev.map((r) => r.slice());
      if (!next[ri]) next[ri] = [] as string[];
      next[ri][ci] = value;
      editingRef.current = true; // mark this update as user-initiated
      return next;
    });
  };

  React.useEffect(() => {
    if (!editingRef.current) return;
    editingRef.current = false;
    onEdit?.(localRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localRows]);

  if (!localRows || localRows.length === 0) {
    return <div className="text-xs text-gray-500">No table data</div>;
  }

  const header = basisHasHeader && localRows.length > 0 ? localRows[0] : [];
  const body = basisHasHeader ? localRows.slice(1) : localRows;

  return (
    <div className={className}>
      <Table>
        {caption ? <TableCaption>{caption}</TableCaption> : null}
        {basisHasHeader && (
          <TableHeader>
            <TableRow>
              {header.map((h, i) => (
                <TableHead key={i} className="whitespace-nowrap">
                  {editable ? (
                    <input
                      className="w-full bg-transparent outline-none border border-transparent focus:border-gray-300 rounded px-1 py-0.5"
                      value={h ?? ""}
                      onChange={(e) => handleChange(0, i, e.target.value)}
                    />
                  ) : (
                    h
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {body.map((r, ri) => (
            <TableRow key={ri} className="even:bg-gray-50">
              {r.map((c, ci) => (
                <TableCell
                  key={ci}
                  className="whitespace-pre-wrap border border-x-gray-100 p-1"
                >
                  {editable ? (
                    <input
                      className="w-full bg-transparent hover:border-gray-200 outline-none border border-transparent focus:border-gray-300 rounded px-1 py-0.5"
                      value={c ?? ""}
                      onChange={(e) =>
                        handleChange(
                          basisHasHeader ? ri + 1 : ri,
                          ci,
                          e.target.value
                        )
                      }
                    />
                  ) : (
                    c
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
