import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./oidc";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (process.env.BYPASS_AUTH === "true") {
        const bypassUser = await authStorage.getUserByEmail("mpapa@aseva.com");
        if (bypassUser) {
          const { oidcId: _, ...safeUser } = bypassUser as any;
          return res.json(safeUser);
        }
      }

      if (!req.isAuthenticated || !req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const oidcId = req.user.claims.sub;
      const user = await authStorage.getUserByOidcId(oidcId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { oidcId: _, ...safeUser } = user as any;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
