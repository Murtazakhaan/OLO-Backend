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
exports.updateTrainerStatus = exports.getAllTrainers = exports.getTrainer = exports.upsertTrainer = void 0;
const trainer_validators_1 = require("../validators/trainer.validators");
const TrainerService = __importStar(require("../services/trainer.service"));
const errors_1 = require("../utils/errors");
const response_1 = require("../utils/response");
// config
const MAX_SIZE_MB = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const zod_1 = require("zod");
const upsertTrainer = async (req, res) => {
    // ✅ Validate uploaded docs if present
    if (req.files && Object.keys(req.files).length > 0) {
        req.body.documents = {};
        for (const [key, files] of Object.entries(req.files)) {
            const file = files[0];
            if (!ACCEPTED_TYPES.includes(file.mimetype)) {
                throw new errors_1.AppError(`Invalid file type for ${key}. Only JPG, PNG, PDF allowed.`, 400);
            }
            if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                throw new errors_1.AppError(`File too large for ${key}. Max ${MAX_SIZE_MB} MB allowed.`, 400);
            }
            req.body.documents[key] = {
                filePath: `/uploads/documents/${file.filename}`,
                originalName: file.originalname,
                expiry: req.body[`${key}Expiry`] || null,
            };
        }
    }
    // 🔹 Parse JSON fields if they come as strings from FormData
    try {
        if (req.body.availability && typeof req.body.availability === "string") {
            req.body.availability = JSON.parse(req.body.availability);
        }
        if (req.body.travelAreas && typeof req.body.travelAreas === "string") {
            req.body.travelAreas = JSON.parse(req.body.travelAreas);
        }
        if (req.body.specialisations && typeof req.body.specialisations === "string") {
            req.body.specialisations = JSON.parse(req.body.specialisations);
        }
        if (req.body.agreement && typeof req.body.agreement === "string") {
            req.body.agreement = JSON.parse(req.body.agreement);
        }
    }
    catch {
        throw new errors_1.AppError("Invalid JSON format in payload", 400);
    }
    const isSignupCompleted = typeof req.body.signup === "string" &&
        req.body.signup.toLowerCase() === "completed";
    // ✅ If signup is completed, skip step-number requirement and step schema
    let payload;
    if (isSignupCompleted) {
        // Keep it simple & safe: only allow the editable fields you expect from the profile page.
        // (No need to change your existing step schemas.)
        const patch = {
            fullName: req.body.fullName,
            address: req.body.address,
            travelAreas: req.body.travelAreas,
            specialisations: req.body.specialisations,
            availability: req.body.availability,
            documents: req.body.documents, // allow doc uploads from profile
            signup: "completed",
        };
        // Optional tiny validation without touching your step schemas:
        // (all optional; you can remove this if you truly want zero extra validation)
        const Slot = zod_1.z.object({ start: zod_1.z.string().min(1), end: zod_1.z.string().min(1) });
        const PatchSchema = zod_1.z.object({
            fullName: zod_1.z.string().trim().min(1).optional(),
            address: zod_1.z.string().trim().optional(),
            travelAreas: zod_1.z.array(zod_1.z.string().trim().min(1)).optional(),
            specialisations: zod_1.z.array(zod_1.z.string().trim().min(1)).optional(),
            availability: zod_1.z.record(zod_1.z.string(), zod_1.z.array(Slot)).optional(),
            documents: zod_1.z.record(zod_1.z.any()).optional(),
            signup: zod_1.z.literal("completed"),
        });
        const parsed = PatchSchema.safeParse(patch);
        if (!parsed.success) {
            throw new errors_1.ValidationError(parsed.error.flatten());
        }
        payload = parsed.data;
        // Ensure we never write/advance step in this mode
        delete payload.step;
    }
    else {
        // 🔁 Normal wizard flow (keep your existing schemas exactly as-is)
        const step = Number(req.body.step);
        if (isNaN(step))
            throw new errors_1.AppError("Invalid step", 400);
        const schemaMap = {
            1: trainer_validators_1.trainerStep1Schema,
            2: trainer_validators_1.trainerStep2Schema,
            3: trainer_validators_1.trainerStep3Schema,
            4: trainer_validators_1.trainerStep4Schema,
            5: trainer_validators_1.trainerStep5Schema,
        };
        const schema = schemaMap[step];
        if (!schema)
            throw new errors_1.AppError("Invalid step", 400);
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            throw new errors_1.ValidationError(parsed.error.flatten());
        }
        payload = parsed.data;
    }
    const result = await TrainerService.upsertTrainerProfile(req.user?.userId || req.body?.userId || null, payload);
    return (0, response_1.success)(res, result, isSignupCompleted ? "Trainer profile updated" : "Trainer onboarding updated");
};
exports.upsertTrainer = upsertTrainer;
const getTrainer = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const trainer = await TrainerService.getTrainerByUserId(userId);
    return (0, response_1.success)(res, trainer, "Trainer profile fetched successfully");
};
exports.getTrainer = getTrainer;
const getAllTrainers = async (req, res) => {
    const { page, limit, q, email, status } = req.query;
    const result = await TrainerService.getAllTrainers({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        q,
        email,
        status,
    });
    return (0, response_1.success)(res, result, "Trainers fetched successfully");
};
exports.getAllTrainers = getAllTrainers;
const updateTrainerStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const user = await TrainerService.updateTrainerStatus(id, status);
    return (0, response_1.success)(res, user, "Trainer status updated successfully");
};
exports.updateTrainerStatus = updateTrainerStatus;
