import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as DiscordStrategy } from "passport-discord-auth";
import { prisma } from "./prisma.js";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildOAuthUsername(baseName: string | undefined, provider: string, providerId: string) {
  const fallback = baseName?.trim() || provider;
  const cleaned = fallback
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 24) || provider;

  return `${cleaned}-${providerId.slice(-6)}`;
}

// ─── Google Strategy ─────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      callbackURL: requireEnv("GOOGLE_CALLBACK_URL"),
      // ❌ DO NOT add passReqToCallback
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        console.log(`[OAuth:Google] verify callback — email=${email}, profileId=${profile.id}`);

        if (!email) {
          console.error("[OAuth:Google] No email in profile");
          return done(new Error("Email not provided by Google"), false);
        }

        // Upsert: find by email, create if missing, update nothing if exists
        const username = buildOAuthUsername(profile.displayName, "google", profile.id);
        const user = await prisma.user.upsert({
          where: { email },
          update: {}, // don't overwrite anything on existing users
          create: {
            email,
            username,
            password: "oauth", // placeholder — NOT NULL in schema
          },
        });

        console.log(`[OAuth:Google] upsert complete — userId=${user.id}, email=${user.email}`);
        done(null, user);
      } catch (err) {
        console.error("[OAuth:Google] verify callback error:", err);
        done(err as Error, false);
      }
    }
  )
);

// ─── Discord Strategy ────────────────────────────────────
passport.use(
  new DiscordStrategy(
    {
      clientId: requireEnv("DISCORD_CLIENT_ID"),
      clientSecret: requireEnv("DISCORD_CLIENT_SECRET"),
      callbackUrl: requireEnv("DISCORD_CALLBACK_URL"),
      scope: ["identify", "email"],
      // ❌ DO NOT add passReqToCallback
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.email;
        console.log(`[OAuth:Discord] verify callback — email=${email}, profileId=${profile.id}`);

        if (!email) {
          console.error("[OAuth:Discord] No email in profile");
          return done(new Error("Discord email missing"), false);
        }

        // Upsert: find by email, create if missing, update nothing if exists
        const username = buildOAuthUsername(profile.username, "discord", profile.id);
        const user = await prisma.user.upsert({
          where: { email },
          update: {}, // don't overwrite anything on existing users
          create: {
            email,
            username,
            password: "oauth", // placeholder — NOT NULL in schema
          },
        });

        console.log(`[OAuth:Discord] upsert complete — userId=${user.id}, email=${user.email}`);
        done(null, user);
      } catch (err) {
        console.error("[OAuth:Discord] verify callback error:", err);
        done(err as Error, false);
      }
    }
  )
);


// Required by Passport even with session: false —
// the initial OAuth redirect calls serializeUser internally.
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser((id: string, done) => {
  done(null, { id });
});

export default passport;
