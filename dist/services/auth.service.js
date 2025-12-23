"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = exports.loginUser = exports.setPasswordForUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const errors_1 = require("../utils/errors");
const user_model_1 = require("../models/user.model");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const participant_model_1 = require("../models/participant.model");
const trainer_model_1 = require("../models/trainer.model");
const setPasswordForUser = async (email, password) => {
    const user = await user_model_1.User.findOne({ email });
    if (!user)
        throw new errors_1.NotFoundError("User");
    // Hash password
    const salt = await bcryptjs_1.default.genSalt(10);
    user.password = await bcryptjs_1.default.hash(password, salt);
    // Activate account if still pending
    if (user.status === "PENDING") {
        user.status = "ACTIVE";
    }
    await user.save();
    return {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
    };
};
exports.setPasswordForUser = setPasswordForUser;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const JWT_EXPIRES_IN = "7d"; // adjust as needed
const loginUser = async (email, password) => {
    const user = await user_model_1.User.findOne({ email });
    if (!user)
        throw new errors_1.NotFoundError("User", "Invalid email or password!");
    if (!user.password) {
        throw new errors_1.AppError("Your account is under verification process, you'll be notify soon by admin", 400);
    }
    const isMatch = await bcryptjs_1.default.compare(password, user.password);
    if (!isMatch) {
        throw new errors_1.AuthError("Invalid email or password!");
    }
    switch (user.status) {
        case "ACTIVE":
            // allow login
            break;
        case "PENDING":
            throw new errors_1.AppError("Account is pending activation. Please complete setup.", 403);
        case "BLOCKED":
            throw new errors_1.AppError("Account has been blocked. Contact support.", 403);
        case "DELETED":
            throw new errors_1.AppError("Account has been deleted.", 403);
        default:
            throw new errors_1.AppError("Account status invalid. Contact support.", 403);
    }
    const token = jsonwebtoken_1.default.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return {
        token,
        user: {
            id: user._id,
            email: user.email,
            role: user.role,
            status: user.status,
        },
    };
};
exports.loginUser = loginUser;
const getUserById = async (userId) => {
    const user = await user_model_1.User.findById(userId).select("_id email role status createdAt updatedAt");
    if (!user)
        throw new errors_1.NotFoundError("User");
    let name = null;
    let trainer = null;
    let participant = null;
    // Role-specific fetch (full details)
    if (user.role === "TRAINER") {
        trainer = await trainer_model_1.Trainer.findOne({ userId: user._id }).lean(); // full doc
        if (trainer) {
            name = trainer.fullName || user.email || null;
        }
        else {
            name = user.email || null;
        }
    }
    else if (user.role === "PARTICIPANT") {
        participant = await participant_model_1.Participant.findOne({ userId: user._id }).lean(); // full doc
        if (participant) {
            name = participant.fullName || user.email || null;
        }
        else {
            name = user.email || null;
        }
    }
    else {
        // other roles (admin, etc.) keep existing behavior: only user + name=fallback
        name = user.email || null;
    }
    return {
        ...user.toObject(), // preserves existing shape
        name,
        // new optional role-specific payloads (non-breaking additions)
        trainer: user.role === "TRAINER" ? trainer : undefined,
        participant: user.role === "PARTICIPANT" ? participant : undefined,
    };
};
exports.getUserById = getUserById;
