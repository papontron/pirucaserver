const mongoose = require("mongoose");

  // const recargaSchema = mongoose.Schema({
  //   fecha:{type:Date, default:new Date()},
  //   capturaPago:{type:String,required:true},
  //   metodoPago:{type:String,required:true},
  //   monto:{type:Number,required:true},
  //   codigoTrans:{type:String,required:true},
  //   estado:{type:String,default:"en proceso"}
  // });

  // const mensajeSchema = new mongoose.Schema({
  //   asunto:{type:String, required:true},
  //   _user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
  //   contenido:{type:String,required:true},
  //   fecha:{type:Date,default:new Date()}
  // });
  
  const userSchema = mongoose.Schema({
    imagen:{type:String},
    email:{type:String, required:true},
    nombres:{type:String, required:true},
    apellidos:{type:String,required:true},
    hash:{type:String},
    salt:String,
    token:{type:String,default:""},
    refreshToken:{type:String,default:""},
    easyCoins:{type:Number,default:0},
    telefono:{type:Number,required:true},
    direccion:{type:String,required:true},
    coordenadas:{type:Array,required:true},
    pirula:{type:String,default:"pirula"},
    _courier:{type:mongoose.Schema.Types.ObjectId,ref:"Courier",default:new mongoose.Types.ObjectId},
    //movimientos:[movimientoSchema]
    // recargas:[{type:recargaSchema,default:[]}],
    // mensajes:[{type:mensajeSchema,default:[]}]
  },{timestamps:true});

const User = new mongoose.model("users",userSchema);
//module.exports = {User}

