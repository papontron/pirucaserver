const jwt = require("jsonwebtoken");
const { default: mongoose } = require("mongoose");
require("../models/user.model");
const keys = require("../keys/keys");
const {getToken,getRefreshToken} = require("./generateTokens");

const User = mongoose.model("users");

async function verifyCredentials(req,res,next){
  const {token, refreshToken} = req.body;
  if(!token||!refreshToken) return res.send({mensaje:"No está autorizado"})
  try{
    const verifiedToken = jwt.verify(token,keys.tokenSecret);
    const verifiedRefreshToken = jwt.verify(refreshToken,keys.refreshTokenSecret);
    const id = verifiedToken.id;
    const email = verifiedRefreshToken.email;
    console.log("verifying credentials");
    const foundUser = await User.findOne({
      id,
      email,
      token,
      refreshToken
    });
    // const foundUser = await User.findById(id);
    if(verifiedToken&&verifiedRefreshToken&&foundUser){
      const token = getToken(foundUser.id);
      const refreshToken = getRefreshToken(foundUser.email);
      foundUser.token = token;
      foundUser.refreshToken = refreshToken;
      const user = await foundUser.save();
      req.user = user;
      return next();         
    }else{
      return res.send({mensaje:"no está autorizado"});
    }
  }catch(error){
    return res.send({mensaje:error.message})
  }

}
module.exports = {verifyCredentials};