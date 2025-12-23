"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const trainer_routes_1 = __importDefault(require("./trainer.routes"));
const participant_route_1 = __importDefault(require("./participant.route"));
const auth_route_1 = __importDefault(require("./auth.route"));
const shiftRequest_routes_1 = __importDefault(require("./shiftRequest.routes"));
const router = (0, express_1.Router)();
router.use("/auth", auth_route_1.default);
router.use("/trainer", trainer_routes_1.default);
router.use("/participant", participant_route_1.default);
router.use("/shifts", shiftRequest_routes_1.default);
exports.default = router;
