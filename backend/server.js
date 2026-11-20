import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import healthRouter from './src/routes/health.js';


//Express Server
const app = express();

//Add Server Middlwares


//Server Routes
app.use('/health',healthRouter);

app.listen(process.env.PORT, ()=> {
    console.log(`Server is running on PORT ${process.env.PORT}`);
})