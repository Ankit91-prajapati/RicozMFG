import { BOM } from "../../models/bom.model.js";
export const createBOM = async (req, res) => {
    const bom = await BOM.create(req.body);
    res.status(201).json({
        success: true,
        message: "BOM created successfully",
        data: bom,
    });
};
export const getBOMs = async (_req, res) => {
    const boms = await BOM.find()
        .populate("product", "name code type")
        .populate("items.product", "name code type unit")
        .sort({ createdAt: -1 })
        .lean();
    res.json({
        success: true,
        data: boms,
    });
};
export const getBOM = async (req, res) => {
    const bom = await BOM.findById(req.params.id)
        .populate("product", "name code type")
        .populate("items.product", "name code type unit");
    if (!bom) {
        return res.status(404).json({
            success: false,
            message: "BOM not found",
        });
    }
    res.json({
        success: true,
        data: bom,
    });
};
export const updateBOM = async (req, res) => {
    const bom = await BOM.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!bom) {
        return res.status(404).json({
            success: false,
            message: "BOM not found",
        });
    }
    res.status(200).json({
        success: true,
        message: "BOM updated successfully",
        data: bom,
    });
};
export const deleteBOM = async (req, res) => {
    const bom = await BOM.findByIdAndDelete(req.params.id);
    if (!bom) {
        return res.status(404).json({
            success: false,
            message: "BOM not found",
        });
    }
    res.status(200).json({
        success: true,
        message: "BOM deleted successfully",
    });
};
