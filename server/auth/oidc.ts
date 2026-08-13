import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { getAppUrl } from "../app-url";

const ONELOGIN_ISSUER_URL = process.env.ONELOGIN_ISSUER_URL!;
const ONELOGIN_CLIENT_ID = process.env.ONELOGIN_CLIENT_ID!;
const ONELOGIN_CLIENT_SECRET = process.env.ONELOGIN_CLIENT_SECRET!;

const getOidcConfig = memoize(
  async () => {
    const config = await client.discovery(
      new URL(ONELOGIN_ISSUER_URL),
      ONELOGIN_CLIENT_ID,
      { client_secret: ONELOGIN_CLIENT_SECRET },
      client.ClientSecretBasic(ONELOGIN_CLIENT_SECRET)
    );
    return config;
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["given_name"] || claims["first_name"],
    lastName: claims["family_name"] || claims["last_name"],
    profileImageUrl: claims["picture"] || claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const appUrl = getAppUrl();
  const callbackURL = `${appUrl}/api/callback`;

  const strategy = new Strategy(
    {
      name: "onelogin",
      config,
      scope: "openid email profile",
      callbackURL,
    },
    verify
  );
  passport.use(strategy);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    if (process.env.DISABLE_LOGIN === "true") {
      return res.status(503).send("Login is temporarily disabled. Please try again later.");
    }
    const returnTo = req.query.returnTo as string | undefined;
    if (returnTo && req.session) {
      (req.session as any).returnTo = returnTo;
    }
    passport.authenticate("onelogin", {
      prompt: "login",
      scope: ["openid", "email", "profile"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const returnTo = (req.session as any)?.returnTo || "/";
    if (req.session) {
      delete (req.session as any).returnTo;
    }
    passport.authenticate("onelogin", {
      successReturnToOrRedirect: returnTo,
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      const redirectUri = appUrl;
      try {
        const endSessionUrl = client.buildEndSessionUrl(config, {
          client_id: ONELOGIN_CLIENT_ID,
          post_logout_redirect_uri: redirectUri,
        }).href;
        res.redirect(endSessionUrl);
      } catch (e) {
        req.session?.destroy(() => {});
        res.redirect("/");
      }
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
