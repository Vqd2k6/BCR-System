import React, { useEffect, useRef, useState } from 'react';
import type { CadGraph, CadRect, CadVertex } from '../types/cadLab.types';
import { getCadStrokeWidth, getCadTextFontSize } from '../utils/cadSvgRenderer';
import { addColumn, addEdge, addTextBox, findVertexNear, moveColumn, moveTextBox, moveVertex } from '../utils/cadGraphEdit';

export type CadEditorTool = 'SELECT' | 'ADD_EDGE' | 'ADD_COLUMN' | 'ADD_TEXT' | 'ERASE_RECT';

export interface CadSelection {
  kind: 'VERTEX' | 'EDGE' | 'COLUMN' | 'TEXT';
  id: string;
}

interface Props {
  graph: CadGraph;
  underlayUrl: string;
  underlayOpacity: number;
  showUnderlay: boolean;
  tool: CadEditorTool;
  orthoLock: boolean;
  selection: CadSelection | null;
  pendingText: string;
  onSelect: (selection: CadSelection | null) => void;
  onCommit: (next: CadGraph, selection?: CadSelection | null) => void;
  onEraseRect: (rect: CadRect) => void;
}

interface Pt {
  x: number;
  y: number;
}

type DragState =
  | { kind: 'VERTEX' | 'COLUMN' | 'TEXT'; id: string; base: CadGraph; moved: boolean }
  | { kind: 'ERASE'; start: Pt };

const EDGE_CLASS_COLOR: Record<string, string> = {
  ORTHO: 'stroke-slate-900',
  SLANT: 'stroke-teal-600',
  SLANT_SUSPECT: 'stroke-amber-500',
};

