import {
  createTeam as createTeamInDb,
  findTeamsForUser,
  findTeamById,
  getTeamMembers,
  joinTeamByInviteCode as joinTeamByInviteCodeInDb,
  type Team,
  type TeamMember,
} from "@/lib/db";

export type { Team, TeamMember };

export async function getTeamsForUser(userId: string): Promise<Team[]> {
  return findTeamsForUser(userId);
}

export async function getTeamById(teamId: string): Promise<Team | undefined> {
  return findTeamById(teamId);
}

export async function getMembersForTeam(teamId: string): Promise<TeamMember[]> {
  return getTeamMembers(teamId);
}

export async function createTeam(ownerUserId: string, name: string): Promise<{ team: Team; membership: TeamMember }> {
  return createTeamInDb(ownerUserId, name);
}

export async function joinTeamByInviteCode(
  userId: string,
  inviteCode: string,
): Promise<{ team: Team; membership: TeamMember } | null> {
  return joinTeamByInviteCodeInDb(userId, inviteCode);
}
