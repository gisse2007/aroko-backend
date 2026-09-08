-- =========================================
-- AROKO - Base de datos PostgreSQL
-- =========================================

CREATE DATABASE "arokoDB";
\c "arokoDB";

-- =========================================
-- ROLES Y PERMISOS
-- =========================================
CREATE TABLE roles (
    id_rol      SERIAL PRIMARY KEY,
    nombre      VARCHAR(50)  UNIQUE NOT NULL,
    descripcion VARCHAR(150),
    estado      VARCHAR(10)  DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO'))
);

CREATE TABLE permisos (
    id_permiso  SERIAL PRIMARY KEY,
    nombre      VARCHAR(50)  UNIQUE NOT NULL,
    descripcion VARCHAR(150),
    estado      VARCHAR(10)  DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO'))
);

CREATE TABLE rol_permiso (
    id_rol_permiso SERIAL PRIMARY KEY,
    rol_id         INT NOT NULL REFERENCES roles(id_rol) ON DELETE CASCADE,
    permiso_id     INT NOT NULL REFERENCES permisos(id_permiso) ON DELETE CASCADE,
    UNIQUE(rol_id, permiso_id)
);

-- =========================================
-- USUARIOS
-- =========================================
CREATE TABLE usuarios (
    id_usuario  SERIAL PRIMARY KEY,
    correo      VARCHAR(100) UNIQUE NOT NULL,
    contrasena  VARCHAR(255) NOT NULL,
    rol_id      INT NOT NULL REFERENCES roles(id_rol),
    estado      VARCHAR(10)  DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
    created_at  TIMESTAMP    DEFAULT NOW()
);

-- =========================================
-- EMPLEADOS
-- =========================================
CREATE TABLE empleados (
    id_empleado SERIAL PRIMARY KEY,
    usuario_id  INT UNIQUE REFERENCES usuarios(id_usuario),
    creado_por_id INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    nombre      VARCHAR(100) NOT NULL,
    documento   VARCHAR(20)  UNIQUE NOT NULL,
    telefono    VARCHAR(20),
    estado      VARCHAR(10)  DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO'))
);

-- =========================================
-- CLIENTES
-- =========================================
CREATE TABLE clientes (
    id_cliente    SERIAL PRIMARY KEY,
    usuario_id    INT UNIQUE REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    nombre        VARCHAR(100) NOT NULL,
    tipo_documento VARCHAR(20) DEFAULT 'CC',
    documento     VARCHAR(20)  UNIQUE NOT NULL,
    telefono      VARCHAR(20),
    email         VARCHAR(100),
    direccion     VARCHAR(150),
    estado        VARCHAR(10)  DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO'))
);

-- =========================================
-- PROVEEDORES
-- =========================================
CREATE TABLE proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    empleado_id  INT NOT NULL REFERENCES empleados(id_empleado),
    nombre       VARCHAR(100) NOT NULL,
    direccion    VARCHAR(150),
    telefono     VARCHAR(20),
    email        VARCHAR(100),
    estado       VARCHAR(10)  DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO'))
);

-- =========================================
-- CATEGORIAS
-- =========================================
CREATE TABLE categorias_insumo (
    id_categoria SERIAL PRIMARY KEY,
    nombre       VARCHAR(50) UNIQUE NOT NULL,
    estado       VARCHAR(10) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO'))
);

CREATE TABLE categorias_producto (
    id_categoria SERIAL PRIMARY KEY,
    nombre       VARCHAR(50) UNIQUE NOT NULL,
    estado       VARCHAR(10) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO'))
);

-- =========================================
-- INSUMOS
-- =========================================
CREATE TABLE insumos (
    id_insumo       SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) UNIQUE NOT NULL,
    categoria_id    INT NOT NULL REFERENCES categorias_insumo(id_categoria),
    unidad_medida   VARCHAR(20),
    stock_actual    DECIMAL(10,2) DEFAULT 0,
    stock_minimo    DECIMAL(10,2) DEFAULT 0,
    precio_unitario DECIMAL(10,2),
    estado          VARCHAR(10)  DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO'))
);

-- =========================================
-- PRODUCTOS
-- =========================================
CREATE TABLE productos (
    id_producto     SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) UNIQUE NOT NULL,
    categoria_id    INT NOT NULL REFERENCES categorias_producto(id_categoria),
    precio          DECIMAL(10,2) NOT NULL,
    stock_producto  DECIMAL(10,2) DEFAULT 0,
    estado          VARCHAR(10)  DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO'))
);

