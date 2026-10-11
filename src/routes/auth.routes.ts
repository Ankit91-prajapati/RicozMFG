import { Router } from "express"
import { forgotPassword, googleAuthCallback, googleAuthStart, login, logout, refreshHandler, register, resetPassword, verifyEmail } from "../controllers/web/auth.controller.js"
const authRouter = Router()

authRouter.post("/register", register)
authRouter.post("/verify-email", verifyEmail)
authRouter.post("/login" , login)
authRouter.post("/refresh" , refreshHandler)
authRouter.post("/logout" , logout)
authRouter.post("/forgot-password" ,forgotPassword)
authRouter.post("/reset-password" , resetPassword)
authRouter.get("/google" , googleAuthStart)
authRouter.get("/google/callback" ,googleAuthCallback)

export default authRouter