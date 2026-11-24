import express from 'express';
import expressRateLimit from 'express-rate-limit';
import {registerUser,loginUser,refreshUser} from '../controllers/profileController.js';

//Initialize Rate Limiters
const loginRateLimiter = new expressRateLimit({
    windowMs : 1000 * 60 * 15,
    max: 5,
    message : {status : "Too many login attempts in short period of time"}
})

const refreshRateLimiter = new expressRateLimit({
    windowMs : 1000 * 60 * 15,
    max: 20,
    message : {status : "Too many refresh attempts in short period of time"}
})

const router = express.Router();
router.post("/register",registerUser);
router.post("/login",loginRateLimiter,loginUser);
router.post("/refresh",refreshRateLimiter,refreshUser);

export default router;