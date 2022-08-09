
const mongoose = require("mongoose");
const ventaSchema = new mongoose.Schema({
  _recibo:{type:mongoose.Schema.Types.ObjectId,ref:"Recibo"},
  _comprador:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
  comprador:{type:String},
  _ventaId:{type:mongoose.Schema.Types.ObjectId,required:true},
  _courier:{type:mongoose.Schema.Types.ObjectId,ref:"Courier"},
  ticket:{type:String},
  tiendas:[{
    _tienda:{type:mongoose.Schema.Types.ObjectId,ref:"Tienda"},
    tienda:{type:Object},
    codigoEntrega:{type:String,required:true},
    estado:{type:String,enum:["en tienda","en camino","entregado","cancelado","finalizado","expirado","no entregado"],default:"en tienda"},
    productos:[{
      _producto:{type:mongoose.Schema.Types.ObjectId, ref:"Producto"},
      precioUnit:{type:Number,required:true},
      cantidad:{type:Number,required:true},
      monto:{type:Number,required:true},
      cobrado:{type:Boolean,default:false},

      nombre:{type:String},
      descripcion:{type:String},
      imagen:{type:String}
    }],
    monto:{type:Number,required:true}
  }],
  //ticket:{type:String,required:true,default:""},
  entregadoCourier:{type:Boolean,default:false},
  entregadoCliente:{type:Boolean,default:false},
  montoTotal:{type:Number,required:true},
  devolucion:{type:Number,default:0},
  fechaVencimiento:{type:Number,requuired:true},
  estado:{
    type:String,
    enum:["pendiente","iniciado","cancelado","en camino","entregado","expirado","finalizado","no entregado"]
  }//en camino cuando ya se entregó al courier//el vendedor cambiara a procesando
},{timestamps:true})
const historialVentaSchema = new mongoose.Schema({
  _user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
  ventas:[ventaSchema]
},{timestamps:true});
const HistorialVenta = new mongoose.model("historialventas",historialVentaSchema);