"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminDashboardSummary = exports.getTrainerShiftSummary = exports.listPastShiftsWithTimesheets = exports.upsertTimesheetForShift = exports.clockOutShiftAsTrainer = exports.clockInShiftAsTrainer = exports.listMine = exports.listForTrainer = exports.listForParticipant = exports.decline = exports.approveAndAssign = exports.listForAdmin = exports.createShiftRequest = void 0;
const errors_1 = require("../utils/errors");
const shiftRequest_model_1 = require("../models/shiftRequest.model");
const participant_model_1 = require("../models/participant.model");
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../models/user.model");
const trainer_model_1 = require("../models/trainer.model");
const email_1 = require("../utils/email");
const date_fns_1 = require("date-fns");
const shift_model_1 = require("../models/shift.model");
const timesheet_model_1 = require("../models/timesheet.model");
/**
 * Business validation for a new Shift Request
 */
const validateRequestWindow = (start, end) => {
    if (!(start instanceof Date) || isNaN(start.getTime())) {
        throw new errors_1.AppError("Invalid start date/time", 400);
    }
    if (!(end instanceof Date) || isNaN(end.getTime())) {
        throw new errors_1.AppError("Invalid end date/time", 400);
    }
    if (start >= end) {
        throw new errors_1.AppError("End time must be after start time", 400);
    }
    // Optional: disallow past
    const now = new Date();
    if (end < now) {
        throw new errors_1.AppError("Cannot request a shift in the past", 400);
    }
    // Optional: min duration 30 mins
    const MIN_MINUTES = 30;
    if ((end.getTime() - start.getTime()) / (1000 * 60) < MIN_MINUTES) {
        throw new errors_1.AppError(`Shift must be at least ${MIN_MINUTES} minutes`, 400);
    }
};
/**
 * Ensure the participant belongs to the logged-in user (role: PARTICIPANT).
 * Admins can create on behalf of participants.
 */
