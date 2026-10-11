import type { Request, Response } from "express";
import { userLoginSchema, userRegisterSchema } from "./auth.schema.js";
import UserModel from "../../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sendVerifyEmail from "../../lib/email.js";

import createAccesstoken from "../../lib/createAccesstoken.js";
import createRefreshtoken from "../../lib/createRefreshtoken.js";
import crypto from "crypto";

import getGoogleClient from "../../lib/getGoogleClient.js";



export async function register(req: Request, res: Response) {
  try {
    const user = userRegisterSchema.safeParse(req.body);

    if (!user.success) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid data!", error: user.error });
    }

    const { username, email, password } = user.data;
    const normalisedEmail = email.toLowerCase().trim();
    const existingUser = await UserModel.findOne({ email: normalisedEmail });

    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "User alreay exists!" });
    }
    const HashPassword = await bcrypt.hash(password, 10);
    const newlyCreatedUser = await UserModel.create({
      username,
      email: normalisedEmail,
      password: HashPassword,
      role: "user",
    });

    const verifyToken = jwt.sign(
      { id: newlyCreatedUser.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );
    const verify = `${process.env.VITE_FRONTEND_URL}/auth/verify-email?token=${verifyToken}`;

    sendVerifyEmail(
      normalisedEmail,
      "Verify your email",
      `<h1>click Link to verify <a href="${verify}"><button> ${verify} </button></a>   </h1>`
    );
    return res.status(201).json({
      success: true,
      user: newlyCreatedUser,
      message: "User created and verification URL send to your email",
     
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  console.log(req.body);
  const { token } = req.body;

  try {
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "token is missing" });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };

    const user = await UserModel.findById(payload.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "user not found" });
    }

    if (user.isemailVerified) {
      return res.json({ success: false, message: "user already verified" });
    }

    user.isemailVerified = true;
    await user.save();

    return res.status(200).json({ success: true, message: "User is verified" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error });
  }
}



//login user
export async function login(req: Request, res: Response) {
  try {
    const user = userLoginSchema.safeParse(req.body);

    if (!user.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid data! Email or Password",
        error: user.error,
      });
    }

    const { email, password } = user.data;
    const normalisedEmail = email.toLowerCase().trim();

    const userExist = await UserModel.findOne({ email: normalisedEmail });
    if (!userExist) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    const ok = await bcrypt.compare(password, userExist.password);
    if (!ok) {
      return res.status(400).json({
        success: false,
        message: "Invalid password",
      });
    }

    if (!userExist.isemailVerified) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email then login",
      });
    }

    const accessToken = createAccesstoken(
      userExist.id,
      userExist.role,
      userExist.tokenVersion
    );

    const refreshToken = createRefreshtoken(
      userExist.id,
      userExist.tokenVersion
    );

    const isProd = process.env.NODE_ENV === "production";

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
      path:"/"
    });

    // ✅ Refresh Token Cookie (LONG LIFE)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path:"/"
    });

    return res.status(200).json({
      success: true,
      message: "Login successfully done",
      user: userExist,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error,
    });
  }
}



//Refresh handler
export async function refreshHandler(req: Request, res: Response) {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "token is missing" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      role: "user" | "admin";
      tokenVersion: number;
    };

    const user = await UserModel.findById(payload.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "user not  found" });
    }

    if (payload.tokenVersion !== user.tokenVersion) {
      return res.status(400).json({ success: false, message: "invalid token" });
    }

    const accessToken = createAccesstoken(
      user.id,
      user.role,
      user.tokenVersion
    );
    const refreshToken = createRefreshtoken(user.id, user.tokenVersion);

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 15 * 60 * 100,
      path:"/",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path:"/"

    });

    return res.status(200).json({
      success: true,
      message: " Refresh Login successfully done",
      user: user,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error });
  }
}

export async function logout(req: Request, res: Response) {
 const isProd = process.env.NODE_ENV === "production";
 res.clearCookie("accessToken", {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
});


res.clearCookie("refreshToken", {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
});
 
  return res.status(200).json({
    success: true,
    message: " User Logged out",
  });
}



export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email are required" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User  not found with this email" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const rawHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordToken = rawHash;
    user.resetPasswordExpiryDate = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.VITE_FRONTEND_URL}/auth/reset-password?token=${rawToken}`;
    sendVerifyEmail(
      email,
      "Verify your email",
      `<h1>click Link to verify <a href="${resetUrl}"><button>click here to verify email </button></a>   </h1>`
    );

    return res.status(200).json({
      success: true,
      message: "verification mail sent  to your Email",
      
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error });
  }
}



export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body as {
      token?: string;
      newPassword: string;
    };
    if (!token) {
      return res.status(400).json({ message: "Reset token is missing" });
    }

    if (!newPassword) {
      return res.status(400).json({ message: "Please Enter password!" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await UserModel.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpiryDate: { $gt: new Date() }, // expiry must be in future
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiryDate = undefined;
    user.tokenVersion = user.tokenVersion + 1;
    await user.save();
    return res.json({
      message: "Password reset successfully!",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function googleAuthStart(req: Request, res: Response) {
  try {
    const client = getGoogleClient();

    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["openid", "email", "profile"],
    });

    console.log(url);
    return res.status(200).json({
      success: true,
      message: "successfully redirect to google login",
      url: url,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

export async function googleAuthCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string | undefined;

    if (!code) {
      return res.status(400).json({
        message: "Missing code in callback",
      });
    }

    const client = getGoogleClient();

    // 🔄 Exchange code for tokens
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      return res.status(400).json({
        message: "No Google id_token found",
      });
    }

    // ✅ Verify token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const emailVerified = payload?.email_verified;

    if (!email || !emailVerified) {
      return res.status(400).json({
        message: "Google email not verified",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 🔍 Check user in DB
    let user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
      // 🆕 Create new user
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = await UserModel.create({
        username: payload?.name ?? normalizedEmail.split("@")[0],
        email: normalizedEmail,
        password: passwordHash,
        role: "user",
        isemailVerified: true,
      });
    } else {
      // 🔄 Update existing user
      if (!user.isemailVerified) {
        user.isemailVerified = true;
        await user.save();
      }
    }

    const accessToken = createAccesstoken(
      user.id,
      user.role as "user" | "admin",
      user.tokenVersion
    );

    const refreshToken = createRefreshtoken(user.id, user.tokenVersion);

    const isProd = process.env.NODE_ENV === "production";

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 15 * 60 * 100,
      path:"/",
    });

    // 🍪 Set cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    // 📤 Response
    // return res.status(200).json({
    //   message: "Google login successful",
    //   user: {
    //     id: user.id,
    //     email: user.email,
    //     role: user.role,
    //     isemailVerified: user.isemailVerified,
    //   },
    //  });
    return res.redirect(`${process.env.VITE_FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error("Google Auth Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
