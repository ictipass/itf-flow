"use client";

import { useEffect, useRef, useState } from "react";

const RENDER_WIDTH = 900;
const A4_RATIO = 841.89 / 595.28;

export function DocumentInkCanvas({ attachmentId, mimeType, formId }: { attachmentId: string; mimeType: string; formId: string }) {
  const baseCanvas = useRef<HTMLCanvasElement>(null);
  const inkCanvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [inkDataUrl, setInkDataUrl] = useState("");
  const [inkColor, setInkColor] = useState("#18181b");
  const [inkWidth, setInkWidth] = useState(3);
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
    drawing.current = true;
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = inkColor;
    context.lineWidth = inkWidth;
    context.lineTo(current.x + 0.01, current.y + 0.01);
    context.stroke();
  }

  function continueInk(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    event.preventDefault();
    const context = inkCanvas.current?.getContext("2d");
    if (!context) return;
    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();
  }

  function finishInk(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setInkDataUrl(event.currentTarget.toDataURL("image/png"));
  }

  function clearInk() {
    const canvas = inkCanvas.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setInkDataUrl("");
  }

  function changePage(next: number) {
    clearInk();
    setPageNumber(Math.max(1, Math.min(pageCount, next)));
  }

  return <div className="document-ink-editor">
    <input type="hidden" name="pageNumber" value={pageNumber} form={formId} />
    <input type="hidden" name="inkDataUrl" value={inkDataUrl} form={formId} />
    <div className="ink-toolbar">
      <div className="actions">
        <button className="btn secondary compact" type="button" disabled={pageNumber <= 1} onClick={() => changePage(pageNumber - 1)}>Previous page</button>
        <strong>Page {pageNumber} of {pageCount}</strong>
        <button className="btn secondary compact" type="button" disabled={pageNumber >= pageCount} onClick={() => changePage(pageNumber + 1)}>Next page</button>
      </div>
      <div className="actions">
        <label>Ink <input type="color" value={inkColor} onChange={(event) => setInkColor(event.target.value)} aria-label="Ink colour" /></label>
        <label>Width <input type="range" min="2" max="10" value={inkWidth} onChange={(event) => setInkWidth(Number(event.target.value))} /></label>
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
    </div>
    <small className="muted">Stylus ink is embedded into the generated PDF. It is visual handwriting; authenticated identity, policy and integrity evidence are recorded separately by ITF Flow.</small>
  </div>;
}