const ensureParticipantOwnership = async (participantId, userId, role) => {
    const participant = await user_model_1.User.findById(participantId);
    if (!participant)
        throw new errors_1.NotFoundError("Participant");
    if (role !== "ADMIN" && participant.id.toString() !== userId) {
        throw new errors_1.AppError("You are not allowed to create requests for this participant", 403);
    }
    return participant;
};
const createShiftRequest = async (payload, role) => {
    const { participantId, requestedBy, service, start, end, notes, preferredTrainerIds = [], } = payload;
    if (!participantId || !requestedBy || !service || !start || !end) {
        throw new errors_1.AppError("participantId, service, start and end are required", 400);
    }
    // Validate times
    const startDt = new Date(start);
    const endDt = new Date(end);
    validateRequestWindow(startDt, endDt);
    // Validate participant ownership
    await ensureParticipantOwnership(participantId, requestedBy, role);
    // Sanitize trainer ids
    const trainerIds = (preferredTrainerIds || [])
        .filter(Boolean)
        .map((id) => new mongoose_1.default.Types.ObjectId(id));
    const doc = {
        participantId: new mongoose_1.default.Types.ObjectId(participantId),
        requestedBy: new mongoose_1.default.Types.ObjectId(requestedBy),
        service, // string code
        start: startDt,
        end: endDt,
        notes,
        preferredTrainerIds: trainerIds,
        status: "PENDING_ADMIN",
    };
    const created = await shiftRequest_model_1.ShiftRequest.create(doc);
    return created;
};
exports.createShiftRequest = createShiftRequest;
const listForAdmin = async (params) => {
    const { page = 1, limit = 20, status, q, dateFrom, dateTo, sort = "createdAt:desc", } = params;
    // ---------- Filters ----------
    const match = {};
    if (status?.length)
        match.status = { $in: status };
    if (dateFrom || dateTo) {
        match.start = {};
        if (dateFrom)
            match.start.$gte = new Date(dateFrom);
        if (dateTo)
            match.start.$lt = new Date(dateTo);
    }
    // ---------- Sort ----------
    const [sortFieldRaw, sortDirRaw] = (sort || "createdAt:desc").split(":");
    const allowedSortFields = new Set(["createdAt", "start"]);
    const sortField = allowedSortFields.has(sortFieldRaw)
        ? sortFieldRaw
        : "createdAt";
    const sortDir = sortDirRaw === "asc" ? 1 : -1;
    // ---------- Pipeline ----------
    const stages = [
        { $match: match },
        // 1) participantId is now a USER _id
        {
            $lookup: {
                from: "users",
                localField: "participantId", // <-- user _id stored here
                foreignField: "_id",
                as: "participantUser",
            },
        },
        { $unwind: { path: "$participantUser", preserveNullAndEmptyArrays: true } },
        // 2) (Optional) pull participant profile via userId (for fullName/phone)
        {
            $lookup: {
                from: "participants",
                localField: "participantUser._id", // user _id
                foreignField: "userId",
                as: "participantProfile",
            },
        },
        {
            $unwind: {
                path: "$participantProfile",
                preserveNullAndEmptyArrays: true,
            },
        },
    ];
    // ---------- Optional search ----------
    const trimmedQ = q?.trim();
    if (trimmedQ) {
        const rx = new RegExp(trimmedQ, "i");
        stages.push({
            $match: {
                $or: [
                    { "participantProfile.fullName": rx }, // name lives in participant profile
                    { "participantUser.email": rx }, // email lives in users
                    { service: rx },
                ],
            },
        });
    }
    // ---------- Facet ----------
    const facet = await shiftRequest_model_1.ShiftRequest.aggregate([
        ...stages,
        {
            $facet: {
                data: [
                    { $sort: { [sortField]: sortDir } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            status: 1,
                            service: 1,
                            start: 1,
                            end: 1,
                            notes: 1,
                            preferredTrainerIds: 1,
                            createdAt: 1,
                            assignedTrainerId: 1,
                            approvedBy: 1,
                            approvedAt: 1,
                            // keep both user + profile parts
                            participantUser: {
                                _id: "$participantUser._id",
                                email: "$participantUser.email",
                            },
                            participant: {
                                _id: "$participantProfile._id",
                                fullName: "$participantProfile.fullName",
                                phone: "$participantProfile.phone",
                            },
                        },
                    },
                ],
                meta: [{ $count: "total" }],
            },
        },
    ]);
    const data = facet?.[0]?.data ?? [];
    const total = facet?.[0]?.meta?.[0]?.total ?? 0;
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / Math.max(1, limit)),
        },
    };
};
exports.listForAdmin = listForAdmin;
const approveAndAssign = async ({ requestId, trainerId, adminUserId, }) => {
    if (!mongoose_1.default.isValidObjectId(requestId))
        throw new errors_1.AppError("Invalid requestId", 400);
    if (!mongoose_1.default.isValidObjectId(trainerId))
        throw new errors_1.AppError("Invalid trainerId", 400);
    if (!mongoose_1.default.isValidObjectId(adminUserId))
        throw new errors_1.AppError("Invalid adminUserId", 400);
    const reqDoc = await shiftRequest_model_1.ShiftRequest.findById(requestId);
    if (!reqDoc)
        throw new errors_1.NotFoundError("ShiftRequest");
    if (reqDoc.status !== "PENDING_ADMIN") {
        throw new errors_1.AppError("Only PENDING_ADMIN requests can be approved", 409);
    }
    // Ensure trainer exists and is active/approved
    const trainer = await trainer_model_1.Trainer.findById(trainerId).populate("userId", "email status role fullName");
    if (!trainer)
        throw new errors_1.NotFoundError("Trainer");
    const trainerUser = trainer.userId;
    if (trainerUser?.role !== "TRAINER" ||
        trainerUser?.status === "BLOCKED" ||
        trainer.status === "PENDING") {
        throw new errors_1.AppError("Trainer is not eligible for assignment", 400);
    }
    // ✅ Get participant info from Participant model
    const participant = await participant_model_1.Participant.findOne({
        userId: reqDoc.participantId,
    });
    if (!participant)
        throw new errors_1.NotFoundError("Participant");
    // Approve & assign
    reqDoc.status = "APPROVED";
    reqDoc.assignedTrainerId = new mongoose_1.default.Types.ObjectId(trainerId);
    reqDoc.approvedBy = new mongoose_1.default.Types.ObjectId(adminUserId);
    reqDoc.approvedAt = new Date();
    await reqDoc.save();
    // ✅ Email notifications
    try {
        const startTime = reqDoc.start ? new Date(reqDoc.start) : null;
        const endTime = reqDoc.end ? new Date(reqDoc.end) : null;
        const shiftDate = startTime
            ? (0, date_fns_1.format)(startTime, "EEEE, MMM d yyyy")
            : "Scheduled date TBD";
        const start = startTime ? (0, date_fns_1.format)(startTime, "hh:mm a") : "";
        const end = endTime ? (0, date_fns_1.format)(endTime, "hh:mm a") : "";
        const shiftInfo = `
      <p><b>Service:</b> ${reqDoc.service || "N/A"}</p>
      <p><b>Date:</b> ${shiftDate}</p>
      ${start && end ? `<p><b>Time:</b> ${start} – ${end}</p>` : ""}
    `;
        // ---- Trainer email ----
        await (0, email_1.sendEmail)(trainerUser.email, "New Shift Assigned 📅", `
        <p>Hello ${trainerUser.fullName || "Trainer"},</p>
        <p>You’ve been <b>assigned</b> to a new participant shift!</p>
        ${shiftInfo}
        <p>Participant: <b>${participant.fullName}</b></p>
        <p>Please review full details in your CareLink dashboard.</p>
        <p>Best regards,<br/>CareLink Team</p>
      `);
        // ---- Participant email ----
        await (0, email_1.sendEmail)(participant.email, "Your Shift Request Has Been Approved ✅", `
        <p>Hello ${participant.fullName || "Participant"},</p>
        <p>Your shift request has been <b>approved</b> and assigned to trainer <b>${trainerUser.fullName || "your trainer"}</b>.</p>
        ${shiftInfo}
        <p>Thank you for using CareLink!</p>
        <p>Best regards,<br/>CareLink Team</p>
      `);
    }
    catch (err) {
        console.error("❌ Failed to send notification emails:", err);
    }
    return reqDoc;
};
exports.approveAndAssign = approveAndAssign;
const decline = async (requestId, adminUserId, reason) => {
    if (!mongoose_1.default.isValidObjectId(requestId)) {
        throw new errors_1.AppError("Invalid requestId", 400);
    }
    const reqDoc = await shiftRequest_model_1.ShiftRequest.findById(requestId);
    if (!reqDoc)
        throw new errors_1.NotFoundError("ShiftRequest");
    if (reqDoc.status !== "PENDING_ADMIN") {
        throw new errors_1.AppError("Only PENDING_ADMIN requests can be declined", 409);
    }
    reqDoc.status = "DECLINED";
    reqDoc.approvedBy = new mongoose_1.default.Types.ObjectId(adminUserId);
    reqDoc.approvedAt = new Date();
    reqDoc.declinedReason = reason || null;
    await reqDoc.save();
    return reqDoc;
};
exports.decline = decline;
const buildCommonMatch = (params) => {
    const { status, dateFrom, dateTo, onlyUpcoming, onlyPast } = params || {};
    const match = {};
    if (status?.length)
        match.status = { $in: status };
    // date filters on start
    if (dateFrom || dateTo) {
        match.start = {};
        if (dateFrom)
            match.start.$gte = new Date(dateFrom);
        if (dateTo)
            match.start.$lt = new Date(dateTo);
    }
    // convenience windows
    const now = new Date();
    if (onlyUpcoming) {
        match.start = { ...(match.start || {}), $gte: now };
    }
    if (onlyPast) {
        match.end = { $lt: now };
    }
    return match;
};
const parseSort = (sort) => {
    const [field, dir] = (sort || "createdAt:desc").split(":");
    return {
        field: field === "start" ? "start" : "createdAt",
        dir: dir === "asc" ? 1 : -1,
    };
};
/**
 * List shift requests for a participant (participantId in ShiftRequest stores the USER _id)
 */
