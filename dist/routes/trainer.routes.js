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
const express_1 = require("express");
const TrainerController = __importStar(require("../controllers/trainer.controller"));
const catchAsync_1 = require("../utils/catchAsync");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
router.post("/onboarding", upload_1.upload.fields([
    { name: "ndisCheck", maxCount: 1 },
    { name: "wwcc", maxCount: 1 },
    { name: "licence", maxCount: 1 },
    { name: "firstAid", maxCount: 1 },
    { name: "cpr", maxCount: 1 },
    { name: "qualification", maxCount: 1 },
]), (0, catchAsync_1.catchAsync)(TrainerController.upsertTrainer));
router.get("/me", (0, catchAsync_1.catchAsync)(TrainerController.getTrainer));
router.get("/", (0, catchAsync_1.catchAsync)(TrainerController.getAllTrainers));
router.patch("/:id/status", (0, catchAsync_1.catchAsync)(TrainerController.updateTrainerStatus));
exports.default = router;
