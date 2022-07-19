const mongoose = require("mongoose");
const {ObjectId} = mongoose.Schema.Types;

const mensajeSchema = new mongoose.Schema({
  asunto:{type:String, required:true},
  contenido:{type:String,required:true},
  fecha:{type:Date,default:new Date()},
  nuevo:{type:Boolean, default:true},
  _recibo:{type:ObjectId,ref:"Recibo"},
  remitente:{type:String,default:"Pirula puppy bot"}
})
const buzonSchema = new mongoose.Schema({
  _user:{type:mongoose.Schema.Types.ObjectId, ref:"User"},
  mensajes:[{type:mensajeSchema, default:[]}]
})
const Buzon = new mongoose.model("buzones",buzonSchema);