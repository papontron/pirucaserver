const mongoose = require("mongoose");

const categoriaSchema = new mongoose.Schema(
  {
  nombre:{type:String,required:true},
  codigo:{type:String,required:true,unique:true}
  },
  {timestamps:true}
  );

const Categoria = new mongoose.model("categorias",categoriaSchema);