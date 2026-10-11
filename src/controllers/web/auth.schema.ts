import z from "zod"

 export const userRegisterSchema = z.object({
    username:z.string().min(3),
    email:z.email(),
    password:z.string().min(6)
})

export const userLoginSchema = z.object({
    email:z.email(),
    password:z.string().min(6)
})

