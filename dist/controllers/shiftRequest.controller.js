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
exports.adminDashboardSummary = exports.trainerDashboardSummary = exports.listPastShiftsWithTimesheets = exports.clockOutShiftAsTrainerController = exports.clockInShiftAsTrainer = exports.listMine = exports.listTrainerMine = exports.listParticipantMine = exports.decline = exports.approveAndAssign = exports.adminList = exports.createShiftRequest = void 0;
const response_1 = require("../utils/response");
const ShiftRequestService = __importStar(require("../services/shiftRequest.service"));
const errors_1 = require("../utils/errors");
/**
 * POST /api/shift-requests
 * Participant creates a new shift request
 * Body: { participantId, service, start, end, notes?, preferredTrainerIds?[] }
 */
const createShiftRequest = async (req, res) => {
    if (!req.user) {
        throw new errors_1.AppError("Unauthorized", 401);
    }
    console.log("req.user.userId", req.user.userId);
    const created = await ShiftRequestService.createShiftRequest({
        participantId: req.user.userId, // same as user making request
        requestedBy: req.user.userId,
        service: req.body.service, // string code from front-end selection
        start: req.body.start,
        end: req.body.end,
        notes: req.body.notes,
        preferredTrainerIds: req.body.preferredTrainerIds,
    }, req.user.role);
    return (0, response_1.success)(res, created, "Shift request submitted");
};
exports.createShiftRequest = createShiftRequest;
/**
 * GET /api/admin/shift-requests
 * Admin list view for pending/approved/declined shift requests
 * Query: ?page=&limit=&status=&q=&dateFrom=&dateTo=&sort=
 */
const adminList = async (req, res) => {
    if (req.user?.role !== "ADMIN") {
        throw new errors_1.AppError("Forbidden", 403);
    }
    const { page, limit, status, q, dateFrom, dateTo, sort } = req.query;
    const result = await ShiftRequestService.listForAdmin({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: Array.isArray(status)
            ? status
            : status
                ? [status]
                : undefined,
        q: q,
        dateFrom: dateFrom,
        dateTo: dateTo,
        sort: sort || "createdAt:desc",
    });
    return (0, response_1.success)(res, result, "Shift requests fetched");
};
exports.adminList = adminList;
/**
 * POST /api/admin/shift-requests/approve
 * Body: { requestId, trainerId }
 */
const approveAndAssign = async (req, res) => {
    if (req.user?.role !== "ADMIN") {
        throw new errors_1.AppError("Forbidden", 403);
    }
    const { requestId, trainerId } = req.body;
    const adminUserId = req.user.userId;
    const updated = await ShiftRequestService.approveAndAssign({
        requestId,
        trainerId,
        adminUserId,
    });
    return (0, response_1.success)(res, updated, "Shift request approved and assigned");
};
exports.approveAndAssign = approveAndAssign;
/**
 * POST /api/admin/shift-requests/decline
 * Body: { requestId, reason? }
 */
