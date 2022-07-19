const mongoose = require("mongoose");
const {verifyOrigin} = require("../middlewares/verifyOrigin");
const Recibo = mongoose.model("recibos");
module.exports = (app)=>{
  app.post("/api/getrecibo",verifyOrigin, async (req,res)=>{
    try{
      const {_recibo} = req.body;
      console.log(req.body)
      const recibo = await Recibo.findOne({_id:_recibo});     
      if(!recibo) return res.send({mensaje:"recibo not found"})
      return res.send({mensaje:"success",recibo});
    }catch(e){
      console.log(e.message)
      return res.send({mensaje:e.message})
    }
    
  });
}