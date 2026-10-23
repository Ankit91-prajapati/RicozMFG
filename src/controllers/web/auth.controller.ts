import type { CookieOptions, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { userLoginSchema, userRegisterSchema } from "./auth.schema.js";
import User from "../../models/user.model.js";
import sendVerifyEmail from "../../lib/email.js";
import createAccesstoken from "../../lib/createAccesstoken.js";
import createRefreshtoken from "../../lib/createRefreshtoken.js";
import getGoogleClient from "../../lib/getGoogleClient.js";

/* ------------------------------------------------------------------ */
/* Auth cookies                                                        */
/*                                                                     */
/*  accessToken   httpOnly, 15 min, path "/"                           */
/*  refreshToken  httpOnly, 7 days, path "/api/auth" (only sent to      */
/*                /api/auth/*, so pages and other APIs never get it)   */
/*  hasSession    readable, "1", 7 days, path "/" -- holds no secret;   */
/*                the Next.js proxy uses it to know a session exists   */
/*                                                                     */
/*  Recommended: Next.js rewrites /api/* to this server (one origin)   */
/*   -> SameSite=Lax, nothing to configure.                            */
/*  API on a different site     -> COOKIE_CROSS_SITE=true              */
/*  app.x.com + api.x.com       -> COOKIE_DOMAIN=.x.com                */
/* ------------------------------------------------------------------ */
const isProd = process.env.NODE_ENV === "production";
const crossSite = process.env.COOKIE_CROSS_SITE === "true";

const ACCESS_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const sharedCookie: CookieOptions = {
  secure: isProd || crossSite, // plain http is fine on localhost in development
  sameSite: crossSite ? "none" : "lax",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};
const ACCESS_COOKIE: CookieOptions = { ...sharedCookie, httpOnly: true, path: "/" };
const REFRESH_COOKIE: CookieOptions = { ...sharedCookie, httpOnly: true, path: "/api/auth" };
const MARKER_COOKIE: CookieOptions = { ...sharedCookie, httpOnly: false, path: "/" };

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("accessToken", accessToken, { ...ACCESS_COOKIE, maxAge: ACCESS_MAX_AGE });
  res.cookie("refreshToken", refreshToken, { ...REFRESH_COOKIE, maxAge: REFRESH_MAX_AGE });
  res.cookie("hasSession", "1", { ...MARKER_COOKIE, maxAge: REFRESH_MAX_AGE });
}

/** path / domain must match the ones used when the cookie was set, or the browser keeps it. */
function clearAuthCookies(res: Response) {
  res.clearCookie("accessToken", ACCESS_COOKIE);
  res.clearCookie("refreshToken", REFRESH_COOKIE);
  res.clearCookie("hasSession", MARKER_COOKIE);
  // the old code set the refresh cookie on path "/": clear that one too
  res.clearCookie("refreshToken", { ...sharedCookie, httpOnly: true, path: "/" });
}

/** Never send the whole document: it contains the password hash and the reset token. */
function toPublicUser(u: {
  _id: unknown;
  username?: string;
  email: string;
  role: string;
  isemailVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    _id: u._id,
    username: u.username,
    email: u.email,
    role: u.role,
    isemailVerified: u.isemailVerified,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

const serverError = (res: Response, error: unknown) => {
  console.error(error); // keep the details in the server log, not in the response
  return res.status(500).json({ success: false, message: "Internal server error" });
};

export async function register(req: Request, res: Response) {
  try {
    const parsed = userRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid data!", error: parsed.error });
    }

    const { username, email, password } = parsed.data;
    const normalisedEmail = email.toLowerCase().trim();

    if (await User.findOne({ email: normalisedEmail })) {
      return res.status(409).json({ success: false, message: "User already exists!" });
    }

    const newUser = await User.create({
      username,
      email: normalisedEmail,
      password: await bcrypt.hash(password, 10),
      role: "user",
    });

    const verifyToken = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET as string, { expiresIn: "1d" });
    const verifyUrl = `${process.env.VITE_FRONTEND_URL}/auth/verify-email?token=${verifyToken}`;

    // don't let a mail failure turn a successful sign-up into an unhandled rejection
    sendVerifyEmail(
      normalisedEmail,
      "Verify your email",
      `<h1>Click the link to verify your email <a href="${verifyUrl}"><button>Verify email</button></a></h1>`,
    ).catch((err) => console.error("Verification email failed:", err));

    return res.status(201).json({
      success: true,
      user: newUser,
      message: "User created and verification URL sent to your email",
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.body as { token?: string };

  try {
    if (!token) {
      return res.status(400).json({ success: false, message: "token is missing" });
    }

    let payload: { id: string };
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    } catch {
      return res.status(400).json({ success: false, message: "Invalid or expired verification link" });
    }

    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "user not found" });
    }

    if (user.isemailVerified) {
      return res.json({ success: false, message: "user already verified" });
    }

    user.isemailVerified = true;
    await user.save();

    return res.status(200).json({ success: true, message: "User is verified" });
  } catch (error) {
    return serverError(res, error);
  }
}

