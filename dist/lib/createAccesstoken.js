import jwt from "jsonwebtoken";
const createAccesstoken = (id, role, tokenVersion) => {
    const payload = { id, role, tokenVersion };
    return (jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "30min" }));
};
export default createAccesstoken;
