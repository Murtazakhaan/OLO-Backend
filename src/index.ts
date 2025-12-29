import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { ENV } from "./config/env";
import healthRouter from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";
import routes from './routes'
import { connectDB } from "./utils/mongoose";
import path from "path";
import cookieParser from "cookie-parser";




const app = express();

// Middleware
app.use(helmet());
const FRONTEND_ORIGIN = "https://olo-frontend.onrender.com";


export   const corsOptions = {
    origin: ["https://olo-frontend.onrender.com", "https://itsolo.com.au/", 'http://localhost:3000'],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
};

app.use(cors(corsOptions));
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(morgan("dev"));

app.use(express.json());
 app.disable("x-powered-by");

// Routes
app.use("/health", healthRouter);

// Root 
app.get("/", (_, res) => {
  res.send("CareLink API is running 🚀");
});

// serve static uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

connectDB();

// Centralized routes
app.use("/api", routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(ENV.PORT, () => {
  console.log(`⚡️ Server running in ${ENV.NODE_ENV} on http://localhost:${ENV.PORT}`);
});
