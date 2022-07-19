const mongoose = require("mongoose");
const {getHashSalt} = require("./generateHash");
const {getToken,getRefreshToken} = require("./generateTokens");
require("../models/user.model");

const User = mongoose.model("users");

async function verifyPassword(req,res,next){
  console.log("verificando email y password gaa");
  try{
    console.log({body:req.body})
    const {email,password} = req.body;
    const foundUser = await User.findOne({email}).select("+hash +salt");
    if(!foundUser){
      return res.send({mensaje:"usuario o password incorrectos"});  
    }
    const {hash} = getHashSalt(password,foundUser.salt);
    if(hash===foundUser.hash){
      const token = getToken(foundUser.id);
      const refreshToken = getRefreshToken(foundUser.email);
      foundUser.token = token;
      foundUser.refreshToken = refreshToken;
      const user = await foundUser.save()
      req.user = user;
      return next();
    }
    return res.send( {mensaje:"usuario o password incorrectos"})
  }catch(error){
    return res.send({mensaje:error})
  }
}
module.exports = {verifyPassword}