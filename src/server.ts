
import express from "express";
import "dotenv/config";
import connectDB from "./config/db.js";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRouter from "./routes/auth.routes.js";
import adminRouter from "./routes/admin.route.js";
import userRouter from "./routes/user.route.js";
import productRoutes from "./routes/product.route.js";
import machineRoutes from "./routes/machine.routes.js";
import productionPlanRoutes from "./routes/productionPlan.routes.js";
import workOrderRoutes from "./routes/workOrder.routes.js";
import operationExecutionRoutes from "./routes/operationExecution.routes.js";
import qualityIssueRoutes from "./routes/qualityIssue.routes.js";
import maintenanceWorkOrderRoutes from "./routes/maintenanceWorkOrder.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import supplierRoutes from "./routes/supplier.routes.js";
import purchaseOrderRoutes from "./routes/purchaseOrder.routes.js";
import bomRoutes from "./routes/bom.routes.js";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.VITE_FRONTEND_URL,
    credentials: true,
  })
);

// Database connection
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// Health check
app.get("/", (_req, res) => {
  res.send("Express server is working");
});

// Routes
app.use("/api/auth", authRouter);
app.use("/user", userRouter);
app.use("/admin", adminRouter);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/machines", machineRoutes);
app.use("/api/v1/production-plans", productionPlanRoutes);
app.use("/api/v1/work-orders", workOrderRoutes);
app.use("/api/v1/operation-executions", operationExecutionRoutes);
app.use("/api/v1/quality-issues", qualityIssueRoutes);
app.use("/api/v1/maintenance-work-orders", maintenanceWorkOrderRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/suppliers", supplierRoutes);
app.use("/api/v1/purchase-orders", purchaseOrderRoutes);
app.use("/api/v1/boms", bomRoutes);

// Vercel needs the Express app exported
export default app;

// Local development only
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
