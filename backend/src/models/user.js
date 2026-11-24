import mongoose from 'mongoose';

const userSchema = mongoose.Schema(
    {
        username: {
            type:String,
            required:[true,"User name is required"],
            unique:true,
            trim:true,
            minlength:[3,"User name must be atleast of 3 characters"]

        },
        email : {
            type:String,
            required:[true,"User email is required"],
            unique:true,
            trim:true,
            lowercase:true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
        },
        password : {
            type:String,
            required:[true,"User password is required"],
            select:false
        },
        refreshToken : {
            type: String,
            default : null
        },
        role : {
            type:String,
            lowercase:true,
            default : 'user',
            validate: {validator : v=>v != null,message:"User role can not be null"}
        },
        avatar_url : {
            type: String,
            trim:true,
            default:null
        }

    }
)

const User = mongoose.model("User",userSchema);
export default User;
