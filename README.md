Visión general
Este repositorio contiene una aplicación web llamada Artiako Landak. No usa frameworks ni empaquetadores: todo se ejecuta en el navegador a partir de un único index.html que carga múltiples ficheros JavaScript.

Estructura de carpetas y archivos principales
index.html
Página principal. Define el tablero, estilos base y componentes del panel de control. Es el punto de entrada que incluye todos los scripts.

Serie v20-part*.js (núcleo del juego)
Se cargan en orden para formar el motor principal:

v20-part2.js: Renderizado del tablero (DOM, colocación de casillas y fichas).

v20-part3.js: Definición del tablero; aquí se enumeran casillas, precios y familias.

v20-part4.js: Gestión económica básica (jugadores, dinero, IVA, banca).

v20-part5.js: Dados, movimiento de jugadores, turnos y lógica de tiradas.

v20-part6.js: Reglas al caer en cada casilla (impuestos, subastas, cárcel…).

v20-part7.js: Acciones del propietario (construir, vender, hipotecas, préstamos).

v20-part8.js: Sistema de eventos/cartas y minijuegos adicionales.

Scripts complementarios v20
v20-debug.js, v20-rename.js, v20-casino-ani.js… aportan utilidades o efectos específicos.

Módulos “v21” (add-ons opcionales)

auction+debt-market-v21.js: Mercado de deuda con subastas visibles o selladas y correcciones al sistema de subastas.

v_21_ui_graphics.js: Mejora visual (heatmap de casillas, iconografía, tickets de deuda, panel de balance).

v_21_extras_bundles_bots.js: Bundles de propiedades, mantenimiento premium, anti‑abuso y bots de subasta.

v_21_risk_insider_bots_maint.js: Margin calls, carta “Insider”, IA agresiva y mantenimiento dinámico.

v_21_securitization.js: Fraccionamiento de préstamos, pools y securitización de deuda.

Conceptos clave para orientarse
Estado global
Variables como state, TILES, BoardUI, Estado (la banca) se definen en los diferentes módulos y se comparten globalmente.

Flujo de turnos
v20-part5.js controla lanzamiento de dados, movimiento y fin de turno; muchas extensiones se enganchan a estas funciones.

Propiedades y acciones
v20-part7.js maneja construcción, venta, hipotecas y préstamos, incluyendo reglas como construcción pareja y control del banco.

Eventos y economía avanzada
v20-part8.js y los módulos v21 añaden efectos temporales, mercado de deuda, subastas de bundles, riesgos de margen, etc.

Recomendaciones para nuevos colaboradores
Arrancar el juego en el navegador
Abre index.html para ver cómo se ensamblan los scripts y cómo se ve el tablero.

Revisar los módulos en orden
Leer v20-part2.js → v20-part8.js ayuda a comprender el flujo completo (UI → definición de casillas → economía → movimiento → eventos).

Entender las variables globales
Localiza dónde se definen y modifican state, TILES, Estado, BoardUI y sus funciones asociadas (por ejemplo, renderBoard, onLand, renderPlayers).

Explorar los add-ons v21
Una vez dominado el núcleo, revisa módulos como auction+debt-market-v21.js y v_21_risk_insider_bots_maint.js para ver cómo se amplía la mecánica con préstamos, securitización o IA.

Próximos pasos de aprendizaje

Práctica con manipulación del DOM y eventos en JavaScript puro.

Técnicas de arquitectura modular (cómo dividir y reutilizar lógica sin frameworks).

Conceptos de economía y finanzas aplicados a juegos (subastas, préstamos, securitización).

Opcional: introducir herramientas modernas (bundlers, tests) si se busca mantenimiento a largo plazo.

Con esta visión, un nuevo integrante puede orientarse rápidamente en el código y decidir qué parte estudiar o extender según sus intereses.

Ejecución de pruebas
--------------------
Se han añadido tests básicos empleando el *test runner* integrado en Node.js. Para ejecutarlos, asegúrate de tener Node >= 18 y después ejecuta:

```
npm test
```

