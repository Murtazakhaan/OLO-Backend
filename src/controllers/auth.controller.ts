import { Request, Response } from "express";
import * as AuthService from "../services/auth.service";
import { success } from "../utils/response";
import { AppError, AuthError } from "../utils/errors";
import { AuthRequest } from "../middleware/auth";

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  await AuthService.sendForgotPasswordCode(email);

  return success(res, {}, "If an account exists for this email, a verification code has been sent.");
};

export const verifyResetCode = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    throw new AppError("Email and code are required", 400);
  }

  await AuthService.verifyResetCode(email, code);

  return success(res, {}, "Verification code is valid");
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, code, password } = req.body;

  if (!email || !code || !password) {
    throw new AppError("Email, code and password are required", 400);
  }

  const result = await AuthService.resetPasswordWithCode(email, code, password);

  return success(res, result, "Password reset successfully");
};

export const setPassword = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("email and password are required", 400);
  }

  const result = await AuthService.setPasswordForUser(email, password);

  return success(res, result, "Password set successfully, login created");
};



export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const result = await AuthService.loginUser(email, password);

  // Cross-site auth cookie
  const isProd = process.env.NODE_ENV === "production";
  const cookieDomain = isProd ? process.env.COOKIE_DOMAIN : undefined;
  res.cookie("carelink_access_token", result.token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    domain: cookieDomain,
  });

  return success(res, result, "Login successful");
};


export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError("Invalid token or missing token");
  }

  const user = await AuthService.getUserById(req.user.userId);
  return success(res, user, "User profile fetched successfully");
};


export const logout = async (req: Request, res: Response) => {

  // Clear auth cookie
 const isProd = process.env.NODE_ENV === "production";
  const cookieDomain = isProd ? process.env.COOKIE_DOMAIN : undefined;
  res.clearCookie("carelink_access_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    domain: cookieDomain
  });

  return success(res, {}, "Logged out successfully");
};
