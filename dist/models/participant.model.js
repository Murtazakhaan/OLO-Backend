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
exports.Participant = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ParticipantSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    fullName: { type: String, required: true },
    ndisNumber: { type: String, required: true },
    dob: { type: Date, required: true },
    address: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    guardianName: String,
    guardianPhone: String,
    guardianEmail: String,
    interests: [String],
    availability: { type: Object, default: {} },
    planManagerName: String,
    planManagerEmail: String,
    fundingType: { type: String, enum: ["plan", "self", "ndia"], required: true },
    isMinor: { type: Boolean, default: false },
    agreement: {
        version: String,
        effectiveDate: Date,
        acknowledged: {
            tos: { type: Boolean, default: false },
            privacy: { type: Boolean, default: false },
            consent: { type: Boolean, default: false },
        },
        signature: {
            dataUrl: String,
            date: Date,
        },
        pdfUrl: String,
    },
    status: {
        type: String,
        enum: ["PENDING", "ACTIVE", "BLOCKED", "DELETED"],
        default: "PENDING",
    },
}, { timestamps: true });
exports.Participant = mongoose_1.default.model("Participant", ParticipantSchema);
