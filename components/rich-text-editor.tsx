"use client";

import { useRef, useState } from "react";

type Command = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "undo" | "redo";

export function RichTextEditor({ initialHtml = "", name = "body", onDirty }: { initialHtml?: string; name?: string; onDirty?: () => void }) {
  const editor = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLTextAreaElement>(null);
  const [empty, setEmpty] = useState(!initialHtml.trim());

  function synchronize() {
    const value = editor.current?.innerHTML ?? "";
    if (hidden.current) hidden.current.value = value;
    setEmpty(!(editor.current?.textContent ?? "").trim() && !editor.current?.querySelector("img,ul,ol"));
    onDirty?.();
  }

  function command(commandName: Command, value?: string) {
    editor.current?.focus();
    document.execCommand(commandName, false, value);
    synchronize();
  }

  function block(tag: "p" | "h2" | "blockquote") {
    editor.current?.focus();
    document.execCommand("formatBlock", false, tag);
    synchronize();
  }

  return <div className="rich-text-editor">
    <div className="rich-text-toolbar" role="toolbar" aria-label="Memo formatting">
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => block("p")}>Paragraph</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => block("h2")}>Heading</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}><strong>Bold</strong></button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}><em>Italic</em></button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("underline")}><u>Underline</u></button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")}>Bullets</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertOrderedList")}>Numbering</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => block("blockquote")}>Quote</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("undo")}>Undo</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("redo")}>Redo</button>
    </div>
    <div
      ref={editor}
      className={`rich-text-surface${empty ? " is-empty" : ""}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder="Compose the full memo or transcribe the main content of the letter"
      dangerouslySetInnerHTML={{ __html: initialHtml }}
      onInput={synchronize}
    />
    <textarea ref={hidden} name={name} defaultValue={initialHtml} hidden readOnly aria-hidden="true" />
    <small className="muted">Formatting is restricted to safe headings, emphasis, lists and quotations so it remains consistent in the ITF PDF output.</small>
  </div>;
}
