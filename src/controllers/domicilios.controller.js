import pool from "../config/db.js";
import { DOMICILIOS_QUERIES } from "../queries/domicilios.queries.js";
import { enviarCorreoEntrega, enviarCorreoDomicilioCreado } from "../services/email.service.js";

const ESTADOS_VALIDOS = [
  "PENDIENTE",
  "EN_CAMINO",
  "ENTREGADO",
  "CANCELADO",
];

const TRANSICIONES_ESTADO = {
  PENDIENTE: ["EN_CAMINO", "CANCELADO"],
  EN_CAMINO: ["ENTREGADO", "CANCELADO"],
  ENTREGADO: [],
  CANCELADO: [],
};



// ==========================================
// LISTAR DOMICILIOS
// ==========================================
export const listarDomicilios = async (req, res) => {

  const { search, estado } = req.query;


  try {

    let result;


    if(search){

      result = await pool.query(
        DOMICILIOS_QUERIES.SEARCH,
        [
          `%${search}%`,
          search
        ]
      );


    } else if(estado){


      result = await pool.query(
        DOMICILIOS_QUERIES.FILTER_ESTADO,
        [
          estado
        ]
      );


    } else {


      result = await pool.query(
        DOMICILIOS_QUERIES.LIST
      );

    }



    res.json({

      ok:true,

      data:result.rows

    });



  } catch(error){

    console.error(
      "Error listar domicilios:",
      error
    );


    res.status(500).json({

      ok:false,

      message:"Error al listar domicilios."

    });

  }

};





// ==========================================
// OBTENER DOMICILIO POR ID
// ==========================================
export const obtenerDomicilio = async(req,res)=>{


  try{


    const {id}=req.params;



    const result = await pool.query(

      DOMICILIOS_QUERIES.FIND_BY_ID,

      [id]

    );



    if(!result.rows.length){


      return res.status(404).json({

        ok:false,

        message:"Domicilio no encontrado."

      });

    }



    res.json({

      ok:true,

      data:result.rows[0]

    });



  }catch(error){


    console.error(
      "Error obtener domicilio:",
      error
    );



    res.status(500).json({

      ok:false,

      message:"Error del servidor."

    });

  }

};







// ==========================================
// CREAR DOMICILIO
// ==========================================
export const crearDomicilio = async(req,res)=>{


  try{


    const {

      venta_id,

      cliente_id,

      empleado_id,

      barrio,

      direccion,

      referencias


    } = req.body;




    if(!cliente_id || !direccion || !barrio){


      return res.status(400).json({

        ok:false,

        message:"Cliente, barrio y dirección son obligatorios."

      });

    }





    const result = await pool.query(

      DOMICILIOS_QUERIES.CREATE,

      [

        venta_id || null,

        cliente_id,

        empleado_id || null,

        barrio,

        direccion,

        referencias || ""

      ]

    );




    const domicilio = await pool.query(
      DOMICILIOS_QUERIES.FIND_BY_ID,
      [
        result.rows[0].id_domicilio
      ]
    );

    // Correo de domicilio creado
    try {
      const datosCorreo = await pool.query(DOMICILIOS_QUERIES.OBTENER_CORREO, [result.rows[0].id_domicilio]);
      const cli = datosCorreo.rows[0];
      if (cli?.email) {
        enviarCorreoDomicilioCreado({
          correo:      cli.email,
          nombre:      cli.nombre,
          direccion:   cli.direccion,
          barrio:      cli.barrio,
          referencias: cli.referencias || "",
        }).catch(err => console.error('[email] Domicilio creado:', err.message));
      }
    } catch (_) {}

    res.status(201).json({
      ok:true,
      message:"Domicilio creado correctamente.",
      data:domicilio.rows[0]
    });





  }catch(error){


    console.error(
      "Error crear domicilio:",
      error
    );



    res.status(500).json({

      ok:false,

      message:"Error al registrar domicilio."

    });

  }

};








