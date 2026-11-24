import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './src/routes/health.js';
import profileRouter from './src/routes/profile.js'
import { connectDB } from './src/config/db.js';

//Connect Database
connectDB();

//Express Server
const app = express();

//Add Server Middlwares
app.use(helmet());
app.use(cookieParser());
app.use(cors(
    {
        credentials:true,
        origin:process.env.CLIENT_URL
    }
))

//Server Routes
app.use('/health',healthRouter);
app.use('/profile',profileRouter);

app.listen(process.env.PORT, ()=> {
    console.log(`Server is running on PORT ${process.env.PORT}`);
})