const decline = async (req, res) => {
    if (req.user?.role !== "ADMIN") {
        throw new errors_1.AppError("Forbidden", 403);
    }
    const { requestId, reason } = req.body;
    const adminUserId = req.user.userId;
    const updated = await ShiftRequestService.decline(requestId, adminUserId, reason);
    return (0, response_1.success)(res, updated, "Shift request declined");
};
exports.decline = decline;
// NEW: GET /api/shift-requests/participant/mine
// List shift requests for the logged-in participant (by userId)
const listParticipantMine = async (req, res) => {
    if (!req.user)
        throw new errors_1.AppError("Unauthorized", 401);
    const { page, limit, status, dateFrom, dateTo, sort, onlyUpcoming, onlyPast } = req.query;
    const result = await ShiftRequestService.listForParticipant(req.user.userId, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: Array.isArray(status)
            ? status
            : status
                ? [status]
                : undefined,
        dateFrom: dateFrom,
        dateTo: dateTo,
        sort: sort || "createdAt:desc",
        onlyUpcoming: onlyUpcoming === "true",
        onlyPast: onlyPast === "true",
    });
    return (0, response_1.success)(res, result, "Participant shift requests");
};
exports.listParticipantMine = listParticipantMine;
// NEW: GET /api/shift-requests/trainer/mine
// List shift requests assigned to the logged-in trainer (resolve Trainer by userId)
const listTrainerMine = async (req, res) => {
    if (!req.user)
        throw new errors_1.AppError("Unauthorized", 401);
    const { page, limit, status, dateFrom, dateTo, sort, onlyUpcoming, onlyPast } = req.query;
    const result = await ShiftRequestService.listForTrainer(req.user.userId, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: Array.isArray(status)
            ? status
            : status
                ? [status]
                : undefined,
        dateFrom: dateFrom,
        dateTo: dateTo,
        sort: sort || "createdAt:desc",
        onlyUpcoming: onlyUpcoming === "true",
        onlyPast: onlyPast === "true",
    });
    return (0, response_1.success)(res, result, "Trainer shift requests");
};
exports.listTrainerMine = listTrainerMine;
// NEW: GET /api/shift-requests/mine
// Smart router: participant → listForParticipant, trainer → listForTrainer
const listMine = async (req, res) => {
    if (!req.user)
        throw new errors_1.AppError("Unauthorized", 401);
    const { page, limit, status, dateFrom, dateTo, sort, onlyUpcoming, onlyPast } = req.query;
    const result = await ShiftRequestService.listMine(req.user.userId, req.user.role, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: Array.isArray(status)
            ? status
            : status
                ? [status]
                : undefined,
        dateFrom: dateFrom,
        dateTo: dateTo,
        sort: sort || "createdAt:desc",
        onlyUpcoming: onlyUpcoming === "true",
        onlyPast: onlyPast === "true",
    });
    return (0, response_1.success)(res, result, "My shift requests");
};
exports.listMine = listMine;
const clockInShiftAsTrainer = async (req, res) => {
    if (!req.user)
        throw new errors_1.AppError("Unauthorized", 401);
    if (req.user.role !== "TRAINER")
        throw new errors_1.AppError("Forbidden", 403);
    const { requestId } = req.body;
    const shift = await ShiftRequestService.clockInShiftAsTrainer({
        trainerUserId: req.user.userId,
        shiftRequestId: requestId,
    });
    return (0, response_1.success)(res, shift, "Shift clock-in started");
};
exports.clockInShiftAsTrainer = clockInShiftAsTrainer;
const clockOutShiftAsTrainerController = async (req, res) => {
    if (!req.user)
        throw new errors_1.AppError("Unauthorized", 401);
    if (req.user.role !== "TRAINER")
        throw new errors_1.AppError("Forbidden", 403);
    const { requestId, report } = req.body;
    const { activities, progress, incidents, km } = (report || {});
    const result = await ShiftRequestService.clockOutShiftAsTrainer({
        trainerUserId: req.user.userId,
        shiftRequestId: requestId,
        report: { activities, progress, incidents, km },
    });
    return (0, response_1.success)(res, result, "Shift clocked out");
};
exports.clockOutShiftAsTrainerController = clockOutShiftAsTrainerController;
/**
 * GET /api/shift-requests/past
 * Role-aware list of PAST (COMPLETED) shifts including:
 * - shift details
 * - participant & trainer (with trainer email)
 * - matching timesheet item + timesheet meta
 *
 * Trainer/Participant -> returns only their own past shifts.
 * Admin -> can filter by trainerId/participantId (accepts Trainer._id/User._id and Participant._id/User._id).
 *
 * Query: ?page=&pageSize=&dateFrom=&dateTo=&trainerId=&participantId=
 */
const listPastShiftsWithTimesheets = async (req, res) => {
    if (!req.user)
        throw new errors_1.AppError("Unauthorized", 401);
    const { page = "1", pageSize = "20", dateFrom, dateTo, trainerId, participantId, } = req.query;
    const result = await ShiftRequestService.listPastShiftsWithTimesheets({
        viewer: { id: req.user.userId, role: req.user.role }, // "TRAINER" | "PARTICIPANT" | "ADMIN"
        page: parseInt(String(page), 10),
        pageSize: parseInt(String(pageSize), 10),
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        trainerId: trainerId || undefined,
        participantId: participantId || undefined,
    });
    return (0, response_1.success)(res, result, "Past shifts with timesheets fetched");
};
exports.listPastShiftsWithTimesheets = listPastShiftsWithTimesheets;
/**
 * GET /api/dashboard/trainer/summary
 * Returns: { totalShifts, totalUpcoming, nextShift, generatedAt }
 *
 * - TRAINER: summary for the logged-in trainer (by userId)
 * - ADMIN: must provide ?trainerId= (accepts Trainer._id or User._id)
 */
const trainerDashboardSummary = async (req, res) => {
    if (!req.user)
        throw new errors_1.AppError("Unauthorized", 401);
    const role = req.user.role;
    const { trainerId } = req.query;
    if (role !== "TRAINER" && role !== "ADMIN") {
        throw new errors_1.AppError("Forbidden", 403);
    }
    const summary = await ShiftRequestService.getTrainerShiftSummary({
        viewer: { id: req.user.userId, role: role },
        trainerId: trainerId ? String(trainerId) : undefined,
    });
    return (0, response_1.success)(res, summary, "Trainer dashboard summary");
};
exports.trainerDashboardSummary = trainerDashboardSummary;
const adminDashboardSummary = async (req, res) => {
    if (!req.user)
        throw new errors_1.AppError("Unauthorized", 401);
    if (req.user.role !== "ADMIN")
        throw new errors_1.AppError("Forbidden", 403);
    const { dateFrom, dateTo } = req.query;
    const data = await ShiftRequestService.getAdminDashboardSummary({
        dateFrom: dateFrom,
        dateTo: dateTo,
    });
    return (0, response_1.success)(res, data, "Admin dashboard summary");
};
exports.adminDashboardSummary = adminDashboardSummary;
