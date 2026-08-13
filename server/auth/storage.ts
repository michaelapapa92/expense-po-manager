import { users, type User } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByOidcId(oidcId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(userData: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByOidcId(oidcId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.oidcId, oidcId));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User> {
    const existingByOidc = await this.getUserByOidcId(userData.id);
    if (existingByOidc) {
      const [updated] = await db.update(users)
        .set({
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.oidcId, userData.id))
        .returning();
      return updated;
    }

    if (userData.email) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail) {
        const [updated] = await db.update(users)
          .set({
            oidcId: userData.id,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email))
          .returning();
        return updated;
      }
    }

    const name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'New User';
    const initials = `${(userData.firstName || 'N')[0]}${(userData.lastName || 'U')[0]}`.toUpperCase();

    const [user] = await db.insert(users)
      .values({
        name,
        email: userData.email || `user-${userData.id}@unknown.com`,
        avatarInitials: initials,
        oidcId: userData.id,
        profileImageUrl: userData.profileImageUrl,
        role: "Employee",
        isAdmin: false,
        isAccountsPayable: false,
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