-- RECETA (BOM)
CREATE TABLE detalle_producto (
    id_detalle_producto SERIAL PRIMARY KEY,
    producto_id         INT NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
    insumo_id           INT NOT NULL REFERENCES insumos(id_insumo),
    cantidad_requerida  DECIMAL(10,2) NOT NULL,
    UNIQUE(producto_id, insumo_id)
);

-- =========================================
-- COMPRAS
-- =========================================
CREATE TABLE compras (
    id_compra        SERIAL PRIMARY KEY,
    proveedor_id     INT NOT NULL REFERENCES proveedores(id_proveedor),
    empleado_id      INT NOT NULL REFERENCES empleados(id_empleado),
    fecha_compra     TIMESTAMP   DEFAULT NOW(),
    numero_factura   VARCHAR(50) UNIQUE NOT NULL,
    foto_comprobante VARCHAR(255),
    estado           VARCHAR(15) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','ANULADA')),
    total_compra     DECIMAL(10,2) NOT NULL
);

CREATE TABLE detalle_compra (
    id_detalle      SERIAL PRIMARY KEY,
    compra_id       INT NOT NULL REFERENCES compras(id_compra) ON DELETE CASCADE,
    insumo_id       INT NOT NULL REFERENCES insumos(id_insumo),
    cantidad        DECIMAL(10,2) NOT NULL,
    contenido       DECIMAL(10,2) NOT NULL DEFAULT 1,
    stock_ingresado DECIMAL(10,2) NOT NULL DEFAULT 0,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal        DECIMAL(10,2) NOT NULL
);

-- =========================================
-- PRODUCCION
-- =========================================
CREATE TABLE produccion (
    id_produccion    SERIAL PRIMARY KEY,
    empleado_id      INT NOT NULL REFERENCES empleados(id_empleado),
    fecha            TIMESTAMP   DEFAULT NOW(),
    estado           VARCHAR(15) DEFAULT 'REGISTRADA' CHECK (estado IN ('REGISTRADA','ANULADA')),
    motivo_anulacion VARCHAR(255)
);

CREATE TABLE detalle_produccion (
    id_detalle    SERIAL PRIMARY KEY,
    produccion_id INT NOT NULL REFERENCES produccion(id_produccion) ON DELETE CASCADE,
    producto_id   INT NOT NULL REFERENCES productos(id_producto),
    cantidad      DECIMAL(10,2) NOT NULL
);

-- =========================================
-- SALIDA DE INSUMOS
-- =========================================
CREATE TABLE salida_insumos (
    id_salida   SERIAL PRIMARY KEY,
    empleado_id INT NOT NULL REFERENCES empleados(id_empleado),
    fecha       TIMESTAMP   DEFAULT NOW(),
    motivo      VARCHAR(255),
    estado      VARCHAR(15) DEFAULT 'REGISTRADA' CHECK (estado IN ('REGISTRADA','ANULADA'))
);

CREATE TABLE detalle_salida_insumos (
    id_detalle SERIAL PRIMARY KEY,
    salida_id  INT NOT NULL REFERENCES salida_insumos(id_salida) ON DELETE CASCADE,
    insumo_id  INT NOT NULL REFERENCES insumos(id_insumo),
    cantidad   DECIMAL(10,2) NOT NULL
);

-- =========================================
-- PEDIDOS
-- =========================================
CREATE TABLE pedidos (
    id_pedido   SERIAL PRIMARY KEY,
    cliente_id  INT NOT NULL REFERENCES clientes(id_cliente),
    empleado_id INT NOT NULL REFERENCES empleados(id_empleado),
    fecha       TIMESTAMP   DEFAULT NOW(),
    estado      VARCHAR(15) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','CONFIRMADO','ANULADO')),
    total       DECIMAL(10,2) NOT NULL
);

CREATE TABLE detalle_pedido (
    id_detalle  SERIAL PRIMARY KEY,
    pedido_id   INT NOT NULL REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
    producto_id INT NOT NULL REFERENCES productos(id_producto),
    cantidad    DECIMAL(10,2) NOT NULL,
    precio      DECIMAL(10,2) NOT NULL,
    subtotal    DECIMAL(10,2) NOT NULL
);

