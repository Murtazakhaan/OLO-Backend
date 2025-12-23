"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportTimesheet = exports.reopenTimesheet = exports.approveTimesheet = exports.submitTimesheet = exports.getTimesheetById = exports.listTimesheets = void 0;
// services/timesheets.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const timesheet_model_1 = require("../models/timesheet.model");
const errors_1 = require("../utils/errors");
const trainer_model_1 = require("../models/trainer.model");
const participant_model_1 = require("../models/participant.model"); // ✅ add this
const pdf_1 = require("../utils/pdf");
const csv_1 = require("../utils/csv");
const isObjectId = (id) => mongoose_1.default.isValidObjectId(id);
const listTimesheets = async ({ viewer, status, weekStart, trainerId, page, pageSize, }) => {
    const q = {};
    if (status)
        q.status = status;
    if (weekStart)
        q.weekStart = new Date(weekStart);
    // TRAINER: restrict to own trainer document
    if (viewer.role === "TRAINER") {
        const trainer = await trainer_model_1.Trainer.findOne({ userId: viewer.id }).select("_id");
        if (!trainer)
            throw new errors_1.NotFoundError("User not found");
        q.trainerId = trainer._id;
    }
    // ADMIN: optional filter by trainerId (accepts Trainer._id OR User._id)
    if (viewer.role === "ADMIN" && trainerId && isObjectId(trainerId)) {
        // Try direct Trainer._id first
        let trainerDoc = await trainer_model_1.Trainer.findById(trainerId).select("_id");
        if (!trainerDoc) {
            // Fallback: treat as User._id
            trainerDoc = await trainer_model_1.Trainer.findOne({ userId: trainerId }).select("_id");
            if (!trainerDoc)
                throw new errors_1.NotFoundError("Trainer not found");
        }
        q.trainerId = trainerDoc._id;
    }
    const [items, total] = await Promise.all([
        timesheet_model_1.Timesheet.find(q)
            .sort({ weekStart: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .select("trainerId items weekStart weekEnd status totals createdAt updatedAt")
            .populate({
            path: "trainerId",
            select: "fullName phone userId",
            populate: { path: "userId", select: "email", model: "User" },
        })
            .lean(),
        timesheet_model_1.Timesheet.countDocuments(q),
    ]);
    // ✅ Collect all participant *user ids* from items
    const participantUserIds = Array.from(new Set(items.flatMap((ts) => (ts.items ?? [])
        .map((it) => it.participantId)
        .filter((id) => id && isObjectId(String(id)))
        .map((id) => String(id)))));
    // ✅ Fetch Participant docs by userId in one round-trip
    const participants = await participant_model_1.Participant.find({
        userId: { $in: participantUserIds },
    })
        .select("_id userId fullName email phone status")
        .lean();
    // Build quick lookup by userId
    const participantByUserId = new Map(participants.map((p) => [String(p.userId), p]));
    // ✅ Enrich each timesheet item with participant details (alongside, no shape break)
    const data = items.map((ts) => {
        const trainer = ts.trainerId || {};
        const user = trainer.userId || {};
        const enrichedItems = (ts.items ?? []).map((it) => {
            const p = participantByUserId.get(String(it.participantId));
            return {
                ...it,
                // keep participantId as-is (this is the User._id)
                participant: p
                    ? {
                        // expose both ids for convenience
                        userId: String(p.userId),
                        participantDocId: String(p._id),
                        fullName: p.fullName,
                        email: p.email ?? "",
                        phone: p.phone ?? "",
                        status: p.status ?? "",
                    }
                    : undefined,
            };
        });
        return {
            ...ts,
            items: enrichedItems,
            // Existing admin helper block stays intact
            adminView: {
                trainerId: trainer._id,
                trainerName: trainer.fullName ?? "(No name)",
                trainerPhone: trainer.phone ?? "",
                trainerEmail: user.email ?? "",
                itemsCount: enrichedItems.length,
                amounts: {
                    hours: ts.totals?.hours ?? 0,
                    km: ts.totals?.km ?? 0,
                    labourCents: ts.totals?.amountCents ?? 0,
                    mileageCents: ts.totals?.mileageCents ?? 0,
                    totalCents: ts.totals?.totalCents ?? 0,
                },
            },
        };
    });
    return { data, pagination: { page, pageSize, total } };
};
exports.listTimesheets = listTimesheets;
const getTimesheetById = async ({ id, viewer }) => {
    if (!isObjectId(id))
        throw new errors_1.AppError("Invalid timesheet id", 400);
    const ts = await timesheet_model_1.Timesheet.findById(id)
        .populate("trainerId", "id userId")
        .lean();
    if (!ts)
        throw new errors_1.NotFoundError("Timesheet");
    // if (!canView(viewer, ts)) throw new AppError("Forbidden", 403);
    return ts;
};
exports.getTimesheetById = getTimesheetById;
const submitTimesheet = async ({ id, trainerUserId }) => {
    if (!isObjectId(id))
        throw new errors_1.AppError("Invalid id", 400);
    const ts = await timesheet_model_1.Timesheet.findById(id).populate("trainerId", "userId");
    if (!ts)
        throw new errors_1.NotFoundError("Timesheet");
    // if (!canSubmit(trainerUserId, ts)) throw new AppError("Forbidden", 403);
    // if (ts.status !== "DRAFT")
    //   throw new AppError("Only DRAFT can be submitted", 409);
    ts.status = "SUBMITTED";
    await ts.save();
    return ts.toObject();
};
exports.submitTimesheet = submitTimesheet;
const approveTimesheet = async ({ id, adminUserId }) => {
    if (!isObjectId(id))
        throw new errors_1.AppError("Invalid id", 400);
    // (optional) verify adminUserId belongs to an Admin model
    const ts = await timesheet_model_1.Timesheet.findById(id);
    if (!ts)
        throw new errors_1.NotFoundError("Timesheet");
    if (!["SUBMITTED", "REOPENED"].includes(ts.status))
        throw new errors_1.AppError("Only SUBMITTED/REOPENED can be approved", 409);
    ts.status = "APPROVED";
    await ts.save();
    return ts.toObject();
};
exports.approveTimesheet = approveTimesheet;
const reopenTimesheet = async ({ id, adminUserId, reason }) => {
    if (!isObjectId(id))
        throw new errors_1.AppError("Invalid id", 400);
    const ts = await timesheet_model_1.Timesheet.findById(id);
    if (!ts)
        throw new errors_1.NotFoundError("Timesheet");
    if (!["SUBMITTED", "APPROVED"].includes(ts.status))
        throw new errors_1.AppError("Only SUBMITTED/APPROVED can be reopened", 409);
    ts.status = "REOPENED";
    // (optional) push an audit note
    ts.audit = [
        ...(ts.audit ?? []),
        { by: adminUserId, at: new Date(), reason },
    ];
    await ts.save();
    return ts.toObject();
};
exports.reopenTimesheet = reopenTimesheet;
const toISODate = (d) => {
    if (!d)
        return "";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};
const centsToMoney = (c) => {
    const n = typeof c === "number" ? c : 0;
    return (n / 100).toFixed(2);
};
// helper
const exportTimesheet = async ({ id, viewer, format }) => {
    const ts = await (0, exports.getTimesheetById)({ id, viewer });
    // --- ENRICH TRAINER (handles unpopulated trainerId) ---
    let trainer = {};
    let trainerEmail = "";
    const t = await trainer_model_1.Trainer.findById(ts.trainerId)
        .select("fullName phone userId")
        .populate({ path: "userId", select: "email", model: "User" })
        .lean();
    trainer = t || {};
    trainerEmail = t?.userId?.email ?? "";
    // --- ENRICH PARTICIPANTS (items[].participant) ---
    const itemsRaw = Array.isArray(ts.items)
        ? ts.items
        : [];
    const participantUserIds = Array.from(new Set(itemsRaw
        .map((i) => i?.participantId)
        .filter((id) => id && isObjectId(id))
        .map((id) => String(id))));
    let participantByUserId = new Map();
    if (participantUserIds.length) {
        const participants = await participant_model_1.Participant.find({
            userId: { $in: participantUserIds },
        })
            .select("_id userId fullName email phone status")
            .lean();
        participantByUserId = new Map(participants.map((p) => [
            String(p.userId),
            {
                name: p.fullName ?? "",
                email: p.email ?? "",
                phone: p.phone ?? "",
                status: p.status ?? "",
                participantDocId: String(p._id),
                userId: String(p.userId),
            },
        ]));
    }
    // items with participant block (for CSV/PDF)
    const items = itemsRaw.map((i) => ({
        ...i,
        participant: participantByUserId.get(String(i.participantId)),
    }));
    console.log("items", items);
    if (format === "csv") {
        const payload = {
            title: `Timesheet ${ts._id}`,
            meta: {
                timesheetId: String(ts._id),
                status: ts.status ?? "",
                trainerName: trainer?.fullName ?? "",
                trainerEmail: trainerEmail ?? "",
                trainerPhone: trainer?.phone ?? "",
            },
            period: `${new Date(ts.weekStart).toDateString()} → ${new Date(ts.weekEnd).toDateString()}`,
            totals: {
                hours: ts.totals?.hours ?? 0,
                km: ts.totals?.km ?? 0,
                amountCents: ts.totals?.amountCents ?? 0,
                mileageCents: ts.totals?.mileageCents ?? 0,
                totalCents: ts.totals?.totalCents ?? 0,
            },
            items: items.map((i) => ({
                dateISO: i.date ? new Date(i.date).toISOString().slice(0, 10) : "",
                service: i.service ?? "",
                hours: typeof i.hours === "number" ? i.hours : 0,
                km: typeof i.km === "number" ? i.km : 0,
                amountCents: typeof i.amountCents === "number" ? i.amountCents : 0,
                mileageCents: typeof i.mileageCents === "number" ? i.mileageCents : 0,
                totalCents: typeof i.totalCents === "number" ? i.totalCents : 0,
                amount: undefined, // or preformat if you prefer
                mileage: undefined,
                total: undefined,
                participant: i.participant
                    ? {
                        name: i.participant.name ?? "",
                        email: i.participant.email ?? "",
                        phone: i.participant.phone ?? "",
                        status: i.participant.status ?? "",
                    }
                    : undefined,
                notes: i.notes ?? "",
            })),
        };
        const csvBuf = (0, csv_1.createCsvBuffer)(payload, {
            delimiter: ",",
            eol: "\r\n",
            withBOM: true,
            includeSummary: true,
            moneyPrefix: "$",
            // itemColumns: ["Date","Service","Hours","KM","Total"], // ← Example: customize columns
        });
        const nameDate = (ts.weekStart && new Date(ts.weekStart).toISOString().slice(0, 10)) ||
            new Date().toISOString().slice(0, 10);
        return {
            filename: `timesheet_${ts._id}_${nameDate}.csv`,
            mime: "text/csv; charset=utf-8",
            buffer: csvBuf,
        };
    }
    // ----- PDF -----
    // Keep items/totals in cents so your PDF util can format; pass meta for headers.
    const pdfPayload = {
        title: `Timesheet ${ts._id}`,
        meta: {
            timesheetId: String(ts._id),
            status: ts.status ?? "",
            trainerName: trainer?.fullName ?? "",
            trainerEmail: trainerEmail ?? "",
            trainerPhone: trainer?.phone ?? "",
        },
        period: `${new Date(ts.weekStart).toDateString()} → ${new Date(ts.weekEnd).toDateString()}`,
        totals: {
            hours: ts.totals?.hours ?? 0,
            km: ts.totals?.km ?? 0,
            amountCents: ts.totals?.amountCents ?? 0,
            mileageCents: ts.totals?.mileageCents ?? 0,
            totalCents: ts.totals?.totalCents ?? 0,
        },
        // Provide a rendering-friendly items array (keep raw cents; also include formatted helpers)
        items: items.map((i) => ({
            dateISO: toISODate(i.date),
            service: i.service ?? "",
            hours: typeof i.hours === "number" ? i.hours : 0,
            km: typeof i.km === "number" ? i.km : 0,
            amountCents: typeof i.amountCents === "number" ? i.amountCents : 0,
            mileageCents: typeof i.mileageCents === "number" ? i.mileageCents : 0,
            totalCents: typeof i.totalCents === "number" ? i.totalCents : 0,
            amount: centsToMoney(i.amountCents),
            mileage: centsToMoney(i.mileageCents),
            total: centsToMoney(i.totalCents),
            participant: i.participant
                ? {
                    name: i.participant.name ?? "",
                    email: i.participant.email ?? "",
                    phone: i.participant.phone ?? "",
                    status: i.participant.status ?? "",
                }
                : undefined,
            notes: i.notes ?? "",
        })),
    };
    const pdf = await (0, pdf_1.createPdfBuffer)(pdfPayload);
    const nameDate = toISODate(ts.weekStart) || toISODate(new Date());
    return {
        filename: `timesheet_${ts._id}_${nameDate}.pdf`,
        mime: "application/pdf",
        buffer: pdf,
    };
};
exports.exportTimesheet = exportTimesheet;
