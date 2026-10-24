import jwt from "jsonwebtoken"

const createAccesstoken = (id:string ,role:"user"|"admin", tokenVersion:number) => {
    const payload = {id , role ,tokenVersion}

  return (
       jwt.sign(payload ,process.env.JWT_SECRET! , {expiresIn:"15min"})
     )
}

export default createAccesstoken