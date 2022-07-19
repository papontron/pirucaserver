const mongoose = require("mongoose");
const subVentaSchema = new mongoose.Schema({
  _vendedor:{type:mongoose.Schema.Types.ObjectId, ref:"User"},
  vendedor:{type:String},
  _courier:{type:mongoose.Schema.Types.ObjectId,ref:"Courier"},
  tiendas:[{
    _tienda:{type:mongoose.Schema.Types.ObjectId,ref:"Tienda"},
    nombre:{type:String},
    codigoEntrega:{type:String,required:true}, 
    estado:{type:String,enum:["en tienda","en camino","entregado","expirado","cancelado","no entregado"],default:"en tienda"},
    monto:{type:Number,required:true},
    productos:[{
      _producto:{type:mongoose.Schema.Types.ObjectId, ref:"Producto"},
      precioUnit:{type:Number,required:true},
      cantidad:{type:Number,required:true},
      monto:{type:Number,required:true},
      cobrado:{type:Boolean,default:false},
      nombre:{type:String},
      descripcion:{type:String},
      imagen:{type:String}
    }]
  }],
  subTotal:{type:Number,required:true},
  estado:{type:String,enum:["pendiente",
  "iniciado","expirado","entregado","cancelado","finalizado"],default:"pendiente"},//cambiar a String->pendiente,entregado,cancelado

},{timestamps:true});
const reciboSchema = new mongoose.Schema({
  fechaVencimiento:{type:Number,required:true},
  _comprador:{type:mongoose.Schema.Types.ObjectId, ref:"User"},
  comprador:{type:String},
  monto:{type:Number,required:true},
  precioDelivery:{type:Number,required:true},
  montoTotal:{type:Number,required:true},
  venta:[{type:subVentaSchema,default:[]}],
  estado:{type:String,enum:['pendiente','iniciado','cancelado','finalizado','expirado'],default:"pendiente"},//cambiar a pendiente,finalizado,cancelado
  cobradoTotalmente:{type:Boolean,default:false},
  devolucion:{type:Number,default:0}
},{timestamps:true});
const Recibo = new mongoose.model("recibos",reciboSchema);