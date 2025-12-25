"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getMe = exports.login = exports.setPassword = void 0;
const AuthService = __importStar(require("../services/auth.service"));
const response_1 = require("../utils/response");
const errors_1 = require("../utils/errors");
const setPassword = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new errors_1.AppError("email and password are required", 400);
    }
    const result = await AuthService.setPasswordForUser(email, password);
    return (0, response_1.success)(res, result, "Password set successfully, login created");
};
exports.setPassword = setPassword;
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new errors_1.AppError("Email and password are required", 400);
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
    return (0, response_1.success)(res, result, "Login successful");
};
exports.login = login;
const getMe = async (req, res) => {
    if (!req.user) {
        throw new errors_1.AuthError("Invalid token or missing token");
    }
    const user = await AuthService.getUserById(req.user.userId);
    return (0, response_1.success)(res, user, "User profile fetched successfully");
};
exports.getMe = getMe;
const logout = async (req, res) => {
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
    return (0, response_1.success)(res, {}, "Logged out successfully");
};
exports.logout = logout;
