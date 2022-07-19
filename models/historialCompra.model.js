const mongoose = require("mongoose");
const compraSchema = new mongoose.Schema({
  _recibo:{type:mongoose.Schema.Types.ObjectId,ref:"Recibo"},
  estado:{
    type:String,
    enum:["pendiente","iniciado","cancelado","en camino","entregado","expirado","finalizado"]
  },//pendiente,recibido,cancelado
  monto:{type:Number,required:true},
  precioDelivery:{type:Number,required:true},
  montoTotal:{type:Number,required:true},
  codigoRecepcion:{type:String,required:true},
  fechaVencimiento:{type:Number,required:true},
  devolucion:{type:Number,default:0},
  //ticket:{type:String,required:true,default:""}
},{timestamps:true})
const historialCompraSchema = new mongoose.Schema({
  _user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
  compras:[compraSchema]
},{timestamps:true});
const HistorialCompra = new mongoose.model("historialcompras",historialCompraSchema);