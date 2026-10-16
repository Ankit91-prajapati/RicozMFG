import jwt from "jsonwebtoken";
const createRefreshtoken = (id, tokenVersion) => {
    const payload = { id, tokenVersion };
    return (jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: "7d" }));
};
export default createRefreshtoken;
