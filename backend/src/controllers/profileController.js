import mongoose from "mongoose";
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User from '../models/user.js';
import {SignJWT,jwtVerify} from 'jose';
import { log } from "console";

const saltRounds = 10;
const jwtAccess = new TextEncoder().encode(process.env.JWT_ACCESS);
const jwtRefresh = new TextEncoder().encode(process.env.JWT_REFRESH);


const setRefreshCookie = (res,token) =>
{
    res.cookie("refreshToken",token,{
        httpOnly:true,
        sameSite:'strict',
        secure: process.env.NODE_ENV === "production",
        path:"/api/auth/",
        maxAge: 1000 * 60 * 60 * 24 * 7
    })
}


export const registerUser = async(req,res) =>
{
    let passwordHash;
    if (!req.body?.username || !req.body?.email || !req.body?.password)
    {
        return res.status(400).json({status: "Invalid register request"});
    }
    try
    {
        passwordHash = await bcrypt.hash(req.body.password,saltRounds);
    }
    catch (error)
    {
        console.log(error);
        return res.status(422).json({status:"Internal server error"})
    }
    req.body.password = passwordHash;
    //Protect Against Unwanted Fields By Destructuring
    const {username,email,password} = req.body;

    try
    {
        await User.create({username,email,password});
        res.status(201).json({status:"User registration successful"})
    }
    catch (error)
    {
        if (error.code === 11000)
        {
            const field = Object.keys(error.keyValue || {})[0];
            return res.status(409).json({status:`${field} already exists`});
        }
        res.status(422).json({status:"Model validation failed"})
    }

}

export const loginUser = async (req,res) =>
{
    let passMatch;
    if (!req.body?.email || !req.body?.password)
    {
        return res.status(400).json({status: "Invalid login request"});   
    }
    
    const user = await User.findOne({
        email:req.body.email }).select("+password") // Returns null if there is no user document with matching email

    if (!user)
    {
        return res.status(401).json({status : "Invalid credentials"})
    }
    const storedPassword = user.password;
    try
    {
        passMatch = await bcrypt.compare(req.body.password,storedPassword);
    }
    catch (error)
    {
        passMatch = false;
    }

    if (!passMatch)
    {
        return res.status(401).json({status : "Invalid credentials"})
    }

    const payload = {
        username : user.username,
        email : user.email,
        role : user.role,
        avatar_url : user.avatar_url
    }

    const accessToken = await new SignJWT(payload)
        .setProtectedHeader({alg : 'HS256'})
        .setSubject(user._id.toString())
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(jwtAccess);
    
    const refreshToken = await new SignJWT({})
        .setProtectedHeader({alg:'HS256'})
        .setSubject(user._id.toString()) // Robust Way To Include Unique User Id Instead Of Including It In Payload
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(jwtRefresh);
    
    //Generate Refresh Token Hash And Store To Detect Token Reuse
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await User.updateOne({
        _id : user._id
        },
        {
            $set : {refreshToken : refreshTokenHash}
        });

    setRefreshCookie(res,refreshToken);
    res.status(200).json({accessToken});
}

export const refreshUser = async (req,res) =>
{
    const refreshToken = req.cookies?.refreshToken || null;
    if (!refreshToken)
    {
        return res.status(401).json({status:"No Refresh Token"})
    }
    try
    {
        const {payload} = await jwtVerify(refreshToken,jwtRefresh,{
            algorithms : ['HS256']
        });

        const user = await User.findById(payload.sub);
        if (!user)
        {
            return res.status(401).json({status : "User Not Found"});
        }

        const dbTokenHash = user.refreshToken;
        const oldTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        
        if (dbTokenHash !== oldTokenHash)
        {
            return res.status(401).json({status : "Token reuse detected"})
        }

        const newPayload = { // Always Use Fresh Payload Because User Might Have Changed Details During LOGIN-REFRESh ,So Old Payload Has Stall Claims
            username : user.username,
            email : user.email,
            role : user.role,
            avatar_url : user.avatar_url
        }

        const accessToken = await new SignJWT(newPayload)
        .setProtectedHeader({alg : 'HS256'})
        .setSubject(user._id.toString())
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(jwtAccess);
    
        const newRefreshToken = await new SignJWT({})
            .setProtectedHeader({alg:'HS256'})
            .setSubject(user._id.toString()) // Robust Way To Include Unique User Id Instead Of Including It In Payload
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(jwtRefresh);
        
        //Generate Refresh Token Hash And Store To Detect Token Reuse
        const refreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
        await User.updateOne({
            _id : user._id
            },
            {
                $set : {refreshToken : refreshTokenHash}
            });

        setRefreshCookie(res,newRefreshToken);
        res.status(200).json({accessToken});
    }
    catch(error)
    {
        res.clearCookie("refreshToken",{path:'/api/auth/'})
        res.status(401).json({status : "Invalid Refresh Token"});
    }

}

export const logoutUser = async (req,res) =>
{
    const token = req.cookies?.refreshToken || null;
    if (token)
    {
        try
        {
            const {payload} = await jwtVerify(token,jwtRefresh,{
                algorithms : ['HS256']
            })
            await User.updateOne({
                _id : payload.sub},
                {
                    $set : {refreshToken : null}
                }
            );
        }
        catch{} // Token is already invalid
    }
    res.clearCookie("refreshToken",{path: "/api/auth/"});
    res.status(200).json({status:'Logged Out'});
}