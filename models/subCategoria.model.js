const mongoose = require("mongoose");
const subCategoriaSchema = new mongoose.Schema({
  nombre:{type:String,required:true},
  codigo:{type:String,required:true,unique:true},
  _categoria:{type:mongoose.Schema.Types.ObjectId,ref:"Categoria",required:true}
},{timestamps:true});
const SubCategoria = new mongoose.model("subcategorias",subCategoriaSchema);