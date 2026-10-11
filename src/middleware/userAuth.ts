import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import UserModel from "../models/user.model.js";

export default async function userAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "You are not authenticated" });
  }

  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      role: "user" | "admin";
      tokenVersion: number;
    };

    const user = await UserModel.findById(payload.id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ message: "Token invalidated" });
    }

    const authReq = req as any; // request ke ander user ko attach kar raha hu
    authReq.user = {
      id: user._id,
      email: user.email,
      name: user.username,
      role: user.role,
      isemailVerified: user.isemailVerified,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}
