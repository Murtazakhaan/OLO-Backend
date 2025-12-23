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
exports.exportTimesheet = exports.reopenTimesheet = exports.approveTimesheet = exports.submitTimesheet = exports.getTimesheetById = exports.listTimesheets = void 0;
const TimesheetSvc = __importStar(require("../services/timesheets.service"));
const errors_1 = require("../utils/errors");
const listTimesheets = async (req, res) => {
    const { status, weekStart, trainerId, page = "1", pageSize = "20" } = req.query;
    const viewer = { id: req.user.userId, role: req.user.role };
    const result = await TimesheetSvc.listTimesheets({
        viewer,
        status: status,
        weekStart: weekStart,
        trainerId: trainerId,
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
    });
    res.json({ success: true, ...result });
};
exports.listTimesheets = listTimesheets;
const getTimesheetById = async (req, res) => {
    const { id } = req.params;
    const viewer = { id: req.user.userId, role: req.user.role };
    const ts = await TimesheetSvc.getTimesheetById({ id, viewer });
    res.json({ success: true, data: ts });
};
exports.getTimesheetById = getTimesheetById;
const submitTimesheet = async (req, res) => {
    const { id } = req.params;
    const ts = await TimesheetSvc.submitTimesheet({ id, trainerUserId: req.user.userId });
    res.json({ success: true, message: "Timesheet submitted", data: ts });
};
exports.submitTimesheet = submitTimesheet;
const approveTimesheet = async (req, res) => {
    const { id } = req.params;
    const ts = await TimesheetSvc.approveTimesheet({ id, adminUserId: req.user.userId });
    res.json({ success: true, message: "Timesheet approved", data: ts });
};
exports.approveTimesheet = approveTimesheet;
const reopenTimesheet = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body ?? {};
    const ts = await TimesheetSvc.reopenTimesheet({ id, adminUserId: req.user.userId, reason });
    res.json({ success: true, message: "Timesheet reopened", data: ts });
};
exports.reopenTimesheet = reopenTimesheet;
const exportTimesheet = async (req, res) => {
    const { id } = req.params;
    const { format = "csv" } = req.query;
    const viewer = { id: req.user.userId, role: req.user.role };
    if (!["csv", "pdf"].includes(String(format)))
        throw new errors_1.AppError("Unsupported format", 400);
    const { filename, mime, buffer } = await TimesheetSvc.exportTimesheet({ id, viewer, format });
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", mime);
    res.send(buffer);
};
exports.exportTimesheet = exportTimesheet;
