import jwt from "jsonwebtoken"

const createRefreshtoken = (id:string , tokenVersion:number) => {
    const payload = {id  ,tokenVersion}

  return (
       jwt.sign(payload ,process.env.JWT_SECRET! , {expiresIn:"7d"})
     )
}

export default createRefreshtoken