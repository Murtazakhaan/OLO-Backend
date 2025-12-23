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
// src/routes/shiftRequest.routes.ts
const express_1 = require("express");
const Ctrl = __importStar(require("../controllers/shiftRequest.controller"));
const catchAsync_1 = require("../utils/catchAsync");
const auth_1 = require("../middleware/auth");
// ✅ add this import
const TimesheetCtrl = __importStar(require("../controllers/timesheets.controller"));
const router = (0, express_1.Router)();
/**
 * Participant: Create new shift request
 * POST /api/shifts/request
 */
router.post("/request", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.createShiftRequest));
/**
 * Admin: List all shift requests (filter/search/sort)
 * GET /api/shifts/admin/list
 * Query: ?page=&limit=&status=&q=&dateFrom=&dateTo=&sort=
 */
router.get("/admin/list", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.adminList));
/**
 * Admin: Approve + assign shift to trainer
 * POST /api/shifts/admin/approve
 * Body: { requestId, trainerId }
 */
router.post("/admin/approve", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.approveAndAssign));
/**
 * Admin: Decline a shift request
 * POST /api/shifts/admin/decline
 * Body: { requestId, reason? }
 */
router.post("/admin/decline", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.decline));
// new
router.get("/participant/mine", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.listParticipantMine));
router.get("/trainer/mine", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.listTrainerMine));
router.get("/mine", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.listMine));
router.post("/trainer/clock-in", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.clockInShiftAsTrainer));
router.post("/trainer/clock-out", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.clockOutShiftAsTrainerController));
router.get("/past", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.listPastShiftsWithTimesheets));
router.get("/dashboard", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.trainerDashboardSummary));
router.get("/admin/dashboard", auth_1.authenticate, (0, catchAsync_1.catchAsync)(Ctrl.adminDashboardSummary));
/* ------------------------------------------------------------------ */
/*                             TIMESHEETS                              */
/* Base path here: /api/shifts/timesheets[...] (since mounted under /api/shifts)
   If you prefer /api/timesheets, move these to a separate router file. */
/* ------------------------------------------------------------------ */
// List timesheets (trainer sees own; admin can filter by trainerId)
router.get("/timesheets", auth_1.authenticate, (0, catchAsync_1.catchAsync)(TimesheetCtrl.listTimesheets));
// Get a single timesheet (trainer own / admin any)
router.get("/timesheets/:id", auth_1.authenticate, (0, catchAsync_1.catchAsync)(TimesheetCtrl.getTimesheetById));
// Trainer submits their timesheet (status: DRAFT -> SUBMITTED)
router.post("/timesheets/:id/submit", auth_1.authenticate, (0, catchAsync_1.catchAsync)(TimesheetCtrl.submitTimesheet));
// Admin approves (status: SUBMITTED/REOPENED -> APPROVED)
router.post("/timesheets/:id/approve", auth_1.authenticate, (0, catchAsync_1.catchAsync)(TimesheetCtrl.approveTimesheet));
// Admin reopens (status: SUBMITTED/APPROVED -> REOPENED)
router.post("/timesheets/:id/reopen", auth_1.authenticate, (0, catchAsync_1.catchAsync)(TimesheetCtrl.reopenTimesheet));
// Export CSV/PDF (trainer own / admin any) -> ?format=csv|pdf
router.get("/timesheets/:id/export", auth_1.authenticate, (0, catchAsync_1.catchAsync)(TimesheetCtrl.exportTimesheet));
exports.default = router;
