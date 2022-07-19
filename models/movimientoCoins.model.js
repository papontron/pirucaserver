const mongoose = require("mongoose");


const movimientoSchema = mongoose.Schema({
  _user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
  movimientos:[{
    tipo:{type:String,required:true,enum:["compra","venta","recarga"]},
    _recibo:{type:String,required:true},
  }]
});
const Movimiento = new mongoose.model("movimientos",movimientoSchema);