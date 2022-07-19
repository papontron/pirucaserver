const keys = require("../keys/keys");

function verifyOrigin(req,res,next){
  if(req.headers.origin!==keys.corsOrigin||!req.headers.origin){
    return res.send({mensaje:"usted no esta autorizado"});
  }else{
    return next();
  }
}
module.exports={verifyOrigin};