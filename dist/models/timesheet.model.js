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
exports.Timesheet = void 0;
// models/timesheet.model.ts
const mongoose_1 = __importStar(require("mongoose"));
const TimesheetItemSchema = new mongoose_1.Schema({
    shiftId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Shift", required: true },
    participantId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Participant", required: true },
    date: { type: Date, required: true },
    service: { type: String, required: true },
    hours: { type: Number, required: true },
    km: { type: Number, default: 0 },
    amountCents: { type: Number, required: true },
    mileageCents: { type: Number, default: 0 },
    totalCents: { type: Number, required: true },
}, { _id: false });
const TimesheetSchema = new mongoose_1.Schema({
    trainerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Trainer", required: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    status: { type: String, enum: ["DRAFT", "SUBMITTED", "APPROVED", "PAID", "REOPENED"], default: "DRAFT" },
    items: { type: [TimesheetItemSchema], default: [] },
    totals: {
        hours: { type: Number, default: 0 },
        km: { type: Number, default: 0 },
        amountCents: { type: Number, default: 0 },
        mileageCents: { type: Number, default: 0 },
        totalCents: { type: Number, default: 0 },
    },
}, { timestamps: true });
TimesheetSchema.index({ trainerId: 1, weekStart: 1 }, { unique: true });
exports.Timesheet = mongoose_1.default.model("Timesheet", TimesheetSchema);
