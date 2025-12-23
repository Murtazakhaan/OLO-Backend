"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTrainerStatus = exports.getAllTrainers = exports.getTrainerByUserId = exports.upsertTrainerProfile = void 0;
const user_model_1 = require("../models/user.model");
const trainer_model_1 = require("../models/trainer.model");
const errors_1 = require("../utils/errors");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const email_1 = require("../utils/email");
// helper to save signature PNG
const saveSignature = (userId, dataUrl) => {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `${userId}-trainer-signature-${Date.now()}.png`;
    const dirPath = path_1.default.join(__dirname, "../../uploads/signatures");
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path_1.default.join(dirPath, fileName);
    fs_1.default.writeFileSync(filePath, buffer);
    // return relative path for client
    return `/uploads/signatures/${fileName}`;
};
// Create / update trainer profile
const upsertTrainerProfile = async (userId, data) => {
    if (!userId) {
        // Step 1 — create new user + trainer
        const existing = await user_model_1.User.findOne({ email: data.email });
        if (existing) {
            throw new Error("Email already in use");
        }
        const user = await user_model_1.User.create({
            email: data.email,
            password: "",
            role: "TRAINER",
            status: "PENDING",
        });
        const trainer = await trainer_model_1.Trainer.create({
            userId: user._id,
            fullName: data.fullName,
            phone: data.phone,
            address: data.address,
            onboardingStep: 1,
        });
        return { user, trainer };
    }
    // Step 2+ — update existing trainer by userId
    const trainer = await trainer_model_1.Trainer.findOne({ userId });
    if (!trainer)
        throw new errors_1.NotFoundError("Trainer");
    // ✅ Merge documents if provided
    if (data.documents) {
        trainer.documents = {
            ...trainer.documents,
            ...data.documents,
        };
        delete data.documents;
    }
    // ✅ Handle agreement + signature if provided
    // ✅ Handle agreement + signature if provided
    if (data.agreement) {
        if (data.agreement.signature?.dataUrl) {
            const url = saveSignature(trainer.userId.toString(), data.agreement.signature.dataUrl);
            data.agreement.signature = {
                dataUrl: url,
                date: new Date(data.agreement.signature.date), // ensure Date
            };
        }
        trainer.agreement = {
            ...trainer.agreement,
            ...data.agreement,
        };
        delete data.agreement;
    }
    // ✅ Assign remaining fields
    Object.assign(trainer, data);
    // advance onboarding step
    trainer.onboardingStep = (trainer.onboardingStep || 0) + 1;
    await trainer.save();
    const user = await user_model_1.User.findById(trainer.userId).select("id email role status");
    return { user, trainer };
};
exports.upsertTrainerProfile = upsertTrainerProfile;
// Get trainer by userId (manual join with User)
const getTrainerByUserId = async (userId) => {
    const trainer = await trainer_model_1.Trainer.findOne({ userId }).populate("userId", "id email role status");
    if (!trainer) {
        throw new errors_1.NotFoundError("Trainer");
    }
    return trainer;
};
exports.getTrainerByUserId = getTrainerByUserId;
const getAllTrainers = async (params) => {
    const { page = 1, limit = 10, q, email, status } = params;
    const match = { role: "TRAINER" };
    if (status) {
        match.status = status;
    }
    if (email) {
        match.email = { $regex: email, $options: "i" };
    }
    if (q) {
        match.$or = [
            { email: { $regex: q, $options: "i" } },
            { "trainer.fullName": { $regex: q, $options: "i" } },
            { "trainer.phone": { $regex: q, $options: "i" } },
            { "trainer.address": { $regex: q, $options: "i" } },
            { "trainer.specialisations": { $regex: q, $options: "i" } },
        ];
    }
    const skip = (page - 1) * limit;
    const pipeline = [
        { $match: match },
        {
            $lookup: {
                from: "trainers",
                localField: "_id",
                foreignField: "userId",
                as: "trainer",
            },
        },
        { $unwind: { path: "$trainer", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                email: 1,
                role: 1,
                status: 1,
                createdAt: 1,
                trainer: 1, // ✅ include the entire trainer object
            },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
    ];
    const [data, totalCount] = await Promise.all([
        user_model_1.User.aggregate(pipeline),
        user_model_1.User.countDocuments({ role: "TRAINER", ...(status ? { status } : {}) }),
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
exports.getAllTrainers = getAllTrainers;
/**
 * Update a trainer's status (via User collection)
 * @param id userId of trainer
 * @param status new status string
 */
/**
 * Update a trainer's status and notify them by email
 */
const updateTrainerStatus = async (id, status) => {
    const user = await user_model_1.User.findById(id).select("_id email role status password");
    if (!user) {
        throw new errors_1.NotFoundError("User");
    }
    // update status
    user.status = status;
    await user.save();
    // ✅ Email content mapping
    const subjects = {
        ACTIVE: "Your Trainer Account Has Been Activated 🎉",
        PENDING: "Your Trainer Account is Pending Review",
        BLOCKED: "Your Trainer Account Has Been Blocked",
        DELETED: "Your Trainer Account Has Been Deleted",
    };
    const messages = {
        ACTIVE: `
      <p>Hello,</p>
      <p>Good news! Your trainer account has been <b>activated</b>.</p>
      <p>You can now log in and start using the platform.</p>
      <p>Best regards,<br/>CareLink Team</p>
    `,
        PENDING: `
      <p>Hello,</p>
      <p>Your trainer account is currently <b>pending review</b>.</p>
      <p>We’ll notify you once it’s activated.</p>
      <p>Best regards,<br/>CareLink Team</p>
    `,
        BLOCKED: `
      <p>Hello,</p>
      <p>Unfortunately, your trainer account has been <b>blocked</b>.</p>
      <p>If you believe this is a mistake, please contact support.</p>
      <p>Best regards,<br/>CareLink Team</p>
    `,
        DELETED: `
      <p>Hello,</p>
      <p>Your trainer account has been <b>deleted</b>.</p>
      <p>If you need further assistance, please reach out to support.</p>
      <p>Best regards,<br/>CareLink Team</p>
    `,
    };
    // ✅ Special case: ACTIVE but no password → send create-login link
    if (status === "ACTIVE" && !user.password) {
        const createLoginUrl = `${process.env.FRONTEND_URL}/auth/register/trainer/create-login?email=${encodeURIComponent(user.email)}`;
        await (0, email_1.sendEmail)(user.email, "Activate Your CareLink Account 🎉", `
        <p>Hello,</p>
        <p>Your trainer account has been <b>activated</b>, but you still need to create your login.</p>
        <p><a href="${createLoginUrl}" style="padding:10px 16px; background:#1976d2; color:#fff; text-decoration:none; border-radius:6px;">Create Login</a></p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,<br/>CareLink Team</p>
      `);
        return user;
    }
    // ✅ Default flow
    if (subjects[status] && messages[status]) {
        try {
            await (0, email_1.sendEmail)(user.email, subjects[status], messages[status]);
        }
        catch (err) {
            console.error("Failed to send email:", err);
        }
    }
    return user;
};
exports.updateTrainerStatus = updateTrainerStatus;
