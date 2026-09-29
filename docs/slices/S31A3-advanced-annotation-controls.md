# S31A3 — Advanced annotation controls

Status: **Implemented; migration and deployment pending**

Implementation commit: `d2189ab`

The PDF/image annotation canvas now supports Pen, Eraser, per-stroke Undo/Redo, clear-all, colour and width controls.
The authenticated minute block has a draggable preview marker; selecting **Custom** placement persists normalized X/Y
coordinates and renders the block at the corresponding bounded PDF position. Existing corner presets remain available.

Migration `20260929140000_add_advanced_annotation_placement` adds the `CUSTOM` placement enum value and normalized
coordinates. The signed canonical annotation payload, document event and database record retain these coordinates.
The source stays immutable and the generated PDF remains hash-bound.

The canvas exports only the final bounded PNG overlay. Undo/redo history is intentionally client-side working state;
the authoritative evidence is the final ink hash, placement, signer, authentication method and output PDF hash.

Acceptance must cover mouse, touch and at least one supported stylus device; pen/eraser switching; multiple undo/redo;
custom placement near every boundary; multi-page navigation; and Confidential/Secret authorization.
