import mongoose from "mongoose";
import bcrypt from 'bcrypt';
import User from '../models/user.js';

const saltRounds = 10;

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

    const storedPassword = await User.findOne({
        email:req.body.email
    }).select("+password");
    const passMatch = await bcrypt.compare(req.body.password,storedPassword);
    if (!passMatch)
    {
        return res.status(401).json({status : "Invalid credentials"})
    }
    
}

export const refreshUser = async (req,res) =>
{

}