-- =========================================
-- VENTAS
-- =========================================
CREATE TABLE ventas (
    id_venta    SERIAL PRIMARY KEY,
    pedido_id   INT REFERENCES pedidos(id_pedido),
    empleado_id INT NOT NULL REFERENCES empleados(id_empleado),
    fecha       TIMESTAMP     DEFAULT NOW(),
    total       DECIMAL(10,2) NOT NULL,
    abonado     DECIMAL(10,2) DEFAULT 0 CHECK (abonado >= 0),
    estado      VARCHAR(15)   DEFAULT 'REGISTRADA' CHECK (estado IN ('REGISTRADA','ANULADA'))
);
-- saldo como columna generada (equivalente al PERSISTED de SQL Server)
ALTER TABLE ventas ADD COLUMN saldo DECIMAL(10,2) GENERATED ALWAYS AS (total - abonado) STORED;

CREATE TABLE detalle_venta (
    id_detalle  SERIAL PRIMARY KEY,
    venta_id    INT NOT NULL REFERENCES ventas(id_venta) ON DELETE CASCADE,
    producto_id INT NOT NULL REFERENCES productos(id_producto),
    cantidad    DECIMAL(10,2) NOT NULL,
    precio      DECIMAL(10,2) NOT NULL,
    subtotal    DECIMAL(10,2) NOT NULL
);

-- =========================================
-- ABONOS
-- =========================================
-- Agrego metodo_pago que el frontend usa pero no estaba en el DDL original
CREATE TABLE abonos (
    id_abono      SERIAL PRIMARY KEY,
    venta_id      INT NOT NULL REFERENCES ventas(id_venta),
    empleado_id   INT NOT NULL REFERENCES empleados(id_empleado),
    numero_cuota  INT NOT NULL CHECK (numero_cuota BETWEEN 1 AND 3),
    fecha         TIMESTAMP     DEFAULT NOW(),
    valor         DECIMAL(10,2) NOT NULL CHECK (valor > 0),
    metodo_pago   VARCHAR(30)   DEFAULT 'Efectivo'
                  CHECK (metodo_pago IN ('Efectivo','Transferencia','Tarjeta débito','Tarjeta crédito','Nequi','Daviplata')),
    estado        VARCHAR(15)   DEFAULT 'REGISTRADO' CHECK (estado IN ('REGISTRADO','ANULADO')),
    UNIQUE(venta_id, numero_cuota)
);

-- =========================================
-- DOMICILIOS
-- =========================================
CREATE TABLE domicilios (
    id_domicilio SERIAL PRIMARY KEY,
    pedido_id    INT NOT NULL REFERENCES pedidos(id_pedido),
    empleado_id  INT NOT NULL REFERENCES empleados(id_empleado),
    direccion    VARCHAR(150),
    ciudad       VARCHAR(100),
    referencia   VARCHAR(150),
    estado       VARCHAR(15) DEFAULT 'PENDIENTE'
                 CHECK (estado IN ('PENDIENTE','EN_CAMINO','ENTREGADO','CANCELADO'))
);

-- =========================================
-- DATOS INICIALES
-- =========================================
INSERT INTO roles (nombre, descripcion) VALUES
  ('Administrador', 'Acceso total al sistema'),
  ('Panadero',      'Gestión de producción e insumos'),
  ('Repartidor',    'Gestión de domicilios y pedidos'),
  ('Cliente',       'Acceso a la tienda en línea');

INSERT INTO permisos (nombre, descripcion) VALUES
  ('VER_DASHBOARD',     'Ver métricas del dashboard'),
  ('GESTIONAR_USUARIOS','Crear y editar usuarios'),
  ('GESTIONAR_VENTAS',  'Registrar y anular ventas'),
  ('GESTIONAR_COMPRAS', 'Registrar y anular compras'),
  ('GESTIONAR_PRODUCCION','Registrar producción'),
  ('GESTIONAR_PEDIDOS', 'Gestionar pedidos'),
  ('GESTIONAR_DOMICILIOS','Gestionar domicilios');

-- Administrador tiene todos los permisos
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 1, id_permiso FROM permisos;

-- Panadero: compras, producción
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 2, id_permiso FROM permisos
WHERE nombre IN ('GESTIONAR_COMPRAS','GESTIONAR_PRODUCCION');

-- Repartidor: pedidos, domicilios
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 3, id_permiso FROM permisos
WHERE nombre IN ('GESTIONAR_PEDIDOS','GESTIONAR_DOMICILIOS');