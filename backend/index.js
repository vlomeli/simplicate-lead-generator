import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

//load environment variables form .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

//Global middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})