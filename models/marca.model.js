const mongoose = require("mongoose");
const marcaSchema = new mongoose.Schema({
  nombre:{type:String,required:true},
  codigo:{type:String,required:true,unique:true}
},{timestamps:true});
const Marca = new mongoose.model("marcas",marcaSchema);