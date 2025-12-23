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
exports.Shift = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ShiftSchema = new mongoose_1.Schema({
    shiftRequestId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "ShiftRequest",
        required: true,
        index: true,
    },
    participantId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    trainerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Trainer",
        required: true,
        index: true,
    },
    service: { type: String, required: true },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    scheduledDurationMinutes: { type: Number, required: true },
    actualClockIn: { type: Date, required: true },
    plannedClockOut: { type: Date, required: true },
    actualClockOut: { type: Date, default: null },
    status: {
        type: String,
        enum: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
        default: "IN_PROGRESS",
        index: true,
    },
    report: {
        activities: { type: String, trim: true },
        progress: { type: String, trim: true },
        incidents: { type: String, trim: true },
        km: { type: Number, default: 0 },
    },
}, { timestamps: true });
/** Useful compound indexes for cron + analytics */
ShiftSchema.index({ status: 1, plannedClockOut: 1 });
ShiftSchema.index({ trainerId: 1, status: 1 });
ShiftSchema.index({ participantId: 1, status: 1 });
exports.Shift = mongoose_1.default.model("Shift", ShiftSchema);
