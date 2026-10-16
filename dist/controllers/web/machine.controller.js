import { Machine } from "../../models/machine.model.js";
export const createMachine = async (req, res) => {
    const machine = await Machine.create(req.body);
    res.status(201).json({
        success: true,
        message: "Machine created successfully",
        data: machine,
    });
};
export const getMachines = async (_req, res) => {
    const machines = await Machine.find()
        .sort({ createdAt: -1 })
        .lean();
    res.json({
        success: true,
        data: machines,
    });
};
export const getMachine = async (req, res) => {
    const machine = await Machine.findById(req.params.id);
    if (!machine) {
        return res.status(404).json({
            success: false,
            message: "Machine not found",
        });
    }
    res.json({
        success: true,
        data: machine,
    });
};
export const updateMachine = async (req, res) => {
    const machine = await Machine.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!machine) {
        return res.status(404).json({
            success: false,
            message: "Machine not found",
        });
    }
    res.json({
        success: true,
        message: "Machine updated successfully",
        data: machine,
    });
};
export const deleteMachine = async (req, res) => {
    const machine = await Machine.findByIdAndDelete(req.params.id);
    if (!machine) {
        return res.status(404).json({
            success: false,
            message: "Machine not found",
        });
    }
    res.json({
        success: true,
        message: "Machine deleted successfully",
    });
};
