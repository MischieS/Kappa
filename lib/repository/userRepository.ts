import {
  createUser as createUserInDb,
  findUserById,
  findUserByUsername,
  saveUser as saveUserInDb,
  type User,
  type QuestProgress,
  type ItemProgress,
  type QuestObjectiveProgress,
  type TraderStanding,
  type HideoutItemProgress,
} from "@/lib/db";

export type {
  User,
  QuestProgress,
  ItemProgress,
  QuestObjectiveProgress,
  TraderStanding,
  HideoutItemProgress,
};

export async function getUserById(id: string): Promise<User | undefined> {
  return findUserById(id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  return findUserByUsername(username);
}

export async function createUser(
  username: string,
  passwordHash: string,
  faction?: string,
  gameEdition?: string,
): Promise<User> {
  return createUserInDb(username, passwordHash, faction, gameEdition);
}

export async function saveUser(user: User): Promise<void> {
  await saveUserInDb(user);
}
