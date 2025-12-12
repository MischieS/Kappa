"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, ListChecks, Map, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-3.5 w-3.5" />,
  },
  {
    label: "Quests",
    href: "/quests",
    icon: <ListChecks className="h-3.5 w-3.5" />,
  },
  {
    label: "Quest Items",
    href: "/quests/items",
    icon: <Boxes className="h-3.5 w-3.5" />,
  },
  {
    label: "Kappa Items",
    href: "/kappa-items",
    icon: <Boxes className="h-3.5 w-3.5" />,
  },
  {
    label: "Hideout Items",
    href: "/hideout-items",
    icon: <Boxes className="h-3.5 w-3.5" />,
  },
  {
    label: "Maps",
    href: "/maps",
    icon: <Map className="h-3.5 w-3.5" />,
  },
  {
    label: "Timmies",
    href: "/timmies",
    icon: <Users className="h-3.5 w-3.5" />,
  },
];

export function TopNav() {
  const pathname = usePathname();

  const [userName, setUserName] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState<string | null>(null);

  const displayName = userName || "Anon";

  const [hidePrimary, setHidePrimary] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;

      if (currentY > lastY + 4 && currentY > 32) {
        setHidePrimary(true);
      } else if (currentY < lastY - 4) {
        setHidePrimary(false);
      }

      lastY = currentY;
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await fetch("/api/me", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) return;

        const data = await response.json().catch(() => null);
        if (!cancelled && data && typeof data.username === "string") {
          setUserName(data.username);

          if (typeof data.gameEdition === "string") {
            const value = data.gameEdition as Edition;
            setEdition(value);
            persistPlayerSettings({ edition: value });
          }

          if (typeof data.faction === "string") {
            const value = data.faction as Faction;
            setFaction(value);
            persistPlayerSettings({ faction: value });
          }

          if (typeof data.level === "number" && !Number.isNaN(data.level)) {
            setLevel(data.level);
            persistPlayerSettings({ level: data.level });
          }

          if (typeof data.fenceRep === "number" && !Number.isNaN(data.fenceRep)) {
            setFenceRep(data.fenceRep);
            persistPlayerSettings({ fenceRep: data.fenceRep });
          }
        }
      } catch {
        // ignore, treat as not logged in
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (userName) return;

    try {
      const raw = window.localStorage.getItem("kappaPlayerSettings");

      if (!raw) {
        // If there are no persisted settings yet for an anonymous user,
        // seed localStorage with the current header defaults so other
        // pages (like /quests) can use level / Fence rep for locking.
        persistPlayerSettings({
          edition: "Prepare for Escape",
          faction: "USEC",
          level: 28,
          fenceRep: 1.14,
        });
        return;
      }

      const data = JSON.parse(raw) as {
        edition?: Edition;
        faction?: Faction;
        level?: number;
        fenceRep?: number;
      };

      if (data.edition && typeof data.edition === "string") {
        setEdition(data.edition as Edition);
      }

      if (data.faction && typeof data.faction === "string") {
        setFaction(data.faction as Faction);
      }

      if (typeof data.level === "number" && !Number.isNaN(data.level)) {
        setLevel(data.level);
      }

      if (typeof data.fenceRep === "number" && !Number.isNaN(data.fenceRep)) {
        setFenceRep(data.fenceRep);
      }
    } catch {
    }
  }, [userName]);

  async function handleLogoutClick() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore network errors for this lightweight setup
    }
    setUserName(null);
    setAuthError(null);
  }

  async function handleLoginSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setAuthError("Username and password are required");
      return;
    }

    setAuthError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (data && (data.error as string)) || "Login failed";
        setAuthError(message);
        return;
      }

      const serverUsername = (data?.username as string | undefined) ?? loginUsername.trim();
      setUserName(serverUsername);
      setAuthOpen(false);
    } catch {
      setAuthError("Unable to reach server");
    }
  }

  async function handleSignupSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!signupUsername.trim() || !signupPassword.trim()) {
      setAuthError("Username and password are required");
      return;
    }

    setAuthError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: signupUsername.trim(),
          password: signupPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (data && (data.error as string)) || "Sign up failed";
        setAuthError(message);
        return;
      }

      const serverUsername = (data?.username as string | undefined) ?? signupUsername.trim();
      setUserName(serverUsername);
      setAuthOpen(false);
    } catch {
      setAuthError("Unable to reach server");
    }
  }

  type Edition = "Standard" | "Left Behind" | "Prepare for Escape" | "Edge of Darkness" | "Unheard";
  type Faction = "USEC" | "BEAR";

  const [edition, setEdition] = useState<Edition>("Prepare for Escape");
  const [faction, setFaction] = useState<Faction>("USEC");
  const [level, setLevel] = useState<number>(28);
  const [fenceRep, setFenceRep] = useState<number>(1.14);
  const [fenceInput, setFenceInput] = useState<string | null>(null);
  const [editionOpen, setEditionOpen] = useState(false);
  const [factionOpen, setFactionOpen] = useState(false);

  const levelInputRef = useRef<HTMLInputElement | null>(null);
  const fenceRepInputRef = useRef<HTMLInputElement | null>(null);

  function persistPlayerSettings(partial: {
    edition?: Edition;
    faction?: Faction;
    level?: number;
    fenceRep?: number;
  }) {
    if (typeof window === "undefined") return;
    try {
      const existingRaw = window.localStorage.getItem("kappaPlayerSettings");
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const next = { ...existing, ...partial };
      window.localStorage.setItem("kappaPlayerSettings", JSON.stringify(next));

      const detail: {
        edition?: Edition;
        faction?: Faction;
        level?: number;
        fenceRep?: number;
      } = {};

      if (partial.edition !== undefined) detail.edition = partial.edition;
      if (partial.faction !== undefined) detail.faction = partial.faction;
      if (partial.level !== undefined) detail.level = partial.level;
      if (partial.fenceRep !== undefined) detail.fenceRep = partial.fenceRep;

      window.dispatchEvent(
        new CustomEvent("kappaPlayerSettingsChanged", {
          detail,
        }),
      );
    } catch {
    }
  }

  async function updateProfile(partial: {
    faction?: string;
    gameEdition?: string;
    level?: number;
    fenceRep?: number;
  }) {
    try {
      await fetch("/api/user/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(partial),
      });
    } catch {
      // ignore network errors for this lightweight setup
    }
  }

  const currentPath = pathname || "/";

  const sortedNav = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length);
  const activeHref = sortedNav.find((item) => currentPath.startsWith(item.href))?.href ?? "/dashboard";

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-md">
      {/* Primary header bar: logo + user info */}
      <div
        id="kappa-primary-header"
        className={`border-b border-zinc-900/80 transition-transform duration-200 ${
          hidePrimary ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-[0.18em] text-zinc-200">
              Kappa
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Compact player info bar inside primary header */}
            <div className="hidden md:flex">
              <div className="flex items-center rounded-lg bg-zinc-950/40 px-2 py-0.5 text-[10px] text-zinc-300">
                {/* Edition */}
                <button
                  type="button"
                  onClick={() => setEditionOpen(true)}
                  className="flex min-w-[3.5rem] items-center justify-center px-1.5 text-center"
                >
                  <span className="truncate text-[10px] font-semibold text-zinc-100">
                    {edition}
                  </span>
                </button>

                {/* Faction */}
                <button
                  type="button"
                  onClick={() => setFactionOpen(true)}
                  className="flex min-w-[3rem] items-center justify-center px-1.5 text-center"
                >
                  <span className="truncate text-[10px] font-semibold text-zinc-100">
                    {faction}
                  </span>
                </button>

                {/* Level */}
                <div className="flex min-w-[3rem] items-center justify-center gap-0.5 px-1.5 text-center">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    LvL
                  </span>
                  <input
                    ref={levelInputRef}
                    type="text"
                    value={level}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^0-9]/g, "");
                      if (!raw) {
                        setLevel(1);
                        return;
                      }
                      const next = Number(raw);
                      if (Number.isNaN(next)) return;
                      const clamped = Math.min(80, Math.max(1, next));
                      setLevel(clamped);
                    }}
                    onBlur={() => {
                      void updateProfile({ level });
                      persistPlayerSettings({ level });
                    }}
                    className="w-8 bg-transparent text-center text-[10px] font-semibold text-zinc-100 outline-none"
                  />
                </div>

                {/* Fence Rep */}
                <div className="flex min-w-[4rem] items-center justify-center gap-0.5 px-1.5 text-center">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Fence
                  </span>
                  <input
                    ref={fenceRepInputRef}
                    type="text"
                    value={fenceInput ?? fenceRep.toFixed(2)}
                    onFocus={(event) => {
                      event.target.select();
                      setFenceInput("");
                    }}
                    onChange={(event) => {
                      const next = event.target.value;
                      // Allow optional leading -, up to 3 digits: -999 .. 999
                      if (!/^[-]?\d{0,3}$/.test(next)) return;
                      setFenceInput(next);
                    }}
                    onBlur={() => {
                      if (fenceInput == null) return;
                      let raw = fenceInput.trim();
                      if (!raw || raw === "-") {
                        setFenceRep(0);
                        setFenceInput(null);
                        return;
                      }

                      const negative = raw.startsWith("-");
                      const digits = raw.replace(/[^0-9]/g, "");
                      if (!digits) {
                        setFenceRep(0);
                        setFenceInput(null);
                        return;
                      }

                      let value: number;
                      if (digits.length === 1) {
                        // Single digit: treat as whole number (6 -> 6.00)
                        value = Number(digits);
                      } else {
                        // 2+ digits: last two are decimals (943 -> 9.43, 045 -> 0.45)
                        const intPart = digits.slice(0, -2) || "0";
                        const decPart = digits.slice(-2);
                        value = Number(`${intPart}.${decPart}`);
                      }

                      if (negative) value = -value;

                      const clamped = Math.max(-9.99, Math.min(9.99, value));
                      const finalValue = Number(clamped.toFixed(2));
                      setFenceRep(finalValue);
                      void updateProfile({ fenceRep: finalValue });
                      persistPlayerSettings({ fenceRep: finalValue });
                      setFenceInput(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-10 bg-transparent text-center text-[10px] font-semibold text-emerald-300 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">{displayName}</span>
              {userName ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-zinc-700/80 bg-zinc-950/80 text-[11px] text-zinc-200"
                  onClick={handleLogoutClick}
                >
                  Log out
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-zinc-700/80 bg-zinc-950/80 text-[11px] text-zinc-200"
                  onClick={() => {
                    setAuthTab("login");
                    setAuthOpen(true);
                  }}
                >
                  Log in
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary header bar: primary navigation menu */}
      <div
        className={`bg-zinc-950/95 transition-transform duration-200 ${
          hidePrimary ? "-translate-y-14" : "translate-y-0"
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 pb-3 pt-3 md:px-6 lg:px-8">
          {/* Main nav pills */}
          <div className="mt-1 flex justify-center">
            <nav
              className="hidden items-center justify-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-950/90 px-1.5 py-1.5 text-xs md:flex"
              aria-label="Primary navigation"
            >
              {NAV_ITEMS.map((item) => {
                const active = item.href === activeHref;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                      active
                        ? "bg-emerald-500/15 text-zinc-50"
                        : "text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-100",
                    ].join(" ")}
                  >
                    <span className="text-emerald-400">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <Modal open={authOpen} onClose={() => setAuthOpen(false)} title="Account">
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setAuthTab("login")}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                authTab === "login"
                  ? "bg-zinc-900 text-zinc-50"
                  : "text-zinc-500 hover:bg-zinc-900/70 hover:text-zinc-100"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("signup")}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                authTab === "signup"
                  ? "bg-zinc-900 text-zinc-50"
                  : "text-zinc-500 hover:bg-zinc-900/70 hover:text-zinc-100"
              }`}
            >
              Sign up
            </button>
          </div>

          {authError ? (
            <p className="text-xs text-rose-400">{authError}</p>
          ) : null}

          {authTab === "login" ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">Log in with your existing account.</p>
              <form onSubmit={handleLoginSubmit} className="space-y-2">
                <div className="space-y-1 text-xs">
                  <label className="block text-zinc-400">Username</label>
                  <input
                    value={loginUsername}
                    onChange={(event) => setLoginUsername(event.target.value)}
                    className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Enter username"
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <label className="block text-zinc-400">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Enter password"
                  />
                </div>
                <Button type="submit" size="sm" className="w-full text-xs">
                  Log in
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">Sign up with a new username.</p>
              <form onSubmit={handleSignupSubmit} className="space-y-2">
                <div className="space-y-1 text-xs">
                  <label className="block text-zinc-400">Username</label>
                  <input
                    value={signupUsername}
                    onChange={(event) => setSignupUsername(event.target.value)}
                    className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Choose a username"
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <label className="block text-zinc-400">Password</label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(event) => setSignupPassword(event.target.value)}
                    className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Choose a password"
                  />
                </div>
                <Button type="submit" size="sm" variant="primary" className="w-full text-xs">
                  Sign up
                </Button>
              </form>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={editionOpen} onClose={() => setEditionOpen(false)} title="Edition">
        <div className="space-y-2 text-xs text-zinc-300">
          {(["Standard", "Left Behind", "Prepare for Escape", "Edge of Darkness", "Unheard"] as Edition[]).map(
            (opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setEdition(opt);
                  void updateProfile({ gameEdition: opt });
                  persistPlayerSettings({ edition: opt });
                  setEditionOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-900/80 ${
                  edition === opt ? "text-emerald-300" : "text-zinc-200"
                }`}
              >
                <span>{opt}</span>
              </button>
            ),
          )}
        </div>
      </Modal>
      <Modal open={factionOpen} onClose={() => setFactionOpen(false)} title="Faction">
        <div className="space-y-2 text-xs text-zinc-300">
          {(["USEC", "BEAR"] as Faction[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setFaction(opt);
                void updateProfile({ faction: opt });
                persistPlayerSettings({ faction: opt });
                setFactionOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-900/80 ${
                faction === opt ? "text-emerald-300" : "text-zinc-200"
              }`}
            >
              <span>{opt}</span>
            </button>
          ))}
        </div>
      </Modal>
    </header>
  );
}
