const {Server} = require("socket.io");
const keys = require("./keys/keys");
let io;

module.exports = {
  init:(server)=>{
    io = new Server(server,{cors:{origin:keys.corsOrigin},pingTimeout:60000});
    return io;
  },
  getIo:()=>{//cuando se necesite requereir otra instancia de wss que ya a sido inicializada, lo haremos con este método
    if(!io){
      throw new Error('io server hasnt been initialized yet');
    }
    return io;
  }
}