import mongoose from "mongoose";
import bcrypt from 'bcrypt';
import User from '../models/user.js';
import {SignJWT} from 'jose';

const saltRounds = 10;
const jwtAccess = process.env.JWT_ACCESS
const jwtRefresh = process.env.JWT_REFRESH

export const registerUser = async(req,res) =>
{
    if (!req.body?.username || !req.body?.email || !req.body?.password)
    {
        return res.status(400).json({status: "Invalid register request"});
    }
    
    const passwordHash = await bcrypt.hash(req.body.password,saltRounds);
    req.body.password = passwordHash;
    try
    {
        await User.create(req.body);
        res.status(201).json({status:"User registration is successful"})
    }
    catch (err)
    {
        res.status(422).json({status:"Model validation has failed"})
    }

}

export const loginUser = async (req,res) =>
{
    if (!req.body?.email || !req.body?.password)
    {
        return res.status(400).json({status: "Invalid login request"});   
    }
    
    const user = await User.findOne({
        email:req.body.email
    }) // Returns null if there is no user document with matching email

    if (!user)
    {
        return res.status(401).json({status : "Invalid credentials"})
    }
    const storedPassword = user.select("+password");
    const passMatch = await bcrypt.compare(req.body.password,storedPassword);
    if (!passMatch)
    {
        return res.status(401).json({status : "Invalid credentials"})
    }

    const payload = {
        id : user._id,
        username : user.username,
        email : user.email,
        role : user.role,
        avatar_url : user.avatar_url
    }

    const accessToken = await new SignJWT(payload)
        .setProtectedHeader({alg : 'HS256'})
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(jwtAccess);
    
    const refreshToken = await new SignJWT(payload)
        .setProtectedHeader({alg:'HS256'})
        .setIssuedAt()
        .setExpirationTime('1w')
        .sign(jwtRefresh);
    
    
}

export const refreshUser = async (req,res) =>
{

}