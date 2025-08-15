# Artiako Landak

Artiako Landak es un juego de tablero que combina economía, subastas y roles opcionales. Cada partida puede configurarse con jugadores humanos y bots, módulos como mercado de deuda, roles ocultos o eventos especiales, y un tablero lleno de grupos de propiedades, transportes, impuestos y casillas de cárcel.

## Preparación de la partida
1. Pulsa **"Nueva partida"** y define cuántos humanos, bots y el capital inicial.
2. Cada jugador se crea con género, posición inicial y capital; si el módulo de roles está activo se asigna uno secreto y se habilitan casillas y eventos especiales.
3. El tablero incluye propiedades, impuestos, transportes (metros, buses, ferrys, aeropuertos), eventos, cárcel e **Ir a la cárcel**.

## Secuencia de turno y acciones
- Durante tu turno presiona **Tirar dados** (o la tecla **R**) y mueve tu ficha.
- Las acciones disponibles aparecerán en el panel: **Terminar turno**, **Prestar dinero**, **Construir**, **Vender casa**, **Hipotecar**, **Levantar hipoteca**, **Mi Balance** e **Insider** cuando corresponda.
- Los atajos de teclado agilizan algunas de estas acciones (R, E, A, L, S).

## Reglas principales
1. **Impuesto:** pagas el 33 % de las ganancias acumuladas desde tu último tributo.
2. **Eliminación y liquidación:** un jugador con saldo negativo queda eliminado y todas sus propiedades pasan al jugador que lo ha eliminado. Las propiedades mantienen cualquier hipoteca, los edificios se venden automáticamente y la venta es forzada antes de la transferencia.
3. **Subastas:** todas las compras de propiedades y eventos se resuelven mediante subasta.
4. **Construcción:** edificar casas u hoteles cuesta dinero que se paga al Estado.

## Módulos opcionales
- **GameDebtMarket:** subastas visibles, subastas selladas para eventos y un mercado de préstamos P2P que puede subastarse.
- **GameRiskPlus:** llamadas de margen cuando un deudor queda por debajo de un umbral de efectivo, cartas **Insider** para conocer y fijar el próximo evento, IA predadora y mantenimiento dinámico según monopolios de color.
- **GameExtras:** subasta paquetes de casillas libres, aplica costes de mantenimiento a tiles premium, detecta colusión, ofrece bots con distintos perfiles y un panel **Mi balance**.
- **Roles y política:** roles secretos como proxeneta o FBI, gobierno que modifica impuestos e intereses, banca corrupta, juez IA y votaciones.

## Atajos de teclado
- **R**: tirar dados
- **E**: terminar turno
- **A**: iniciar subasta
- **L**: cargar partida
- **S**: guardar partida

## Juego en línea
Desde esta versión se incluye un modo P2P básico con chat integrado. Usa **Compartir** para actuar como anfitrión (J1) y se generará un enlace que podrás enviar. Tus amigos pueden abrirlo y pulsar **Unirse** para conectarse como J2, J3, etc. El chat permite enviar mensajes rápidos entre jugadores durante la partida.

## Desarrollo
- `js/utils/overlay.js` permite alternar la visibilidad del overlay mediante teclado.
  El parámetro opcional `toggleKey` (por defecto `F2`) define la tecla usada. El overlay
  no se ocultará mientras haya una subasta activa para evitar interferencias.

- El antiguo prototipo `mono_jail_dados.html` se integró en `index.html`, por lo que se eliminó el archivo redundante.
