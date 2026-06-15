import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

export default generateToken;
