const mongoose = require("mongoose");

const recargaSchema = new mongoose.Schema({
  fecha:{type:Date, default:new Date()},
  capturaPago:{type:String,required:true},
  metodoPago:{type:String,required:true},
  monto:{type:Number,required:true},
  codigoTrans:{type:String,required:true},
  estado:{type:String, required:true,enum:["pendiente","aprobado","rechazado"]}
},{timestamps:true});
const historialRecargaSchema = new mongoose.Schema({
  _user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
  recargas:[{type:recargaSchema,default:[]}]
});
const HistorialRecarga = new mongoose.model("historialrecargas",historialRecargaSchema);