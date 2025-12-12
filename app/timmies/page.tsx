"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Users, Plus, KeyRound, Loader2 } from "lucide-react";

interface TeamSummary {
  id: string;
  name: string;
  ownerUserId: string;
  inviteCode?: string;
  createdAt: string;
}

interface TeamListResponse {
  teams?: TeamSummary[];
}

interface TeamNeedMember {
  userId: string;
  username: string | null;
  role: string | null;
  required: number;
  collected: number;
}

interface TeamNeedItem {
  itemId: string;
  name: string;
  shortName?: string;
  iconLink?: string;
  wikiLink?: string;
  requiresFir: boolean;
  totalRequired: number;
  totalCollected: number;
  members: TeamNeedMember[];
}

interface TeamNeedsResponse {
  teamId: string;
  items: TeamNeedItem[];
}

export default function TimmiesPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamNeeds, setTeamNeeds] = useState<TeamNeedsResponse | null>(null);
  const [needsLoading, setNeedsLoading] = useState(false);
  const [needsError, setNeedsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTeams() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/teams", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 401) {
            setError("Log in to create and manage teams.");
          } else {
            const data = await response.json().catch(() => null);
            const message = (data && (data.error as string)) || "Failed to load teams";
            setError(message);
          }
          setTeams([]);
          return;
        }

        const data = (await response.json().catch(() => null)) as TeamListResponse | null;
        if (cancelled || !data) return;

        const list = Array.isArray(data.teams) ? data.teams : [];
        setTeams(list);
        if (!selectedTeamId && list.length > 0) {
          setSelectedTeamId(list[0].id);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load teams");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTeams();

    return () => {
      cancelled = true;
    };
  }, [selectedTeamId]);

  async function handleCreateTeam(event: React.FormEvent) {
    event.preventDefault();
    const name = createName.trim();
    if (!name) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (data && (data.error as string)) || "Failed to create team";
        setError(message);
        return;
      }

      const created: TeamSummary | null = data && data.team ? data.team : null;
      if (created) {
        setTeams((prev) => {
          const existing = prev.find((t) => t.id === created.id);
          if (existing) return prev;
          return [...prev, created];
        });
        setCreateName("");
        setSelectedTeamId(created.id);
      }
    } catch {
      setError("Failed to create team");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinTeam(event: React.FormEvent) {
    event.preventDefault();
    const code = joinCode.trim();
    if (!code) return;

    setJoining(true);
    setError(null);

    try {
      const response = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inviteCode: code }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (data && (data.error as string)) || "Failed to join team";
        setError(message);
        return;
      }

      const joined: TeamSummary | null = data && data.team ? data.team : null;
      if (joined) {
        setTeams((prev) => {
          const existing = prev.find((t) => t.id === joined.id);
          if (existing) return prev;
          return [...prev, joined];
        });
        setJoinCode("");
        setSelectedTeamId(joined.id);
      }
    } catch {
      setError("Failed to join team");
    } finally {
      setJoining(false);
    }
  }

  async function handleSelectTeam(teamId: string) {
    setSelectedTeamId(teamId);
    setTeamNeeds(null);
    setNeedsError(null);
    setNeedsLoading(true);

    try {
      const response = await fetch(`/api/teams/${teamId}/needs`, {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (data && (data.error as string)) || "Failed to load team needs";
        setNeedsError(message);
        return;
      }

      if (data && typeof data === "object") {
        const parsed = data as TeamNeedsResponse;
        setTeamNeeds(parsed);
      }
    } catch {
      setNeedsError("Failed to load team needs");
    } finally {
      setNeedsLoading(false);
    }
  }

  const selectedTeam = selectedTeamId ? teams.find((t) => t.id === selectedTeamId) ?? null : null;

  return (
    <AppShell title="Timmies" subtitle="Create a team and see what your friends still need.">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)]">
        <Card className="border-zinc-900/80 bg-zinc-950/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <Users className="h-4 w-4 text-emerald-400" />
                  Your teams
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Log in, create a team, or join one with an invite code.
                </CardDescription>
              </div>
              {loading ? (
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <p className="text-[11px] text-rose-400">{error}</p> : null}

            <form onSubmit={handleCreateTeam} className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="New team name"
                  className="h-8 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={creating || !createName.trim()}
                  className="inline-flex items-center gap-1.5 text-[11px]"
                >
                  {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Create
                </Button>
              </div>
            </form>

            <form onSubmit={handleJoinTeam} className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="Invite code"
                  className="h-8 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={joining || !joinCode.trim()}
                  className="inline-flex items-center gap-1.5 text-[11px]"
                >
                  {joining ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
                  Join
                </Button>
              </div>
            </form>

            <div className="mt-2 space-y-1">
              {teams.length === 0 && !loading ? (
                <p className="text-[11px] text-zinc-500">No teams yet. Create one or join with an invite code.</p>
              ) : null}

              {teams.map((team) => {
                const isActive = selectedTeamId === team.id;
                const createdDate = new Date(team.createdAt);

                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => handleSelectTeam(team.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      isActive
                        ? "border-emerald-500/70 bg-emerald-500/10 text-zinc-50"
                        : "border-zinc-800/80 bg-zinc-950/80 text-zinc-200 hover:border-emerald-500/60 hover:bg-zinc-900/80"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{team.name}</span>
                      <span className="text-[10px] text-zinc-500">
                        Created {createdDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <Badge variant={isActive ? "success" : "outline"} className="text-[10px]">
                      {isActive ? "Selected" : "Select"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-900/80 bg-zinc-950/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-100">Team needs</CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Items required across all members of the selected team.
                </CardDescription>
              </div>
              {needsLoading ? (
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedTeam ? (
              <p className="text-[11px] text-zinc-500">Select a team to see aggregated quest item needs.</p>
            ) : null}

            {needsError ? <p className="text-[11px] text-rose-400">{needsError}</p> : null}

            {selectedTeam && !teamNeeds && !needsLoading ? (
              <Button
                type="button"
                size="sm"
                className="text-[11px]"
                onClick={() => handleSelectTeam(selectedTeam.id)}
              >
                Load needs
              </Button>
            ) : null}

            {selectedTeam && teamNeeds && teamNeeds.items.length === 0 && !needsLoading ? (
              <p className="text-[11px] text-zinc-500">No outstanding quest item requirements for this team.</p>
            ) : null}

            {selectedTeam && teamNeeds && teamNeeds.items.length > 0 ? (
              <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1 text-[11px]">
                {teamNeeds.items.map((item) => {
                  const remaining = Math.max(item.totalRequired - item.totalCollected, 0);

                  return (
                    <div
                      key={item.itemId}
                      className="rounded-lg border border-zinc-900/80 bg-zinc-950/80 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-100">{item.name}</span>
                          {item.shortName ? (
                            <span className="text-[10px] text-zinc-500">{item.shortName}</span>
                          ) : null}
                        </div>
                        <div className="text-right text-[10px] text-zinc-400">
                          <div>
                            Team {item.totalCollected}/{item.totalRequired}
                          </div>
                          <div className="text-emerald-300">
                            {remaining} left
                          </div>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.members.map((member) => {
                          const memberRemaining = Math.max(member.required - member.collected, 0);
                          return (
                            <span
                              key={`${item.itemId}-${member.userId}`}
                              className="inline-flex items-center gap-1 rounded-full bg-zinc-900/80 px-2 py-0.5 text-[10px] text-zinc-300"
                            >
                              <span>{member.username || "Anon"}</span>
                              <span className="text-zinc-500">
                                {member.collected}/{member.required}
                              </span>
                              {memberRemaining > 0 ? (
                                <span className="text-emerald-300">{memberRemaining} left</span>
                              ) : null}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
