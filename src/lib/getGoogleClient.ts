import { OAuth2Client } from "google-auth-library";

const getGoogleClient = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
     const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
     const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  return (
     
     new OAuth2Client({
       clientId,
       clientSecret,
       redirectUri
   
     })
  )
}

export default getGoogleClient