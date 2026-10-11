import 'dotenv/config'
import nodemailer from "nodemailer"

export default async function  sendVerifyEmail(to:string , subject:string ,text:string ){
    if(!process.env.BREVO_HOST ||!process.env.BREVO_PORT ||!process.env.BREVO_PASS){
        throw new Error("mail env are missing")
    }

    const transporter = nodemailer.createTransport({
    host:process.env.BREVO_HOST,
    port:Number(process.env.BREVO_PORT),
    secure: false,
    auth:{
        user:process.env.BREVO_USER,
        pass:process.env.BREVO_PASS
    }
    })

    await transporter.sendMail({from:process.env.SENDER_EMAIL , to , subject , text:text })
}