//login user
export async function login(req: Request, res: Response) {
  try {
    const parsed = userLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid data! Email or Password",
        error: parsed.error,
      });
    }

    const { email, password } = parsed.data;
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // same answer for "no such user" and "wrong password": don't reveal which emails exist
    const ok = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !ok) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!user.isemailVerified) {
      return res.status(403).json({ success: false, message: "Please verify your email then login" });
    }

    setAuthCookies(
      res,
      createAccesstoken(user.id, user.role, user.tokenVersion),
      createRefreshtoken(user.id, user.tokenVersion),
    );

    return res.status(200).json({
      success: true,
      message: "Login successfully done",
      user: user,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

//Refresh handler
export async function refreshHandler(req: Request, res: Response) {
  try {
    // Any problem with the refresh token is a 401 (the frontend then signs the user out),
    // and the cookies are cleared so the proxy's hasSession marker doesn't outlive the session.
    const reject = (message: string) => {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message });
    };

    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) return reject("token is missing");

    let payload: { id: string; role: "user" | "admin"; tokenVersion: number };
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as typeof payload;
    } catch {
      return reject("Session expired, please log in again");
    }

    const user = await User.findById(payload.id);
    if (!user || payload.tokenVersion !== user.tokenVersion) {
      return reject("invalid token");
    }

    setAuthCookies(
      res,
      createAccesstoken(user.id, user.role, user.tokenVersion),
      createRefreshtoken(user.id, user.tokenVersion),
    );

    return res.status(200).json({
      success: true,
      message: "Refresh Login successfully done",
      user: user,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookies(res);
  return res.status(200).json({ success: true, message: "User Logged out" });
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const normalisedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalisedEmail });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      user.resetPasswordExpiryDate = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      const resetUrl = `${process.env.VITE_FRONTEND_URL}/auth/reset-password?token=${rawToken}`;
      sendVerifyEmail(
        normalisedEmail,
        "Reset your password",
        `<h1>Click the link to reset your password <a href="${resetUrl}"><button>Reset password</button></a></h1>`,
      ).catch((err) => console.error("Reset email failed:", err));
    }

    // same answer whether or not the account exists
    return res.status(200).json({
      success: true,
      message: "If an account exists for this email, a reset link has been sent",
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token) {
      return res.status(400).json({ message: "Reset token is missing" });
    }
    if (!newPassword) {
      return res.status(400).json({ message: "Please Enter password!" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpiryDate: { $gt: new Date() }, // expiry must be in the future
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiryDate = undefined;
    user.tokenVersion = user.tokenVersion + 1; // signs the user out everywhere
    await user.save();

    return res.json({ message: "Password reset successfully!" });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function googleAuthStart(_req: Request, res: Response) {
  try {
    const client = getGoogleClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["openid", "email", "profile"],
    });

    return res.status(200).json({
      success: true,
      message: "successfully redirect to google login",
      url,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function googleAuthCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      return res.status(400).json({ message: "Missing code in callback" });
    }

    const client = getGoogleClient();

    // Exchange code for tokens, then verify the id_token
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      return res.status(400).json({ message: "No Google id_token found" });
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    if (!email || !payload?.email_verified) {
      return res.status(400).json({ message: "Google email not verified" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      user = await User.create({
        username: payload.name ?? normalizedEmail.split("@")[0],
        email: normalizedEmail,
        password: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
        role: "user",
        isemailVerified: true,
      });
    } else if (!user.isemailVerified) {
      user.isemailVerified = true;
      await user.save();
    }

    setAuthCookies(
      res,
      createAccesstoken(user.id, user.role, user.tokenVersion),
      createRefreshtoken(user.id, user.tokenVersion),
    );

    return res.redirect(`${process.env.VITE_FRONTEND_URL}/dashboard`);
  } catch (error) {
    return serverError(res, error);
  }
}