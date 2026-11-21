import mongoose from 'mongoose'
export const connectDB = async () =>
{
    try
    {
        const conn = await mongoose.connect(process.env.DATABASE);
        console.log("Mongodb Connection Successfull : ",conn.connection.host);
    }
    catch(error)
    {
        console.log("Database Connection Failed : ",error.message);
        process.exit(1)
    }
}