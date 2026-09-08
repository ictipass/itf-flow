"use client";

import { useEffect, useRef, useState } from "react";
import {
  AppWindow,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileText,
  GraduationCap,
  Grid3X3,
  HandCoins,
  Landmark,
  Megaphone,
  ShieldCheck,
  UsersRound,
  WalletCards,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  WorkspaceAppNavigationResponse,
  WorkspaceNavigationApp,
} from "@/lib/workspace-app-navigation-contract";

const iconComponents: Record<WorkspaceNavigationApp["icon"], LucideIcon> = {
  "app-window": AppWindow,
  workflow: Workflow,
  "wallet-cards": WalletCards,
  "graduation-cap": GraduationCap,
  "users-round": UsersRound,
  "briefcase-business": BriefcaseBusiness,
  "chart-combined": ChartNoAxesCombined,
  "shield-check": ShieldCheck,
  "clipboard-check": ClipboardCheck,
  "file-text": FileText,
  database: Database,
  wrench: Wrench,
  building: Building2,
  "hand-coins": HandCoins,
  megaphone: Megaphone,
  landmark: Landmark,
};

type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; apps: WorkspaceNavigationApp[] }
  | { status: "error" };

export function WorkspaceAppSwitcher() {
  const [open, setOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceUrl = process.env.NEXT_PUBLIC_WORKSPACE_URL ?? "/";

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

  async function loadApplications() {
    setLoadState({ status: "loading" });
    try {
      const response = await fetch("/api/workspace/apps", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Application navigation unavailable");
      const body = (await response.json()) as WorkspaceAppNavigationResponse;
      setLoadState({ status: "ready", apps: body.apps });
    } catch {
      setLoadState({ status: "error" });
    }
  }

  function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) void loadApplications();
  }

  return (
    <div className="workspace-app-switcher" ref={containerRef}>
      <button
        type="button"
        className="workspace-app-switcher-trigger"
        aria-label="Open ITF applications"
        aria-expanded={open}
        aria-controls="workspace-app-switcher-panel"
        onClick={toggle}
      >
        <Grid3X3 size={19} aria-hidden="true" />
      </button>
      {open ? (
        <section
          id="workspace-app-switcher-panel"
          className="workspace-app-switcher-panel"
          aria-label="Your ITF applications"
        >
          <header>
            <div>
              <strong>ITF applications</strong>
              <small>Your authorized apps</small>
            </div>
            <a href={`${workspaceUrl.replace(/\/$/, "")}/dashboard/apps`}>
              Workspace <ExternalLink size={13} aria-hidden="true" />
            </a>
          </header>
          {loadState.status === "loading" || loadState.status === "idle" ? (
            <p className="workspace-app-switcher-status">Loading applications…</p>
          ) : null}
          {loadState.status === "error" ? (
            <div className="workspace-app-switcher-status">
              <p>Application list is temporarily unavailable.</p>
              <button type="button" onClick={() => void loadApplications()}>
                Try again
              </button>
            </div>
          ) : null}
          {loadState.status === "ready" && loadState.apps.length === 0 ? (
            <p className="workspace-app-switcher-status">
              No other applications are currently assigned to you.
            </p>
          ) : null}
          {loadState.status === "ready" && loadState.apps.length > 0 ? (
            <div className="workspace-app-switcher-grid">
              {loadState.apps.map((app) => {
                const Icon = iconComponents[app.icon];
                return (
                  <a key={app.id} href={app.launchUrl} title={app.name}>
                    <span><Icon size={23} strokeWidth={1.8} aria-hidden="true" /></span>
                    <strong>{app.name}</strong>
                    <small>{app.category.toLowerCase()}</small>
                  </a>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
