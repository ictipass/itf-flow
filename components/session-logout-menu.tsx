"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { logoutAction, workspaceLogoutHandoffAction } from "@/app/actions";

type Appearance = "classic" | "modern" | "soft" | "glass";

export function SessionLogoutMenu({ appearance }: { appearance: Appearance }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    function dismiss(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function dismissWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", dismissWithKeyboard);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", dismissWithKeyboard);
    };
  }, []);

  return (
    <div
      className={`session-logout-menu session-logout-menu-${appearance}`}
      ref={containerRef}
    >
      <form action={logoutAction} className="session-logout-main-form">
        <button className="session-logout-main" type="submit" title="Sign out">
          <LogOut size={appearance === "classic" ? 16 : 18} aria-hidden="true" />
          {appearance === "classic" ? <span>Sign out</span> : null}
          {appearance !== "classic" ? <span className="sr-only">Sign out</span> : null}
        </button>
      </form>
      <button
        className="session-logout-chevron"
        type="button"
        aria-label="Open sign-out options"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} className="session-logout-panel" role="menu">
          <strong>Sign-out options</strong>
          <p>The main button signs out of Flow and returns you to Workspace.</p>
          <form action={workspaceLogoutHandoffAction}>
            <button type="submit" role="menuitem">
              <LogOut size={16} aria-hidden="true" />
              Sign out of Workspace and all apps
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
