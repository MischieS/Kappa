import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

export type QuestStatus = 'not_started' | 'in_progress' | 'completed';

export interface QuestProgress {
  questId: string;
  status: QuestStatus;
  completedAt?: string;
}

export interface ItemProgress {
  itemId: string;
  count: number;
  isQuestRequired?: boolean;
  isKappaRequired?: boolean;
}

export interface HideoutItemProgress {
  itemId: string;
  name: string;
  shortName?: string;
  iconLink?: string;
  wikiLink?: string;
  requiresFir?: boolean;
  totalRequired: number;
  totalCollected: number;
}

export interface QuestObjectiveProgress {
  questId: string;
  objectiveId: string;
  collected: number;
}

export interface TraderStanding {
  traderId: string;
  level: number;
}

export type TeamRole = 'owner' | 'member';

export interface Team {
  id: string;
  name: string;
  ownerUserId: string;
  inviteCode: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  faction?: string;
  gameEdition?: string;
  level?: number;
  fenceRep?: number;
  quests: QuestProgress[];
  items: ItemProgress[];
  objectiveProgress: QuestObjectiveProgress[];
  hideoutItems?: HideoutItemProgress[];
  traderStandings?: TraderStanding[];
}

// Initialize Database
const dbPath = path.join(process.cwd(), 'tarkov-tracker.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    faction TEXT,
    game_edition TEXT,
    level INTEGER,
    fence_rep REAL,
    quests JSON DEFAULT '[]',
    items JSON DEFAULT '[]',
    objective_progress JSON DEFAULT '[]',
    hideout_items JSON DEFAULT '[]',
    trader_standings JSON DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT,
    owner_user_id TEXT,
    invite_code TEXT UNIQUE,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT,
    user_id TEXT,
    role TEXT,
    joined_at TEXT,
    FOREIGN KEY(team_id) REFERENCES teams(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Helper to parse User from DB row
function parseUserRow(row: any): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    faction: row.faction,
    gameEdition: row.game_edition,
    level: row.level,
    fenceRep: row.fence_rep,
    quests: JSON.parse(row.quests || '[]'),
    items: JSON.parse(row.items || '[]'),
    objectiveProgress: JSON.parse(row.objective_progress || '[]'),
    hideoutItems: JSON.parse(row.hideout_items || '[]'),
    traderStandings: JSON.parse(row.trader_standings || '[]'),
  };
}

export async function findUserByUsername(username: string): Promise<User | undefined> {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const row = stmt.get(username);
  if (!row) return undefined;
  return parseUserRow(row);
}

export async function findUserById(id: string): Promise<User | undefined> {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return undefined;
  return parseUserRow(row);
}

