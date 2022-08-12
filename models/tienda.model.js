const mongoose = require("mongoose");
const tiendaSchema = new mongoose.Schema({
  nombre:{type:String,required:true},
  direccion:{type:String,required:true},
  verificado:{type:Boolean,default:false},
  _user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
  telefono:{type:Number,required:true},
  // metodosPago:{type:[String], required:true},
  slogan:{type:String,default:""},
  logo:{type:String,default:"sdjfsdf"},
  descripcion:{type:String, required:true},
  tags:{type:String, required:true},
  createdAt:{type:Date,default:new Date()},
  coordenadas:{type:Array,required:true},
  rating:{type:Array,default:[]},
  ventas:{type:Number,default:0}
});
const Tienda = new mongoose.model("tiendas",tiendaSchema);