export const CadSvgEditor: React.FC<Props> = ({
  graph,
  underlayUrl,
  underlayOpacity,
  showUnderlay,
  tool,
  orthoLock,
  selection,
  pendingText,
  onSelect,
  onCommit,
  onEraseRect,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragGraph, setDragGraph] = useState<CadGraph | null>(null);
  const [edgeStart, setEdgeStart] = useState<Pt | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);

  const view = dragGraph ?? graph;
  const stroke = getCadStrokeWidth(view);
  const handleR = Math.max(view.width, view.height) / 180;
  const snapRadius = handleR * 2.5;
  const byId = new Map<string, CadVertex>(view.vertices.map((v) => [v.id, v]));
  const isSelect = tool === 'SELECT';

  useEffect(() => {
    setEdgeStart(null);
    setDrag(null);
    setDragGraph(null);
  }, [tool, graph]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEdgeStart(null);
        setDrag(null);
        setDragGraph(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toSvgPoint = (clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  };

  const startDrag = (e: React.PointerEvent, kind: 'VERTEX' | 'COLUMN' | 'TEXT', id: string) => {
    if (!isSelect) return;
    e.stopPropagation();
    onSelect({ kind, id });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag({ kind, id, base: graph, moved: false });
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool !== 'ERASE_RECT') return;
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ kind: 'ERASE', start: p });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    setCursor(p);
    if (!drag || drag.kind === 'ERASE') return;
    let next: CadGraph;
    if (drag.kind === 'VERTEX') next = moveVertex(drag.base, drag.id, p, orthoLock);
    else if (drag.kind === 'COLUMN') next = moveColumn(drag.base, drag.id, p);
    else next = moveTextBox(drag.base, drag.id, p);
    setDragGraph(next);
    if (!drag.moved) setDrag({ ...drag, moved: true });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    if (drag.kind === 'ERASE') {
      const p = toSvgPoint(e.clientX, e.clientY);
      if (p) {
        const rect = {
          x: Math.min(drag.start.x, p.x),
          y: Math.min(drag.start.y, p.y),
          w: Math.abs(p.x - drag.start.x),
          h: Math.abs(p.y - drag.start.y),
        };
        if (rect.w > 2 && rect.h > 2) onEraseRect(rect);
      }
    } else if (drag.moved && dragGraph) {
      onCommit(dragGraph, { kind: drag.kind, id: drag.id });
    }
    setDrag(null);
    setDragGraph(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    if (tool === 'SELECT') {
      onSelect(null);
      return;
    }
    if (tool === 'ADD_EDGE') {
      if (!edgeStart) {
        const near = findVertexNear(graph, p, snapRadius);
        setEdgeStart(near ? { x: near.x, y: near.y } : p);
        return;
      }
      const next = addEdge(graph, edgeStart, p, snapRadius, orthoLock);
      setEdgeStart(null);
      if (next !== graph) onCommit(next, null);
      return;
    }
    if (tool === 'ADD_COLUMN') {
      const widths = graph.edges.map((item) => item.beamWidthPx ?? 0).filter((w) => w > 0).sort((a, b) => a - b);
      const size = widths.length > 0 ? widths[Math.floor(widths.length / 2)] : Math.max(view.width, view.height) / 50;
      const next = addColumn(graph, p, Math.round(size));
      onCommit(next, { kind: 'COLUMN', id: next.columns[next.columns.length - 1].id });
      return;
    }
    if (tool === 'ADD_TEXT') {
      const h = Math.max(14, Math.round(Math.max(view.width, view.height) / 45));
      const next = addTextBox(graph, p, pendingText.trim() || '20x20', h);
      onCommit(next, { kind: 'TEXT', id: next.textBoxes[next.textBoxes.length - 1].id });
    }
  };

  const isSelected = (kind: CadSelection['kind'], id: string): boolean =>
    selection?.kind === kind && selection.id === id;

  const erasePreview =
    drag?.kind === 'ERASE' && cursor
      ? {
          x: Math.min(drag.start.x, cursor.x),
          y: Math.min(drag.start.y, cursor.y),
          w: Math.abs(cursor.x - drag.start.x),
          h: Math.abs(cursor.y - drag.start.y),
        }
      : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${view.width} ${view.height}`}
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full select-none touch-none ${
        tool === 'SELECT' ? 'cursor-pointer' : tool === 'ERASE_RECT' ? 'cursor-crosshair' : 'cursor-copy'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setCursor(null)}
      onClick={handleCanvasClick}
    >
      <defs>
        <pattern id="cad-editor-hatch" patternUnits="userSpaceOnUse" width={stroke * 2.5} height={stroke * 2.5} patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={stroke * 2.5} className="stroke-slate-900" strokeWidth={stroke * 0.6} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={view.width} height={view.height} className="fill-white" />
      {showUnderlay && underlayUrl && (
        <image
          href={underlayUrl}
          x={0}
          y={0}
          width={view.width}
          height={view.height}
          opacity={underlayOpacity}
          transform={`rotate(${view.underlayRotateDeg} ${view.width / 2} ${view.height / 2})`}
          className="pointer-events-none"
        />
      )}

      {/* Cạnh: nét nhìn thấy + vùng bấm rộng hơn */}
      {view.edges.map((e) => {
        const a = byId.get(e.a);
        const b = byId.get(e.b);
        if (!a || !b) return null;
        const selected = isSelected('EDGE', e.id);
        return (
          <g key={e.id}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={selected ? 'stroke-sky-500' : EDGE_CLASS_COLOR[e.angleClass]}
              strokeWidth={selected ? stroke * 2 : e.angleClass === 'SLANT_SUSPECT' ? stroke * 1.6 : stroke}
              strokeDasharray={e.angleClass === 'SLANT_SUSPECT' ? `${stroke * 4} ${stroke * 2}` : undefined}
              strokeLinecap="square"
            />
            {isSelect && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="stroke-transparent cursor-pointer"
                strokeWidth={handleR * 2.2}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect({ kind: 'EDGE', id: e.id });
                }}
              />
            )}
          </g>
        );
      })}

      {view.columns.map((c) => (
        <rect
          key={c.id}
          x={c.cx - c.w / 2}
          y={c.cy - c.h / 2}
          width={c.w}
          height={c.h}
          fill="url(#cad-editor-hatch)"
          className={`${isSelected('COLUMN', c.id) ? 'stroke-sky-500' : 'stroke-slate-900'} ${isSelect ? 'cursor-pointer' : 'pointer-events-none'}`}
          strokeWidth={stroke}
          onPointerDown={(ev) => startDrag(ev, 'COLUMN', c.id)}
          onClick={(ev) => ev.stopPropagation()}
        />
      ))}

      {view.textBoxes.map((t) => {
        const filled = t.text.trim().length > 0;
        const selected = isSelected('TEXT', t.id);
        return (
          <g
            key={t.id}
            className={isSelect ? 'cursor-pointer' : 'pointer-events-none'}
            onPointerDown={(ev) => startDrag(ev, 'TEXT', t.id)}
            onClick={(ev) => ev.stopPropagation()}
          >
            <rect
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              className={filled ? (selected ? 'fill-white stroke-sky-500' : 'fill-white stroke-transparent') : selected ? 'fill-violet-200/40 stroke-sky-500' : 'fill-violet-200/30 stroke-violet-500'}
              strokeWidth={stroke * 0.8}
              strokeDasharray={filled ? undefined : `${stroke * 3} ${stroke * 2}`}
            />
            {filled && (
              <text
                x={t.x + t.w / 2}
                y={t.y + t.h / 2}
                fontSize={getCadTextFontSize(t)}
                fontFamily="'Courier New', monospace"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-slate-900"
              >
                {t.text}
              </text>
            )}
          </g>
        );
      })}

      {isSelect &&
        view.vertices.map((v) => {
          const selected = isSelected('VERTEX', v.id);
          return (
            <circle
              key={v.id}
              cx={v.x}
              cy={v.y}
              r={selected ? handleR * 1.4 : handleR}
              className={`${selected ? 'fill-sky-500 stroke-white' : 'fill-white stroke-sky-600'} cursor-pointer`}
              strokeWidth={stroke * 0.7}
              onPointerDown={(ev) => startDrag(ev, 'VERTEX', v.id)}
              onClick={(ev) => ev.stopPropagation()}
            />
          );
        })}

      {tool === 'ADD_EDGE' && edgeStart && cursor && (
        <line
          x1={edgeStart.x}
          y1={edgeStart.y}
          x2={cursor.x}
          y2={cursor.y}
          className="stroke-sky-500 pointer-events-none"
          strokeWidth={stroke}
          strokeDasharray={`${stroke * 3} ${stroke * 2}`}
        />
      )}
      {erasePreview && (
        <rect
          x={erasePreview.x}
          y={erasePreview.y}
          width={erasePreview.w}
          height={erasePreview.h}
          className="fill-rose-500/15 stroke-rose-500 pointer-events-none"
          strokeWidth={stroke}
          strokeDasharray={`${stroke * 3} ${stroke * 2}`}
        />
      )}
    </svg>
  );
};
