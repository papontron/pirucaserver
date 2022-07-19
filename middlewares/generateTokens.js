const jwt = require("jsonwebtoken");
const keys = require("../keys/keys");

const getToken = (anId)=>{
  const token = jwt.sign({id:anId},keys.tokenSecret,{expiresIn:"30m"})
  return token;
}
const getRefreshToken = (anEmail)=>{
  const refreshToken = jwt.sign({email:anEmail},keys.refreshTokenSecret,{expiresIn:"1d"});
  return refreshToken;
}

module.exports = {getToken, getRefreshToken};