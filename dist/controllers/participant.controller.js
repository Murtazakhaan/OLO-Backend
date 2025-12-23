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
exports.getAllParticipantsController = exports.getParticipant = exports.upsertParticipant = void 0;
const ParticipantService = __importStar(require("../services/participant.service"));
const response_1 = require("../utils/response");
// NOTE: Add Zod/Yup validators for step-specific payloads later
// For now, just accept body and trust frontend schema
const upsertParticipant = async (req, res) => {
    // 🔹 Ensure step is numeric if included
    let step = Number(req.body.step || 1);
    if (isNaN(step))
        step = 1;
    // TODO: add schema validation like trainer.validators.ts
    // const schema = participantStepSchemas[step];
    // const parsed = schema.safeParse(req.body);
    // if (!parsed.success) throw new ValidationError(parsed.error.flatten());
    const result = await ParticipantService.upsertParticipantProfile(req.user?.userId || req.body?.userId || null, req.body // replace with parsed.data once schema is ready
    );
    return (0, response_1.success)(res, result, "Participant onboarding updated");
};
exports.upsertParticipant = upsertParticipant;
const getParticipant = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const participant = await ParticipantService.getParticipantByUserId(userId);
    return (0, response_1.success)(res, participant, "Participant profile fetched successfully");
};
exports.getParticipant = getParticipant;
const getAllParticipantsController = async (req, res) => {
    const { page, limit, q, email, status } = req.query;
    const result = await ParticipantService.getAllParticipants({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        q,
        email,
        status,
    });
    return (0, response_1.success)(res, result, "Trainers fetched successfully");
};
exports.getAllParticipantsController = getAllParticipantsController;
