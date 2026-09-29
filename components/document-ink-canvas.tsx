"use client";

import { useEffect, useRef, useState } from "react";

const RENDER_WIDTH = 900;
const A4_RATIO = 841.89 / 595.28;
type InkPoint = { x: number; y: number };
type InkStroke = { points: InkPoint[]; color: string; width: number; erase: boolean };

export function DocumentInkCanvas({ attachmentId, mimeType, formId }: { attachmentId: string; mimeType: string; formId: string }) {
  const baseCanvas = useRef<HTMLCanvasElement>(null);
  const inkCanvas = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<InkStroke | null>(null);
  const strokes = useRef<InkStroke[]>([]);
  const redoStrokes = useRef<InkStroke[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [inkDataUrl, setInkDataUrl] = useState("");
  const [inkColor, setInkColor] = useState("#18181b");
  const [inkWidth, setInkWidth] = useState(3);
  const [tool, setTool] = useState<"DRAW" | "ERASE">("DRAW");
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const [placement, setPlacement] = useState({ x: .7, y: .08 });
  const draggingPlacement = useRef(false);
  const [status, setStatus] = useState("Loading document page…");
  const sourceUrl = `/attachments/${attachmentId}?inline=1`;

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    async function render() {
      const base = baseCanvas.current;
      const ink = inkCanvas.current;
      if (!base || !ink) return;
      setStatus("Loading document page…");
      try {
        if (mimeType === "application/pdf") {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
          const task = pdfjs.getDocument({ url: sourceUrl, withCredentials: true });
          loadingTask = task;
          const document = await task.promise;
          if (cancelled) return;
          setPageCount(document.numPages);
          const page = await document.getPage(Math.min(pageNumber, document.numPages));
          const baseViewport = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: RENDER_WIDTH / baseViewport.width });
          base.width = Math.ceil(viewport.width);
          base.height = Math.ceil(viewport.height);
          ink.width = base.width;
          ink.height = base.height;
          const context = base.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas rendering is unavailable.");
          renderTask = page.render({ canvasContext: context, viewport });
          await renderTask.promise;
        } else {
          const image = new Image();
          image.src = sourceUrl;
          await image.decode();
          if (cancelled) return;
          base.width = RENDER_WIDTH;
          base.height = Math.round(RENDER_WIDTH * A4_RATIO);
          ink.width = base.width;
          ink.height = base.height;
          const context = base.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas rendering is unavailable.");
          context.fillStyle = "white";
          context.fillRect(0, 0, base.width, base.height);
          const margin = 36;
          const scale = Math.min((base.width - margin * 2) / image.naturalWidth, (base.height - margin * 2) / image.naturalHeight, 1);
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          context.drawImage(image, (base.width - width) / 2, (base.height - height) / 2, width, height);
        }
        if (!cancelled) setStatus("Use a stylus, touch, or mouse to write directly on this page.");
      } catch (error) {
        if (!cancelled && (error as Error).name !== "RenderingCancelledException") setStatus("The page preview could not be rendered. You can still open the source in a new tab.");
      }
    }
    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
    };
  }, [mimeType, pageNumber, sourceUrl]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = inkCanvas.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  }

  function startInk(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = inkCanvas.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const current = point(event);
    activeStroke.current = { points: [current], color: inkColor, width: inkWidth, erase: tool === "ERASE" };
    context.beginPath();
    context.moveTo(current.x, current.y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = tool === "ERASE" ? "destination-out" : "source-over";
    context.strokeStyle = inkColor;
    context.lineWidth = tool === "ERASE" ? inkWidth * 5 : inkWidth;
    context.lineTo(current.x + 0.01, current.y + 0.01);
    context.stroke();
  }

  function continueInk(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeStroke.current) return;
    event.preventDefault();
    const context = inkCanvas.current?.getContext("2d");
    if (!context) return;
    const current = point(event);
    activeStroke.current.points.push(current);
    context.lineTo(current.x, current.y);
    context.stroke();
  }

  function finishInk(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeStroke.current) return;
    strokes.current.push(activeStroke.current);
    activeStroke.current = null;
    redoStrokes.current = [];
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setInkDataUrl(event.currentTarget.toDataURL("image/png"));
    setHistoryState({ undo: strokes.current.length, redo: redoStrokes.current.length });
  }

  function redraw() {
    const canvas = inkCanvas.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes.current) {
      if (!stroke.points.length) continue;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.erase ? stroke.width * 5 : stroke.width;
      for (const item of stroke.points.slice(1)) context.lineTo(item.x, item.y);
      if (stroke.points.length === 1) context.lineTo(stroke.points[0].x + .01, stroke.points[0].y + .01);
      context.stroke();
    }
    context.globalCompositeOperation = "source-over";
    setInkDataUrl(strokes.current.length ? canvas.toDataURL("image/png") : "");
    setHistoryState({ undo: strokes.current.length, redo: redoStrokes.current.length });
  }

  function undoInk() {
    const stroke = strokes.current.pop();
    if (stroke) redoStrokes.current.push(stroke);
    redraw();
  }

  function redoInk() {
    const stroke = redoStrokes.current.pop();
    if (stroke) strokes.current.push(stroke);
    redraw();
  }

  function clearInk() {
    const canvas = inkCanvas.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    strokes.current = [];
    redoStrokes.current = [];
    setInkDataUrl("");
    setHistoryState({ undo: 0, redo: 0 });
  }

  function movePlacement(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingPlacement.current) return;
    const stage = event.currentTarget.parentElement;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    setPlacement({ x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) });
  }

  function changePage(next: number) {
    clearInk();
    setPageNumber(Math.max(1, Math.min(pageCount, next)));
  }

  return <div className="document-ink-editor">
    <input type="hidden" name="pageNumber" value={pageNumber} form={formId} />
    <input type="hidden" name="inkDataUrl" value={inkDataUrl} form={formId} />
    <input type="hidden" name="placementX" value={placement.x.toFixed(4)} form={formId} />
    <input type="hidden" name="placementY" value={placement.y.toFixed(4)} form={formId} />
    <div className="ink-toolbar">
      <div className="actions">
        <button className="btn secondary compact" type="button" disabled={pageNumber <= 1} onClick={() => changePage(pageNumber - 1)}>Previous page</button>
        <strong>Page {pageNumber} of {pageCount}</strong>
        <button className="btn secondary compact" type="button" disabled={pageNumber >= pageCount} onClick={() => changePage(pageNumber + 1)}>Next page</button>
      </div>
      <div className="actions">
        <label>Ink <input type="color" value={inkColor} onChange={(event) => setInkColor(event.target.value)} aria-label="Ink colour" /></label>
        <label>Width <input type="range" min="2" max="10" value={inkWidth} onChange={(event) => setInkWidth(Number(event.target.value))} /></label>
        <button className={`btn secondary compact${tool === "DRAW" ? " active" : ""}`} type="button" onClick={() => setTool("DRAW")}>Pen</button>
        <button className={`btn secondary compact${tool === "ERASE" ? " active" : ""}`} type="button" onClick={() => setTool("ERASE")}>Eraser</button>
        <button className="btn secondary compact" type="button" onClick={undoInk} disabled={!historyState.undo}>Undo stroke</button>
        <button className="btn secondary compact" type="button" onClick={redoInk} disabled={!historyState.redo}>Redo stroke</button>
        <button className="btn secondary compact" type="button" onClick={clearInk} disabled={!inkDataUrl}>Clear ink</button>
      </div>
    </div>
    <p className="muted" role="status">{status}</p>
    <div className="ink-page-stage">
      <canvas ref={baseCanvas} className="ink-document-layer" aria-hidden="true" />
      <canvas
        ref={inkCanvas}
        className="ink-drawing-layer"
        aria-label="Draw annotation or signature directly on the selected document page"
        onPointerDown={startInk}
        onPointerMove={continueInk}
        onPointerUp={finishInk}
        onPointerCancel={finishInk}
      />
      <div
        className="annotation-placement-handle"
        style={{ left: `${placement.x * 55}%`, top: `${placement.y * 78}%` }}
        role="button"
        tabIndex={0}
        aria-label="Drag the authenticated minute block to a custom position"
        onPointerDown={(event) => { event.preventDefault(); draggingPlacement.current = true; event.currentTarget.setPointerCapture(event.pointerId); movePlacement(event); }}
        onPointerMove={movePlacement}
        onPointerUp={(event) => { draggingPlacement.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => { draggingPlacement.current = false; }}
      >Drag minute block</div>
    </div>
    <small className="muted">Use Pen or Eraser and undo individual strokes as needed. Select Custom placement in the form to use the draggable minute-block position. Stylus ink remains a visual mark; authenticated identity, policy and integrity evidence are recorded separately.</small>
  </div>;
}