const listForParticipant = async (participantUserId, params = {}) => {
    if (!mongoose_1.default.isValidObjectId(participantUserId)) {
        throw new errors_1.AppError("Invalid participant user id", 400);
    }
    const { page = 1, limit = 20, sort = "createdAt:desc" } = params;
    const match = {
        ...buildCommonMatch(params),
        participantId: new mongoose_1.default.Types.ObjectId(participantUserId),
    };
    const { field, dir } = parseSort(sort);
    const facet = await shiftRequest_model_1.ShiftRequest.aggregate([
        { $match: match },
        // Join assigned trainer (if any) -> users for display
        {
            $lookup: {
                from: "trainers",
                localField: "assignedTrainerId",
                foreignField: "_id",
                as: "assignedTrainer",
            },
        },
        { $unwind: { path: "$assignedTrainer", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "assignedTrainer.userId",
                foreignField: "_id",
                as: "assignedTrainerUser",
            },
        },
        {
            $unwind: {
                path: "$assignedTrainerUser",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $facet: {
                data: [
                    { $sort: { [field]: dir } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            status: 1,
                            service: 1,
                            start: 1,
                            end: 1,
                            notes: 1,
                            preferredTrainerIds: 1,
                            createdAt: 1,
                            assignedTrainerId: 1,
                            // Friendly trainer fields for the participant UI
                            trainer: {
                                _id: "$assignedTrainer._id",
                                userId: "$assignedTrainer.userId",
                                fullName: "$assignedTrainer.fullName",
                                userEmail: "$assignedTrainerUser.email",
                            },
                        },
                    },
                ],
                meta: [{ $count: "total" }],
            },
        },
    ]);
    const data = facet?.[0]?.data ?? [];
    const total = facet?.[0]?.meta?.[0]?.total ?? 0;
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / Math.max(1, limit)),
        },
    };
};
exports.listForParticipant = listForParticipant;
/**
 * List shift requests assigned to the trainer (resolve trainer by logged-in userId)
 * Now includes latest Shift details (clock-in/clock-out) via linked shift.
 */
const listForTrainer = async (trainerUserId, params = {}) => {
    if (!mongoose_1.default.isValidObjectId(trainerUserId)) {
        throw new errors_1.AppError("Invalid trainer user id", 400);
    }
    // Resolve Trainer document for this user
    const trainerDoc = await trainer_model_1.Trainer.findOne({ userId: trainerUserId }).lean();
    if (!trainerDoc?._id) {
        throw new errors_1.AppError("Trainer profile not found for this user", 404);
    }
    const { page = 1, limit = 20, sort = "createdAt:desc" } = params;
    const match = {
        ...buildCommonMatch(params),
        assignedTrainerId: trainerDoc._id, // only assigned to this trainer
    };
    const { field, dir } = parseSort(sort);
    const facet = await shiftRequest_model_1.ShiftRequest.aggregate([
        { $match: match },
        // Join participant user + profile for trainer display
        {
            $lookup: {
                from: "users",
                localField: "participantId",
                foreignField: "_id",
                as: "participantUser",
            },
        },
        { $unwind: { path: "$participantUser", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "participants",
                localField: "participantUser._id",
                foreignField: "userId",
                as: "participantProfile",
            },
        },
        {
            $unwind: {
                path: "$participantProfile",
                preserveNullAndEmptyArrays: true,
            },
        },
        // 🔹 Join latest Shift for this request (if any)
        {
            $lookup: {
                from: "shifts",
                let: { reqId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$shiftRequestId", "$$reqId"] } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 1 },
                ],
                as: "shiftDoc",
            },
        },
        { $unwind: { path: "$shiftDoc", preserveNullAndEmptyArrays: true } },
        // Shape the response
        {
            $facet: {
                data: [
                    { $sort: { [field]: dir } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            status: 1,
                            service: 1,
                            start: 1,
                            end: 1,
                            notes: 1,
                            createdAt: 1,
                            // Participant display
                            participant: {
                                _id: "$participantProfile._id",
                                fullName: "$participantProfile.fullName",
                                phone: "$participantProfile.phone",
                                email: "$participantUser.email",
                            },
                            // 🔹 Shift details (if exists)
                            shift: {
                                _id: "$shiftDoc._id",
                                status: "$shiftDoc.status",
                                actualClockIn: "$shiftDoc.actualClockIn",
                                plannedClockOut: "$shiftDoc.plannedClockOut",
                                actualClockOut: "$shiftDoc.actualClockOut",
                                scheduledStart: "$shiftDoc.scheduledStart",
                                scheduledEnd: "$shiftDoc.scheduledEnd",
                                scheduledDurationMinutes: "$shiftDoc.scheduledDurationMinutes",
                            },
                            // 🔹 Convenience boolean for UI
                            isClockedIn: {
                                $eq: ["$shiftDoc.status", "IN_PROGRESS"],
                            },
                        },
                    },
                ],
                meta: [{ $count: "total" }],
            },
        },
    ]);
    const data = facet?.[0]?.data ?? [];
    const total = facet?.[0]?.meta?.[0]?.total ?? 0;
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / Math.max(1, limit)),
        },
    };
};
exports.listForTrainer = listForTrainer;
/**
 * Smart router: returns participant or trainer lists based on role
 */
