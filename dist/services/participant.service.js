"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllParticipants = exports.getParticipantByUserId = exports.upsertParticipantProfile = void 0;
const user_model_1 = require("../models/user.model");
const participant_model_1 = require("../models/participant.model");
const errors_1 = require("../utils/errors");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// helper to save signature PNG
const saveSignature = (userId, dataUrl) => {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `${userId}-signature-${Date.now()}.png`;
    const dirPath = path_1.default.join(__dirname, "../../uploads/signatures");
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path_1.default.join(dirPath, fileName);
    fs_1.default.writeFileSync(filePath, buffer);
    // return relative path for client
    return `/uploads/signatures/${fileName}`;
};
// Create or update participant profile
const upsertParticipantProfile = async (userId, data) => {
    if (!userId) {
        // If no userId, try to find by email
        if (!data.email) {
            throw new Error("Email is required for onboarding without userId");
        }
        const existingUser = await user_model_1.User.findOne({ email: data.email });
        if (!existingUser) {
            // Step 1 — create new user + participant
            const user = await user_model_1.User.create({
                email: data.email,
                password: "", // will be set at Step 3: Create Login
                role: "PARTICIPANT",
                status: "PENDING",
            });
            const participant = await participant_model_1.Participant.create({
                userId: user._id,
                fullName: data.fullName,
                ndisNumber: data.ndisNumber,
                dob: data.dob,
                address: data.address,
                email: data.email,
                phone: data.phone,
                guardianName: data.guardianName,
                guardianPhone: data.guardianPhone,
                guardianEmail: data.guardianEmail,
                interests: data.interests || [],
                availability: data.availability || {},
                planManagerName: data.planManagerName,
                planManagerEmail: data.planManagerEmail,
                fundingType: data.fundingType,
                isMinor: data.isMinor || false,
                status: "PENDING",
            });
            return { user, participant };
        }
        // Step 2+ — update existing participant by email
        const participant = await participant_model_1.Participant.findOne({ email: data.email });
        if (!participant)
            throw new errors_1.NotFoundError("Participant");
        // handle signature
        if (data.agreement?.signature?.dataUrl) {
            const url = saveSignature(participant.userId.toString(), data.agreement.signature.dataUrl);
            data.agreement.signature = {
                url,
                date: data.agreement.signature.date,
            };
        }
        Object.assign(participant, data);
        await participant.save();
        const user = await user_model_1.User.findById(participant.userId).select("id email role status");
        return { user, participant };
    }
    // Step 2+ — update existing participant by userId
    const participant = await participant_model_1.Participant.findOne({ userId });
    if (!participant)
        throw new errors_1.NotFoundError("Participant");
    // handle signature
    if (data.agreement?.signature?.dataUrl) {
        const url = saveSignature(participant.userId.toString(), data.agreement.signature.dataUrl);
        data.agreement.signature = {
            url,
            date: data.agreement.signature.date,
        };
    }
    Object.assign(participant, data);
    await participant.save();
    const user = await user_model_1.User.findById(participant.userId).select("id email role status");
    return { user, participant };
};
exports.upsertParticipantProfile = upsertParticipantProfile;
// Get participant by userId
const getParticipantByUserId = async (userId) => {
    const participant = await participant_model_1.Participant.findOne({ userId }).populate("userId", "id email role status");
    if (!participant) {
        throw new errors_1.NotFoundError("Participant");
    }
    return participant;
};
exports.getParticipantByUserId = getParticipantByUserId;
const getAllParticipants = async (params) => {
    const { page = 1, limit = 10, q, email, status } = params;
    // Filter on the User document (role + optional status/email)
    const match = { role: "PARTICIPANT" };
    if (status)
        match.status = status;
    if (email)
        match.email = { $regex: email, $options: "i" };
    // Text search across User + Participant fields
    if (q) {
        match.$or = [
            { email: { $regex: q, $options: "i" } }, // User.email
            { "participant.fullName": { $regex: q, $options: "i" } },
            { "participant.phone": { $regex: q, $options: "i" } },
            { "participant.address": { $regex: q, $options: "i" } },
            { "participant.ndisNumber": { $regex: q, $options: "i" } },
            { "participant.guardianName": { $regex: q, $options: "i" } },
            { "participant.guardianEmail": { $regex: q, $options: "i" } },
            { "participant.fundingType": { $regex: q, $options: "i" } },
            { "participant.interests": { $regex: q, $options: "i" } },
        ];
    }
    const skip = (page - 1) * limit;
    const pipeline = [
        { $match: match },
        {
            $lookup: {
                from: "participants", // <-- model Participant => collection "participants"
                localField: "_id",
                foreignField: "userId",
                as: "participant",
            },
        },
        { $unwind: { path: "$participant", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                email: 1,
                role: 1,
                status: 1, // User.status
                createdAt: 1,
                participant: 1, // include full participant object
            },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
    ];
    const [data, totalCount] = await Promise.all([
        user_model_1.User.aggregate(pipeline),
        user_model_1.User.countDocuments({ role: "PARTICIPANT", ...(status ? { status } : {}) }),
    ]);
    return {
        data,
        pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
        },
    };
};
exports.getAllParticipants = getAllParticipants;
