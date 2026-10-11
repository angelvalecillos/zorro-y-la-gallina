# Zorro y la Gallina — juego venezolano

Juego de mesa tradicional venezolano (2 zorros vs 20 gallinas) en **HTML5 puro** (sin dependencias).

## Jugar en PC

Abre `index.html` en cualquier navegador moderno (Chrome, Edge, Firefox). No necesita servidor ni internet.

- Click para seleccionar ficha y destino.
- Atajos: `R` reiniciar, `M` menú.

## Subir a minijuegos.com

1. Comprime el contenido de esta carpeta en un ZIP con `index.html` en la raíz:
   - `index.html`, `style.css`, `game.js`
2. En minijuegos.com → publicar juego HTML5 → sube el ZIP.
3. Requisitos cumplidos:
   - Sin librerías externas, sin backend, sin `fetch`.
   - Responsive (PC + móvil) con `<meta viewport>`.
   - Canvas escalable, funciona con ratón y táctil (Pointer Events).
   - Pausa/menú/reinicio incluidos.

Tamaño recomendado del canvas: 960×640 o responsive. El juego ya escala solo.

## Crear versiones Android / iPhone después

El juego es web estándar, se envuelve sin reescribir:

**Opción recomendada: Capacitor**
```bash
npm i @capacitor/core @capacitor/cli
npx cap init "ZorroGallina" com.tuestudio.zorrogallina
# copia esta carpeta como `www/`
npx cap add android
npx cap add ios
npx cap sync
# abrir en Android Studio / Xcode y publicar
```

**Alternativa:** Cordova, o PWA (añadir `manifest.json` + service worker).

No se usa `localStorage` sensible ni plugins: compatible directo.

## Reglas implementadas

- Tablero en cruz de **33 intersecciones** (7×7 sin esquinas de 2×2). Gallinero = 9 intersecciones superiores (`x=2..4, y=0..2`).
- **Posición inicial:** zorros en las esquinas del gallinero `(2,2)` y `(4,2)`. 20 gallinas en `y>=3` (filas `y=3:7, y=4:7, y=5:3, y=6:3`). 7 casillas vacías en el gallinero.
- **Gallinas:** 1 casilla por turno hacia adelante (norte, `dy<=0`), de lado o en diagonal delantera. Nunca retroceden. No capturan. Empiezan ellas.
- **Zorros:** 1 casilla en cualquier dirección (8 direcciones según líneas del tablero). Capturan saltando **una** gallina a casilla vacía justo detrás, en línea recta. **No puede saltar dos gallinas seguidas.** Capturas múltiples en cadena obligatorias (debe seguir saltando si puede).
- **Soplo:** si un zorro podía capturar y juega sin capturar, en el turno de las gallinas aparece el botón **¡Soplar!** que lo saca del tablero **hasta el final** (sin retorno). Si soplan a los dos, ganan las gallinas.
- **Ganan zorros:** si quedan **8 o menos gallinas**.
- **Ganan gallinas:** si ocupan las **9 casillas del gallinero** o **inmovilizan por completo** a los zorros (sin movimientos ni capturas).
- Diagonales solo donde hay línea dibujada (dentro de bloques 3×3, no a través de las esquinas recortadas de la cruz).
