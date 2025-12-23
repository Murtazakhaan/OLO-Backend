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
exports.ShiftRequest = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ShiftRequestSchema = new mongoose_1.Schema({
    participantId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User", // ✅ directly references User table
        required: true,
        index: true,
    },
    requestedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    service: { type: String, required: true, index: true },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    notes: { type: String, trim: true },
    preferredTrainerIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Trainer" }],
    status: {
        type: String,
        enum: [
            "PENDING_ADMIN",
            "APPROVED",
            "DECLINED",
            "CANCELLED",
            "IN_PROGRESS",
            "COMPLETED",
        ],
        default: "PENDING_ADMIN",
        index: true,
    },
    assignedTrainerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Trainer",
        default: null,
    },
    linkedShiftId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Shift",
        default: null,
    },
    adminComment: { type: String, trim: true, default: null },
}, { timestamps: true });
/**
 * Indexes
 */
ShiftRequestSchema.index({ participantId: 1, start: 1, end: 1 });
ShiftRequestSchema.index({ status: 1, start: 1 });
ShiftRequestSchema.index({ assignedTrainerId: 1, status: 1 });
ShiftRequestSchema.index({ linkedShiftId: 1 });
/**
 * Virtuals for cleaner API responses
 */
ShiftRequestSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    },
});
/**
 * Export model (safe reload for dev hot-modules)
 */
exports.ShiftRequest = mongoose_1.default.models.ShiftRequest ||
    mongoose_1.default.model("ShiftRequest", ShiftRequestSchema);