export async function createUser(
  username: string,
  passwordHash: string,
  faction?: string,
  gameEdition?: string,
): Promise<User> {
  const user: User = {
    id: randomUUID(),
    username,
    passwordHash,
    faction,
    gameEdition,
    level: 1,
    fenceRep: 0,
    quests: [],
    items: [],
    objectiveProgress: [],
    hideoutItems: [],
    traderStandings: [],
  };

  const stmt = db.prepare(`
    INSERT INTO users (
      id, username, password_hash, faction, game_edition, level, fence_rep,
      quests, items, objective_progress, hideout_items, trader_standings
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  stmt.run(
    user.id,
    user.username,
    user.passwordHash,
    user.faction,
    user.gameEdition,
    user.level,
    user.fenceRep,
    JSON.stringify(user.quests),
    JSON.stringify(user.items),
    JSON.stringify(user.objectiveProgress),
    JSON.stringify(user.hideoutItems),
    JSON.stringify(user.traderStandings)
  );

  return user;
}

export async function saveUser(user: User): Promise<void> {
  const stmt = db.prepare(`
    UPDATE users SET
      username = ?,
      password_hash = ?,
      faction = ?,
      game_edition = ?,
      level = ?,
      fence_rep = ?,
      quests = ?,
      items = ?,
      objective_progress = ?,
      hideout_items = ?,
      trader_standings = ?
    WHERE id = ?
  `);

  const info = stmt.run(
    user.username,
    user.passwordHash,
    user.faction,
    user.gameEdition,
    user.level,
    user.fenceRep,
    JSON.stringify(user.quests),
    JSON.stringify(user.items),
    JSON.stringify(user.objectiveProgress),
    JSON.stringify(user.hideoutItems),
    JSON.stringify(user.traderStandings),
    user.id
  );
  
  if (info.changes === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO users (
        id, username, password_hash, faction, game_edition, level, fence_rep,
        quests, items, objective_progress, hideout_items, trader_standings
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);
    
    insertStmt.run(
      user.id,
      user.username,
      user.passwordHash,
      user.faction,
      user.gameEdition,
      user.level,
      user.fenceRep,
      JSON.stringify(user.quests),
      JSON.stringify(user.items),
      JSON.stringify(user.objectiveProgress),
      JSON.stringify(user.hideoutItems),
      JSON.stringify(user.traderStandings)
    );
  }
}

function generateTeamInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    code += alphabet[index];
  }
  return code;
}

export async function createTeam(ownerUserId: string, name: string): Promise<{ team: Team; membership: TeamMember }> {
  let inviteCode = generateTeamInviteCode();
  let retries = 0;
  
  // Simple retry loop to ensure unique invite code
  while (retries < 10) {
    const check = db.prepare('SELECT 1 FROM teams WHERE invite_code = ?').get(inviteCode);
    if (!check) break;
    inviteCode = generateTeamInviteCode();
    retries++;
  }

  const team: Team = {
    id: randomUUID(),
    name,
    ownerUserId,
    inviteCode,
    createdAt: new Date().toISOString(),
  };

  const membership: TeamMember = {
    id: randomUUID(),
    teamId: team.id,
    userId: ownerUserId,
    role: 'owner',
    joinedAt: new Date().toISOString(),
  };

  const insertTeam = db.prepare(`
    INSERT INTO teams (id, name, owner_user_id, invite_code, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMember = db.prepare(`
    INSERT INTO team_members (id, team_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertTeam.run(team.id, team.name, team.ownerUserId, team.inviteCode, team.createdAt);
    insertMember.run(membership.id, membership.teamId, membership.userId, membership.role, membership.joinedAt);
  });

  transaction();

  return { team, membership };
}

export async function findTeamsForUser(userId: string): Promise<Team[]> {
  const stmt = db.prepare(`
    SELECT t.* 
    FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = ?
  `);
  
  const rows = stmt.all(userId);
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
  }));
}

export async function findTeamById(id: string): Promise<Team | undefined> {
  const stmt = db.prepare('SELECT * FROM teams WHERE id = ?');
  const row: any = stmt.get(id);
  
  if (!row) return undefined;
  
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
  };
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const stmt = db.prepare('SELECT * FROM team_members WHERE team_id = ?');
  const rows = stmt.all(teamId);
  
  return rows.map((row: any) => ({
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role as TeamRole,
    joinedAt: row.joined_at,
  }));
}

export async function findTeamByInviteCode(inviteCode: string): Promise<Team | undefined> {
  const normalized = inviteCode.trim().toUpperCase();
  const stmt = db.prepare('SELECT * FROM teams WHERE UPPER(invite_code) = ?');
  const row: any = stmt.get(normalized);

  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
  };
}

export async function joinTeamByInviteCode(
  userId: string,
  inviteCode: string,
): Promise<{ team: Team; membership: TeamMember } | null> {
  const normalized = inviteCode.trim().toUpperCase();
  const teamRow: any = db.prepare('SELECT * FROM teams WHERE UPPER(invite_code) = ?').get(normalized);
  
  if (!teamRow) {
    return null;
  }

  const team: Team = {
    id: teamRow.id,
    name: teamRow.name,
    ownerUserId: teamRow.owner_user_id,
    inviteCode: teamRow.invite_code,
    createdAt: teamRow.created_at,
  };

  const existingMember: any = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(team.id, userId);

  if (existingMember) {
    return {
      team,
      membership: {
        id: existingMember.id,
        teamId: existingMember.team_id,
        userId: existingMember.user_id,
        role: existingMember.role as TeamRole,
        joinedAt: existingMember.joined_at,
      }
    };
  }

  // Check member count (limit 5)
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM team_members WHERE team_id = ?');
  const countResult: any = countStmt.get(team.id);
  if (countResult.count >= 5) {
    return null;
  }

  const membership: TeamMember = {
    id: randomUUID(),
    teamId: team.id,
    userId,
    role: team.ownerUserId === userId ? 'owner' : 'member',
    joinedAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO team_members (id, team_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(membership.id, membership.teamId, membership.userId, membership.role, membership.joinedAt);

  return { team, membership };
}
