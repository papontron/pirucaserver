const mongoose = require("mongoose");
const productoSchema = new mongoose.Schema({
  _tiendas:[{type:mongoose.Schema.Types.ObjectId, ref:"Tienda"}],
  nombre:{type:String,required:true},
  descripcion:{type:String,required:true},
  precio:{type:Number,required:true},
  tags:{type:String,required:true},
  imagen:{type:String,required:true},
  boost:{type:Number,default:0},
  disponible:{type:Boolean,default:true},
  categoria:{type:Object,required:true},
  stock:{type:Number,default:0},
  _user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
  vendidos:{type:Number,default:0}
},{timestamps:true});
productoSchema.index({nombre:'text',tags:'text'});
const Producto = new mongoose.model("productos",productoSchema);