const listMine = async (userId, role, params = {}) => {
    if (role === "TRAINER") {
        return (0, exports.listForTrainer)(userId, params);
    }
    // Participants (and Admins acting as a participant) – fetch by participant user id
    return (0, exports.listForParticipant)(userId, params);
};
exports.listMine = listMine;
/**
 * Trainer taps "Start shift".
 * - Allows late clock-in.
 * - Duration is fixed to the scheduled duration from the ShiftRequest.
 * - Creates a Shift document and marks request as IN_PROGRESS.
 */
const clockInShiftAsTrainer = async ({ trainerUserId, shiftRequestId, }) => {
    if (!mongoose_1.default.isValidObjectId(trainerUserId))
        throw new errors_1.AppError("Invalid trainer user id", 400);
    if (!mongoose_1.default.isValidObjectId(shiftRequestId))
        throw new errors_1.AppError("Invalid shift request id", 400);
    // 🔹 Find trainer by userId
    const trainer = await trainer_model_1.Trainer.findOne({ userId: trainerUserId }).lean();
    if (!trainer?._id)
        throw new errors_1.AppError("Trainer profile not found for this user", 404);
    // 🔹 Load request & validate ownership + status
    const reqDoc = await shiftRequest_model_1.ShiftRequest.findById(shiftRequestId);
    if (!reqDoc)
        throw new errors_1.NotFoundError("ShiftRequest");
    if (!reqDoc.assignedTrainerId ||
        String(reqDoc.assignedTrainerId) !== String(trainer._id)) {
        throw new errors_1.AppError("This shift request is not assigned to you", 403);
    }
    if (reqDoc.status !== "APPROVED") {
        throw new errors_1.AppError("Only approved shift requests can be started", 409);
    }
    // 🔹 Prevent duplicate clock-in
    const existingActive = await shift_model_1.Shift.findOne({
        shiftRequestId: reqDoc._id,
        status: "IN_PROGRESS",
    }).lean();
    if (existingActive) {
        throw new errors_1.AppError("This shift is already in progress", 409);
    }
    // 🔹 Compute scheduled duration
    const scheduledStart = new Date(reqDoc.start);
    const scheduledEnd = new Date(reqDoc.end);
    if (!+scheduledStart || !+scheduledEnd || scheduledEnd <= scheduledStart) {
        throw new errors_1.AppError("Shift request has invalid time window", 500);
    }
    const scheduledDurationMs = scheduledEnd.getTime() - scheduledStart.getTime();
    const scheduledDurationMinutes = Math.round(scheduledDurationMs / 60000);
    // 🔹 Allow late clock-in; planned end = now + scheduled duration
    const now = new Date();
    const plannedClockOut = new Date(now.getTime() + scheduledDurationMs);
    // 🔹 Create the Shift
    const shift = await shift_model_1.Shift.create({
        shiftRequestId: reqDoc._id,
        participantId: reqDoc.participantId, // user _id from User table
        trainerId: trainer._id, // Trainer._id
        service: reqDoc.service,
        scheduledStart,
        scheduledEnd,
        scheduledDurationMinutes,
        actualClockIn: now,
        plannedClockOut,
        status: "IN_PROGRESS",
    });
    // 🔹 Link Shift to ShiftRequest + mark IN_PROGRESS
    reqDoc.linkedShiftId = shift._id;
    // reqDoc.status = "IN_PROGRESS" as any;
    await reqDoc.save();
    return shift.toObject();
};
exports.clockInShiftAsTrainer = clockInShiftAsTrainer;
// ---- helpers ----
const isObjectId = (id) => mongoose_1.default.isValidObjectId(id);
const minutesBetween = (a, b) => Math.max(0, Math.round((+b - +a) / 60000)); // adjust to ceil/floor if your policy needs
const startOfWeekUTC = (d) => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    // Monday as start of week
    const dow = x.getUTCDay(); // 0..6 (Sun..Sat)
    const diffToMon = (dow + 6) % 7; // Mon=0
    x.setUTCDate(x.getUTCDate() - diffToMon);
    x.setUTCHours(0, 0, 0, 0);
    return x;
};
const endOfWeekUTC = (ws) => {
    const x = new Date(ws);
    x.setUTCDate(x.getUTCDate() + 6);
    x.setUTCHours(23, 59, 59, 999);
    return x;
};
const roundCents = (n) => Math.round(n);
// (Optional) Plug your real pricing resolver here.
const getPricingSnapshotForShift = async (shift) => {
    return {
        hourlyRateCents: 6500, // $65.00/h
        kmRateCents: 85, // $0.85/km
    };
};
// ===================== CLOCK OUT (bill from ShiftRequest window) =====================
const clockOutShiftAsTrainer = async ({ trainerUserId, shiftRequestId, report, }) => {
    if (!isObjectId(trainerUserId))
        throw new errors_1.AppError("Invalid trainer user id", 400);
    if (!isObjectId(shiftRequestId))
        throw new errors_1.AppError("Invalid shift request id", 400);
    const trainer = await trainer_model_1.Trainer.findOne({ userId: trainerUserId }).lean();
    if (!trainer?._id)
        throw new errors_1.AppError("Trainer profile not found for this user", 404);
    const reqDoc = await shiftRequest_model_1.ShiftRequest.findById(shiftRequestId);
    if (!reqDoc)
        throw new errors_1.NotFoundError("ShiftRequest");
    if (!reqDoc.assignedTrainerId || String(reqDoc.assignedTrainerId) !== String(trainer._id)) {
        throw new errors_1.AppError("This shift request is not assigned to you", 403);
    }
    const shift = await shift_model_1.Shift.findById(reqDoc.linkedShiftId);
    if (!shift)
        throw new errors_1.NotFoundError("Shift");
    // if (shift.status !== "IN_PROGRESS") throw new AppError("Shift is not in progress", 409);
    // --- AUDIT actuals only (not for billing) ---
    const now = new Date();
    // cap to scheduledEnd (NOT plannedClockOut)
    const auditOut = shift.scheduledEnd && now > shift.scheduledEnd ? shift.scheduledEnd : now;
    shift.actualClockOut = auditOut;
    shift.status = "COMPLETED";
    // trainer report
    const kmNum = report?.km != null ? Number(report.km) : undefined;
    shift.report = {
        activities: report?.activities || "",
        progress: report?.progress || "",
        incidents: report?.incidents || "",
        ...(kmNum != null && !Number.isNaN(kmNum) ? { km: kmNum } : {}),
    };
    // --- BILLING from scheduled request window ---
    const scheduledStart = new Date(reqDoc.start);
    const scheduledEnd = new Date(reqDoc.end);
    const billableMinutes = minutesBetween(scheduledStart, scheduledEnd);
    const { hourlyRateCents, kmRateCents } = await getPricingSnapshotForShift(shift);
    shift.billing = {
        billableMinutes,
        hourlyRateCents,
        kmRateCents,
        source: "ShiftRequest",
        scheduledStart,
        scheduledEnd,
    };
    await shift.save();
    reqDoc.status = "COMPLETED";
    await reqDoc.save();
    const timesheet = await (0, exports.upsertTimesheetForShift)({
        trainerId: shift.trainerId,
        participantId: shift.participantId,
        shiftId: shift._id,
        service: shift.service,
        date: scheduledEnd, // anchor to day of service
        minutes: billableMinutes, // scheduled minutes only
        km: kmNum ?? 0,
        hourlyRateCents,
        kmRateCents,
    });
    return { shift: shift.toObject(), timesheet };
};
exports.clockOutShiftAsTrainer = clockOutShiftAsTrainer;
const upsertTimesheetForShift = async ({ trainerId, participantId, shiftId, service, date, minutes, km = 0, hourlyRateCents, kmRateCents = 0, }) => {
    const weekStart = startOfWeekUTC(date);
    const weekEnd = endOfWeekUTC(weekStart);
    const hours = minutes / 60; // 👈 required by your schema
    const amountCents = Math.round(hours * hourlyRateCents);
    const mileageCents = Math.round(km * kmRateCents);
    const totalCents = amountCents + mileageCents;
    const ts = await timesheet_model_1.Timesheet.findOneAndUpdate({ trainerId, weekStart }, {
        $setOnInsert: {
            trainerId,
            weekStart,
            weekEnd,
            status: "DRAFT",
            items: [],
            totals: { hours: 0, km: 0, amountCents: 0, mileageCents: 0, totalCents: 0 },
        },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
    // Build/replace item shape INCLUDING hours
    const item = {
        shiftId,
        participantId,
        date,
        service,
        minutes, // keep for precision / audits
        hours, // 👈 required by schema
        km,
        hourlyRateCents,
        kmRateCents,
        amountCents,
        mileageCents,
        totalCents,
    };
    const idx = ts.items.findIndex((i) => String(i.shiftId) === String(shiftId));
    if (idx >= 0)
        ts.items[idx] = item;
    else
        ts.items.push(item);
    // Defensive backfill: ensure any legacy items have hours
    ts.items = ts.items.map((i) => ({
        ...i,
        hours: typeof i.hours === "number" ? i.hours : (i.minutes ?? 0) / 60,
    }));
    // Recompute totals (use hours to match your schema)
    const sum = ts.items.reduce((acc, i) => {
        acc.minutes += i.minutes ?? 0;
        acc.hours += i.hours ?? ((i.minutes ?? 0) / 60);
        acc.km += i.km ?? 0;
        acc.amountCents += i.amountCents ?? 0;
        acc.mileageCents += i.mileageCents ?? 0;
        return acc;
    }, { minutes: 0, hours: 0, km: 0, amountCents: 0, mileageCents: 0 });
    ts.weekEnd = weekEnd;
    ts.totals.hours = sum.hours;
    ts.totals.km = sum.km;
    ts.totals.amountCents = sum.amountCents;
    ts.totals.mileageCents = sum.mileageCents;
    ts.totals.totalCents = sum.amountCents + sum.mileageCents;
    await ts.save();
    return ts.toObject();
};
exports.upsertTimesheetForShift = upsertTimesheetForShift;
const listPastShiftsWithTimesheets = async ({ viewer, page, pageSize, dateFrom, dateTo, trainerId, participantId, }) => {
    if (!page || !pageSize)
        throw new errors_1.AppError("page and pageSize are required", 400);
    const match = {};
    // ---- date window (past only)
    const now = new Date();
    const gte = dateFrom ? new Date(dateFrom) : new Date(0);
    const requestedUpper = dateTo ? new Date(dateTo) : now;
    const lte = requestedUpper > now ? now : requestedUpper;
    // ---- role constraints
    if (viewer.role === "TRAINER") {
        const trainer = await trainer_model_1.Trainer.findOne({ userId: viewer.id }).select("_id");
        if (!trainer)
            throw new errors_1.NotFoundError("Trainer");
        match.trainerId = trainer._id;
    }
    else if (viewer.role === "PARTICIPANT") {
        const participant = await participant_model_1.Participant.findOne({ userId: viewer.id }).select("_id userId");
        if (!participant)
            throw new errors_1.NotFoundError("Participant");
        const viewerObjId = mongoose_1.default.Types.ObjectId.isValid(viewer.id)
            ? new mongoose_1.default.Types.ObjectId(viewer.id)
            : null;
        if (viewerObjId) {
            match.$or = [
                { participantId: participant._id },
                { participantId: viewerObjId }, // legacy case
            ];
        }
        else {
            match.participantId = participant._id;
        }
    }
    else if (viewer.role === "ADMIN") {
        if (trainerId) {
            let t = await trainer_model_1.Trainer.findById(trainerId).select("_id");
            if (!t)
                t = await trainer_model_1.Trainer.findOne({ userId: trainerId }).select("_id");
            if (!t)
                throw new errors_1.NotFoundError("Trainer");
            match.trainerId = t._id;
        }
        if (participantId) {
            let p = await participant_model_1.Participant.findById(participantId).select("_id");
            if (!p)
                p = await participant_model_1.Participant.findOne({ userId: participantId }).select("_id");
            if (!p)
                throw new errors_1.NotFoundError("Participant");
            match.participantId = p._id;
        }
    }
    // ---- include:
    //  (A) shifts in the past window (scheduledEnd/plannedClockOut within [gte, lte])
    //  OR
    //  (B) any shift with status COMPLETED, regardless of date
    const pastByWindow = {
        $or: [
            { scheduledEnd: { $gte: gte, $lte: lte } },
            { plannedClockOut: { $gte: gte, $lte: lte } },
        ],
    };
    const baseQuery = {
        ...match,
        $or: [
            pastByWindow,
            { status: "COMPLETED" },
        ],
    };
    const total = await shift_model_1.Shift.countDocuments(baseQuery);
    const shifts = await shift_model_1.Shift.find(baseQuery, {
        _id: 1,
        shiftRequestId: 1,
        participantId: 1,
        trainerId: 1,
        service: 1,
        scheduledStart: 1,
        scheduledEnd: 1,
        scheduledDurationMinutes: 1,
        status: 1,
        report: 1,
        createdAt: 1,
        updatedAt: 1,
    })
        .sort({ scheduledEnd: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec();
    // ---- fetch start/end from ShiftRequest (NOT from shift times)
    const shiftRequestIds = Array.from(new Set(shifts.map((s) => s.shiftRequestId).filter(Boolean).map(String)));
    let reqMap = new Map();
    if (shiftRequestIds.length) {
        const requests = await shiftRequest_model_1.ShiftRequest.find({ _id: { $in: shiftRequestIds } }, { _id: 1, start: 1, end: 1 })
            .lean()
            .exec();
        reqMap = new Map(requests.map((r) => [String(r._id), { start: r.start, end: r.end }]));
    }
    // ---- resolve names
    const trainerIds = new Set();
    const participantIds = new Set();
    for (const s of shifts) {
        if (viewer.role === "ADMIN" && s.trainerId)
            trainerIds.add(String(s.trainerId));
        if ((viewer.role === "TRAINER" || viewer.role === "ADMIN") && s.participantId)
            participantIds.add(String(s.participantId));
    }
    const trainers = trainerIds.size
        ? await trainer_model_1.Trainer.find({ _id: { $in: Array.from(trainerIds) } })
            .select("_id fullName")
            .lean()
            .exec()
        : [];
    const participants = participantIds.size
        ? await participant_model_1.Participant.find({ _id: { $in: Array.from(participantIds) } })
            .select("_id fullName")
            .lean()
            .exec()
        : [];
    const trainerMap = new Map(trainers.map((t) => [String(t._id), t.fullName]));
    const participantMap = new Map(participants.map((p) => [String(p._id), p.fullName]));
    // ---- final shape (uses ShiftRequest.start/end only)
    const data = shifts.map((s) => {
        const reqTimes = reqMap.get(String(s.shiftRequestId));
        const base = {
            ...s,
            start: reqTimes?.start ?? null,
            end: reqTimes?.end ?? null,
        };
        if (viewer.role === "TRAINER") {
            base.participantName = participantMap.get(String(s.participantId)) ?? null;
        }
        else if (viewer.role === "ADMIN") {
            base.participantName = participantMap.get(String(s.participantId)) ?? null;
            base.trainerName = trainerMap.get(String(s.trainerId)) ?? null;
        }
        return base;
    });
    return {
        data,
        pagination: { page, pageSize, total },
    };
};
exports.listPastShiftsWithTimesheets = listPastShiftsWithTimesheets;
const getTrainerShiftSummary = async ({ viewer, trainerId }) => {
    // ---- resolve the trainer document (we need both trainer._id and trainer.userId)
    let trainerDoc = null;
    if (viewer.role === "TRAINER") {
        const me = await trainer_model_1.Trainer.findOne({ userId: viewer.id })
            .select("_id userId")
            .lean()
            .exec();
        if (!me)
            throw new errors_1.NotFoundError("Trainer");
        trainerDoc = {
            _id: new mongoose_1.default.Types.ObjectId(me._id),
            userId: new mongoose_1.default.Types.ObjectId(me.userId),
        };
    }
    else if (viewer.role === "ADMIN") {
        if (!trainerId)
            throw new errors_1.AppError("trainerId is required for admins", 400);
        // Admin passes *user id* (per your note). Still allow trainer doc id for safety.
        const maybeObj = mongoose_1.default.isValidObjectId(trainerId) ? new mongoose_1.default.Types.ObjectId(trainerId) : null;
        // try as Trainer._id
        const asTrainer = maybeObj
            ? await trainer_model_1.Trainer.findById(maybeObj).select("_id userId").lean().exec()
            : null;
        // try as Trainer.userId (this is the expected path if trainerId is a user id)
        const t = asTrainer ?? (await trainer_model_1.Trainer.findOne({ userId: trainerId }).select("_id userId").lean().exec());
        if (!t)
            throw new errors_1.NotFoundError("Trainer");
        trainerDoc = {
            _id: new mongoose_1.default.Types.ObjectId(t._id),
            userId: new mongoose_1.default.Types.ObjectId(t.userId),
        };
    }
    else {
        throw new errors_1.AppError("Forbidden", 403);
    }
    const now = new Date();
    // ----------------------------------------------------------------------------------
    // IMPORTANT: Your data uses *User._id* as the trainer id in Shift & ShiftRequest.
    // So we primarily match on trainerDoc.userId, but keep fallbacks for legacy data
    // that might still store Trainer._id.
    // ----------------------------------------------------------------------------------
    // Shifts: trainerId == User._id (primary). Fallback: trainerId == Trainer._id (legacy).
    const shiftMatch = {
        $or: [
            { trainerId: trainerDoc.userId }, // preferred: User._id
            { trainerId: trainerDoc._id }, // legacy: Trainer._id
        ],
    };
    // Upcoming: from ShiftRequest where assignedTrainerId == User._id (primary).
    // Fallback: assignedTrainerId == Trainer._id (legacy), status APPROVED, start in future.
    const upcomingReqMatch = {
        $and: [
            {
                $or: [
                    { assignedTrainerId: trainerDoc.userId }, // preferred: User._id
                    { assignedTrainerId: trainerDoc._id }, // legacy: Trainer._id
                ],
            },
            { status: "APPROVED" },
            { start: { $gt: now } },
        ],
    };
    // counts
    const [totalShifts, totalUpcoming] = await Promise.all([
        shift_model_1.Shift.countDocuments(shiftMatch),
        shiftRequest_model_1.ShiftRequest.countDocuments(upcomingReqMatch),
    ]);
    // next upcoming = soonest APPROVED ShiftRequest by start
    const nextReq = await shiftRequest_model_1.ShiftRequest.find(upcomingReqMatch)
        .select("_id participantId start end service status")
        .sort({ start: 1, _id: 1 })
        .limit(1)
        .lean()
        .exec();
    let nextShift = null;
    if (nextReq.length) {
        const r = nextReq[0];
        let participantName = null;
        if (r.participantId) {
            const p = await participant_model_1.Participant.findById(r.participantId).select("_id fullName").lean().exec();
            participantName = p?.fullName ?? null;
        }
        nextShift = {
            shiftId: null, // not created yet
            service: r.service,
            status: r.status,
            start: r.start ?? null,
            end: r.end ?? null,
            participantId: r.participantId ? String(r.participantId) : null,
            participantName,
            source: "REQUEST",
        };
    }
    else {
        // optional: if nothing upcoming, surface any live IN_PROGRESS shift
        const live = await shift_model_1.Shift.find({
            ...shiftMatch,
            status: { $in: ["IN_PROGRESS"] },
        }, { _id: 1, participantId: 1, scheduledStart: 1, scheduledEnd: 1, status: 1, service: 1 })
            .sort({ scheduledStart: 1, _id: 1 })
            .limit(1)
            .lean()
            .exec();
        if (live.length) {
            const s = live[0];
            let participantName = null;
            if (s.participantId) {
                const p = await participant_model_1.Participant.findById(s.participantId).select("_id fullName").lean().exec();
                participantName = p?.fullName ?? null;
            }
            nextShift = {
                shiftId: String(s._id),
                service: s.service,
                status: s.status,
                start: s.scheduledStart ?? null,
                end: s.scheduledEnd ?? null,
                participantId: s.participantId ? String(s.participantId) : null,
                participantName,
                source: "SHIFT",
            };
        }
    }
    return {
        totalShifts, // from Shift (matched by User._id first)
        totalUpcoming, // from ShiftRequest APPROVED+future (matched by User._id first)
        nextShift,
        generatedAt: now,
    };
};
exports.getTrainerShiftSummary = getTrainerShiftSummary;
const getAdminDashboardSummary = async (opts) => {
    const now = new Date();
    // Optional date window to scope "created" counters (not required for status counts)
    const createdRange = opts?.dateFrom || opts?.dateTo
        ? {
            createdAt: {
                ...(opts?.dateFrom ? { $gte: new Date(opts.dateFrom) } : {}),
                ...(opts?.dateTo ? { $lte: new Date(opts.dateTo) } : {}),
            },
        }
        : {};
    // ---- USERS
    const usersByRolePromise = Promise.all([
        user_model_1.User.countDocuments({ role: "ADMIN" }),
        user_model_1.User.countDocuments({ role: "TRAINER" }),
        user_model_1.User.countDocuments({ role: "PARTICIPANT" }),
    ]).then(([admins, trainers, participants]) => ({ admins, trainers, participants }));
    const userStatusesPromise = Promise.all([
        user_model_1.User.countDocuments({ status: "ACTIVE" }),
        user_model_1.User.countDocuments({ status: "PENDING" }),
        user_model_1.User.countDocuments({ status: "BLOCKED" }),
        user_model_1.User.countDocuments({ status: "DELETED" }),
    ]).then(([active, pending, blocked, deleted]) => ({ active, pending, blocked, deleted }));
    const totalUsersPromise = user_model_1.User.countDocuments({});
    const usersCreatedInWindowPromise = user_model_1.User.countDocuments(createdRange);
    // ---- TRAINERS
    const trainersTotalPromise = trainer_model_1.Trainer.countDocuments({});
    const trainersActivePromise = trainer_model_1.Trainer.countDocuments({ status: /active/i });
    const trainersPendingPromise = trainer_model_1.Trainer.countDocuments({ status: /pending/i });
    // ---- PARTICIPANTS
    const participantsTotalPromise = participant_model_1.Participant.countDocuments({});
    const participantsByStatusPromise = Promise.all([
        participant_model_1.Participant.countDocuments({ status: "ACTIVE" }),
        participant_model_1.Participant.countDocuments({ status: "PENDING" }),
        participant_model_1.Participant.countDocuments({ status: "BLOCKED" }),
        participant_model_1.Participant.countDocuments({ status: "DELETED" }),
    ]).then(([active, pending, blocked, deleted]) => ({ active, pending, blocked, deleted }));
    // ---- SHIFT REQUESTS (admin workflow)
    const srTotalPromise = shiftRequest_model_1.ShiftRequest.countDocuments({});
    const srByStatusPromise = Promise.all([
        shiftRequest_model_1.ShiftRequest.countDocuments({ status: "PENDING_ADMIN" }),
        shiftRequest_model_1.ShiftRequest.countDocuments({ status: "APPROVED" }),
        shiftRequest_model_1.ShiftRequest.countDocuments({ status: "DECLINED" }),
        shiftRequest_model_1.ShiftRequest.countDocuments({ status: "CANCELLED" }),
        shiftRequest_model_1.ShiftRequest.countDocuments({ status: "IN_PROGRESS" }),
        shiftRequest_model_1.ShiftRequest.countDocuments({ status: "COMPLETED" }),
    ]).then(([pending_admin, approved, declined, cancelled, in_progress, completed]) => ({
        pending_admin,
        approved,
        declined,
        cancelled,
        in_progress,
        completed,
    }));
    // Upcoming & today (ShiftRequest.start basis)
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const srUpcomingPromise = shiftRequest_model_1.ShiftRequest.countDocuments({
        start: { $gt: now },
        status: { $in: ["APPROVED", "IN_PROGRESS"] },
    });
    const srTodayPromise = shiftRequest_model_1.ShiftRequest.countDocuments({
        start: { $gte: startOfToday, $lte: endOfToday },
        status: { $in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] },
    });
    // ---- SHIFTS (actual work sessions)
    const shiftsTotalPromise = shift_model_1.Shift.countDocuments({});
    const shiftsByStatusPromise = Promise.all([
        shift_model_1.Shift.countDocuments({ status: "IN_PROGRESS" }),
        shift_model_1.Shift.countDocuments({ status: "COMPLETED" }),
        shift_model_1.Shift.countDocuments({ status: "CANCELLED" }),
    ]).then(([in_progress, completed, cancelled]) => ({ in_progress, completed, cancelled }));
    // Upcoming (by scheduledStart) & today buckets
    const shiftsUpcomingPromise = shift_model_1.Shift.countDocuments({
        scheduledStart: { $gt: now },
        status: { $ne: "CANCELLED" },
    });
    const shiftsTodayPromise = shift_model_1.Shift.countDocuments({
        scheduledStart: { $gte: startOfToday, $lte: endOfToday },
        status: { $ne: "CANCELLED" },
    });
    // ---- TIMESHEETS
    const timesheetsTotalPromise = timesheet_model_1.Timesheet.countDocuments({});
    const timesheetsByStatusPromise = Promise.all([
        timesheet_model_1.Timesheet.countDocuments({ status: "DRAFT" }),
        timesheet_model_1.Timesheet.countDocuments({ status: "SUBMITTED" }),
        timesheet_model_1.Timesheet.countDocuments({ status: "APPROVED" }),
        timesheet_model_1.Timesheet.countDocuments({ status: "PAID" }),
        timesheet_model_1.Timesheet.countDocuments({ status: "REOPENED" }),
    ]).then(([draft, submitted, approved, paid, reopened]) => ({
        draft,
        submitted,
        approved,
        paid,
        reopened,
    }));
    // ---- RECENT lists (lightweight; limit 5)
    const recentUsersPromise = user_model_1.User.find({}, { _id: 1, email: 1, role: 1, status: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec();
    const recentShiftRequestsPromise = shiftRequest_model_1.ShiftRequest.find({}, { _id: 1, participantId: 1, assignedTrainerId: 1, status: 1, start: 1, end: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec();
    const recentShiftsPromise = shift_model_1.Shift.find({}, { _id: 1, trainerId: 1, participantId: 1, status: 1, scheduledStart: 1, scheduledEnd: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec();
    // ---- execute in parallel
    const [usersByRole, userStatuses, totalUsers, usersCreatedInWindow, trainersTotal, trainersActive, trainersPending, participantsTotal, participantsStatuses, srTotal, srByStatus, srUpcoming, srToday, shiftsTotal, shiftsByStatus, shiftsUpcoming, shiftsToday, timesheetsTotal, timesheetsByStatus, recentUsers, recentShiftRequests, recentShifts,] = await Promise.all([
        usersByRolePromise,
        userStatusesPromise,
        totalUsersPromise,
        usersCreatedInWindowPromise,
        trainersTotalPromise,
        trainersActivePromise,
        trainersPendingPromise,
        participantsTotalPromise,
        participantsByStatusPromise,
        srTotalPromise,
        srByStatusPromise,
        srUpcomingPromise,
        srTodayPromise,
        shiftsTotalPromise,
        shiftsByStatusPromise,
        shiftsUpcomingPromise,
        shiftsTodayPromise,
        timesheetsTotalPromise,
        timesheetsByStatusPromise,
        recentUsersPromise,
        recentShiftRequestsPromise,
        recentShiftsPromise,
    ]);
    return {
        generatedAt: now,
        users: {
            total: totalUsers,
            byRole: usersByRole, // { admins, trainers, participants }
            byStatus: userStatuses, // { active, pending, blocked, deleted }
            createdInWindow: usersCreatedInWindow,
            recent: recentUsers,
        },
        trainers: {
            total: trainersTotal,
            active: trainersActive,
            pending: trainersPending,
        },
        participants: {
            total: participantsTotal,
            byStatus: participantsStatuses, // { active, pending, blocked, deleted }
        },
        shiftRequests: {
            total: srTotal,
            byStatus: srByStatus, // { pending_admin, approved, declined, cancelled, in_progress, completed }
            upcoming: srUpcoming, // start > now & status approved/in_progress
            today: srToday, // today bucket
            recent: recentShiftRequests,
        },
        shifts: {
            total: shiftsTotal,
            byStatus: shiftsByStatus, // { in_progress, completed, cancelled }
            upcoming: shiftsUpcoming, // scheduledStart > now, not cancelled
            today: shiftsToday,
            recent: recentShifts,
        },
        timesheets: {
            total: timesheetsTotal,
            byStatus: timesheetsByStatus, // { draft, submitted, approved, paid, reopened }
        },
    };
};
exports.getAdminDashboardSummary = getAdminDashboardSummary;