// ==========================================
// EDITAR DOMICILIO
// ==========================================
export const editarDomicilio = async(req,res)=>{


  try{


    const {id}=req.params;



    const actual = await pool.query(

      DOMICILIOS_QUERIES.FIND_BY_ID,

      [id]

    );



    if(!actual.rows.length){


      return res.status(404).json({

        ok:false,

        message:"Domicilio no encontrado."

      });

    }




    const estadoActual = actual.rows[0].estado;



    if(

      estadoActual==="ENTREGADO" ||

      estadoActual==="CANCELADO"

    ){


      return res.status(400).json({

        ok:false,

        message:"No se puede editar este domicilio."

      });

    }





    const {

      venta_id,

      cliente_id,

      empleado_id,

      barrio,

      direccion,

      referencias


    } = req.body;





    const result = await pool.query(

      DOMICILIOS_QUERIES.UPDATE,

      [

        venta_id || null,

        cliente_id,

        empleado_id || null,

        barrio,

        direccion,

        referencias || "",

        id

      ]

    );





    res.json({

      ok:true,

      message:"Domicilio actualizado.",

      data:result.rows[0]

    });





  }catch(error){


    console.error(
      "Error editar domicilio:",
      error
    );


    res.status(500).json({

      ok:false,

      message:"Error al actualizar domicilio."

    });


  }

};


// ==========================================
// CAMBIAR ESTADO
// ==========================================
export const cambiarEstadoDomicilio = async(req,res)=>{


  try{


    const {id}=req.params;


    const {estado}=req.body;




    if(!ESTADOS_VALIDOS.includes(estado)){


      return res.status(400).json({

        ok:false,

        message:"Estado inválido."

      });

    }





    const actual = await pool.query(

      DOMICILIOS_QUERIES.FIND_BY_ID,

      [id]

    );



    if(!actual.rows.length){


      return res.status(404).json({

        ok:false,

        message:"Domicilio no encontrado."

      });

    }




    const estadoActual = actual.rows[0].estado;




    if(!TRANSICIONES_ESTADO[estadoActual].includes(estado)){


      return res.status(400).json({

        ok:false,

        message:
        `No se puede cambiar de ${estadoActual} a ${estado}.`

      });

    }






    const result = await pool.query(

      DOMICILIOS_QUERIES.CAMBIAR_ESTADO,

      [

        estado,

        id

      ]

    );







    // Preparación para correo cuando se entrega

    if(estado === "ENTREGADO"){
      const datosCorreo = await pool.query(DOMICILIOS_QUERIES.OBTENER_CORREO, [id]);
      const cliente = datosCorreo.rows[0];
      if(cliente?.email){
        await enviarCorreoEntrega({
          correo: cliente.email,
          nombre: cliente.nombre,
        });
        console.log("Correo de entrega enviado a:", cliente.email);
      }
    }




    res.json({

      ok:true,

      message:"Estado actualizado.",

      data:result.rows[0]

    });





  }catch(error){


    console.error(
      "Error cambiar estado:",
      error
    );



    res.status(500).json({

      ok:false,

      message:"Error al cambiar estado."

    });


  }

};

// ==========================================
// CANCELAR DOMICILIO
// ==========================================
export const cancelarDomicilio = async(req,res)=>{


  try{


    const {id}=req.params;



    const actual = await pool.query(

      DOMICILIOS_QUERIES.FIND_BY_ID,

      [id]

    );



    if(!actual.rows.length){


      return res.status(404).json({

        ok:false,

        message:"Domicilio no encontrado."

      });

    }





    if(

      actual.rows[0].estado==="ENTREGADO"

    ){


      return res.status(400).json({

        ok:false,

        message:"No puedes cancelar un domicilio entregado."

      });

    }





    const result = await pool.query(

      DOMICILIOS_QUERIES.CANCELAR,

      [id]

    );





    res.json({

      ok:true,

      message:"Domicilio cancelado.",

      data:result.rows[0]

    });






  }catch(error){


    console.error(
      "Error cancelar domicilio:",
      error
    );



    res.status(500).json({

      ok:false,

      message:"Error al cancelar domicilio."

    });


  }

};
// ==========================================
// OBTENER MIS DOMICILIOS CLIENTE
// ==========================================
export const obtenerMisDomicilios = async (req, res) => {

  try {

    const { id_usuario } = req.usuario;


    const result = await pool.query(

      `
      SELECT
        d.id_domicilio,
        d.venta_id,
        d.barrio,
        d.direccion,
        d.referencias,
        d.estado,
        d.created_at,
        d.updated_at

      FROM domicilios d

      INNER JOIN clientes c
        ON c.id_cliente = d.cliente_id

      WHERE c.usuario_id = $1

      ORDER BY d.id_domicilio DESC
      `,

      [
        id_usuario
      ]

    );


    res.json({

      ok: true,

      data: result.rows

    });


  } catch(error) {


    console.error(
      "Error obtener mis domicilios:",
      error
    );


    res.status(500).json({

      ok:false,

      message:"Error al obtener domicilios."

    });


  }

};