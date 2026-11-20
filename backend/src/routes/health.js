import express from 'express';

const getHealth = (req,res) =>
{
    res.status(200).json({
        status : "Server is running smoothly"
    })
}

const router = express.Router();
router.get("/",getHealth);
export default router;