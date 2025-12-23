"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errors_1 = require("../utils/errors");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const authenticate = (req, res, next) => {
    let token = null;
    // 🔹 Get token from Authorization header: "Bearer <token>"
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }
    // 🔹 Or from cookie if you set cookie in login controller
    if (!token && req.cookies?.carelink_access_token) {
        token = req.cookies.carelink_access_token;
    }
    if (!token) {
        throw new errors_1.AppError("Not authorized, no token provided", 401);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = { userId: decoded.userId, role: decoded.role };
        next();
    }
    catch (err) {
        throw new errors_1.AppError("Not authorized, invalid token", 401);
    }
};
exports.authenticate = authenticate;
// Optional role-based authorization
const authorize = (...roles) => (req, res, next) => {
    if (!req.user) {
        throw new errors_1.AppError("Not authorized", 401);
    }
    if (!roles.includes(req.user.role)) {
        throw new errors_1.AppError("Forbidden: insufficient permissions", 403);
    }
    next();
};
exports.authorize = authorize;
