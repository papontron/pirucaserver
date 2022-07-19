exports.verifyCoins = (req,res,next)=>{
  const {user}  = req;
  const {token,refreshToken} = user;
  const {montoTotal} = req.body;
  //calculamos el monto total:
  if(user.easyCoins<montoTotal){
    return res.send({
      mensaje:"no tienes suficientes fondos",
      token,
      refreshToken
    })
  }
  next();
}