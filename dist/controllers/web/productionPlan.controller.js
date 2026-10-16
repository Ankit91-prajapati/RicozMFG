import { ProductionPlan } from "../../models/productionPlan.model.js";
export const createProductionPlan = async (req, res) => {
    const plan = await ProductionPlan.create(req.body);
    res.status(201).json({
        success: true,
        message: "Production plan created successfully",
        data: plan,
    });
};
export const getProductionPlans = async (_req, res) => {
    const plans = await ProductionPlan.find()
        .populate("product", "name code type")
        .sort({ createdAt: -1 })
        .lean();
    res.json({
        success: true,
        data: plans,
    });
};
export const getProductionPlan = async (req, res) => {
    const plan = await ProductionPlan.findById(req.params.id).populate("product", "name code type");
    if (!plan) {
        return res.status(404).json({
            success: false,
            message: "Production plan not found",
        });
    }
    res.json({
        success: true,
        data: plan,
    });
};
export const updateProductionPlan = async (req, res) => {
    const plan = await ProductionPlan.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!plan) {
        return res.status(404).json({
            success: false,
            message: "Production plan not found",
        });
    }
    res.json({
        success: true,
        message: "Production plan updated successfully",
        data: plan,
    });
};
export const deleteProductionPlan = async (req, res) => {
    const plan = await ProductionPlan.findByIdAndDelete(req.params.id);
    if (!plan) {
        return res.status(404).json({
            success: false,
            message: "Production plan not found",
        });
    }
    res.json({
        success: true,
        message: "Production plan deleted successfully",
    });
};
