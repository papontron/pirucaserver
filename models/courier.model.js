const mongoose = require("mongoose");
const courierSchema = new mongoose.Schema({
  nombres:{type:String,required:true},
  apellidos:{type:String,required:true},
  telefono:{type:String, required:true},
  coordenadas:{type:Array,required:true},
  email:{type:String,requird:true}
})
const Courier = new mongoose.model("couriers",courierSchema);